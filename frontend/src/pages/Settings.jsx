import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import toast from 'react-hot-toast';
import { HiOutlinePlus } from 'react-icons/hi';

export default function Settings() {
  const { user, hasRole } = useAuth();

  // Route guard: only admin can access Settings
  if (!hasRole('admin')) {
    return <Navigate to="/employees" replace />;
  }

  const [users, setUsers] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ name: '', max_days_per_year: '', description: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [usersRes, ltRes] = await Promise.all([
        API.get('/auth/users'),
        API.get('/leave/types'),
      ]);
      setUsers(usersRes.data);
      setLeaveTypes(ltRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const updateRole = async (userId, newRole) => {
    try {
      await API.put(`/auth/users/${userId}/role?role=${newRole}`);
      toast.success('Role updated');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const addLeaveType = async (e) => {
    e.preventDefault();
    try {
      await API.post('/leave/types', { ...leaveForm, max_days_per_year: parseInt(leaveForm.max_days_per_year) });
      toast.success('Leave type added');
      setShowAddLeave(false);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const roleColors = { admin: '#f43f5e', hr_officer: '#8b5cf6', payroll_officer: '#f59e0b', employee: '#3b82f6' };

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header"><h2>Settings</h2></div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'users' ? 'tab--active' : ''}`} onClick={() => setActiveTab('users')}>User Management</button>
        <button className={`tab ${activeTab === 'leave' ? 'tab--active' : ''}`} onClick={() => setActiveTab('leave')}>Leave Types</button>
      </div>

      {activeTab === 'users' && (
        <div className="table-card">
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Current Role</th><th>Change Role</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td><span className="badge" style={{ background: `${roleColors[u.role]}22`, color: roleColors[u.role] }}>{u.role.replace('_', ' ')}</span></td>
                  <td>
                    <select value={u.role} onChange={e => updateRole(u.id, e.target.value)}>
                      <option value="employee">Employee</option>
                      <option value="hr_officer">HR Officer</option>
                      <option value="payroll_officer">Payroll Officer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'leave' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button className="btn btn--primary" onClick={() => setShowAddLeave(true)}><HiOutlinePlus /> Add Leave Type</button>
          </div>
          <div className="table-card">
            <table className="table">
              <thead><tr><th>Name</th><th>Max Days/Year</th><th>Description</th></tr></thead>
              <tbody>
                {leaveTypes.map(lt => (
                  <tr key={lt.id}><td>{lt.name}</td><td>{lt.max_days_per_year}</td><td>{lt.description || '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {showAddLeave && (
            <div className="modal-overlay" onClick={() => setShowAddLeave(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>Add Leave Type</h3>
                <form onSubmit={addLeaveType}>
                  <div className="form-group"><label>Name</label><input value={leaveForm.name} onChange={e => setLeaveForm({...leaveForm, name: e.target.value})} required /></div>
                  <div className="form-group"><label>Max Days per Year</label><input type="number" value={leaveForm.max_days_per_year} onChange={e => setLeaveForm({...leaveForm, max_days_per_year: e.target.value})} required /></div>
                  <div className="form-group"><label>Description</label><input value={leaveForm.description} onChange={e => setLeaveForm({...leaveForm, description: e.target.value})} /></div>
                  <div className="modal__actions">
                    <button type="button" className="btn btn--ghost" onClick={() => setShowAddLeave(false)}>Cancel</button>
                    <button type="submit" className="btn btn--primary">Add</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
