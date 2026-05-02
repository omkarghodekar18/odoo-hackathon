import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import logoImg from '../assets/logo.png';
import { FiUploadCloud, FiX } from 'react-icons/fi';

export default function Register() {
  const [form, setForm] = useState({ company_name: '', email: '', password: '', confirm_password: '', phone: '' });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const { registerCompany } = useAuth();
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Logo must be less than 2MB');
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('company_name', form.company_name);
      formData.append('email', form.email);
      formData.append('password', form.password);
      formData.append('confirm_password', form.confirm_password);
      if (form.phone) formData.append('phone', form.phone);
      if (logoFile) formData.append('logo', logoFile);

      await registerCompany(formData);
      toast.success('Company registered! Please sign in with your admin email.');
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
      <div className="auth-card auth-card--wide">
        <div className="auth-card__header">
          <img src={logoImg} alt="EmPay" style={{ height: 48, margin: '0 auto 1rem', display: 'block' }} />
          <h1>Register Company</h1>
          <p>Create a workspace for your organization</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-card__form">
          <div className="logo-upload-container">
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
            {!logoPreview ? (
              <div className="logo-dropzone" onClick={() => fileInputRef.current?.click()}>
                <FiUploadCloud size={24} />
                <span>Upload Company Logo</span>
                <small>PNG, JPG up to 2MB</small>
              </div>
            ) : (
              <div className="logo-preview-wrapper">
                <img src={logoPreview} alt="Logo preview" className="logo-preview-img" />
                <button type="button" className="logo-remove-btn" onClick={removeLogo}>
                  <FiX size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="company_name">Company Name</label>
            <input id="company_name" value={form.company_name} onChange={update('company_name')} placeholder="Acme Corp" required />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="reg_email">Admin Email</label>
              <input id="reg_email" type="email" value={form.email} onChange={update('email')} placeholder="admin@company.com" required />
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone (Optional)</label>
              <input id="phone" value={form.phone} onChange={update('phone')} placeholder="+1 234 567 8900" />
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="reg_password">Admin Password</label>
              <input id="reg_password" type="password" value={form.password} onChange={update('password')} placeholder="••••••••" required />
            </div>
            <div className="form-group">
              <label htmlFor="confirm">Confirm Password</label>
              <input id="confirm" type="password" value={form.confirm_password} onChange={update('confirm_password')} placeholder="••••••••" required />
            </div>
          </div>
          
          <button type="submit" className="btn btn--primary btn--full" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Registering...' : 'Register Company'}
          </button>
        </form>
        
        <div className="auth-card__footer">
          <p>Already have an account? <Link to="/login">Sign In</Link></p>
        </div>
      </div>
    </div>
  );
}
