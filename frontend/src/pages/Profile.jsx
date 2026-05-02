import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import toast from 'react-hot-toast';
import {
  HiOutlineKey, HiOutlineEye, HiOutlineEyeOff, HiOutlineX,
  HiOutlineLockClosed, HiOutlineShieldCheck, HiOutlineLibrary,
} from 'react-icons/hi';

export default function Profile() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', address: '', bio: '', resume: '', bank_name: '', bank_account_number: '', bank_ifsc_code: '', bank_branch: '' });
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
          setForm(f => ({ ...f, phone: empRes.data.phone || '', address: empRes.data.address || '', bio: empRes.data.bio || '', resume: empRes.data.resume || '', bank_name: empRes.data.bank_name || '', bank_account_number: empRes.data.bank_account_number || '', bank_ifsc_code: empRes.data.bank_ifsc_code || '', bank_branch: empRes.data.bank_branch || '' }));
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
        await API.put('/employees/me/profile', { phone: form.phone, address: form.address, bio: form.bio, resume: form.resume, bank_name: form.bank_name, bank_account_number: form.bank_account_number, bank_ifsc_code: form.bank_ifsc_code, bank_branch: form.bank_branch });
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
            <>
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

            {/* Bank Details Card */}
            <div style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <HiOutlineLibrary style={{ fontSize: '1.1rem', color: '#16a34a' }} />
                <strong style={{ fontSize: '0.9rem', color: '#15803d' }}>Bank Details</strong>
              </div>
              {(profile.employee.bank_name || profile.employee.bank_account_number) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Bank Name</span>
                    <strong>{profile.employee.bank_name || '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Account No.</span>
                    <strong>{profile.employee.bank_account_number ? '••••' + profile.employee.bank_account_number.slice(-4) : '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>IFSC Code</span>
                    <strong>{profile.employee.bank_ifsc_code || '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Branch</span>
                    <strong>{profile.employee.bank_branch || '—'}</strong>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0 }}>No bank details added yet. Add them in the form →</p>
              )}
            </div>
            </>
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

                {/* ── Bank Details Section ── */}
                <div style={{ borderTop: '1px solid var(--border-light)', marginTop: '1rem', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <HiOutlineLibrary style={{ fontSize: '1rem', color: '#16a34a' }} />
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Bank Details</h4>
                  </div>
                  <div className="form-group">
                    <label>Bank Name</label>
                    <input type="text" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} placeholder="e.g. State Bank of India" />
                  </div>
                  <div className="form-group">
                    <label>Account Number</label>
                    <input type="text" value={form.bank_account_number} onChange={e => setForm({ ...form, bank_account_number: e.target.value })} placeholder="e.g. 1234567890123456" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label>IFSC Code</label>
                      <input type="text" value={form.bank_ifsc_code} onChange={e => setForm({ ...form, bank_ifsc_code: e.target.value.toUpperCase() })} placeholder="e.g. SBIN0001234" />
                    </div>
                    <div className="form-group">
                      <label>Branch</label>
                      <input type="text" value={form.bank_branch} onChange={e => setForm({ ...form, bank_branch: e.target.value })} placeholder="e.g. Andheri West" />
                    </div>
                  </div>
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
