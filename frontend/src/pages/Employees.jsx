import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import toast from 'react-hot-toast';
import {
  HiOutlineSearch, HiOutlinePlus, HiOutlinePencil, HiOutlineTrash,
  HiOutlineClipboardCopy, HiOutlineCheckCircle, HiOutlineKey,
  HiOutlineMail, HiOutlineIdentification, HiOutlineX,
  HiOutlineOfficeBuilding, HiOutlinePhone, HiOutlineCalendar,
  HiOutlineCurrencyDollar, HiOutlineBriefcase,
  HiOutlineLocationMarker, HiOutlineUser, HiOutlineDocumentText
} from 'react-icons/hi';

/* ─── status helpers ─── */
function statusDotClass(status) {
  switch (status) {
    case 'present': return 'status-dot status-dot--present';
    case 'on_leave': return 'status-dot status-dot--leave';
    default: return 'status-dot status-dot--absent';
  }
}
function statusLabel(status) {
  switch (status) {
    case 'present': return 'Present';
    case 'on_leave': return 'On Leave';
    default: return 'Absent';
  }
}

export default function Employees() {
  const { user, company, hasRole } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState({});
  const [viewEmployee, setViewEmployee] = useState(null); // read-only detail

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', department: '', designation: '',
    date_of_joining: '', basic_salary: '', phone: '',
  });

  const canEdit = hasRole('admin', 'hr_officer');

  useEffect(() => { fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    try {
      const res = await API.get('/employees/status/all');
      setEmployees(res.data);
    } catch (err) {
      // Fallback to regular list without status
      try {
        const res = await API.get('/employees/');
        setEmployees(res.data.map(e => ({ ...e, attendance_status: 'absent' })));
      } catch (e) { console.error(e); }
    }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await API.put(`/employees/${editing.id}`, {
          first_name: form.first_name,
          last_name: form.last_name,
          department: form.department,
          designation: form.designation,
          basic_salary: parseFloat(form.basic_salary),
          phone: form.phone,
        });
        toast.success('Employee updated');
        setShowModal(false);
        setEditing(null);
        fetchEmployees();
      } else {
        const res = await API.post('/employees/', {
          ...form,
          basic_salary: parseFloat(form.basic_salary),
        });
        toast.success('Employee created');
        setShowModal(false);
        fetchEmployees();
        
        const generatedCreds = {
          emp_code: res.data.emp_code,
          login_email: res.data.user_email,
          email: form.email || res.data.user_email,
          password: res.data.generated_password,
          name: `${res.data.first_name} ${res.data.last_name}`,
        };
        
        setCredentials(generatedCreds);
        
        // Auto-send email
        try {
          await API.post('/employees/send-credentials', generatedCreds);
          toast.success('Credentials automatically emailed to employee');
        } catch (err) {
          toast.error('Failed to auto-send email');
        }
      }
    } catch (err) { toast.error(err.response?.data?.detail || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this employee?')) return;
    try {
      await API.delete(`/employees/${id}`);
      toast.success('Employee deleted');
      setViewEmployee(null);
      fetchEmployees();
    } catch (err) { toast.error(err.response?.data?.detail || 'Delete failed'); }
  };

  const openEdit = (emp) => {
    setViewEmployee(null);
    setEditing(emp);
    setForm({
      first_name: emp.first_name, last_name: emp.last_name,
      email: emp.user_email || '',
      department: emp.department, designation: emp.designation,
      date_of_joining: emp.date_of_joining, basic_salary: emp.basic_salary,
      phone: emp.phone || '',
    });
    setShowModal(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ first_name: '', last_name: '', email: '', department: '', designation: '', date_of_joining: '', basic_salary: '', phone: '' });
    setShowModal(true);
  };

  const copyField = (key, value) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000);
    });
  };

  const copyAll = () => {
    if (!credentials) return;
    const text = `Employee: ${credentials.name}\nID: ${credentials.emp_code}\nEmail: ${credentials.login_email}\nPassword: ${credentials.password}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(prev => ({ ...prev, all: true }));
      setTimeout(() => setCopied(prev => ({ ...prev, all: false })), 2000);
    });
  };

  const filtered = employees.filter(e =>
    `${e.first_name} ${e.last_name} ${e.emp_code} ${e.department}`
      .toLowerCase().includes(search.toLowerCase())
  );
  const update = (f) => (e) => setForm({ ...form, [f]: e.target.value });

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {canEdit && <button className="btn btn--primary btn--sm" onClick={openNew}><HiOutlinePlus /> NEW</button>}
        </div>
        <div className="page-header__actions">
          <div className="search-box">
            <HiOutlineSearch />
            <input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── Card Grid ── */}
      <div className="emp-grid">
        {filtered.map(emp => (
          <div
            key={emp.id}
            className="emp-card"
            onClick={() => hasRole('admin', 'hr_officer') ? navigate(`/employees/${emp.id}`) : setViewEmployee(emp)}
            tabIndex={0}
            role="button"
            aria-label={`View ${emp.first_name} ${emp.last_name}`}
          >
            <span className={statusDotClass(emp.attendance_status)} title={statusLabel(emp.attendance_status)} />
            <div className="emp-card__avatar">
              {emp.first_name[0]}{emp.last_name[0]}
            </div>
            <div className="emp-card__name">{emp.first_name} {emp.last_name}</div>
            <div className="emp-card__role">{emp.designation}</div>
            <div className="emp-card__dept">{emp.department}</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}><p>No employees found</p></div>
        )}
      </div>

      {/* ── Status Legend ── */}
      <div className="emp-legend">
        <div className="emp-legend__item"><span className="status-dot status-dot--present" /> Green: Present in the office</div>
        <div className="emp-legend__item"><span className="status-dot status-dot--leave" /> Red: On leave</div>
        <div className="emp-legend__item"><span className="status-dot status-dot--absent" /> Yellow: Absent (no time off applied)</div>
      </div>

      {/* ── View Detail Modal (read-only) ── */}
      {viewEmployee && (
        <div className="modal-overlay" onClick={() => setViewEmployee(null)}>
          <div className="modal emp-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="emp-detail-modal__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="emp-detail-modal__avatar">
                  {viewEmployee.first_name[0]}{viewEmployee.last_name[0]}
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>{viewEmployee.first_name} {viewEmployee.last_name}</h3>
                  <span className={statusDotClass(viewEmployee.attendance_status)} style={{ display: 'inline-block', marginRight: '0.4rem' }} />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{statusLabel(viewEmployee.attendance_status)}</span>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setViewEmployee(null)}><HiOutlineX /></button>
            </div>

            <div className="emp-detail-modal__body">
              <div className="emp-detail-row">
                <HiOutlineIdentification />
                <div><span>Employee Code</span><strong>{viewEmployee.emp_code}</strong></div>
              </div>
              <div className="emp-detail-row">
                <HiOutlineMail />
                <div><span>Email</span><strong>{viewEmployee.user_email || '—'}</strong></div>
              </div>
              <div className="emp-detail-row">
                <HiOutlineOfficeBuilding />
                <div><span>Department</span><strong>{viewEmployee.department}</strong></div>
              </div>
              <div className="emp-detail-row">
                <HiOutlineBriefcase />
                <div><span>Designation</span><strong>{viewEmployee.designation}</strong></div>
              </div>
              <div className="emp-detail-row">
                <HiOutlineCalendar />
                <div><span>Date of Joining</span><strong>{viewEmployee.date_of_joining}</strong></div>
              </div>
              {hasRole('admin', 'payroll_officer') && (
              <div className="emp-detail-row">
                <HiOutlineCurrencyDollar />
                <div><span>Basic Salary</span><strong>₹{viewEmployee.basic_salary?.toLocaleString()}</strong></div>
              </div>
              )}
              <div className="emp-detail-row">
                <HiOutlinePhone />
                <div><span>Phone</span><strong>{viewEmployee.phone || '—'}</strong></div>
              </div>
              {viewEmployee.address && (
                <div className="emp-detail-row">
                  <HiOutlineLocationMarker />
                  <div><span>Address</span><strong>{viewEmployee.address}</strong></div>
                </div>
              )}
              {viewEmployee.bio && (
                <div className="emp-detail-row">
                  <HiOutlineUser />
                  <div><span>Bio</span><strong>{viewEmployee.bio}</strong></div>
                </div>
              )}
              {viewEmployee.resume && (
                <div className="emp-detail-row">
                  <HiOutlineDocumentText />
                  <div><span>Resume</span><strong>{viewEmployee.resume}</strong></div>
                </div>
              )}
            </div>

            {canEdit && (
              <div className="modal__actions">
                {user.role === 'admin' && (
                  <button className="btn btn--ghost" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(viewEmployee.id)}>
                    <HiOutlineTrash /> Delete
                  </button>
                )}
                <button className="btn btn--primary" onClick={() => openEdit(viewEmployee)}>
                  <HiOutlinePencil /> Edit
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editing ? 'Edit Employee' : 'Add New Employee'}</h3>
            {!editing && (
              <div className="cred-notice">
                <HiOutlineKey />
                <span>Employee ID and password will be <strong>auto-generated</strong> after creation.</span>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label>First Name</label><input value={form.first_name} onChange={update('first_name')} required /></div>
                <div className="form-group"><label>Last Name</label><input value={form.last_name} onChange={update('last_name')} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Email (Optional)</label><input type="email" placeholder="Used for login & notifications" value={form.email} onChange={update('email')} /></div>
                <div className="form-group"><label>Phone</label><input value={form.phone} onChange={update('phone')} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Department</label><input value={form.department} onChange={update('department')} required /></div>
                <div className="form-group"><label>Designation</label><input value={form.designation} onChange={update('designation')} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Monthly CTC (₹)</label><input type="number" value={form.basic_salary} onChange={update('basic_salary')} required /></div>
                {!editing && (
                  <div className="form-group"><label>Date of Joining</label><input type="date" value={form.date_of_joining} onChange={update('date_of_joining')} required /></div>
                )}
              </div>
              <div className="modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary">{editing ? 'Update' : 'Create Employee'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Credentials Modal (shown after creation) ── */}
      {credentials && (
        <div className="modal-overlay" onClick={() => setCredentials(null)}>
          <div className="modal cred-modal" onClick={e => e.stopPropagation()}>
            <div className="cred-modal__header">
              <HiOutlineCheckCircle className="cred-modal__icon" />
              <h3>Employee Created!</h3>
              <p>Share these credentials with <strong>{credentials.name}</strong>. The password <em>will not be shown again.</em></p>
            </div>

            <div className="cred-card">
              <div className="cred-row">
                <span className="cred-label"><HiOutlineIdentification /> Employee ID</span>
                <span className="cred-value cred-value--id">{credentials.emp_code}</span>
                <button className="icon-btn cred-copy" title="Copy" onClick={() => copyField('emp_code', credentials.emp_code)}>
                  {copied.emp_code ? <HiOutlineCheckCircle style={{ color: 'var(--success)' }} /> : <HiOutlineClipboardCopy />}
                </button>
              </div>
              <div className="cred-row">
                <span className="cred-label"><HiOutlineMail /> Login Email</span>
                <span className="cred-value">{credentials.login_email}</span>
                <button className="icon-btn cred-copy" title="Copy" onClick={() => copyField('login_email', credentials.login_email)}>
                  {copied.login_email ? <HiOutlineCheckCircle style={{ color: 'var(--success)' }} /> : <HiOutlineClipboardCopy />}
                </button>
              </div>
              <div className="cred-row">
                <span className="cred-label"><HiOutlineKey /> Password</span>
                <span className="cred-value cred-value--password">{credentials.password}</span>
                <button className="icon-btn cred-copy" title="Copy" onClick={() => copyField('password', credentials.password)}>
                  {copied.password ? <HiOutlineCheckCircle style={{ color: 'var(--success)' }} /> : <HiOutlineClipboardCopy />}
                </button>
              </div>
            </div>

            <div className="modal__actions">
              <button className="btn btn--ghost btn--full" onClick={async () => {
                try {
                  await API.post('/employees/send-credentials', credentials);
                  toast.success('Credentials emailed to employee');
                } catch (e) {
                  toast.error('Failed to send email');
                }
              }}>
                <HiOutlineMail /> Email Credentials
              </button>
              <button className="btn btn--ghost btn--full" onClick={copyAll}>
                {copied.all ? <><HiOutlineCheckCircle /> Copied!</> : <><HiOutlineClipboardCopy /> Copy All</>}
              </button>
              <button className="btn btn--primary" onClick={() => setCredentials(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
