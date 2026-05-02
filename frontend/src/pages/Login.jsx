import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

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
          <h1>Welcome to EmPay</h1>
          <p>Sign in to manage your workspace</p>
        </div>
        <form onSubmit={handleSubmit} className="auth-card__form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@empay.com" required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="auth-card__footer">
          <p>Don't have an account? <Link to="/register">Sign Up</Link></p>
        </div>
        <div className="auth-card__demo">
          <p>Demo Credentials:</p>
          <div className="auth-card__demo-grid">
            <button type="button" onClick={() => { setEmail('admin@empay.com'); setPassword('admin123'); }} className="demo-btn">Admin</button>
            <button type="button" onClick={() => { setEmail('hr@empay.com'); setPassword('hr123'); }} className="demo-btn">HR</button>
            <button type="button" onClick={() => { setEmail('payroll@empay.com'); setPassword('payroll123'); }} className="demo-btn">Payroll</button>
            <button type="button" onClick={() => { setEmail('john@empay.com'); setPassword('emp123'); }} className="demo-btn">Employee</button>
          </div>
        </div>
      </div>
    </div>
  );
}
