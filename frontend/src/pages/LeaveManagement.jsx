import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineCheck, HiOutlineX } from 'react-icons/hi';

export default function LeaveManagement() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balance, setBalance] = useState([]);
  const [showApply, setShowApply] = useState(false);
  const [form, setForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const canApprove = ['admin', 'payroll_officer'].includes(user.role);

  useEffect(() => { fetchData(); }, [filter]);

  const fetchData = async () => {
    try {
      const [reqRes, typesRes] = await Promise.all([
        API.get(`/leave/requests${filter ? `?status_filter=${filter}` : ''}`),
        API.get('/leave/types'),
      ]);
      setRequests(reqRes.data);
      setLeaveTypes(typesRes.data);
      try { const balRes = await API.get('/leave/balance'); setBalance(balRes.data); } catch {}
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    try {
      await API.post('/leave/apply', { ...form, leave_type_id: parseInt(form.leave_type_id) });
      toast.success('Leave applied!');
      setShowApply(false);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAction = async (id, action) => {
    try {
      await API.put(`/leave/requests/${id}/${action}`);
      toast.success(`Leave ${action}d`);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const statusBadge = (s) => {
    const map = { pending: 'badge--warning', approved: 'badge--success', rejected: 'badge--danger' };
    return <span className={`badge ${map[s]}`}>{s}</span>;
  };

  const update = (f) => (e) => setForm({ ...form, [f]: e.target.value });

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Time Off Management</h2>
        <div className="page-header__actions">
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {user.role === 'employee' && <button className="btn btn--primary" onClick={() => setShowApply(true)}><HiOutlinePlus /> Apply Leave</button>}
        </div>
      </div>

      {/* Leave balance cards */}
      {balance.length > 0 && (
        <div className="leave-balance-grid">
          {balance.map(b => (
            <div key={b.id} className="leave-balance-card">
              <h4>{b.leave_type_name}</h4>
              <div className="leave-balance-card__stats">
                <div><span className="leave-balance-card__number">{b.allocated}</span><span>Allocated</span></div>
                <div><span className="leave-balance-card__number" style={{ color: '#f59e0b' }}>{b.used}</span><span>Used</span></div>
                <div><span className="leave-balance-card__number" style={{ color: '#10b981' }}>{b.remaining}</span><span>Remaining</span></div>
              </div>
              <div className="leave-balance-card__bar">
                <div style={{ width: `${(b.used / b.allocated) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leave requests table */}
      <div className="table-card">
        <table className="table">
          <thead>
            <tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Reason</th><th>Status</th>{canApprove && <th>Actions</th>}</tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id}>
                <td>{r.employee_name}</td>
                <td>{r.leave_type_name}</td>
                <td>{r.start_date}</td>
                <td>{r.end_date}</td>
                <td>{r.reason || '—'}</td>
                <td>{statusBadge(r.status)}</td>
                {canApprove && (
                  <td>
                    {r.status === 'pending' && (
                      <div className="action-btns">
                        <button className="icon-btn icon-btn--success" onClick={() => handleAction(r.id, 'approve')}><HiOutlineCheck /></button>
                        <button className="icon-btn icon-btn--danger" onClick={() => handleAction(r.id, 'reject')}><HiOutlineX /></button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 && <div className="empty-state"><p>No leave requests</p></div>}
      </div>

      {showApply && (
        <div className="modal-overlay" onClick={() => setShowApply(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Apply for Leave</h3>
            <form onSubmit={handleApply}>
              <div className="form-group"><label>Leave Type</label>
                <select value={form.leave_type_id} onChange={update('leave_type_id')} required>
                  <option value="">Select type...</option>
                  {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Start Date</label><input type="date" value={form.start_date} onChange={update('start_date')} required /></div>
                <div className="form-group"><label>End Date</label><input type="date" value={form.end_date} onChange={update('end_date')} required /></div>
              </div>
              <div className="form-group"><label>Reason</label><textarea value={form.reason} onChange={update('reason')} rows={3} /></div>
              <div className="modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setShowApply(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
