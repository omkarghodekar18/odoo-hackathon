import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import toast from 'react-hot-toast';
import {
  HiOutlineArrowLeft, HiOutlineMail, HiOutlinePhone,
  HiOutlineOfficeBuilding, HiOutlineBriefcase, HiOutlineCalendar,
  HiOutlineIdentification, HiOutlineLocationMarker,
  HiOutlineKey, HiOutlineEye, HiOutlineEyeOff, HiOutlineX,
  HiOutlineLockClosed, HiOutlineShieldCheck, HiOutlinePencil,
  HiOutlinePlus, HiOutlineAcademicCap, HiOutlineStar,
} from 'react-icons/hi';

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const [emp, setEmp] = useState(null);
  const [salary, setSalary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('resume');

  // Password modal state
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const canViewSalary = hasRole('admin', 'payroll_officer');
  const canEditSecurity = hasRole('admin');

  const tabs = [
    { key: 'resume', label: 'Resume' },
    { key: 'private', label: 'Private Info' },
    ...(canViewSalary ? [{ key: 'salary', label: 'Salary Info' }] : []),
    ...(canEditSecurity ? [{ key: 'security', label: 'Security' }] : []),
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const empRes = await API.get(`/employees/${id}`);
        setEmp(empRes.data);

        if (canViewSalary) {
          try {
            const salRes = await API.get(`/employees/${id}/salary-info`);
            setSalary(salRes.data);
          } catch { /* salary not available */ }
        }
      } catch (err) {
        toast.error('Employee not found');
        navigate('/employees');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      toast.error('New passwords do not match'); return;
    }
    if (pwdForm.new_password.length < 6) {
      toast.error('Password must be at least 6 characters'); return;
    }
    setPwdLoading(true);
    try {
      await API.put('/auth/change-password', pwdForm);
      toast.success('Password changed successfully!');
      setShowPwdModal(false);
      setPwdForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally { setPwdLoading(false); }
  };

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;
  if (!emp) return null;

  const fullName = `${emp.first_name} ${emp.last_name}`;

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="ep-header">
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/employees')}>
          <HiOutlineArrowLeft /> Back
        </button>
      </div>

      {/* ── Profile Banner ── */}
      <div className="ep-banner">
        <div className="ep-banner__left">
          <div className="ep-banner__avatar">
            {emp.first_name[0]}{emp.last_name[0]}
          </div>
          <div className="ep-banner__info">
            <h2 className="ep-banner__name">{fullName}</h2>
            <div className="ep-banner__meta">
              <span><HiOutlineIdentification /> {emp.emp_code}</span>
              <span><HiOutlineMail /> {emp.user_email || '—'}</span>
              <span><HiOutlinePhone /> {emp.phone || '—'}</span>
            </div>
          </div>
        </div>
        <div className="ep-banner__right">
          <div className="ep-banner__field">
            <span className="ep-banner__label">Company</span>
            <span className="ep-banner__value">{emp.company_name || '—'}</span>
          </div>
          <div className="ep-banner__field">
            <span className="ep-banner__label">Department</span>
            <span className="ep-banner__value">{emp.department}</span>
          </div>
          <div className="ep-banner__field">
            <span className="ep-banner__label">Designation</span>
            <span className="ep-banner__value">{emp.designation}</span>
          </div>
          <div className="ep-banner__field">
            <span className="ep-banner__label">Location</span>
            <span className="ep-banner__value">{emp.address || '—'}</span>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="ep-tabs">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`ep-tabs__btn ${activeTab === t.key ? 'ep-tabs__btn--active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="ep-tab-content">
        {/* ─── Resume ─── */}
        {activeTab === 'resume' && (
          <div className="ep-resume">
            <div className="ep-resume__main">
              <div className="ep-section">
                <h4>About</h4>
                <p className="ep-text-muted">
                  {fullName} is a {emp.designation} in the {emp.department} department.
                  Joined the organization on {emp.date_of_joining}.
                </p>
              </div>
              <div className="ep-section">
                <h4>What I love about my job</h4>
                <p className="ep-text-muted">
                  Contributing to the team's success and constantly learning new skills.
                </p>
              </div>
              <div className="ep-section">
                <h4>My interests and hobbies</h4>
                <p className="ep-text-muted">
                  Technology, reading, and continuous personal development.
                </p>
              </div>
            </div>
            <div className="ep-resume__side">
              <div className="ep-section">
                <h4>Skills</h4>
                <div className="ep-chips">
                  <span className="ep-chip">{emp.department}</span>
                  <span className="ep-chip">{emp.designation}</span>
                  <span className="ep-chip">Team Work</span>
                  <button className="ep-chip ep-chip--add"><HiOutlinePlus /> Add skill</button>
                </div>
              </div>
              <div className="ep-section" style={{ marginTop: '1.5rem' }}>
                <h4>Certification</h4>
                <div className="ep-chips">
                  <button className="ep-chip ep-chip--add"><HiOutlinePlus /> Add certification</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Private Info ─── */}
        {activeTab === 'private' && (
          <div className="ep-private">
            <div className="ep-info-grid">
              <div className="ep-info-card">
                <HiOutlineIdentification className="ep-info-card__icon" />
                <div><span>Employee Code</span><strong>{emp.emp_code}</strong></div>
              </div>
              <div className="ep-info-card">
                <HiOutlineMail className="ep-info-card__icon" />
                <div><span>Email</span><strong>{emp.user_email || '—'}</strong></div>
              </div>
              <div className="ep-info-card">
                <HiOutlinePhone className="ep-info-card__icon" />
                <div><span>Phone</span><strong>{emp.phone || '—'}</strong></div>
              </div>
              <div className="ep-info-card">
                <HiOutlineOfficeBuilding className="ep-info-card__icon" />
                <div><span>Department</span><strong>{emp.department}</strong></div>
              </div>
              <div className="ep-info-card">
                <HiOutlineBriefcase className="ep-info-card__icon" />
                <div><span>Designation</span><strong>{emp.designation}</strong></div>
              </div>
              <div className="ep-info-card">
                <HiOutlineCalendar className="ep-info-card__icon" />
                <div><span>Date of Joining</span><strong>{emp.date_of_joining}</strong></div>
              </div>
              <div className="ep-info-card">
                <HiOutlineLocationMarker className="ep-info-card__icon" />
                <div><span>Address</span><strong>{emp.address || '—'}</strong></div>
              </div>
              <div className="ep-info-card">
                <HiOutlineStar className="ep-info-card__icon" />
                <div><span>Role</span><strong style={{ textTransform: 'capitalize' }}>{emp.user_role?.replace('_', ' ') || '—'}</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Salary Info (Admin/Payroll only) ─── */}
        {activeTab === 'salary' && canViewSalary && salary && (
          <div className="ep-salary">
            {/* Summary Row */}
            <div className="sal-summary">
              <div className="sal-summary__card">
                <span>Month Wage</span>
                <strong>₹{salary.month_wage?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                <small>/ Month</small>
              </div>
              <div className="sal-summary__card">
                <span>Yearly Wage</span>
                <strong>₹{salary.yearly_wage?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                <small>/ Yearly</small>
              </div>
              <div className="sal-summary__card sal-summary__card--info">
                <span>No of working days in a week:</span>
                <strong>{salary.working_days_per_week}</strong>
              </div>
              <div className="sal-summary__card sal-summary__card--info">
                <span>Break Time:</span>
                <strong>{salary.break_time_hours} hr</strong>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="sal-grid">
              {/* Left: Salary Components */}
              <div className="sal-block">
                <h4>Salary Components</h4>
                <table className="sal-table">
                  <thead>
                    <tr><th>Component</th><th>₹ / month</th><th>%</th></tr>
                  </thead>
                  <tbody>
                    {salary.salary_components.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <strong>{c.name}</strong>
                          <span className="sal-table__desc">{c.description}</span>
                        </td>
                        <td className="sal-table__amt">₹{c.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="sal-table__pct">{c.percentage} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Right: PF + Tax */}
              <div className="sal-right">
                <div className="sal-block">
                  <h4>Provident Fund (PF) Contribution</h4>
                  <table className="sal-table">
                    <thead>
                      <tr><th>Type</th><th>₹ / month</th><th>%</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Employee</strong><span className="sal-table__desc">{salary.pf_contribution.employee.description}</span></td>
                        <td className="sal-table__amt">₹{salary.pf_contribution.employee.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="sal-table__pct">{salary.pf_contribution.employee.percentage} %</td>
                      </tr>
                      <tr>
                        <td><strong>Employer's</strong><span className="sal-table__desc">{salary.pf_contribution.employer.description}</span></td>
                        <td className="sal-table__amt">₹{salary.pf_contribution.employer.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="sal-table__pct">{salary.pf_contribution.employer.percentage} %</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="sal-block" style={{ marginTop: '1.5rem' }}>
                  <h4>Tax Deductions</h4>
                  <table className="sal-table">
                    <thead>
                      <tr><th>Tax</th><th>₹ / month</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Professional Tax</strong><span className="sal-table__desc">{salary.tax_deductions.professional_tax.description}</span></td>
                        <td className="sal-table__amt">₹{salary.tax_deductions.professional_tax.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'salary' && canViewSalary && !salary && (
          <div className="empty-state"><p>Salary information not available.</p></div>
        )}

        {/* ─── Security ─── */}
        {activeTab === 'security' && canEditSecurity && (
          <div className="ep-security">
            <div className="ep-section">
              <h4>Password Management</h4>
              <p className="ep-text-muted" style={{ marginBottom: '1rem' }}>
                Change the password for this user account.
              </p>
              <button className="btn btn--primary" onClick={() => { setPwdForm({ old_password: '', new_password: '', confirm_password: '' }); setShowPwdModal(true); }}>
                <HiOutlineKey /> Change Password
              </button>
            </div>
            <div className="ep-section" style={{ marginTop: '2rem' }}>
              <h4>Account Status</h4>
              <div className="ep-info-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                <div className="ep-info-card">
                  <HiOutlineShieldCheck className="ep-info-card__icon" />
                  <div><span>Status</span><strong style={{ color: emp.is_active ? 'var(--success)' : 'var(--danger)' }}>{emp.is_active ? 'Active' : 'Inactive'}</strong></div>
                </div>
                <div className="ep-info-card">
                  <HiOutlineIdentification className="ep-info-card__icon" />
                  <div><span>Role</span><strong style={{ textTransform: 'capitalize' }}>{emp.user_role?.replace('_', ' ')}</strong></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Change Password Modal ── */}
      {showPwdModal && (
        <div className="modal-overlay" onClick={() => setShowPwdModal(false)}>
          <div className="modal pwd-modal" onClick={e => e.stopPropagation()}>
            <div className="pwd-modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="pwd-modal__icon-wrap"><HiOutlineShieldCheck /></div>
                <div>
                  <h3 style={{ margin: 0 }}>Change Password</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Enter your current password and choose a new one</p>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setShowPwdModal(false)}><HiOutlineX /></button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label><HiOutlineLockClosed style={{ fontSize: '0.85rem', verticalAlign: '-2px' }} /> Current Password</label>
                <div className="pwd-input-wrap">
                  <input type={showOld ? 'text' : 'password'} value={pwdForm.old_password} onChange={e => setPwdForm({ ...pwdForm, old_password: e.target.value })} placeholder="Enter current password" required />
                  <button type="button" className="pwd-toggle" onClick={() => setShowOld(v => !v)}>{showOld ? <HiOutlineEyeOff /> : <HiOutlineEye />}</button>
                </div>
              </div>
              <div className="form-group">
                <label><HiOutlineKey style={{ fontSize: '0.85rem', verticalAlign: '-2px' }} /> New Password</label>
                <div className="pwd-input-wrap">
                  <input type={showNew ? 'text' : 'password'} value={pwdForm.new_password} onChange={e => setPwdForm({ ...pwdForm, new_password: e.target.value })} placeholder="Enter new password (min 6 chars)" required minLength={6} />
                  <button type="button" className="pwd-toggle" onClick={() => setShowNew(v => !v)}>{showNew ? <HiOutlineEyeOff /> : <HiOutlineEye />}</button>
                </div>
              </div>
              <div className="form-group">
                <label><HiOutlineLockClosed style={{ fontSize: '0.85rem', verticalAlign: '-2px' }} /> Confirm New Password</label>
                <div className="pwd-input-wrap">
                  <input type={showConfirm ? 'text' : 'password'} value={pwdForm.confirm_password} onChange={e => setPwdForm({ ...pwdForm, confirm_password: e.target.value })} placeholder="Re-enter new password" required minLength={6} />
                  <button type="button" className="pwd-toggle" onClick={() => setShowConfirm(v => !v)}>{showConfirm ? <HiOutlineEyeOff /> : <HiOutlineEye />}</button>
                </div>
                {pwdForm.confirm_password && pwdForm.new_password !== pwdForm.confirm_password && (
                  <span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>Passwords do not match</span>
                )}
              </div>
              <div className="modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setShowPwdModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={pwdLoading || !pwdForm.old_password || !pwdForm.new_password || !pwdForm.confirm_password}>
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
