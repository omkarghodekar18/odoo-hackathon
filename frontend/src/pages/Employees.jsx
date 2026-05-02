import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import toast from 'react-hot-toast';
import { HiOutlineSearch, HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';

export default function Employees() {
  const { user, hasRole } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ emp_code: '', first_name: '', last_name: '', department: '', designation: '', date_of_joining: '', basic_salary: '', phone: '', email: '', password: '' });

  const canEdit = hasRole('admin', 'hr_officer');

  useEffect(() => { fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    try {
      const res = await API.get('/employees/');
      setEmployees(res.data);
      if (canEdit) {
        const usersRes = await API.get('/auth/users');
        setUsers(usersRes.data);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await API.put(`/employees/${editing.id}`, { first_name: form.first_name, last_name: form.last_name, department: form.department, designation: form.designation, basic_salary: parseFloat(form.basic_salary), phone: form.phone });
        toast.success('Employee updated');
      } else {
        await API.post('/employees/', { ...form, basic_salary: parseFloat(form.basic_salary) });
        toast.success('Employee created');
      }
      setShowModal(false);
      setEditing(null);
      fetchEmployees();
    } catch (err) { toast.error(err.response?.data?.detail || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this employee?')) return;
    try {
      await API.delete(`/employees/${id}`);
      toast.success('Employee deleted');
      fetchEmployees();
    } catch (err) { toast.error(err.response?.data?.detail || 'Delete failed'); }
  };

  const openEdit = (emp) => {
    setEditing(emp);
    setForm({ emp_code: emp.emp_code, first_name: emp.first_name, last_name: emp.last_name, department: emp.department, designation: emp.designation, date_of_joining: emp.date_of_joining, basic_salary: emp.basic_salary, phone: emp.phone || '', email: '', password: '' });
    setShowModal(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ emp_code: '', first_name: '', last_name: '', department: '', designation: '', date_of_joining: '', basic_salary: '', phone: '', email: '', password: '' });
    setShowModal(true);
  };

  const filtered = employees.filter(e => `${e.first_name} ${e.last_name} ${e.emp_code} ${e.department}`.toLowerCase().includes(search.toLowerCase()));
  const update = (f) => (e) => setForm({ ...form, [f]: e.target.value });

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Employee Directory</h2>
        <div className="page-header__actions">
          <div className="search-box">
            <HiOutlineSearch />
            <input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {canEdit && <button className="btn btn--primary" onClick={openNew}><HiOutlinePlus /> Add Employee</button>}
        </div>
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr><th>Code</th><th>Name</th><th>Department</th><th>Designation</th><th>Email</th><th>Salary</th>{canEdit && <th>Actions</th>}</tr>
          </thead>
          <tbody>
            {filtered.map(emp => (
              <tr key={emp.id}>
                <td><span className="badge badge--info">{emp.emp_code}</span></td>
                <td><div className="user-cell"><div className="user-cell__avatar">{emp.first_name[0]}{emp.last_name[0]}</div>{emp.first_name} {emp.last_name}</div></td>
                <td>{emp.department}</td>
                <td>{emp.designation}</td>
                <td>{emp.user_email}</td>
                <td>₹{emp.basic_salary?.toLocaleString()}</td>
                {canEdit && <td><div className="action-btns"><button className="icon-btn" onClick={() => openEdit(emp)}><HiOutlinePencil /></button>{user.role === 'admin' && <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(emp.id)}><HiOutlineTrash /></button>}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state"><p>No employees found</p></div>}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editing ? 'Edit Employee' : 'Add Employee'}</h3>
            <form onSubmit={handleSubmit}>
              {!editing && (
                <div className="form-row">
                  <div className="form-group"><label>Login Email</label><input type="email" value={form.email} onChange={update('email')} required /></div>
                  <div className="form-group"><label>Login Password</label><input type="password" value={form.password} onChange={update('password')} required /></div>
                </div>
              )}
              {!editing && <div className="form-group"><label>Employee Code</label><input value={form.emp_code} onChange={update('emp_code')} required /></div>}
              <div className="form-row">
                <div className="form-group"><label>First Name</label><input value={form.first_name} onChange={update('first_name')} required /></div>
                <div className="form-group"><label>Last Name</label><input value={form.last_name} onChange={update('last_name')} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Department</label><input value={form.department} onChange={update('department')} required /></div>
                <div className="form-group"><label>Designation</label><input value={form.designation} onChange={update('designation')} required /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Basic Salary (₹)</label><input type="number" value={form.basic_salary} onChange={update('basic_salary')} required /></div>
                {!editing && <div className="form-group"><label>Date of Joining</label><input type="date" value={form.date_of_joining} onChange={update('date_of_joining')} required /></div>}
              </div>
              <div className="form-group"><label>Phone</label><input value={form.phone} onChange={update('phone')} /></div>
              <div className="modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
