import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import toast from 'react-hot-toast';
import {
  HiOutlineKey, HiOutlineEye, HiOutlineEyeOff, HiOutlineX,
  HiOutlineLockClosed, HiOutlineShieldCheck,
} from 'react-icons/hi';

export default function Profile() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', address: '', bio: '', resume: '' });
  const [loading, setLoading] = useState(true);

  // Change password modal state
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await API.get('/auth/me');
        setProfile(res.data);
        setForm({ full_name: res.data.full_name, email: res.data.email });
        try {
          const empRes = await API.get('/employees/me/profile');
          setProfile(prev => ({ ...prev, employee: empRes.data }));
          setForm(f => ({ ...f, phone: empRes.data.phone || '', address: empRes.data.address || '', bio: empRes.data.bio || '', resume: empRes.data.resume || '' }));
        } catch {}
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await API.put('/auth/profile', { full_name: form.full_name, email: form.email });
      if (profile?.employee) {
        await API.put('/employees/me/profile', { phone: form.phone, address: form.address, bio: form.bio, resume: form.resume });
      }
      toast.success('Profile updated');
      localStorage.setItem('empay_user', JSON.stringify({ ...user, full_name: form.full_name, email: form.email }));
      if (profile?.employee) {
        const empRes = await API.get('/employees/me/profile');
        setProfile(prev => ({ ...prev, employee: empRes.data }));
      }
    } catch (err) { toast.error(err.response?.data?.detail || 'Update failed'); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (pwdForm.new_password !== pwdForm.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    if (pwdForm.new_password.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setPwdLoading(true);
    try {
      await API.put('/auth/change-password', pwdForm);
      toast.success('Password changed successfully!');
      setShowPwdModal(false);
      setPwdForm({ old_password: '', new_password: '', confirm_password: '' });
      setShowOld(false);
      setShowNew(false);
      setShowConfirm(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Password change failed');
    } finally {
      setPwdLoading(false);
    }
  };

  const openPwdModal = () => {
    setPwdForm({ old_password: '', new_password: '', confirm_password: '' });
    setShowOld(false);
    setShowNew(false);
    setShowConfirm(false);
    setShowPwdModal(true);
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
              <div><span>Address</span><strong>{profile.employee.address || '—'}</strong></div>
              {profile.employee.bio && (
                <div style={{ flexDirection: 'column', gap: '0.2rem' }}>
                  <span>Bio</span>
                  <strong>{profile.employee.bio}</strong>
                </div>
              )}
              {profile.employee.resume && (
                <div style={{ flexDirection: 'column', gap: '0.2rem' }}>
                  <span>Resume Link / Summary</span>
                  <strong>{profile.employee.resume}</strong>
                </div>
              )}
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
            {profile?.employee && (
              <>
                <div className="form-group">
                  <label>Phone</label>
                  <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows="2" />
                </div>
                <div className="form-group">
                  <label>Bio</label>
                  <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows="3" placeholder="Tell us about yourself..." />
                </div>
                <div className="form-group">
                  <label>Resume (Link or Summary)</label>
                  <textarea value={form.resume} onChange={e => setForm({ ...form, resume: e.target.value })} rows="3" placeholder="Paste your resume summary or a link to your CV..." />
                </div>
              </>
            )}
            <button type="submit" className="btn btn--primary">Save Changes</button>
          </form>

          <div style={{ borderTop: '1px solid var(--border-light)', marginTop: '1.5rem', paddingTop: '1.5rem' }}>
            <button className="btn btn--ghost" onClick={openPwdModal} style={{ gap: '0.5rem' }}>
              <HiOutlineKey /> Change Password
            </button>
          </div>
        </div>
      </div>

      {/* ── Change Password Modal ── */}
      {showPwdModal && (
        <div className="modal-overlay" onClick={() => setShowPwdModal(false)}>
          <div className="modal pwd-modal" onClick={e => e.stopPropagation()}>
            <div className="pwd-modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="pwd-modal__icon-wrap">
                  <HiOutlineShieldCheck />
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>Change Password</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Enter your current password and choose a new one
                  </p>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setShowPwdModal(false)}><HiOutlineX /></button>
            </div>

            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label><HiOutlineLockClosed style={{ fontSize: '0.85rem', verticalAlign: '-2px' }} /> Current Password</label>
                <div className="pwd-input-wrap">
                  <input
                    type={showOld ? 'text' : 'password'}
                    value={pwdForm.old_password}
                    onChange={e => setPwdForm({ ...pwdForm, old_password: e.target.value })}
                    placeholder="Enter current password"
                    required
                  />
                  <button type="button" className="pwd-toggle" onClick={() => setShowOld(v => !v)}>
                    {showOld ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label><HiOutlineKey style={{ fontSize: '0.85rem', verticalAlign: '-2px' }} /> New Password</label>
                <div className="pwd-input-wrap">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={pwdForm.new_password}
                    onChange={e => setPwdForm({ ...pwdForm, new_password: e.target.value })}
                    placeholder="Enter new password (min 6 chars)"
                    required
                    minLength={6}
                  />
                  <button type="button" className="pwd-toggle" onClick={() => setShowNew(v => !v)}>
                    {showNew ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label><HiOutlineLockClosed style={{ fontSize: '0.85rem', verticalAlign: '-2px' }} /> Confirm New Password</label>
                <div className="pwd-input-wrap">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={pwdForm.confirm_password}
                    onChange={e => setPwdForm({ ...pwdForm, confirm_password: e.target.value })}
                    placeholder="Re-enter new password"
                    required
                    minLength={6}
                  />
                  <button type="button" className="pwd-toggle" onClick={() => setShowConfirm(v => !v)}>
                    {showConfirm ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                  </button>
                </div>
                {pwdForm.confirm_password && pwdForm.new_password !== pwdForm.confirm_password && (
                  <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    Passwords do not match
                  </span>
                )}
              </div>

              <div className="modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setShowPwdModal(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={pwdLoading || !pwdForm.old_password || !pwdForm.new_password || !pwdForm.confirm_password}
                >
                  {pwdLoading ? 'Changing…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
