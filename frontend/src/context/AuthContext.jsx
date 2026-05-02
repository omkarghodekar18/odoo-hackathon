import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('empay_token');
    const savedUser = localStorage.getItem('empay_user');
    const savedCompany = localStorage.getItem('empay_company');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      if (savedCompany) {
        setCompany(JSON.parse(savedCompany));
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });
    const { access_token, user: userData, company: companyData } = res.data;
    localStorage.setItem('empay_token', access_token);
    localStorage.setItem('empay_user', JSON.stringify(userData));
    setUser(userData);
    if (companyData) {
      localStorage.setItem('empay_company', JSON.stringify(companyData));
      setCompany(companyData);
    }

    // Fire attendance login session (non-blocking — only for employee role)
    try {
      await API.post('/attendance/login', {}, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
    } catch (_) {
      // Silently ignore if no employee profile or already logged in
    }

    return userData;
  };

  const registerCompany = async (formData) => {
    const res = await API.post('/auth/register', formData);
    return res.data;
  };

  const logout = async () => {
    // Fire attendance logout session before clearing token (non-blocking)
    try {
      await API.post('/attendance/logout');
    } catch (_) {
      // Silently ignore — no open session or no employee profile
    }

    localStorage.removeItem('empay_token');
    localStorage.removeItem('empay_user');
    localStorage.removeItem('empay_company');
    setUser(null);
    setCompany(null);
  };

  const hasRole = (...roles) => {
    return user && roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, company, login, registerCompany, logout, loading, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
