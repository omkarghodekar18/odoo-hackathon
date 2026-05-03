import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import {
  HiOutlineUsers, HiOutlineClipboardCheck, HiOutlineCalendar,
  HiOutlineCurrencyDollar, HiOutlineTrendingUp, HiOutlineUserGroup,
  HiOutlineExclamation, HiOutlineBriefcase,
} from 'react-icons/hi';

export default function Dashboard() {
  const { user, company, hasRole } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = hasRole('admin', 'hr_officer', 'payroll_officer');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await API.get('/dashboard/analytics');
        setData(res.data);
      } catch (err) {
        console.error('Dashboard analytics error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div className="page-loader"><div className="loading-spinner" /></div>;
  if (!data) return <div className="page"><div className="empty-state"><p>Dashboard data not available.</p></div></div>;

  const { kpi, department_distribution, attendance_trend, leave_chart, payroll_trend, recent_hires, top_earners } = data;

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return percent > 0.05 ? (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Welcome back, {user?.full_name} · {company?.name || 'Your Company'}
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="dash-kpi-grid">
        <div className="dash-kpi-card dash-kpi-card--primary">
          <div className="dash-kpi-card__icon"><HiOutlineUsers /></div>
          <div className="dash-kpi-card__content">
            <span className="dash-kpi-card__value">{kpi.total_employees}</span>
            <span className="dash-kpi-card__label">Total Employees</span>
          </div>
        </div>
        <div className="dash-kpi-card dash-kpi-card--success">
          <div className="dash-kpi-card__icon"><HiOutlineClipboardCheck /></div>
          <div className="dash-kpi-card__content">
            <span className="dash-kpi-card__value">{kpi.today_present}</span>
            <span className="dash-kpi-card__label">Present Today</span>
            <span className="dash-kpi-card__sub">{kpi.attendance_pct}% attendance</span>
          </div>
        </div>
        <div className="dash-kpi-card dash-kpi-card--warning">
          <div className="dash-kpi-card__icon"><HiOutlineCalendar /></div>
          <div className="dash-kpi-card__content">
            <span className="dash-kpi-card__value">{kpi.pending_leaves}</span>
            <span className="dash-kpi-card__label">Pending Leaves</span>
            <span className="dash-kpi-card__sub">{kpi.today_on_leave} on leave today</span>
          </div>
        </div>
        <div className="dash-kpi-card dash-kpi-card--accent">
          <div className="dash-kpi-card__icon"><HiOutlineCurrencyDollar /></div>
          <div className="dash-kpi-card__content">
            <span className="dash-kpi-card__value">₹{(kpi.avg_salary || 0).toLocaleString('en-IN')}</span>
            <span className="dash-kpi-card__label">Avg Monthly CTC</span>
          </div>
        </div>
      </div>

      {/* ── Row: Attendance Trend + Department Pie ── */}
      <div className="dash-charts-row">
        <div className="dash-chart-card dash-chart-card--wide">
          <div className="dash-chart-card__header">
            <h3><HiOutlineTrendingUp style={{ verticalAlign: '-2px', marginRight: '0.4rem', color: 'var(--accent)' }} />Attendance Trend</h3>
            <span className="dash-chart-card__sub">Last 6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={attendance_trend}>
              <defs>
                <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }} />
              <Area type="monotone" dataKey="present" stroke="#10b981" fill="url(#colorPresent)" strokeWidth={2} name="Present" />
              <Area type="monotone" dataKey="absent" stroke="#f43f5e" fill="url(#colorAbsent)" strokeWidth={2} name="Absent" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="dash-chart-card">
          <div className="dash-chart-card__header">
            <h3><HiOutlineUserGroup style={{ verticalAlign: '-2px', marginRight: '0.4rem', color: 'var(--accent)' }} />Departments</h3>
          </div>
          {department_distribution.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 0' }}><p>No department data</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={department_distribution}
                  cx="50%" cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  outerRadius={100}
                  dataKey="value"
                >
                  {department_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row: Payroll Trend + Leave Distribution ── */}
      <div className="dash-charts-row">
        <div className="dash-chart-card dash-chart-card--wide">
          <div className="dash-chart-card__header">
            <h3><HiOutlineCurrencyDollar style={{ verticalAlign: '-2px', marginRight: '0.4rem', color: 'var(--accent)' }} />Payroll Cost Trend</h3>
            <span className="dash-chart-card__sub">
              FY {new Date().getFullYear()} · Total: ₹{(kpi.total_payroll_year || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={payroll_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={v => `₹${v.toLocaleString('en-IN')}`}
                contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}
              />
              <Bar dataKey="total_cost" fill="#0d9488" radius={[6, 6, 0, 0]} name="Cost" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dash-chart-card">
          <div className="dash-chart-card__header">
            <h3><HiOutlineCalendar style={{ verticalAlign: '-2px', marginRight: '0.4rem', color: 'var(--accent)' }} />Leave Overview</h3>
          </div>
          <div className="dash-leave-stats">
            {leave_chart.map((item, i) => (
              <div key={i} className="dash-leave-stat" style={{ '--stat-color': item.color }}>
                <span className="dash-leave-stat__value">{item.value}</span>
                <span className="dash-leave-stat__label">{item.name}</span>
                <div className="dash-leave-stat__bar">
                  <div
                    className="dash-leave-stat__fill"
                    style={{
                      width: `${Math.min(100, (item.value / Math.max(1, leave_chart.reduce((s, c) => s + c.value, 0))) * 100)}%`,
                      background: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="dash-today-status">
            <div className="dash-today-item">
              <span className="dash-today-dot" style={{ background: '#10b981' }} />
              <span>Present: {kpi.today_present}</span>
            </div>
            <div className="dash-today-item">
              <span className="dash-today-dot" style={{ background: '#f59e0b' }} />
              <span>On Leave: {kpi.today_on_leave}</span>
            </div>
            <div className="dash-today-item">
              <span className="dash-today-dot" style={{ background: '#ef4444' }} />
              <span>Absent: {kpi.today_absent}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row: Recent Hires + Top Earners ── */}
      <div className="dash-tables-row">
        <div className="dash-table-card">
          <div className="dash-table-card__header">
            <h3><HiOutlineBriefcase style={{ verticalAlign: '-2px', marginRight: '0.4rem', color: 'var(--accent)' }} />Recent Hires</h3>
          </div>
          {recent_hires.length === 0 ? (
            <div className="empty-state" style={{ padding: '1rem 0' }}><p>No recent hires</p></div>
          ) : (
            <div className="dash-table-list">
              {recent_hires.map((h, i) => (
                <div
                  key={h.id}
                  className="dash-table-item"
                  onClick={() => isAdmin ? navigate(`/employees/${h.id}`) : null}
                  style={{ cursor: isAdmin ? 'pointer' : 'default' }}
                >
                  <div className="dash-table-item__rank">{i + 1}</div>
                  <div className="dash-table-item__avatar">{h.name[0]}</div>
                  <div className="dash-table-item__info">
                    <span className="dash-table-item__name">{h.name}</span>
                    <span className="dash-table-item__sub">{h.designation} · {h.department}</span>
                  </div>
                  <span className="dash-table-item__extra">{h.date_of_joining}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="dash-table-card">
            <div className="dash-table-card__header">
              <h3><HiOutlineCurrencyDollar style={{ verticalAlign: '-2px', marginRight: '0.4rem', color: 'var(--accent)' }} />Top Earners</h3>
            </div>
            {top_earners.length === 0 ? (
              <div className="empty-state" style={{ padding: '1rem 0' }}><p>No data</p></div>
            ) : (
              <div className="dash-table-list">
                {top_earners.map((e, i) => (
                  <div
                    key={e.id}
                    className="dash-table-item"
                    onClick={() => navigate(`/employees/${e.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="dash-table-item__rank" style={{ background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--bg-tertiary)', color: i < 3 ? '#fff' : 'var(--text-secondary)' }}>
                      {i + 1}
                    </div>
                    <div className="dash-table-item__avatar">{e.name[0]}</div>
                    <div className="dash-table-item__info">
                      <span className="dash-table-item__name">{e.name}</span>
                      <span className="dash-table-item__sub">{e.department}</span>
                    </div>
                    <span className="dash-table-item__extra" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      ₹{(e.salary || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
