import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '', role: 'employee' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await register(form.email, form.password, form.full_name, form.role);
      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="auth-page">
      <div className="auth-page__bg">
        <div className="auth-page__orb auth-page__orb--1" />
        <div className="auth-page__orb auth-page__orb--2" />
        <div className="auth-page__orb auth-page__orb--3" />
      </div>
      <div className="auth-card">
        <div className="auth-card__header">
          <div className="auth-card__logo">EP</div>
          <h1>Create Account</h1>
          <p>Join EmPay to streamline your HR operations</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-card__form">
          <div className="form-group">
            <label htmlFor="full_name">Full Name</label>
            <input id="full_name" value={form.full_name} onChange={update('full_name')} placeholder="John Doe" required />
          </div>
          <div className="form-group">
            <label htmlFor="reg_email">Email</label>
            <input id="reg_email" type="email" value={form.email} onChange={update('email')} placeholder="you@empay.com" required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="reg_password">Password</label>
              <input id="reg_password" type="password" value={form.password} onChange={update('password')} placeholder="••••••••" required />
            </div>
            <div className="form-group">
              <label htmlFor="confirm">Confirm</label>
              <input id="confirm" type="password" value={form.confirm} onChange={update('confirm')} placeholder="••••••••" required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select id="role" value={form.role} onChange={update('role')}>
              <option value="employee">Employee</option>
              <option value="hr_officer">HR Officer</option>
              <option value="payroll_officer">Payroll Officer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <div className="auth-card__footer">
          <p>Already have an account? <Link to="/login">Sign In</Link></p>
        </div>
      </div>
    </div>
  );
}
