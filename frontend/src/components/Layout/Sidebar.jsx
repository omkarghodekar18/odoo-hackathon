import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/logo.png';
import {
  HiOutlineHome, HiOutlineUsers, HiOutlineClipboardCheck,
  HiOutlineCalendar, HiOutlineCurrencyDollar, HiOutlineDocumentReport,
  HiOutlineCog, HiOutlineLogout, HiOutlineX
} from 'react-icons/hi';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: HiOutlineHome, roles: ['admin', 'employee', 'hr_officer', 'payroll_officer'] },
  { path: '/employees', label: 'Employees', icon: HiOutlineUsers, roles: ['admin', 'hr_officer', 'employee', 'payroll_officer'] },
  { path: '/attendance', label: 'Attendance', icon: HiOutlineClipboardCheck, roles: ['admin', 'hr_officer', 'payroll_officer', 'employee'] },
  { path: '/leave', label: 'Time Off', icon: HiOutlineCalendar, roles: ['admin', 'hr_officer', 'payroll_officer', 'employee'] },
  { path: '/payroll', label: 'Payroll', icon: HiOutlineCurrencyDollar, roles: ['admin', 'payroll_officer'] },
  { path: '/payslips', label: 'My Payslips', icon: HiOutlineDocumentReport, roles: ['employee'] },
  { path: '/reports', label: 'Reports', icon: HiOutlineDocumentReport, roles: ['admin', 'payroll_officer'] },
  { path: '/settings', label: 'Settings', icon: HiOutlineCog, roles: ['admin'] },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, company, logout } = useAuth();
  const location = useLocation();

  const filteredNav = navItems.filter(item => item.roles.includes(user?.role));

  const apiBaseUrl = 'http://localhost:8000'; // Assuming standard local dev setup

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="sidebar__logo" style={{ flexShrink: 0 }}>
            {company?.logo ? (
              <img src={`${apiBaseUrl}${company.logo}`} alt={company?.name || 'Company'} className="sidebar__logo-img" style={{ borderRadius: '4px', objectFit: 'contain', width: '120px', maxHeight: '48px' }} />
            ) : (
              <img src={logoImg} alt="EmPay" className="sidebar__logo-img" style={{ width: '120px', maxHeight: '48px', objectFit: 'contain' }} />
            )}
          </div>
          <button className="sidebar__close" onClick={onClose} style={{ marginLeft: 'auto' }}>
            <HiOutlineX />
          </button>
        </div>

        <nav className="sidebar__nav">
          {filteredNav.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
              onClick={onClose}
            >
              <item.icon className="sidebar__link-icon" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <NavLink to="/profile" className="sidebar__link" onClick={onClose}>
            <div className="sidebar__user-avatar">
              {user?.full_name?.charAt(0)}
            </div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">{user?.full_name}</span>
              <span className="sidebar__user-role">{user?.role?.replace('_', ' ')}</span>
            </div>
          </NavLink>
          <button className="sidebar__link sidebar__link--danger" onClick={logout}>
            <HiOutlineLogout className="sidebar__link-icon" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
