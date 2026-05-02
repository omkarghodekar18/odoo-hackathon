import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import {
  HiOutlineClock,
  HiOutlineLogout,
  HiOutlineLogin,
  HiOutlineCalendar,
  HiOutlineRefresh,
  HiOutlineCheckCircle,
} from 'react-icons/hi';

/* ─────────────────────────────────── helpers ──────────────────────────────── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtHours(hours) {
  if (hours == null || hours === 0) return '0h 0m';
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

/** Compute status from total hours (including lunch) */
function computeStatus(totalHours) {
  if (totalHours >= 8) return 'present';
  if (totalHours >= 4) return 'half_day';
  return 'absent';
}

/* Live working-hours hook: recalculates total hours every second when checked in */
function useLiveHours(checkInTimeISO, serverRawHours, isActive) {
  const [liveRawHours, setLiveRawHours] = useState(serverRawHours || 0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!isActive || !checkInTimeISO) {
      setLiveRawHours(serverRawHours || 0);
      return;
    }

    // When active, compute elapsed from check-in time + any previous completed session hours
    // serverRawHours already includes elapsed at time of API call, but we want live updates
    const tick = () => {
      const now = Date.now();
      const checkInMs = new Date(checkInTimeISO).getTime();
      const elapsedHours = (now - checkInMs) / 3600000;
      // serverRawHours includes the active session elapsed at request time
      // We need the base hours (completed sessions only) + live elapsed
      // The server sends raw_working_hours which includes current elapsed
      // So we just recompute from check-in time for the active session
      // plus any completed session time (which is serverRawHours minus server-calculated elapsed)
      setLiveRawHours(Math.max(elapsedHours, 0));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [checkInTimeISO, serverRawHours, isActive]);

  return liveRawHours;
}

/* ─────────────────────────────────── main component ──────────────────────────── */

export default function Attendance() {
  const { user } = useAuth();
  const [todayStatus, setTodayStatus] = useState(null);
  const [records, setRecords] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const isEmployee = user.role === 'employee';

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

  const handleCheckIn = async () => {
    try {
      await API.post('/attendance/login');
      window.dispatchEvent(new Event('attendance-updated'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckOut = async () => {
    try {
      await API.post('/attendance/logout');
      window.dispatchEvent(new Event('attendance-updated'));
    } catch (err) {
      console.error(err);
    }
  };

  // Re-fetch when the user checks in/out from navbar
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener('attendance-updated', handler);
    return () => window.removeEventListener('attendance-updated', handler);
  }, [fetchData]);

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;

  const isActive = todayStatus?.is_logged_in;
  const checkInTime = todayStatus?.check_in_time;
  const checkOutTime = todayStatus?.check_out_time;
  const serverRawHours = todayStatus?.raw_working_hours || 0;
  const hasWorkedToday = !!checkInTime;

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

      {/* ── Today's Info Card ── */}
      <TodayInfoCard
        isActive={isActive}
        checkInTime={checkInTime}
        checkOutTime={checkOutTime}
        serverRawHours={serverRawHours}
        hasWorkedToday={hasWorkedToday}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
      />

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
              <th>Check In</th>
              <th>Check Out</th>
              <th>Total Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(isEmployee ? records : allRecords).map(r => (
              <tr key={r.id}>
                {!isEmployee && (
                  <>
                    <td><strong>{r.employee_name}</strong></td>
                    <td><code>{r.emp_code}</code></td>
                  </>
                )}
                <td>{fmtDate(r.date)}</td>
                <td>
                  <span className="checkin-time">{fmtTime(r.check_in_time)}</span>
                </td>
                <td>
                  <span className="checkout-time">{fmtTime(r.check_out_time)}</span>
                </td>
                <td>
                  <span className="hours-badge">{fmtHours(r.total_hours)}</span>
                </td>
                <td><span className={statusClass(r.status)}>{statusLabel(r.status)}</span></td>
              </tr>
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

/* ─────────────────────── Today Info Card (display only) ─────────────────────── */

function TodayInfoCard({ isActive, checkInTime, checkOutTime, serverRawHours, hasWorkedToday, onCheckIn, onCheckOut }) {
  // Live-compute working hours when checked in
  const liveRawHours = useLiveHours(
    isActive ? checkInTime : null,
    serverRawHours,
    isActive
  );

  const rawHours = isActive ? liveRawHours : serverRawHours;
  const totalHours = rawHours >= 4 ? rawHours + 1.0 : rawHours;
  const liveStatus = hasWorkedToday ? computeStatus(totalHours) : null;

  return (
    <div className={`attendance-today-card ${isActive ? 'attendance-today-card--active' : ''} ${checkOutTime ? 'attendance-today-card--done' : ''}`}>
      <div className="attendance-today-card__left">
        {/* Date */}
        <div className="attendance-today-card__date">
          <HiOutlineCalendar />
          <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>

      {/* Working Hours Summary */}
      <div className="attendance-hours-summary">
        <div className="attendance-hours-summary__main">
          <HiOutlineClock className="attendance-hours-summary__icon" />
          <div>
            <span className="attendance-hours-summary__value">{fmtHours(totalHours)}</span>
            <span className="attendance-hours-summary__label">Total Working Hours</span>
          </div>
        </div>
        {rawHours >= 4 && (
          <div className="attendance-hours-summary__breakdown">
            <span className="attendance-hours-summary__raw">{fmtHours(rawHours)} worked</span>
            <span className="attendance-hours-summary__lunch">+ 1h lunch break</span>
          </div>
        )}
      </div>

      {/* Check-in / Check-out / Status row */}
      <div className="attendance-times-row">
        <div className="attendance-time-block">
          <HiOutlineLogin className="attendance-time-block__icon attendance-time-block__icon--in" />
          <div>
            <span className="attendance-time-block__label">Check In</span>
            <span className="attendance-time-block__value">{checkInTime ? fmtTime(checkInTime) : '—'}</span>
          </div>
        </div>
        <div className="attendance-time-block__separator" />
        <div className="attendance-time-block">
          <HiOutlineLogout className="attendance-time-block__icon attendance-time-block__icon--out" />
          <div>
            <span className="attendance-time-block__label">Check Out</span>
            <span className="attendance-time-block__value">
              {checkOutTime ? fmtTime(checkOutTime) : (isActive ? 'In Progress' : '—')}
            </span>
          </div>
        </div>
        <div className="attendance-time-block__separator" />
        <div className="attendance-time-block">
          <HiOutlineCheckCircle className="attendance-time-block__icon attendance-time-block__icon--status" />
          <div>
            <span className="attendance-time-block__label">Status</span>
            {liveStatus
              ? <span className={statusClass(liveStatus)}>{statusLabel(liveStatus)}</span>
              : <span className="badge badge--secondary">No Record</span>
            }
          </div>
        </div>
      </div>

        {/* Active indicator */}
        {isActive && (
          <div className="attendance-live-indicator">
            <div className="attendance-live-indicator__pulse" />
            <span>You are currently working — hours updating live</span>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="attendance-today-card__right">
        {isActive && (
          <button
            className="btn btn--warning btn--lg attendance-check-btn"
            onClick={onCheckOut}
          >
            <HiOutlineLogout /> Check Out
          </button>
        )}
      </div>
    </div>
  );
}
