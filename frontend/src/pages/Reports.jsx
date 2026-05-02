import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import toast from 'react-hot-toast';
import { HiOutlinePrinter, HiOutlineDocumentReport } from 'react-icons/hi';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = (n) => `\u20b9 ${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function Reports() {
  const { hasRole, company } = useAuth();
  if (!hasRole('admin', 'payroll_officer')) return <Navigate to="/dashboard" replace />;

  const [employees, setEmployees]     = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [years, setYears]             = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [reportData, setReportData]   = useState(null);
  const [loading, setLoading]         = useState(false);
  const [fetching, setFetching]       = useState(true);

  const printRef = useRef();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await API.get('/employees');
        setEmployees(res.data);
        // Derive available years from payruns
        const prRes = await API.get('/payroll/payruns');
        const yrs = [...new Set(prRes.data.map(p => p.year))].sort((a,b) => b - a);
        setYears(yrs);
        if (yrs.length > 0) setSelectedYear(String(yrs[0]));
      } catch (e) { console.error(e); }
      finally { setFetching(false); }
    };
    load();
  }, []);

  const handleGenerate = async () => {
    if (!selectedEmpId || !selectedYear) {
      toast.error('Please select an employee and year');
      return;
    }
    setLoading(true);
    setReportData(null);
    try {
      // Fetch all payslips for this employee from the API
      const [empRes, payslipsRes] = await Promise.all([
        API.get(`/employees/${selectedEmpId}`),
        API.get('/payroll/my-payslips').catch(() => ({ data: [] })),
      ]);

      // For admin, fetch employee payslips directly via payruns
      const prRes  = await API.get('/payroll/payruns');
      const year   = parseInt(selectedYear);
      const monthlyData = [];

      for (const pr of prRes.data.filter(p => p.year === year)) {
        try {
          const detail = await API.get(`/payroll/payrun/${pr.id}`);
          const slip   = detail.data.payslips?.find(s => s.employee_id === parseInt(selectedEmpId));
          if (slip) monthlyData.push({ month: pr.month, ...slip });
        } catch (_) {}
      }

      monthlyData.sort((a, b) => a.month - b.month);

      setReportData({
        employee: empRes.data,
        year,
        monthly: monthlyData,
      });
    } catch (err) {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Salary Statement Report</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 32px; background: #fff; }
        .rpt-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0d9488; }
        .rpt-company { font-size: 22px; font-weight: 700; color: #0d9488; }
        .rpt-title-block { text-align: right; }
        .rpt-title { font-size: 18px; font-weight: 700; color: #1a1a1a; }
        .rpt-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 32px; margin-bottom: 20px; padding: 14px; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 6px; }
        .rpt-meta-row { display: flex; flex-direction: column; gap: 2px; }
        .rpt-meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #0d9488; font-weight: 600; }
        .rpt-meta-value { font-size: 13px; font-weight: 600; color: #1a1a1a; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        thead th { background: #0d9488; color: #fff; padding: 9px 12px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
        thead th:not(:first-child) { text-align: right; }
        tbody td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #e5e7eb; }
        tbody td:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
        .section-head td { background: #f0fdfa; font-weight: 700; color: #0d9488; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 12px; }
        .total-row td { background: #0d9488; color: #fff; font-weight: 700; font-size: 13px; }
        .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #94a3b8; text-align: center; }
      </style></head>
      <body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  if (fetching) return <div className="page-loader"><div className="loading-spinner" /></div>;

  const emp = reportData?.employee;
  const monthly = reportData?.monthly || [];

  // Aggregate yearly totals
  const sum = (key) => monthly.reduce((s, m) => s + (m[key] || 0), 0);
  const yearlyBasic    = sum('basic_salary');
  const yearlyHra      = sum('hra');
  const yearlyStd      = sum('standard_allowance');
  const yearlyPerf     = sum('performance_bonus');
  const yearlyLta      = sum('lta');
  const yearlyFixed    = sum('fixed_allowance');
  const yearlyGross    = sum('gross_salary');
  const yearlyPfEmp    = sum('pf_employee');
  const yearlyPfEmpr   = sum('pf_employer');
  const yearlyProfTax  = sum('professional_tax');
  const yearlyDed      = sum('total_deductions');
  const yearlyNet      = sum('net_pay');

  return (
    <div className="page">
      <div className="page-header">
        <h2><HiOutlineDocumentReport style={{ verticalAlign: '-3px', marginRight: '0.5rem' }} />Reports</h2>
      </div>

      {/* ── Filter Card ── */}
      <div className="rpt-filter-card">
        <div className="rpt-filter-row">
          <div className="form-group" style={{ minWidth: 260 }}>
            <label>Employee Name</label>
            <select value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}>
              <option value="">— Select Employee —</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.emp_code})</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: 140 }}>
            <label>Year</label>
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              <option value="">— Select Year —</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <button
            className="btn btn--primary"
            style={{ alignSelf: 'flex-end' }}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? 'Generating…' : 'Print'}
          </button>

          {reportData && (
            <button
              className="btn btn--ghost"
              style={{ alignSelf: 'flex-end' }}
              onClick={handlePrint}
            >
              <HiOutlinePrinter /> Print / Save PDF
            </button>
          )}
        </div>
      </div>

      {/* ── Salary Statement Report ── */}
      {reportData && (
        <div className="rpt-preview-wrap">
          <div className="rpt-doc" ref={printRef}>

            {/* Header */}
            <div className="rpt-header">
              <div className="rpt-company-block">
                <div className="rpt-company-name">{company?.name || 'Company'}</div>
                <div className="rpt-company-sub">Salary Statement Report</div>
              </div>
              <div className="rpt-year-badge">{reportData.year}</div>
            </div>

            {/* Employee Meta */}
            <div className="rpt-meta-grid">
              <div className="rpt-meta-item">
                <span className="rpt-meta-label">Employee Name</span>
                <span className="rpt-meta-value">{emp.first_name} {emp.last_name}</span>
              </div>
              <div className="rpt-meta-item">
                <span className="rpt-meta-label">Date Of Joining</span>
                <span className="rpt-meta-value">{emp.date_of_joining}</span>
              </div>
              <div className="rpt-meta-item">
                <span className="rpt-meta-label">Designation</span>
                <span className="rpt-meta-value">{emp.designation}</span>
              </div>
              <div className="rpt-meta-item">
                <span className="rpt-meta-label">Salary Effective From</span>
                <span className="rpt-meta-value">01 Jan {reportData.year}</span>
              </div>
            </div>

            {/* Table */}
            <table className="rpt-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Salary Components</th>
                  {monthly.map(m => (
                    <th key={m.month} style={{ textAlign: 'right' }}>{MONTHS[m.month - 1]}</th>
                  ))}
                  <th style={{ textAlign: 'right', background: '#065f46' }}>Yearly Amount</th>
                </tr>
              </thead>
              <tbody>
                {/* Earnings Section */}
                <tr className="rpt-section-head">
                  <td colSpan={monthly.length + 2}>Earnings</td>
                </tr>
                {[
                  { label: 'Basic',                key: 'basic_salary',        yearly: yearlyBasic },
                  { label: 'HRA',                  key: 'hra',                 yearly: yearlyHra },
                  { label: 'Standard Allowance',   key: 'standard_allowance',  yearly: yearlyStd },
                  { label: 'Performance Bonus',    key: 'performance_bonus',   yearly: yearlyPerf },
                  { label: 'Leave Travel Allowance', key: 'lta',               yearly: yearlyLta },
                  { label: 'Fixed Allowance',      key: 'fixed_allowance',     yearly: yearlyFixed },
                ].map(row => (
                  <tr key={row.key} className="rpt-data-row">
                    <td>{row.label}</td>
                    {monthly.map(m => <td key={m.month}>{fmt(m[row.key])}</td>)}
                    <td className="rpt-yearly">{fmt(row.yearly)}</td>
                  </tr>
                ))}

                {/* Gross */}
                <tr className="rpt-gross-row">
                  <td><strong>Gross Salary</strong></td>
                  {monthly.map(m => <td key={m.month}><strong>{fmt(m.gross_salary)}</strong></td>)}
                  <td className="rpt-yearly"><strong>{fmt(yearlyGross)}</strong></td>
                </tr>

                {/* Deductions Section */}
                <tr className="rpt-section-head">
                  <td colSpan={monthly.length + 2}>Deduction</td>
                </tr>
                {[
                  { label: 'PF (Employee)',         key: 'pf_employee',       yearly: yearlyPfEmp },
                  { label: 'PF (Employer)',          key: 'pf_employer',       yearly: yearlyPfEmpr },
                  { label: 'Professional Tax',       key: 'professional_tax',  yearly: yearlyProfTax },
                ].map(row => (
                  <tr key={row.key} className="rpt-data-row rpt-data-row--ded">
                    <td>{row.label}</td>
                    {monthly.map(m => <td key={m.month}>{fmt(m[row.key])}</td>)}
                    <td className="rpt-yearly">{fmt(row.yearly)}</td>
                  </tr>
                ))}

                {/* Net Salary */}
                <tr className="rpt-net-row">
                  <td>Net Salary</td>
                  {monthly.map(m => <td key={m.month}>{fmt(m.net_pay)}</td>)}
                  <td className="rpt-yearly">{fmt(yearlyNet)}</td>
                </tr>
              </tbody>
            </table>

            <div className="rpt-footer">
              Generated on {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} &nbsp;·&nbsp; {company?.name}
            </div>
          </div>
        </div>
      )}

      {!reportData && !loading && (
        <div className="empty-state" style={{ marginTop: '3rem' }}>
          <HiOutlineDocumentReport style={{ fontSize: '3rem', color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <p>Select an employee and year, then click <strong>Print</strong> to generate the Salary Statement Report.</p>
        </div>
      )}
    </div>
  );
}
