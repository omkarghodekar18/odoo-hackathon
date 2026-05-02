import { useAuth } from '../../context/AuthContext';
import { HiOutlineMenu, HiOutlineBell } from 'react-icons/hi';

export default function Topbar({ onMenuClick }) {
  const { user } = useAuth();

  const roleColors = {
    admin: '#ef4444',
    hr_officer: '#8b5cf6',
    payroll_officer: '#f59e0b',
    employee: '#0d9488',
  };

  return (
    <header className="topbar">
      <button className="topbar__menu-btn" onClick={onMenuClick}>
        <HiOutlineMenu />
      </button>

      <div className="topbar__title">
        <h1>EmPay HRMS</h1>
      </div>

      <div className="topbar__right">
        <button className="topbar__icon-btn">
          <HiOutlineBell />
          <span className="topbar__notification-badge">3</span>
        </button>

        <div className="topbar__user">
          <div className="topbar__user-avatar" style={{ background: roleColors[user?.role] || '#3b82f6' }}>
            {user?.full_name?.charAt(0)}
          </div>
          <div className="topbar__user-info">
            <span className="topbar__user-name">{user?.full_name}</span>
            <span className="topbar__role-badge" style={{ background: `${roleColors[user?.role]}22`, color: roleColors[user?.role] }}>
              {user?.role?.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
