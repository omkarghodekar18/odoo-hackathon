import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import toast from 'react-hot-toast';
import { HiOutlineClock, HiOutlineLogout as HiLogout } from 'react-icons/hi';

export default function Attendance() {
  const { user } = useAuth();
  const [todayStatus, setTodayStatus] = useState(null);
  const [records, setRecords] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const isEmployee = user.role === 'employee';

  useEffect(() => { fetchData(); }, [month, year]);

  const fetchData = async () => {
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
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCheckIn = async () => {
    try {
      await API.post('/attendance/check-in');
      toast.success('Checked in!');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Check-in failed'); }
  };

  const handleCheckOut = async () => {
    try {
      await API.post('/attendance/check-out');
      toast.success('Checked out!');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Check-out failed'); }
  };

  const statusBadge = (s) => {
    const map = { present: 'badge--success', absent: 'badge--danger', half_day: 'badge--warning', on_leave: 'badge--info' };
    return <span className={`badge ${map[s] || ''}`}>{s.replace('_', ' ')}</span>;
  };

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Attendance</h2>
        <div className="page-header__actions">
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Check-in/out section */}
      <div className="attendance-action-card">
        <div className="attendance-action-card__info">
          <h3>Today's Attendance</h3>
          <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          {todayStatus?.record && (
            <div className="attendance-action-card__details">
              <span>Check-in: {todayStatus.record.check_in || '—'}</span>
              <span>Check-out: {todayStatus.record.check_out || '—'}</span>
              <span>Status: {statusBadge(todayStatus.record.status)}</span>
            </div>
          )}
        </div>
        <div className="attendance-action-card__btns">
          {!todayStatus?.checked_in && <button className="btn btn--success" onClick={handleCheckIn}><HiOutlineClock /> Check In</button>}
          {todayStatus?.checked_in && !todayStatus?.checked_out && <button className="btn btn--warning" onClick={handleCheckOut}><HiLogout /> Check Out</button>}
          {todayStatus?.checked_out && <span className="badge badge--success" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>✓ Day Complete</span>}
        </div>
      </div>

      {/* Records table */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              {!isEmployee && <><th>Employee</th><th>Code</th></>}
              <th>Date</th><th>Check In</th><th>Check Out</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(isEmployee ? records : allRecords).map(r => (
              <tr key={r.id}>
                {!isEmployee && <><td>{r.employee_name}</td><td>{r.emp_code}</td></>}
                <td>{r.date}</td>
                <td>{r.check_in || '—'}</td>
                <td>{r.check_out || '—'}</td>
                <td>{statusBadge(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(isEmployee ? records : allRecords).length === 0 && <div className="empty-state"><p>No attendance records found</p></div>}
      </div>
    </div>
  );
}
