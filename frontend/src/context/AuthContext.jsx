import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('empay_token');
    const savedUser = localStorage.getItem('empay_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });
    const { access_token, user: userData } = res.data;
    localStorage.setItem('empay_token', access_token);
    localStorage.setItem('empay_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const register = async (email, password, full_name, role = 'employee') => {
    const res = await API.post('/auth/register', { email, password, full_name, role });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('empay_token');
    localStorage.removeItem('empay_user');
    setUser(null);
  };

  const hasRole = (...roles) => {
    return user && roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
