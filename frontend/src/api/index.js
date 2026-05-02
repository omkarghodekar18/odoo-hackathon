import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:8000/api',
});

// Request interceptor to attach JWT token
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('empay_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for auth errors
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('empay_token');
      localStorage.removeItem('empay_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default API;
