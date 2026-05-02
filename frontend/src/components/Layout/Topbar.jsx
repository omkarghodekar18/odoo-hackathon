import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API from '../../api';
import toast from 'react-hot-toast';
import {
  HiOutlineMenu, HiOutlineBell, HiOutlineLogin, HiOutlineLogout,
  HiOutlineUser, HiOutlineChevronDown,
} from 'react-icons/hi';

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const dropdownRef = useRef(null);

  const roleColors = {
    admin: '#ef4444',
    hr_officer: '#8b5cf6',
    payroll_officer: '#f59e0b',
    employee: '#0d9488',
  };

  // Fetch today's attendance status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await API.get('/attendance/today');
        setIsCheckedIn(!!res.data?.is_logged_in);
      } catch {
        // No employee profile or error — not checked in
        setIsCheckedIn(false);
      }
    };
    fetchStatus();
  }, []);

  // Live clock when checked in
  useEffect(() => {
    if (!isCheckedIn) { setCurrentTime(''); return; }
    const tick = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [isCheckedIn]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCheckIn = async () => {
    setCheckLoading(true);
    try {
      await API.post('/attendance/login');
      toast.success('Checked in successfully!');
      setIsCheckedIn(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Check in failed');
    } finally { setCheckLoading(false); }
  };

  const handleCheckOut = async () => {
    setCheckLoading(true);
    try {
      await API.post('/attendance/logout');
      toast.success('Checked out successfully!');
      setIsCheckedIn(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Check out failed');
    } finally { setCheckLoading(false); }
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/login');
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
        {/* Check In / Check Out */}
        <div className="topbar__attendance">
          {!isCheckedIn ? (
            <button
              className="topbar__check-btn topbar__check-btn--in"
              onClick={handleCheckIn}
              disabled={checkLoading}
            >
              <HiOutlineLogin />
              {checkLoading ? 'Starting…' : 'Check In →'}
            </button>
          ) : (
            <div className="topbar__checked-in-group">
              {currentTime && <span className="topbar__live-time">{currentTime}</span>}
              <button
                className="topbar__check-btn topbar__check-btn--out"
                onClick={handleCheckOut}
                disabled={checkLoading}
              >
                <HiOutlineLogout />
                {checkLoading ? 'Ending…' : 'Check Out →'}
              </button>
            </div>
          )}
        </div>

        {/* Notification */}
        <button className="topbar__icon-btn">
          <HiOutlineBell />
        </button>

        {/* Profile Avatar + Dropdown */}
        <div className="topbar__profile-wrapper" ref={dropdownRef}>
          <button
            className="topbar__avatar-btn"
            onClick={() => setDropdownOpen(o => !o)}
            aria-expanded={dropdownOpen}
          >
            <div className="topbar__user-avatar" style={{ background: roleColors[user?.role] || '#3b82f6' }}>
              {user?.full_name?.charAt(0)}
            </div>
            <span className={`topbar__status-dot ${isCheckedIn ? 'topbar__status-dot--active' : ''}`} />
            <HiOutlineChevronDown className={`topbar__chevron ${dropdownOpen ? 'topbar__chevron--open' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="topbar__dropdown">
              <div className="topbar__dropdown-header">
                <div className="topbar__dropdown-avatar" style={{ background: roleColors[user?.role] || '#3b82f6' }}>
                  {user?.full_name?.charAt(0)}
                </div>
                <div>
                  <div className="topbar__dropdown-name">{user?.full_name}</div>
                  <div className="topbar__dropdown-role">{user?.role?.replace('_', ' ')}</div>
                </div>
              </div>
              <div className="topbar__dropdown-divider" />
              <button
                className="topbar__dropdown-item"
                onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
              >
                <HiOutlineUser /> My Profile
              </button>
              <button
                className="topbar__dropdown-item topbar__dropdown-item--danger"
                onClick={handleLogout}
              >
                <HiOutlineLogout /> Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
