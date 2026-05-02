import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineCheck, HiOutlineX, HiOutlineFilter, HiOutlineCollection, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';

export default function LeaveManagement() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balance, setBalance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showApply, setShowApply] = useState(false);
  const [showAllocate, setShowAllocate] = useState(false);
  const [showManageTypes, setShowManageTypes] = useState(false);
  const [showAddType, setShowAddType] = useState(false);
  const [form, setForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
  const [allocForm, setAllocForm] = useState({ employee_id: '', leave_type_id: '', allocated: '' });
  const [typeForm, setTypeForm] = useState({ name: '', max_days_per_year: '', description: '' });
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests');

  const isAdmin = ['admin', 'hr_officer'].includes(user?.role);
  const canApprove = isAdmin;

  useEffect(() => { fetchData(); }, [filterEmployee, filterType, filterStatus]);

  const fetchData = async () => {
    try {
      let reqUrl = '/leave/requests?';
      if (filterStatus) reqUrl += `status_filter=${filterStatus}&`;
      if (filterEmployee && isAdmin) reqUrl += `employee_id=${filterEmployee}&`;
      if (filterType) reqUrl += `leave_type_id=${filterType}&`;

      const [reqRes, typesRes] = await Promise.all([
        API.get(reqUrl),
        API.get('/leave/types'),
      ]);
      setRequests(reqRes.data);
      setLeaveTypes(typesRes.data);

      try { const balRes = await API.get('/leave/balance'); setBalance(balRes.data); } catch {}
      if (isAdmin) {
        try { const empRes = await API.get('/leave/employees'); setEmployees(empRes.data); } catch {}
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    try {
      await API.post('/leave/apply', { ...form, leave_type_id: parseInt(form.leave_type_id) });
      toast.success('Leave applied!');
      setShowApply(false);
      setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAllocate = async (e) => {
    e.preventDefault();
    try {
      await API.post('/leave/allocate', {
        employee_id: parseInt(allocForm.employee_id),
        leave_type_id: parseInt(allocForm.leave_type_id),
        allocated: parseInt(allocForm.allocated),
      });
      toast.success('Leave allocated!');
      setShowAllocate(false);
      setAllocForm({ employee_id: '', leave_type_id: '', allocated: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleAddType = async (e) => {
    e.preventDefault();
    try {
      await API.post('/leave/types', { ...typeForm, max_days_per_year: parseInt(typeForm.max_days_per_year) });
      toast.success('Leave type created!');
      setShowAddType(false);
      setTypeForm({ name: '', max_days_per_year: '', description: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handleDeleteType = async (id) => {
    if (!window.confirm('Delete this leave type?')) return;
    try {
      await API.delete(`/leave/types/${id}`);
      toast.success('Leave type deleted');
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

  const update = (setter) => (f) => (e) => setter(prev => ({ ...prev, [f]: e.target.value }));

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2>{isAdmin ? 'Request & Approve' : 'Time Off'}</h2>
          {isAdmin && <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Manage employee time off requests</p>}
        </div>
        <div className="page-header__actions">
          <button className="btn btn--primary" onClick={() => setShowApply(true)}>
            <HiOutlinePlus /> Apply Leave
          </button>
          {isAdmin && (
            <>
              <button className="btn btn--ghost" onClick={() => setShowAllocate(true)}>
                <HiOutlineCollection /> Allocate
              </button>
              <button className="btn btn--ghost" onClick={() => setShowManageTypes(true)}>
                <HiOutlinePencil /> Leave Types
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs for admin */}
      {isAdmin && (
        <div className="tabs" style={{ marginBottom: '1.25rem' }}>
          <button className={`tab ${activeTab === 'requests' ? 'tab--active' : ''}`} onClick={() => setActiveTab('requests')}>Requests</button>
          <button className={`tab ${activeTab === 'overview' ? 'tab--active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        </div>
      )}

      {activeTab === 'requests' && (
        <>
          {/* Filters — Admin/HR */}
          {isAdmin && (
            <div className="to-filters">
              <div className="to-filters__group">
                <HiOutlineFilter className="to-filters__icon" />
                <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
                  <option value="">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
                <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">All Leave Types</option>
                  {leaveTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          )}

          {/* Employee: status filter only */}
          {!isAdmin && (
            <div className="to-filters">
              <div className="to-filters__group">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          )}

          {/* Balance cards — employees see their own */}
          {!isAdmin && balance.length > 0 && (
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
                    <div style={{ width: `${b.allocated ? (b.used / b.allocated) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Requests Table */}
          <div className="table-card">
            <table className="table">
              <thead>
                <tr>
                  {isAdmin && <th>Employee</th>}
                  <th>Leave Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {canApprove && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {requests.map(r => {
                  const days = Math.round((new Date(r.end_date) - new Date(r.start_date)) / (1000 * 60 * 60 * 24)) + 1;
                  return (
                    <tr key={r.id}>
                      {isAdmin && (
                        <td>
                          <div className="user-cell">
                            <div className="user-cell__avatar">{r.employee_name?.charAt(0)}</div>
                            <span>{r.employee_name}</span>
                          </div>
                        </td>
                      )}
                      <td><span className="badge badge--info">{r.leave_type_name}</span></td>
                      <td>{r.start_date}</td>
                      <td>{r.end_date}</td>
                      <td><strong>{days}</strong></td>
                      <td>{r.reason || '—'}</td>
                      <td>{statusBadge(r.status)}</td>
                      {canApprove && (
                        <td>
                          {r.status === 'pending' && (
                            <div className="action-btns">
                              <button className="icon-btn icon-btn--success" title="Approve" onClick={() => handleAction(r.id, 'approve')}><HiOutlineCheck /></button>
                              <button className="icon-btn icon-btn--danger" title="Reject" onClick={() => handleAction(r.id, 'reject')}><HiOutlineX /></button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {requests.length === 0 && <div className="empty-state"><p>No leave requests found</p></div>}
          </div>
        </>
      )}

      {/* Overview Tab — Admin only */}
      {activeTab === 'overview' && isAdmin && (
        <div className="to-overview">
          {/* Leave Types Summary */}
          <div className="to-overview__section">
            <h3>Leave Types</h3>
            <div className="to-type-cards">
              {leaveTypes.map(t => (
                <div key={t.id} className="to-type-card">
                  <div className="to-type-card__icon">📋</div>
                  <div className="to-type-card__info">
                    <strong>{t.name}</strong>
                    <span>{t.max_days_per_year} days/year</span>
                  </div>
                </div>
              ))}
              {leaveTypes.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No leave types configured</p>}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="to-overview__section">
            <h3>Summary</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-card__icon" style={{ background: '#fffbeb', color: '#b45309' }}>⏳</div>
                <div className="stat-card__info">
                  <span className="stat-card__value">{requests.filter(r => r.status === 'pending').length}</span>
                  <span className="stat-card__label">Pending Requests</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card__icon" style={{ background: '#ecfdf5', color: '#059669' }}>✅</div>
                <div className="stat-card__info">
                  <span className="stat-card__value">{requests.filter(r => r.status === 'approved').length}</span>
                  <span className="stat-card__label">Approved</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card__icon" style={{ background: '#fef2f2', color: '#dc2626' }}>❌</div>
                <div className="stat-card__info">
                  <span className="stat-card__value">{requests.filter(r => r.status === 'rejected').length}</span>
                  <span className="stat-card__label">Rejected</span>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card__icon" style={{ background: '#eff6ff', color: '#2563eb' }}>👥</div>
                <div className="stat-card__info">
                  <span className="stat-card__value">{employees.length}</span>
                  <span className="stat-card__label">Employees</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Apply Leave Modal ── */}
      {showApply && (
        <div className="modal-overlay" onClick={() => setShowApply(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Time Off Type Request</h3>
            <form onSubmit={handleApply}>
              <div className="form-group"><label>Time Off Type</label>
                <select value={form.leave_type_id} onChange={update(setForm)('leave_type_id')} required>
                  <option value="">Select type...</option>
                  {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Start Date</label><input type="date" value={form.start_date} onChange={update(setForm)('start_date')} required /></div>
                <div className="form-group"><label>End Date</label><input type="date" value={form.end_date} onChange={update(setForm)('end_date')} required /></div>
              </div>
              {form.start_date && form.end_date && (() => {
                const start = new Date(form.start_date);
                const end = new Date(form.end_date);
                const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
                return (
                  <div className={`badge ${days > 0 ? 'badge--info' : 'badge--danger'}`} style={{ padding: '8px 16px', fontSize: '0.9rem', marginBottom: '4px' }}>
                    {days > 0
                      ? `📅 ${days} day${days > 1 ? 's' : ''} requested`
                      : '⚠️ End date must be after start date'}
                  </div>
                );
              })()}
              <div className="form-group"><label>Reason</label><textarea value={form.reason} onChange={update(setForm)('reason')} rows={3} placeholder="Reason for leave..." /></div>
              <div className="modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setShowApply(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Allocate Leave Modal ── */}
      {showAllocate && (
        <div className="modal-overlay" onClick={() => setShowAllocate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Allocate Leave</h3>
            <form onSubmit={handleAllocate}>
              <div className="form-group"><label>Employee</label>
                <select value={allocForm.employee_id} onChange={update(setAllocForm)('employee_id')} required>
                  <option value="">Select employee...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.emp_code})</option>)}
                </select>
              </div>
              <div className="form-group"><label>Time Off Type</label>
                <select value={allocForm.leave_type_id} onChange={update(setAllocForm)('leave_type_id')} required>
                  <option value="">Select type...</option>
                  {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name} (max {t.max_days_per_year}d)</option>)}
                </select>
              </div>
              <div className="form-group"><label>Allocation (Days)</label>
                <input type="number" min="1" value={allocForm.allocated} onChange={update(setAllocForm)('allocated')} required placeholder="e.g. 25" />
              </div>
              <div className="modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setShowAllocate(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary">Allocate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Manage Leave Types Modal ── */}
      {showManageTypes && (
        <div className="modal-overlay" onClick={() => setShowManageTypes(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h3 style={{ margin: 0 }}>Leave Types</h3>
              <button className="btn btn--primary btn--sm" onClick={() => setShowAddType(true)}><HiOutlinePlus /> Add Type</button>
            </div>
            <div className="to-type-list">
              {leaveTypes.map(t => (
                <div key={t.id} className="to-type-list__item">
                  <div>
                    <strong>{t.name}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{t.max_days_per_year} days/year</span>
                    {t.description && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>{t.description}</p>}
                  </div>
                  <button className="icon-btn icon-btn--danger" onClick={() => handleDeleteType(t.id)}><HiOutlineTrash /></button>
                </div>
              ))}
              {leaveTypes.length === 0 && <p className="empty-state" style={{ padding: '1.5rem' }}>No leave types yet</p>}
            </div>
            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setShowManageTypes(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Leave Type Sub-Modal ── */}
      {showAddType && (
        <div className="modal-overlay" style={{ zIndex: 210 }} onClick={() => setShowAddType(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add Leave Type</h3>
            <form onSubmit={handleAddType}>
              <div className="form-group"><label>Name</label>
                <input value={typeForm.name} onChange={update(setTypeForm)('name')} required placeholder="e.g. Paid Time Off" />
              </div>
              <div className="form-group"><label>Max Days Per Year</label>
                <input type="number" min="1" value={typeForm.max_days_per_year} onChange={update(setTypeForm)('max_days_per_year')} required placeholder="e.g. 25" />
              </div>
              <div className="form-group"><label>Description</label>
                <textarea value={typeForm.description} onChange={update(setTypeForm)('description')} rows={2} placeholder="Optional description" />
              </div>
              <div className="modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setShowAddType(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
