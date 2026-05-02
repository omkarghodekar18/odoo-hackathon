import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { HiOutlinePlus, HiOutlineEye, HiOutlineExclamation, HiOutlinePrinter, HiOutlineArrowLeft } from 'react-icons/hi';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Payroll() {
  const { hasRole } = useAuth();
  if (!hasRole('admin', 'payroll_officer')) return <Navigate to="/employees" replace />;

  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Dashboard state
  const [dashboard, setDashboard] = useState(null);
  const [costMode, setCostMode] = useState('monthly');
  const [countMode, setCountMode] = useState('monthly');

  // Payrun state
  const [payruns, setPayruns] = useState([]);
  const [selectedPayrun, setSelectedPayrun] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  // Payslip detail state
  const [payslipDetail, setPayslipDetail] = useState(null);
  const [payslipTab, setPayslipTab] = useState('worked_days');

  // New payslip modal state
  const [showNewPayslip, setShowNewPayslip] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  const printRef = useRef();

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dashRes, runRes] = await Promise.all([
        API.get('/payroll/dashboard'),
        API.get('/payroll/payruns'),
      ]);
      setDashboard(dashRes.data);
      setPayruns(runRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    try {
      await API.post('/payroll/payrun', { month, year });
      toast.success('Payrun created!');
      setShowCreate(false);
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const viewPayrun = async (id) => {
    try {
      const res = await API.get(`/payroll/payrun/${id}`);
      setSelectedPayrun(res.data);
      setPayslipDetail(null);
      setActiveTab('payrun');
    } catch (err) { toast.error('Failed to load payrun'); }
  };

  const viewPayslip = async (id) => {
    try {
      const res = await API.get(`/payroll/payslip/${id}`);
      setPayslipDetail(res.data);
      setPayslipTab('worked_days');
    } catch (err) { toast.error('Failed to load payslip'); }
  };

  const bulkValidate = async (payrunId) => {
    try {
      await API.put(`/payroll/payrun/${payrunId}/validate`);
      toast.success('All payslips validated!');
      viewPayrun(payrunId);
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const payslipAction = async (id, action) => {
    try {
      await API.put(`/payroll/payslip/${id}/${action}`);
      toast.success(`Payslip ${action}d`);
      viewPayslip(id);
      if (selectedPayrun) viewPayrun(selectedPayrun.id);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const openNewPayslipModal = async () => {
    if (!selectedPayrun) return;
    try {
      const res = await API.get(`/payroll/payrun/${selectedPayrun.id}/available-employees`);
      setAvailableEmployees(res.data);
      setSelectedEmployeeId(res.data.length > 0 ? res.data[0].id : '');
      setShowNewPayslip(true);
    } catch (err) { toast.error('Failed to load employees'); }
  };

  const handleCreatePayslip = async () => {
    if (!selectedEmployeeId || !selectedPayrun) return;
    try {
      const res = await API.post('/payroll/payslip', {
        payrun_id: selectedPayrun.id,
        employee_id: parseInt(selectedEmployeeId),
      });
      toast.success('Payslip created!');
      setShowNewPayslip(false);
      viewPayrun(selectedPayrun.id);
      viewPayslip(res.data.id);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Payslip</title>
      <style>body{font-family:Inter,sans-serif;padding:2rem;color:#1a202c}
      table{width:100%;border-collapse:collapse;margin:1rem 0}
      th,td{padding:8px 12px;border:1px solid #e2e8f0;text-align:left;font-size:14px}
      th{background:#f1f3f7;font-weight:600;font-size:12px;text-transform:uppercase}
      h2,h3{margin:0 0 0.5rem}
      .header{display:flex;justify-content:space-between;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:2px solid #0d9488}
      .meta span{display:block;font-size:13px;color:#64748b}
      .total{font-weight:700;font-size:1.1rem;margin-top:1rem;text-align:right}
      .deduction{color:#ef4444}
      </style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const statusBadge = (s) => {
    const map = { draft:'badge--warning', computed:'badge--info', done:'badge--success', cancelled:'badge--danger',
                  confirmed:'badge--info', validated:'badge--success', paid:'badge--success' };
    return <span className={`badge ${map[s] || 'badge--secondary'}`}>{s}</span>;
  };

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;

  // ═══════════════════════════════════════════════════════════════════════
  // PAYSLIP DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════════
  if (payslipDetail) {
    const d = payslipDetail;
    const totalWorkedDays = (d.worked_days || []).reduce((s,w) => s + w.days, 0);
    const totalWorkedAmt = (d.worked_days || []).reduce((s,w) => s + w.amount, 0);

    // Separate salary computation into earnings, gross, deductions, net
    const earnings = (d.salary_computation || []).filter(l => !l.is_deduction && l.name !== 'Gross' && l.name !== 'Net Amount');
    const grossLine = (d.salary_computation || []).find(l => l.name === 'Gross');
    const deductions = (d.salary_computation || []).filter(l => l.is_deduction);
    const netLine = (d.salary_computation || []).find(l => l.name === 'Net Amount');
    
    // Split deductions for UI layout
    const pfDeductions = deductions.filter(l => l.name.includes('PF'));
    const taxDeductions = deductions.filter(l => !l.name.includes('PF'));

    return (
      <div className="page">
        <div className="page-header">
          <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
            <button className="icon-btn" onClick={() => setPayslipDetail(null)}><HiOutlineArrowLeft /></button>
            <div>
              <h2>[{d.employee_name}]</h2>
              <p style={{fontSize:'0.85rem',color:'#64748b'}}>{d.payrun_ref}</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="pr-action-bar">
          <button className="btn btn--accent btn--sm" onClick={openNewPayslipModal}>New Payslip</button>
          {(d.status === 'draft' || d.status === 'computed') && <button className="btn btn--primary btn--sm" onClick={() => payslipAction(d.id,'compute')}>Compute</button>}
          {d.status !== 'done' && d.status !== 'cancelled' && <button className="btn btn--success btn--sm" onClick={() => payslipAction(d.id,'validate')}>Validate</button>}
          {d.status !== 'done' && d.status !== 'cancelled' && <button className="btn btn--ghost btn--sm" onClick={() => payslipAction(d.id,'cancel')}>Cancel</button>}
          <button className="btn btn--ghost btn--sm" onClick={handlePrint}><HiOutlinePrinter /> Print</button>
          <div style={{marginLeft:'auto'}}>{statusBadge(d.status)}</div>
        </div>

        {/* Meta info */}
        <div className="pr-meta-grid" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
          <div className="pr-meta-item"><span className="pr-meta-label">Payrun</span><span className="pr-meta-value" style={{color:'var(--accent)'}}>{d.payrun_ref}</span></div>
          <div className="pr-meta-item"><span className="pr-meta-label">Salary Structure</span><span className="pr-meta-value" style={{color:'var(--accent)'}}>{d.salary_structure}</span></div>
          <div className="pr-meta-item"><span className="pr-meta-label">Period</span><span className="pr-meta-value">{d.period}</span></div>
        </div>

        {/* Tabs: Worked Days | Salary Computation */}
        <div className="tabs" style={{marginTop:'1.25rem'}}>
          <button className={`tab ${payslipTab==='worked_days'?'tab--active':''}`} onClick={() => setPayslipTab('worked_days')}>Worked Days</button>
          <button className={`tab ${payslipTab==='salary'?'tab--active':''}`} onClick={() => setPayslipTab('salary')}>Salary Computation</button>
        </div>

        <div ref={printRef}>
          {/* Print header (hidden on screen) */}
          <div className="print-only">
            <div className="header"><div><h2>{d.employee_name}</h2><p>{d.payrun_ref}</p></div><div className="meta"><span>Period: {d.period}</span><span>Structure: {d.salary_structure}</span></div></div>
          </div>

          {payslipTab === 'worked_days' && (
            <div className="table-card">
              <table className="table">
                <thead><tr><th>Type</th><th style={{textAlign:'right'}}>Days</th><th style={{textAlign:'right'}}>Amount</th></tr></thead>
                <tbody>
                  {(d.worked_days || []).map((w,i) => (
                    <tr key={i}>
                      <td><strong>{w.name}</strong></td>
                      <td style={{textAlign:'right'}}>{w.days.toFixed(2)} {w.name === 'Attendance' ? `(${Math.round(w.days)} working days in week)` : w.name === 'Paid Time Off' ? `(${Math.round(w.days)} Paid leaves/Month)` : ''}</td>
                      <td style={{textAlign:'right'}}>₹{w.amount.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                    </tr>
                  ))}
                  <tr className="pr-total-row">
                    <td><strong>Total</strong></td>
                    <td style={{textAlign:'right'}}><strong>{totalWorkedDays.toFixed(2)}</strong></td>
                    <td style={{textAlign:'right'}}><strong>₹{totalWorkedAmt.toLocaleString(undefined,{minimumFractionDigits:2})}</strong></td>
                  </tr>
                </tbody>
              </table>
              <div className="pr-note">
                Salary is calculated based on the employee's monthly attendance. Paid leaves are included in the total payable days, while unpaid leaves are deducted from the salary.
              </div>
            </div>
          )}

          {payslipTab === 'salary' && (
            <>
              {/* Summary Row */}
              <div className="sal-summary" style={{marginTop:'1.25rem'}}>
                <div className="sal-summary__card">
                  <span>Net Pay</span>
                  <strong>₹{netLine?.amount?.toLocaleString(undefined,{minimumFractionDigits:2})}</strong>
                  <small>Take Home</small>
                </div>
                <div className="sal-summary__card">
                  <span>Gross Wage</span>
                  <strong>₹{grossLine?.amount?.toLocaleString(undefined,{minimumFractionDigits:2})}</strong>
                  <small>Before Deductions</small>
                </div>
                <div className="sal-summary__card sal-summary__card--info">
                  <span>Employer Cost:</span>
                  <strong>₹{d.employer_cost?.toLocaleString(undefined,{minimumFractionDigits:2})}</strong>
                </div>
              </div>

              <div className="sal-grid" style={{marginTop:'1.25rem'}}>
              {/* Left: Salary Components */}
              <div className="sal-block">
                <h4 style={{marginBottom:'1rem',color:'#1e293b'}}>Salary Components</h4>
                <table className="sal-table">
                  <thead>
                    <tr><th>Component</th><th style={{textAlign:'right'}}>₹ / Month</th><th style={{textAlign:'right'}}>%</th></tr>
                  </thead>
                  <tbody>
                    {earnings.map((line,i) => (
                      <tr key={`e-${i}`}>
                        <td>
                          <strong>{line.name}</strong>
                          {line.description && <span className="sal-table__desc">{line.description}</span>}
                        </td>
                        <td className="sal-table__amt" style={{textAlign:'right'}}>₹{line.amount.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                        <td className="sal-table__pct" style={{textAlign:'right', color:'#0d9488'}}>{line.rate_pct}{line.rate_pct !== '-' ? ' %' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Right: PF + Tax */}
              <div className="sal-right">
                <div className="sal-block">
                  <h4 style={{marginBottom:'1rem',color:'#1e293b'}}>Provident Fund (PF) Contribution</h4>
                  <table className="sal-table">
                    <thead>
                      <tr><th>Type</th><th style={{textAlign:'right'}}>₹ / Month</th><th style={{textAlign:'right'}}>%</th></tr>
                    </thead>
                    <tbody>
                      {pfDeductions.map((line,i) => (
                        <tr key={`pf-${i}`}>
                          <td>
                            <strong>{line.name}</strong>
                            {line.description && <span className="sal-table__desc">{line.description}</span>}
                          </td>
                          <td className="sal-table__amt" style={{textAlign:'right'}}>₹{line.amount.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                          <td className="sal-table__pct" style={{textAlign:'right', color:'#0d9488'}}>{line.rate_pct}{line.rate_pct !== '-' ? ' %' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="sal-block" style={{ marginTop: '1.5rem' }}>
                  <h4 style={{marginBottom:'1rem',color:'#1e293b'}}>Tax Deductions</h4>
                  <table className="sal-table">
                    <thead><tr><th>Tax</th><th style={{textAlign:'right'}}>₹ / Month</th></tr></thead>
                    <tbody>
                      {taxDeductions.map((line,i) => (
                        <tr key={`tax-${i}`}>
                          <td>
                            <strong>{line.name}</strong>
                            {line.description && <span className="sal-table__desc">{line.description}</span>}
                          </td>
                          <td className="sal-table__amt" style={{textAlign:'right'}}>₹{line.amount.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN PAGE WITH TABS
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="page">
      <div className="page-header">
        <h2>Payroll</h2>
      </div>

      {/* Top tabs: Dashboard | Payrun */}
      <div className="tabs">
        <button className={`tab ${activeTab==='dashboard'?'tab--active':''}`} onClick={() => {setActiveTab('dashboard'); setSelectedPayrun(null);}}>Dashboard</button>
        <button className={`tab ${activeTab==='payrun'?'tab--active':''}`} onClick={() => setActiveTab('payrun')}>Payrun</button>
      </div>

      {/* ─── DASHBOARD TAB ─── */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="pr-dashboard">

          {/* ── KPI cards ── */}
          {dashboard.kpi && (
            <div className="pr-kpi-grid">
              <div className="pr-kpi-card">
                <span className="pr-kpi-label">Employees on Payroll</span>
                <span className="pr-kpi-value">{dashboard.kpi.total_employees}</span>
                <span className="pr-kpi-sub">Active headcount</span>
              </div>
              <div className="pr-kpi-card pr-kpi-card--accent">
                <span className="pr-kpi-label">Latest Period</span>
                <span className="pr-kpi-value">₹{(dashboard.kpi.latest_total_cost || 0).toLocaleString('en-IN')}</span>
                <span className="pr-kpi-sub">{dashboard.kpi.latest_period} total net pay</span>
              </div>
              <div className="pr-kpi-card">
                <span className="pr-kpi-label">Avg Net Pay</span>
                <span className="pr-kpi-value">₹{(dashboard.kpi.avg_net_pay || 0).toLocaleString('en-IN')}</span>
                <span className="pr-kpi-sub">Per employee (latest month)</span>
              </div>
              <div className="pr-kpi-card">
                <span className="pr-kpi-label">Annual Cost {dashboard.kpi.annual_cost_year}</span>
                <span className="pr-kpi-value">₹{(dashboard.kpi.annual_cost || 0).toLocaleString('en-IN')}</span>
                <span className="pr-kpi-sub">{dashboard.kpi.payruns_count} payruns total</span>
              </div>
              <div className="pr-kpi-card pr-kpi-card--highlight">
                <span className="pr-kpi-label">Top Earner</span>
                <span className="pr-kpi-value" style={{fontSize:'1.1rem'}}>{dashboard.kpi.top_earner_name}</span>
                <span className="pr-kpi-sub">₹{(dashboard.kpi.top_earner_amount || 0).toLocaleString('en-IN')} net pay</span>
              </div>
            </div>
          )}

          <div className="pr-dashboard__top">
            {/* Warnings */}
            <div className="pr-panel">
              <h3 className="pr-panel__title"><HiOutlineExclamation style={{color:'#f59e0b'}} /> Warnings</h3>
              {dashboard.warnings.filter(w => w.count > 0).length === 0
                ? <p className="pr-panel__empty">No warnings</p>
                : dashboard.warnings.filter(w => w.count > 0).map((w,i) => (
                  <div key={i} className="pr-warning-item">
                    <span>{w.message}</span><span className="badge badge--warning">{w.count}</span>
                  </div>
                ))
              }
            </div>

            {/* Pending Payruns */}
            <div className="pr-panel">
              <h3 className="pr-panel__title">Payrun</h3>
              {dashboard.pending_payruns.length === 0
                ? <p className="pr-panel__empty">All payruns up to date</p>
                : dashboard.pending_payruns.map((p,i) => (
                  <div key={i} className="pr-pending-item" onClick={() => {setMonth(p.month); setYear(p.year); setShowCreate(true);}}>
                    <span className="pr-pending-label">{p.label}</span>
                    <span className="badge badge--info">Generate</span>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Charts */}
          <div className="pr-dashboard__charts">
            <div className="chart-card">
              <div className="pr-chart-header">
                <h3>Employee Cost</h3>
                <div className="tabs" style={{marginBottom:0}}>
                  <button className={`tab ${costMode==='annual'?'tab--active':''}`} onClick={() => setCostMode('annual')}>Annual</button>
                  <button className={`tab ${costMode==='monthly'?'tab--active':''}`} onClick={() => setCostMode('monthly')}>Monthly (12m)</button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={costMode === 'monthly' ? dashboard.cost_chart_monthly : dashboard.cost_chart_annual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => `₹${v.toLocaleString('en-IN')}`} contentStyle={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'8px'}} />
                  <Bar dataKey="value" fill="#0d9488" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <div className="pr-chart-header">
                <h3>Employee Count</h3>
                <div className="tabs" style={{marginBottom:0}}>
                  <button className={`tab ${countMode==='annual'?'tab--active':''}`} onClick={() => setCountMode('annual')}>Annual</button>
                  <button className={`tab ${countMode==='monthly'?'tab--active':''}`} onClick={() => setCountMode('monthly')}>Monthly (12m)</button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={countMode === 'monthly' ? dashboard.count_chart_monthly : dashboard.count_chart_annual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip contentStyle={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'8px'}} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}


      {/* ─── PAYRUN TAB ─── */}
      {activeTab === 'payrun' && (
        <div>
          {/* If a payrun is selected, show its payslips */}
          {selectedPayrun ? (
            <div>
              <div className="pr-payrun-header">
                <div style={{display:'flex',alignItems:'center',gap:'0.75rem'}}>
                  <button className="icon-btn" onClick={() => setSelectedPayrun(null)}><HiOutlineArrowLeft /></button>
                  <h3>{MONTHS[selectedPayrun.month-1]} {selectedPayrun.year} — Payrun</h3>
                  {statusBadge(selectedPayrun.status)}
                </div>
                <div className="pr-payrun-actions">
                  <button className="btn btn--primary btn--sm" onClick={() => { setMonth(new Date().getMonth()+1); setYear(new Date().getFullYear()); setShowCreate(true); }}>
                    <HiOutlinePlus /> Payrun
                  </button>
                  {selectedPayrun.status !== 'validated' && selectedPayrun.status !== 'paid' && (
                    <button className="btn btn--success btn--sm" onClick={() => bulkValidate(selectedPayrun.id)}>Validate</button>
                  )}
                </div>
              </div>

              <div className="table-card" style={{marginTop:'1rem'}}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pay Period</th><th>Employee</th><th>Employer Cost</th>
                      <th>Basic Wage</th><th>Gross Wage</th><th>Net Wage</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPayrun.payslips?.map(s => (
                      <tr key={s.id} style={{cursor:'pointer'}} onClick={() => viewPayslip(s.id)}>
                        <td><strong>[{MONTHS[selectedPayrun.month-1]} {selectedPayrun.year}][{s.employee_name}]</strong></td>
                        <td>
                          <div className="user-cell">
                            <div className="user-cell__avatar">{s.employee_name?.[0]}</div>
                            <div><div>{s.employee_name}</div><small style={{color:'#94a3b8'}}>{s.emp_code}</small></div>
                          </div>
                        </td>
                        <td>₹ {(s.employer_cost || 0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                        <td>₹ {s.basic_salary?.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                        <td>₹ {s.gross_salary?.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                        <td><strong style={{color:'#10b981'}}>₹ {s.net_pay?.toLocaleString(undefined,{minimumFractionDigits:2})}</strong></td>
                        <td>{statusBadge(s.status || 'draft')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!selectedPayrun.payslips || selectedPayrun.payslips.length === 0) && (
                  <div className="empty-state"><p>No payslips in this payrun</p></div>
                )}
              </div>
            </div>
          ) : (
            /* Payrun list */
            <div>
              <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'1rem'}}>
                <button className="btn btn--primary" onClick={() => setShowCreate(true)}><HiOutlinePlus /> New Payrun</button>
              </div>
              <div className="table-card">
                <table className="table">
                  <thead><tr><th>Period</th><th>Employees</th><th>Status</th><th>Total Amount</th><th>Created</th><th>Actions</th></tr></thead>
                  <tbody>
                    {payruns.map(p => (
                      <tr key={p.id}>
                        <td><strong>{MONTHS[p.month-1]} {p.year}</strong></td>
                        <td>{p.employee_count || '—'} People</td>
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
            </div>
          )}
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
                  {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Year</label>
                <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
                  {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <p style={{color:'#94a3b8',fontSize:'0.875rem'}}>This will generate payslips for all employees based on their attendance and leave records.</p>
            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={handleCreate}>Generate Payrun</button>
            </div>
          </div>
        </div>
      )}

      {/* New payslip modal */}
      {showNewPayslip && (
        <div className="modal-overlay" onClick={() => setShowNewPayslip(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Create New Payslip</h3>
            {availableEmployees.length === 0 ? (
              <p style={{color:'#94a3b8',fontSize:'0.875rem',padding:'1rem 0'}}>All employees already have payslips in this payrun.</p>
            ) : (
              <>
                <div className="form-group" style={{marginBottom:'1rem'}}>
                  <label>Select Employee</label>
                  <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)}>
                    {availableEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.emp_code})</option>
                    ))}
                  </select>
                </div>
                <p style={{color:'#94a3b8',fontSize:'0.875rem'}}>A payslip will be generated based on this employee's attendance and salary structure.</p>
              </>
            )}
            <div className="modal__actions">
              <button className="btn btn--ghost" onClick={() => setShowNewPayslip(false)}>Cancel</button>
              {availableEmployees.length > 0 && (
                <button className="btn btn--primary" onClick={handleCreatePayslip}>Create Payslip</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
