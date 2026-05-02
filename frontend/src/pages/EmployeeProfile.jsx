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
  HiOutlinePlus, HiOutlineStar, HiOutlineSave,
} from 'react-icons/hi';

/* ────────────────────────────────────────────── helpers ── */
const PCT_KEY_MAP = {
  basic: 'basic_pct',
  hra: 'hra_pct',
  standard_allowance: 'standard_allowance_pct',
  performance_bonus: 'performance_bonus_pct',
  lta: 'lta_pct',
  fixed_allowance: 'fixed_allowance_pct',
};

const fmtINR = (v) => v?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) ?? '0.00';

/* ═══════════════════════════════════════════════════════════ */
export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const [emp, setEmp] = useState(null);
  const [salary, setSalary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('resume');

  /* editable salary state */
  const [editingSalary, setEditingSalary] = useState(false);
  const [editCtc, setEditCtc] = useState('');
  const [editPcts, setEditPcts] = useState({});
  const [editPfPcts, setEditPfPcts] = useState({ employee_pf_pct: 12, employer_pf_pct: 12 });
  const [saving, setSaving] = useState(false);

  /* editable profile state */
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', department: '', designation: '',
    phone: '', address: '', date_of_joining: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);

  /* Password modal */
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const canEditProfile = hasRole('admin', 'payroll_officer', 'hr_officer');
  const canViewSalary = hasRole('admin', 'payroll_officer');
  const canEditSecurity = hasRole('admin');

  const tabs = [
    { key: 'resume', label: 'Resume' },
    { key: 'private', label: 'Private Info' },
    ...(canViewSalary ? [{ key: 'salary', label: 'Salary Info' }] : []),
    ...(canEditSecurity ? [{ key: 'security', label: 'Security' }] : []),
  ];

  /* ──────── Fetch ──────── */
  const fetchSalary = async () => {
    try {
      const salRes = await API.get(`/employees/${id}/salary-info`);
      setSalary(salRes.data);
      setEditCtc(salRes.data.monthly_ctc || 0);
      // build pct map from salary_components
      const p = {};
      salRes.data.salary_components.forEach(c => { p[c.key] = c.percentage; });
      setEditPcts(p);
      setEditPfPcts({
        employee_pf_pct: salRes.data.pf_contribution.employee.percentage,
        employer_pf_pct: salRes.data.pf_contribution.employer.percentage,
      });
    } catch { /* salary not available */ }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const empRes = await API.get(`/employees/${id}`);
        setEmp(empRes.data);
        if (canViewSalary) await fetchSalary();
      } catch (err) {
        toast.error('Employee not found');
        navigate('/employees');
      } finally { setLoading(false); }
    };
    fetchData();
  }, [id]);

  /* ──────── Save Profile ──────── */
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await API.put(`/employees/${id}`, editForm);
      toast.success('Profile updated successfully!');
      setShowEditModal(false);
      // refresh employee data
      const empRes = await API.get(`/employees/${id}`);
      setEmp(empRes.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Update failed');
    } finally { setProfileSaving(false); }
  };


  /* ──────── Save salary ──────── */
  const handleSaveSalary = async () => {
    // Validate total %
    const total = Object.values(editPcts).reduce((s, v) => s + Number(v || 0), 0);
    if (Math.abs(total - 100) > 0.5) {
      toast.error(`Component percentages must total 100%. Current: ${total.toFixed(2)}%`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        monthly_ctc: Number(editCtc),
        basic_pct: Number(editPcts.basic || 50),
        hra_pct: Number(editPcts.hra || 20),
        standard_allowance_pct: Number(editPcts.standard_allowance || 5.67),
        performance_bonus_pct: Number(editPcts.performance_bonus || 8.33),
        lta_pct: Number(editPcts.lta || 8.33),
        fixed_allowance_pct: Number(editPcts.fixed_allowance || 7.67),
        employee_pf_pct: Number(editPfPcts.employee_pf_pct),
        employer_pf_pct: Number(editPfPcts.employer_pf_pct),
      };
      await API.put(`/employees/${id}/salary-info`, payload);
      toast.success('Salary structure saved!');
      setEditingSalary(false);
      await fetchSalary();          // refresh computed values
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  };

  /* ──────── Password ──────── */
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.new_password !== pwdForm.confirm_password) { toast.error('Passwords do not match'); return; }
    if (pwdForm.new_password.length < 6) { toast.error('Min 6 characters'); return; }
    setPwdLoading(true);
    try {
      await API.put('/auth/change-password', pwdForm);
      toast.success('Password changed!');
      setShowPwdModal(false);
      setPwdForm({ old_password: '', new_password: '', confirm_password: '' });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setPwdLoading(false); }
  };

  /* ──────── Computed helpers for editable preview ──────── */
  const previewCtc = Number(editCtc) || 0;
  const previewComponents = salary?.salary_components?.map(c => {
    const pct = Number(editPcts[c.key] || c.percentage);
    return { ...c, percentage: pct, amount: round2(previewCtc * pct / 100) };
  }) ?? [];
  const previewBasic = previewComponents.find(c => c.key === 'basic')?.amount || 0;
  const previewEmpPf = round2(previewBasic * Number(editPfPcts.employee_pf_pct) / 100);
  const previewEmprPf = round2(previewBasic * Number(editPfPcts.employer_pf_pct) / 100);
  const totalPct = Object.values(editPcts).reduce((s, v) => s + Number(v || 0), 0);

  /* ──────── Render ──────── */
  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;
  if (!emp) return null;

  const fullName = `${emp.first_name} ${emp.last_name}`;

  return (
    <div className="page">
      {/* Header */}
      <div className="ep-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/employees')}>
          <HiOutlineArrowLeft /> Back
        </button>
        {canEditProfile && (
          <button 
            className="btn btn--primary btn--sm" 
            onClick={() => {
              setEditForm({
                first_name: emp.first_name || '',
                last_name: emp.last_name || '',
                department: emp.department || '',
                designation: emp.designation || '',
                phone: emp.phone || '',
                address: emp.address || '',
                date_of_joining: emp.date_of_joining || ''
              });
              setShowEditModal(true);
            }}
          >
            <HiOutlinePencil /> Edit Profile
          </button>
        )}
      </div>

      {/* Banner */}
      <div className="ep-banner">
        <div className="ep-banner__left">
          <div className="ep-banner__avatar">{emp.first_name[0]}{emp.last_name[0]}</div>
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
          <div className="ep-banner__field"><span className="ep-banner__label">Company</span><span className="ep-banner__value">{emp.company_name || '—'}</span></div>
          <div className="ep-banner__field"><span className="ep-banner__label">Department</span><span className="ep-banner__value">{emp.department}</span></div>
          <div className="ep-banner__field"><span className="ep-banner__label">Designation</span><span className="ep-banner__value">{emp.designation}</span></div>
          <div className="ep-banner__field"><span className="ep-banner__label">Location</span><span className="ep-banner__value">{emp.address || '—'}</span></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ep-tabs">
        {tabs.map(t => (
          <button key={t.key} className={`ep-tabs__btn ${activeTab === t.key ? 'ep-tabs__btn--active' : ''}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="ep-tab-content" key={activeTab}>

        {/* ─── Resume ─── */}
        {activeTab === 'resume' && (
          <div className="ep-resume">
            <div className="ep-resume__main">
              <div className="ep-section">
                <h4>About</h4>
                <p className="ep-text-muted">
                  {fullName} is a {emp.designation} in the {emp.department} department. Joined the organization on {emp.date_of_joining}.
                </p>
              </div>
              <div className="ep-section"><h4>What I love about my job</h4><p className="ep-text-muted">Contributing to the team's success and constantly learning new skills.</p></div>
              <div className="ep-section"><h4>My interests and hobbies</h4><p className="ep-text-muted">Technology, reading, and continuous personal development.</p></div>
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
                <div className="ep-chips"><button className="ep-chip ep-chip--add"><HiOutlinePlus /> Add certification</button></div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Private Info ─── */}
        {activeTab === 'private' && (
          <div className="ep-private">
            <div className="ep-info-grid">
              <InfoCard icon={<HiOutlineIdentification />} label="Employee Code" value={emp.emp_code} />
              <InfoCard icon={<HiOutlineMail />} label="Email" value={emp.user_email || '—'} />
              <InfoCard icon={<HiOutlinePhone />} label="Phone" value={emp.phone || '—'} />
              <InfoCard icon={<HiOutlineOfficeBuilding />} label="Department" value={emp.department} />
              <InfoCard icon={<HiOutlineBriefcase />} label="Designation" value={emp.designation} />
              <InfoCard icon={<HiOutlineCalendar />} label="Date of Joining" value={emp.date_of_joining} />
              <InfoCard icon={<HiOutlineLocationMarker />} label="Address" value={emp.address || '—'} />
              <InfoCard icon={<HiOutlineStar />} label="Role" value={emp.user_role?.replace('_', ' ') || '—'} style={{ textTransform: 'capitalize' }} />
            </div>
          </div>
        )}

        {/* ─── Salary Info ─── */}
        {activeTab === 'salary' && canViewSalary && salary && (
          <div className="ep-salary">

            {/* Edit / Save toolbar */}
            <div className="sal-toolbar">
              {!editingSalary ? (
                <button className="btn btn--primary btn--sm" onClick={() => setEditingSalary(true)}>
                  <HiOutlinePencil /> Edit Salary Structure
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className={`sal-toolbar__pct ${Math.abs(totalPct - 100) > 0.5 ? 'sal-toolbar__pct--err' : ''}`}>
                    Total: {totalPct.toFixed(2)}%
                  </span>
                  <button className="btn btn--ghost btn--sm" onClick={() => { setEditingSalary(false); fetchSalary(); }}>Cancel</button>
                  <button className="btn btn--primary btn--sm" onClick={handleSaveSalary} disabled={saving}>
                    <HiOutlineSave /> {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>

            {/* Summary Row */}
            <div className="sal-summary">
              <div className="sal-summary__card">
                <span>Month Wage (CTC)</span>
                {editingSalary ? (
                  <input type="number" className="sal-inline-input sal-inline-input--lg" value={editCtc} onChange={e => setEditCtc(e.target.value)} />
                ) : (
                  <strong>₹{fmtINR(salary.month_wage)}</strong>
                )}
                <small>/ Month</small>
              </div>
              <div className="sal-summary__card">
                <span>Yearly Wage</span>
                <strong>₹{fmtINR(previewCtc * 12)}</strong>
                <small>/ Yearly</small>
              </div>
              <div className="sal-summary__card sal-summary__card--info"><span>No of working days in a week:</span><strong>5</strong></div>
              <div className="sal-summary__card sal-summary__card--info"><span>Break Time:</span><strong>1 hr</strong></div>
            </div>

            {/* Two-column */}
            <div className="sal-grid">
              {/* Left: Salary Components */}
              <div className="sal-block">
                <h4>Salary Components</h4>
                <table className="sal-table">
                  <thead>
                    <tr><th>Component</th><th>₹ / month</th><th>%</th></tr>
                  </thead>
                  <tbody>
                    {previewComponents.map((c) => (
                      <tr key={c.key}>
                        <td>
                          <strong>{c.name}</strong>
                          <span className="sal-table__desc">{c.description}</span>
                        </td>
                        <td className="sal-table__amt">₹{fmtINR(c.amount)}</td>
                        <td className="sal-table__pct">
                          {editingSalary ? (
                            <input
                              type="number"
                              step="0.01"
                              className="sal-inline-input"
                              value={editPcts[c.key] ?? c.percentage}
                              onChange={e => setEditPcts(prev => ({ ...prev, [c.key]: e.target.value }))}
                            />
                          ) : (
                            <>{c.percentage} %</>
                          )}
                        </td>
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
                        <td className="sal-table__amt">₹{fmtINR(previewEmpPf)}</td>
                        <td className="sal-table__pct">
                          {editingSalary ? (
                            <input type="number" step="0.01" className="sal-inline-input" value={editPfPcts.employee_pf_pct} onChange={e => setEditPfPcts(prev => ({ ...prev, employee_pf_pct: e.target.value }))} />
                          ) : (
                            <>{salary.pf_contribution.employee.percentage} %</>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Employer's</strong><span className="sal-table__desc">{salary.pf_contribution.employer.description}</span></td>
                        <td className="sal-table__amt">₹{fmtINR(previewEmprPf)}</td>
                        <td className="sal-table__pct">
                          {editingSalary ? (
                            <input type="number" step="0.01" className="sal-inline-input" value={editPfPcts.employer_pf_pct} onChange={e => setEditPfPcts(prev => ({ ...prev, employer_pf_pct: e.target.value }))} />
                          ) : (
                            <>{salary.pf_contribution.employer.percentage} %</>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="sal-block" style={{ marginTop: '1.5rem' }}>
                  <h4>Tax Deductions</h4>
                  <table className="sal-table">
                    <thead><tr><th>Tax</th><th>₹ / month</th></tr></thead>
                    <tbody>
                      <tr>
                        <td><strong>Professional Tax</strong><span className="sal-table__desc">{salary.tax_deductions.professional_tax.description}</span></td>
                        <td className="sal-table__amt">₹{fmtINR(salary.tax_deductions.professional_tax.amount)}</td>
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
              <p className="ep-text-muted" style={{ marginBottom: '1rem' }}>Change the password for this user account.</p>
              <button className="btn btn--primary" onClick={() => { setPwdForm({ old_password: '', new_password: '', confirm_password: '' }); setShowPwdModal(true); }}>
                <HiOutlineKey /> Change Password
              </button>
            </div>
            <div className="ep-section" style={{ marginTop: '2rem' }}>
              <h4>Account Status</h4>
              <div className="ep-info-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                <InfoCard icon={<HiOutlineShieldCheck />} label="Status" value={emp.is_active ? 'Active' : 'Inactive'} style={{ color: emp.is_active ? 'var(--success)' : 'var(--danger)' }} />
                <InfoCard icon={<HiOutlineIdentification />} label="Role" value={emp.user_role?.replace('_', ' ')} style={{ textTransform: 'capitalize' }} />
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
                <div><h3 style={{ margin: 0 }}>Change Password</h3><p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Enter current password and choose a new one</p></div>
              </div>
              <button className="icon-btn" onClick={() => setShowPwdModal(false)}><HiOutlineX /></button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="form-group"><label><HiOutlineLockClosed style={{ fontSize: '0.85rem', verticalAlign: '-2px' }} /> Current Password</label>
                <div className="pwd-input-wrap"><input type={showOld ? 'text' : 'password'} value={pwdForm.old_password} onChange={e => setPwdForm({ ...pwdForm, old_password: e.target.value })} placeholder="Enter current password" required /><button type="button" className="pwd-toggle" onClick={() => setShowOld(v => !v)}>{showOld ? <HiOutlineEyeOff /> : <HiOutlineEye />}</button></div>
              </div>
              <div className="form-group"><label><HiOutlineKey style={{ fontSize: '0.85rem', verticalAlign: '-2px' }} /> New Password</label>
                <div className="pwd-input-wrap"><input type={showNew ? 'text' : 'password'} value={pwdForm.new_password} onChange={e => setPwdForm({ ...pwdForm, new_password: e.target.value })} placeholder="Enter new password (min 6 chars)" required minLength={6} /><button type="button" className="pwd-toggle" onClick={() => setShowNew(v => !v)}>{showNew ? <HiOutlineEyeOff /> : <HiOutlineEye />}</button></div>
              </div>
              <div className="form-group"><label><HiOutlineLockClosed style={{ fontSize: '0.85rem', verticalAlign: '-2px' }} /> Confirm New Password</label>
                <div className="pwd-input-wrap"><input type={showConfirm ? 'text' : 'password'} value={pwdForm.confirm_password} onChange={e => setPwdForm({ ...pwdForm, confirm_password: e.target.value })} placeholder="Re-enter new password" required minLength={6} /><button type="button" className="pwd-toggle" onClick={() => setShowConfirm(v => !v)}>{showConfirm ? <HiOutlineEyeOff /> : <HiOutlineEye />}</button></div>
                {pwdForm.confirm_password && pwdForm.new_password !== pwdForm.confirm_password && (<span style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>Passwords do not match</span>)}
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

      {/* ── Edit Profile Modal ── */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h3>Edit Profile</h3>
              <button className="icon-btn" onClick={() => setShowEditModal(false)}><HiOutlineX /></button>
            </div>
            <form onSubmit={handleSaveProfile}>
              <div className="form-row">
                <div className="form-group"><label>First Name</label><input value={editForm.first_name} onChange={e => setEditForm({...editForm, first_name: e.target.value})} required /></div>
                <div className="form-group"><label>Last Name</label><input value={editForm.last_name} onChange={e => setEditForm({...editForm, last_name: e.target.value})} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Department</label><input value={editForm.department} onChange={e => setEditForm({...editForm, department: e.target.value})} required /></div>
                <div className="form-group"><label>Designation</label><input value={editForm.designation} onChange={e => setEditForm({...editForm, designation: e.target.value})} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Date of Joining</label><input type="date" value={editForm.date_of_joining} onChange={e => setEditForm({...editForm, date_of_joining: e.target.value})} required /></div>
                <div className="form-group"><label>Phone</label><input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
              </div>
              <div className="form-group"><label>Address</label><input value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} /></div>
              <div className="modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary" disabled={profileSaving}>
                  {profileSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════ Reusable sub-components ══════ */
function InfoCard({ icon, label, value, style }) {
  return (
    <div className="ep-info-card">
      <span className="ep-info-card__icon">{icon}</span>
      <div><span>{label}</span><strong style={style}>{value}</strong></div>
    </div>
  );
}

function round2(n) { return Math.round(n * 100) / 100; }
