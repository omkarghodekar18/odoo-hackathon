import { useState, useEffect } from 'react';
import API from '../api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineEye } from 'react-icons/hi';

export default function Payroll() {
  const [payruns, setPayruns] = useState([]);
  const [selectedPayrun, setSelectedPayrun] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchPayruns(); }, []);

  const fetchPayruns = async () => {
    try {
      const res = await API.get('/payroll/payruns');
      setPayruns(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    try {
      await API.post('/payroll/payrun', { month, year });
      toast.success('Payrun created!');
      setShowCreate(false);
      fetchPayruns();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const viewPayrun = async (id) => {
    try {
      const res = await API.get(`/payroll/payrun/${id}`);
      setSelectedPayrun(res.data);
    } catch (err) { toast.error('Failed to load payrun'); }
  };

  const processPayrun = async (id) => {
    try {
      await API.put(`/payroll/payrun/${id}/process`);
      toast.success('Payrun processed');
      viewPayrun(id);
      fetchPayruns();
    } catch (err) { toast.error('Failed'); }
  };

  const markPaid = async (id) => {
    try {
      await API.put(`/payroll/payrun/${id}/pay`);
      toast.success('Payrun marked as paid');
      viewPayrun(id);
      fetchPayruns();
    } catch (err) { toast.error('Failed'); }
  };

  const statusBadge = (s) => {
    const map = { draft: 'badge--warning', processed: 'badge--info', paid: 'badge--success' };
    return <span className={`badge ${map[s]}`}>{s}</span>;
  };

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Payroll Management</h2>
        <button className="btn btn--primary" onClick={() => setShowCreate(true)}><HiOutlinePlus /> New Payrun</button>
      </div>

      {/* Payruns list */}
      <div className="table-card">
        <table className="table">
          <thead><tr><th>Period</th><th>Status</th><th>Total Amount</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {payruns.map(p => (
              <tr key={p.id}>
                <td><strong>{monthNames[p.month-1]} {p.year}</strong></td>
                <td>{statusBadge(p.status)}</td>
                <td>₹{p.total_amount?.toLocaleString()}</td>
                <td>{new Date(p.created_at).toLocaleDateString()}</td>
                <td><button className="icon-btn" onClick={() => viewPayrun(p.id)}><HiOutlineEye /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {payruns.length === 0 && <div className="empty-state"><p>No payruns created yet</p></div>}
      </div>

      {/* Payrun detail modal */}
      {selectedPayrun && (
        <div className="modal-overlay" onClick={() => setSelectedPayrun(null)}>
          <div className="modal modal--large" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h3>Payrun: {monthNames[selectedPayrun.month-1]} {selectedPayrun.year}</h3>
              <div className="modal__header-actions">
                {selectedPayrun.status === 'draft' && <button className="btn btn--primary" onClick={() => processPayrun(selectedPayrun.id)}>Process</button>}
                {selectedPayrun.status === 'processed' && <button className="btn btn--success" onClick={() => markPaid(selectedPayrun.id)}>Mark as Paid</button>}
                {statusBadge(selectedPayrun.status)}
              </div>
            </div>
            <div className="payrun-summary">
              <div className="payrun-summary__item"><span>Total Employees</span><strong>{selectedPayrun.payslips?.length || 0}</strong></div>
              <div className="payrun-summary__item"><span>Total Amount</span><strong>₹{selectedPayrun.total_amount?.toLocaleString()}</strong></div>
            </div>
            <div className="table-card" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="table">
                <thead><tr><th>Employee</th><th>Basic</th><th>HRA</th><th>Gross</th><th>PF</th><th>Prof. Tax</th><th>Deductions</th><th>Net Pay</th><th>Days</th></tr></thead>
                <tbody>
                  {selectedPayrun.payslips?.map(s => (
                    <tr key={s.id}>
                      <td><div className="user-cell"><div className="user-cell__avatar">{s.employee_name?.[0]}</div><div><div>{s.employee_name}</div><small>{s.emp_code}</small></div></div></td>
                      <td>₹{s.basic_salary?.toLocaleString()}</td>
                      <td>₹{s.hra?.toLocaleString()}</td>
                      <td>₹{s.gross_salary?.toLocaleString()}</td>
                      <td>₹{s.pf_deduction?.toLocaleString()}</td>
                      <td>₹{s.professional_tax}</td>
                      <td>₹{s.total_deductions?.toLocaleString()}</td>
                      <td><strong style={{ color: '#10b981' }}>₹{s.net_pay?.toLocaleString()}</strong></td>
                      <td>{s.days_present}/{s.working_days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal__actions"><button className="btn btn--ghost" onClick={() => setSelectedPayrun(null)}>Close</button></div>
          </div>
        </div>
      )}

      {/* Create payrun modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Create New Payrun</h3>
            <div className="form-row">
              <div className="form-group"><label>Month</label>
                <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                  {monthNames.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Year</label>
                <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
                  {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>This will calculate payslips for all employees based on their attendance and leave records.</p>
            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={handleCreate}>Generate Payrun</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
