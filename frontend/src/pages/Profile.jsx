import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await API.get('/auth/me');
        setProfile(res.data);
        setForm({ full_name: res.data.full_name, email: res.data.email });
        try {
          const empRes = await API.get('/employees/me/profile');
          setProfile(prev => ({ ...prev, employee: empRes.data }));
        } catch {}
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await API.put('/auth/profile', form);
      toast.success('Profile updated');
      localStorage.setItem('empay_user', JSON.stringify({ ...user, ...form }));
    } catch (err) { toast.error(err.response?.data?.detail || 'Update failed'); }
  };

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;

  const roleColors = { admin: '#f43f5e', hr_officer: '#8b5cf6', payroll_officer: '#f59e0b', employee: '#3b82f6' };

  return (
    <div className="page">
      <div className="page-header"><h2>My Profile</h2></div>

      <div className="profile-layout">
        <div className="profile-card">
          <div className="profile-card__avatar" style={{ background: roleColors[profile?.role] || '#3b82f6' }}>
            {profile?.full_name?.charAt(0)}
          </div>
          <h3>{profile?.full_name}</h3>
          <span className="badge" style={{ background: `${roleColors[profile?.role]}22`, color: roleColors[profile?.role] }}>
            {profile?.role?.replace('_', ' ')}
          </span>
          <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>{profile?.email}</p>

          {profile?.employee && (
            <div className="profile-card__details">
              <div><span>Employee Code</span><strong>{profile.employee.emp_code}</strong></div>
              <div><span>Department</span><strong>{profile.employee.department}</strong></div>
              <div><span>Designation</span><strong>{profile.employee.designation}</strong></div>
              <div><span>Phone</span><strong>{profile.employee.phone || '—'}</strong></div>
            </div>
          )}
        </div>

        <div className="profile-edit-card">
          <h3>Edit Profile</h3>
          <form onSubmit={handleUpdate}>
            <div className="form-group">
              <label>Full Name</label>
              <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <button type="submit" className="btn btn--primary">Save Changes</button>
          </form>
        </div>
      </div>
    </div>
  );
}
