import { useState, useEffect } from 'react';
import API from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Reports() {
  const [attendanceData, setAttendanceData] = useState([]);
  const [leaveData, setLeaveData] = useState([]);
  const [payrollData, setPayrollData] = useState([]);
  const [activeTab, setActiveTab] = useState('attendance');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [att, leave, pay] = await Promise.all([
          API.get('/dashboard/attendance-chart'),
          API.get('/leave/requests'),
          API.get('/dashboard/payroll-summary'),
        ]);
        setAttendanceData(att.data);
        setLeaveData(leave.data);
        setPayrollData(pay.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;

  const tabs = [
    { id: 'attendance', label: 'Attendance Report' },
    { id: 'leave', label: 'Leave Report' },
    { id: 'payroll', label: 'Payroll Report' },
  ];

  return (
    <div className="page">
      <div className="page-header"><h2>Reports</h2></div>

      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab ${activeTab === t.id ? 'tab--active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'attendance' && (
        <div className="chart-card">
          <h3>Monthly Attendance Report — {new Date().getFullYear()}</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }} />
              <Bar dataKey="present" fill="#10b981" name="Present" radius={[4,4,0,0]} />
              <Bar dataKey="absent" fill="#f43f5e" name="Absent" radius={[4,4,0,0]} />
              <Bar dataKey="on_leave" fill="#f59e0b" name="On Leave" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeTab === 'leave' && (
        <div className="table-card">
          <h3>Leave Report</h3>
          <table className="table">
            <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Status</th></tr></thead>
            <tbody>
              {leaveData.map(r => (
                <tr key={r.id}>
                  <td>{r.employee_name}</td>
                  <td>{r.leave_type_name}</td>
                  <td>{r.start_date}</td>
                  <td>{r.end_date}</td>
                  <td><span className={`badge ${r.status === 'approved' ? 'badge--success' : r.status === 'rejected' ? 'badge--danger' : 'badge--warning'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="table-card">
          <h3>Payroll Summary</h3>
          <table className="table">
            <thead><tr><th>Period</th><th>Total Amount</th><th>Status</th></tr></thead>
            <tbody>
              {payrollData.map((p, i) => (
                <tr key={i}>
                  <td>{p.month} {p.year}</td>
                  <td>₹{p.total?.toLocaleString()}</td>
                  <td><span className={`badge ${p.status === 'paid' ? 'badge--success' : 'badge--warning'}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {payrollData.length === 0 && <div className="empty-state"><p>No payroll data</p></div>}
        </div>
      )}
    </div>
  );
}
