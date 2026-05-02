import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import toast from 'react-hot-toast';
import {
  HiOutlineClock,
  HiOutlineLogout,
  HiOutlineLogin,
  HiOutlineCalendar,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineRefresh,
} from 'react-icons/hi';

/* ─────────────────────────────────── helpers ──────────────────────────────── */

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDuration(minutes) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

function fmtHours(hours) {
  if (hours == null) return '0h 0m';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

function statusClass(s) {
  const map = {
    present: 'badge--success',
    absent: 'badge--danger',
    half_day: 'badge--warning',
    on_leave: 'badge--info',
  };
  return `badge ${map[s] || ''}`;
}

function statusLabel(s) {
  const map = {
    present: 'Present',
    absent: 'Absent',
    half_day: 'Half Day',
    on_leave: 'On Leave',
  };
  return map[s] || s;
}

/* Live elapsed-time hook for an active session */
function useElapsed(loginTimeISO) {
  const [elapsed, setElapsed] = useState('');
  const rafRef = useRef(null);

  useEffect(() => {
    if (!loginTimeISO) { setElapsed(''); return; }
    const loginMs = new Date(loginTimeISO).getTime();

    const tick = () => {
      const diffMs = Date.now() - loginMs;
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      const s = Math.floor((diffMs % 60000) / 1000);
      setElapsed(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loginTimeISO]);

  return elapsed;
}

/* ─────────────────────────────────── subcomponents ──────────────────────────── */

function SessionsAccordion({ sessions }) {
  const [open, setOpen] = useState(false);
  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="sessions-accordion">
      <button
        className="sessions-accordion__toggle"
        onClick={() => setOpen(o => !o)}
      >
        <span>{sessions.length} session{sessions.length !== 1 ? 's' : ''} today</span>
        {open ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />}
      </button>
      {open && (
        <div className="sessions-accordion__body">
          {sessions.map((s, i) => (
            <div key={s.id} className="session-row">
              <span className="session-row__index">#{i + 1}</span>
              <span className="session-row__time">
                <HiOutlineLogin style={{ color: 'var(--color-success)' }} />
                {fmtTime(s.login_time)}
              </span>
              <span className="session-row__arrow">→</span>
              <span className="session-row__time">
                <HiOutlineLogout style={{ color: s.logout_time ? 'var(--color-warning)' : '#94a3b8' }} />
                {s.logout_time ? fmtTime(s.logout_time) : <em>active</em>}
              </span>
              <span className="session-row__dur">
                {s.duration_minutes != null ? fmtDuration(s.duration_minutes) : '…'}
              </span>
              {s.is_auto_closed && (
                <span className="badge badge--warning" style={{ fontSize: '0.65rem' }}>auto-closed</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────── main component ──────────────────────────── */

export default function Attendance() {
  const { user } = useAuth();
  const [todayStatus, setTodayStatus] = useState(null);
  const [records, setRecords] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const isEmployee = user.role === 'employee';

  const elapsed = useElapsed(todayStatus?.active_login_time || null);

  const fetchData = useCallback(async () => {
    try {
      const todayRes = await API.get('/attendance/today');
      setTodayStatus(todayRes.data);
      if (isEmployee) {
        const myRes = await API.get(`/attendance/my?month=${month}&year=${year}`);
        setRecords(myRes.data);
      } else {
        const allRes = await API.get(`/attendance/all?month=${month}&year=${year}`);
        setAllRecords(allRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [month, year, isEmployee]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLogin = async () => {
    setActionLoading(true);
    try {
      await API.post('/attendance/login');
      toast.success('Session started — you are now clocked in!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    setActionLoading(true);
    try {
      await API.post('/attendance/logout');
      toast.success('Session ended — clocked out successfully!');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to end session');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;

  const summary = todayStatus?.summary;
  const isActive = todayStatus?.is_logged_in;
  const sessions = todayStatus?.sessions || [];

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="page-header">
        <h2>Attendance</h2>
        <div className="page-header__actions">
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn--ghost btn--sm" onClick={fetchData} title="Refresh">
            <HiOutlineRefresh />
          </button>
        </div>
      </div>

      {/* ── Today's panel ── */}
      <div className={`attendance-action-card ${isActive ? 'attendance-action-card--active' : ''}`}>
        <div className="attendance-action-card__info">
          <div className="attendance-action-card__date">
            <HiOutlineCalendar />
            <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>

          {/* Live timer when active */}
          {isActive && (
            <div className="attendance-timer">
              <span className="attendance-timer__label">Current session</span>
              <span className="attendance-timer__clock">{elapsed || '00:00:00'}</span>
              <span className="attendance-timer__since">since {fmtTime(todayStatus.active_login_time)}</span>
            </div>
          )}

          {/* Daily stats */}
          <div className="attendance-stats-row">
            <div className="attendance-stat">
              <span className="attendance-stat__val">{fmtHours(summary?.total_hours)}</span>
              <span className="attendance-stat__lbl">Total Today</span>
            </div>
            <div className="attendance-stat">
              <span className="attendance-stat__val">{sessions.length}</span>
              <span className="attendance-stat__lbl">Sessions</span>
            </div>
            <div className="attendance-stat">
              {summary
                ? <span className={statusClass(summary.status)}>{statusLabel(summary.status)}</span>
                : <span className="badge badge--secondary">No Record</span>
              }
              <span className="attendance-stat__lbl">Status</span>
            </div>
          </div>

          {/* Session accordion */}
          <SessionsAccordion sessions={sessions} />
        </div>

        {/* Action buttons */}
        <div className="attendance-action-card__btns">
          {!isActive ? (
            <button
              className="btn btn--success btn--lg"
              onClick={handleLogin}
              disabled={actionLoading}
            >
              <HiOutlineLogin />
              {actionLoading ? 'Starting…' : 'Clock In'}
            </button>
          ) : (
            <button
              className="btn btn--warning btn--lg"
              onClick={handleLogout}
              disabled={actionLoading}
            >
              <HiOutlineLogout />
              {actionLoading ? 'Ending…' : 'Clock Out'}
            </button>
          )}
          <p className="attendance-action-card__hint">
            {isActive
              ? 'You are currently clocked in. Clock out when done.'
              : 'Click Clock In to start tracking your work session.'}
          </p>
        </div>
      </div>

      {/* ── Status legend ── */}
      <div className="attendance-legend">
        <div className="attendance-legend__item">
          <span className="badge badge--success">Present</span>
          <span>≥ 8 hrs</span>
        </div>
        <div className="attendance-legend__item">
          <span className="badge badge--warning">Half Day</span>
          <span>4 – 8 hrs</span>
        </div>
        <div className="attendance-legend__item">
          <span className="badge badge--danger">Absent</span>
          <span>&lt; 4 hrs</span>
        </div>
        <div className="attendance-legend__item">
          <span className="badge badge--info">On Leave</span>
          <span>Approved leave</span>
        </div>
      </div>

      {/* ── Records table ── */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              {!isEmployee && <><th>Employee</th><th>Code</th></>}
              <th>Date</th>
              <th>Total Hours</th>
              <th>Sessions</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(isEmployee ? records : allRecords).map(r => (
              <>
                <tr key={r.id} className="table-row--clickable" onClick={() => !isEmployee && toggleRow(r.id)}>
                  {!isEmployee && (
                    <>
                      <td><strong>{r.employee_name}</strong></td>
                      <td><code>{r.emp_code}</code></td>
                    </>
                  )}
                  <td>{fmtDate(r.date)}</td>
                  <td>
                    <span className="hours-badge">{fmtHours(r.total_hours)}</span>
                  </td>
                  <td>
                    {isEmployee
                      ? <span className="sessions-count">{r.sessions?.length ?? '—'}</span>
                      : <span className="sessions-count">{r.sessions?.length ?? '—'}</span>
                    }
                  </td>
                  <td><span className={statusClass(r.status)}>{statusLabel(r.status)}</span></td>
                  <td>
                    {!isEmployee && (
                      <button
                        className="btn btn--ghost btn--xs"
                        onClick={e => { e.stopPropagation(); toggleRow(r.id); }}
                      >
                        {expandedRows[r.id] ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />}
                      </button>
                    )}
                  </td>
                </tr>
                {/* Session drill-down row for admins */}
                {!isEmployee && expandedRows[r.id] && r.sessions?.length > 0 && (
                  <tr key={`${r.id}-sessions`} className="session-drill-row">
                    <td colSpan={7}>
                      <div className="session-drill-body">
                        {r.sessions.map((s, i) => (
                          <div key={s.id} className="session-row">
                            <span className="session-row__index">#{i + 1}</span>
                            <span className="session-row__time">
                              <HiOutlineLogin style={{ color: 'var(--color-success)' }} />
                              {fmtTime(s.login_time)}
                            </span>
                            <span className="session-row__arrow">→</span>
                            <span className="session-row__time">
                              <HiOutlineLogout style={{ color: s.logout_time ? 'var(--color-warning)' : '#94a3b8' }} />
                              {s.logout_time ? fmtTime(s.logout_time) : <em>still open</em>}
                            </span>
                            <span className="session-row__dur">
                              {s.duration_minutes != null ? fmtDuration(s.duration_minutes) : '…'}
                            </span>
                            {s.is_auto_closed && (
                              <span className="badge badge--warning" style={{ fontSize: '0.65rem' }}>auto-closed</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {(isEmployee ? records : allRecords).length === 0 && (
          <div className="empty-state"><p>No attendance records found for the selected period</p></div>
        )}
      </div>
    </div>
  );
}
