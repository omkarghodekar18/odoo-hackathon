import { useState, useEffect } from 'react';
import API from '../api';

export default function Payslips() {
  const [payslips, setPayslips] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/payroll/my-payslips').then(res => setPayslips(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header"><h2>My Payslips</h2></div>

      {payslips.length === 0 ? (
        <div className="empty-state-card"><p>No payslips available yet</p></div>
      ) : (
        <div className="payslip-grid">
          {payslips.map(s => (
            <div key={s.id} className="payslip-card" onClick={() => setSelected(s)}>
              <div className="payslip-card__header">
                <h4>{monthNames[s.month-1]} {s.year}</h4>
                <span className={`badge ${s.status === 'paid' ? 'badge--success' : 'badge--warning'}`}>{s.status}</span>
              </div>
              <div className="payslip-card__amount">₹{s.net_pay?.toLocaleString()}</div>
              <div className="payslip-card__details">
                <span>Gross: ₹{s.gross_salary?.toLocaleString()}</span>
                <span>Deductions: ₹{s.total_deductions?.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Payslip — {monthNames[selected.month-1]} {selected.year}</h3>
            <div className="payslip-detail">
              <div className="payslip-detail__section">
                <h4>Earnings</h4>
                <div className="payslip-detail__row"><span>Basic Salary</span><span>₹{selected.basic_salary?.toLocaleString()}</span></div>
                <div className="payslip-detail__row"><span>HRA</span><span>₹{selected.hra?.toLocaleString()}</span></div>
                <div className="payslip-detail__row"><span>Conveyance</span><span>₹{selected.conveyance?.toLocaleString()}</span></div>
                <div className="payslip-detail__row"><span>Medical</span><span>₹{selected.medical?.toLocaleString()}</span></div>
                <div className="payslip-detail__row payslip-detail__row--total"><span>Gross Salary</span><span>₹{selected.gross_salary?.toLocaleString()}</span></div>
              </div>
              <div className="payslip-detail__section">
                <h4>Deductions</h4>
                <div className="payslip-detail__row"><span>Provident Fund (12%)</span><span>₹{selected.pf_deduction?.toLocaleString()}</span></div>
                <div className="payslip-detail__row"><span>Professional Tax</span><span>₹{selected.professional_tax}</span></div>
                <div className="payslip-detail__row"><span>Income Tax</span><span>₹{selected.income_tax}</span></div>
                <div className="payslip-detail__row payslip-detail__row--total"><span>Total Deductions</span><span>₹{selected.total_deductions?.toLocaleString()}</span></div>
              </div>
              <div className="payslip-detail__section">
                <div className="payslip-detail__row payslip-detail__row--net"><span>Net Pay</span><span>₹{selected.net_pay?.toLocaleString()}</span></div>
              </div>
              <div className="payslip-detail__section">
                <h4>Attendance</h4>
                <div className="payslip-detail__row"><span>Working Days</span><span>{selected.working_days}</span></div>
                <div className="payslip-detail__row"><span>Days Present</span><span>{selected.days_present}</span></div>
                <div className="payslip-detail__row"><span>Leave Days</span><span>{selected.leave_days}</span></div>
              </div>
            </div>
            <div className="modal__actions"><button className="btn btn--ghost" onClick={() => setSelected(null)}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
