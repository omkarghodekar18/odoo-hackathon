import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { HiOutlineUsers, HiOutlineClipboardCheck, HiOutlineCalendar, HiOutlineCurrencyDollar } from 'react-icons/hi';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [attendanceChart, setAttendanceChart] = useState([]);
  const [leaveChart, setLeaveChart] = useState([]);
  const [deptStats, setDeptStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, attRes, leaveRes, deptRes] = await Promise.all([
          API.get('/dashboard/stats'),
          API.get('/dashboard/attendance-chart'),
          API.get('/dashboard/leave-chart'),
          API.get('/dashboard/department-stats'),
        ]);
        setStats(statsRes.data);
        setAttendanceChart(attRes.data);
        setLeaveChart(leaveRes.data);
        setDeptStats(deptRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;

  const statCards = user.role === 'employee'
    ? [
        { icon: HiOutlineClipboardCheck, label: 'My Attendance (This Month)', value: stats?.my_attendance_this_month || 0, color: '#10b981' },
        { icon: HiOutlineCalendar, label: 'Pending Leaves', value: stats?.my_pending_leaves || 0, color: '#f59e0b' },
        { icon: HiOutlineUsers, label: 'Total Employees', value: stats?.total_employees || 0, color: '#3b82f6' },
        { icon: HiOutlineClipboardCheck, label: 'Present Today', value: stats?.today_present || 0, color: '#8b5cf6' },
      ]
    : [
        { icon: HiOutlineUsers, label: 'Total Employees', value: stats?.total_employees || 0, color: '#3b82f6' },
        { icon: HiOutlineClipboardCheck, label: 'Present Today', value: `${stats?.today_present || 0} (${stats?.today_attendance_pct || 0}%)`, color: '#10b981' },
        { icon: HiOutlineCalendar, label: 'Pending Leaves', value: stats?.pending_leaves || 0, color: '#f59e0b' },
        { icon: HiOutlineCurrencyDollar, label: 'Total Payroll', value: `₹${(stats?.total_payroll || 0).toLocaleString()}`, color: '#f43f5e' },
      ];

  const DEPT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4'];

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Welcome back, {user.full_name}!</p>
      </div>

      <div className="stats-grid">
        {statCards.map((card, i) => (
          <div key={i} className="stat-card" style={{ '--accent': card.color }}>
            <div className="stat-card__icon" style={{ background: `${card.color}15`, color: card.color }}>
              <card.icon />
            </div>
            <div className="stat-card__info">
              <span className="stat-card__value">{card.value}</span>
              <span className="stat-card__label">{card.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Monthly Attendance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={attendanceChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1a202c' }} />
              <Bar dataKey="present" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="on_leave" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Leave Overview</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={leaveChart} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {leaveChart.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1a202c' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Department Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={deptStats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" stroke="#94a3b8" fontSize={12} />
              <YAxis dataKey="department" type="category" stroke="#94a3b8" fontSize={12} width={100} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1a202c' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {deptStats.map((_, i) => (
                  <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
