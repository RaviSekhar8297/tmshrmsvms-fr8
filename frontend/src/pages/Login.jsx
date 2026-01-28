import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiEye, FiEyeOff, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../services/api';
import './Login.css';

const LOGO_URL = 'https://www.brihaspathi.com/highbtlogo%20white-%20tm.png';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const { login, token, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (token && user) {
      // Front Desk users go to VMS add visitor page
      if (user.role === 'Front Desk') {
        navigate('/vms/add', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [token, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      toast.error('Please enter username and password');
      return;
    }
    
    setLoading(true);
    try {
      const userData = await login(username, password);
      // Check if we're redirecting to Google OAuth (calendar connection)
      const pendingConnect = localStorage.getItem('pending_calendar_connect');
      if (pendingConnect === 'true') {
        // Don't navigate, OAuth redirect will happen
        setLoading(false);
        return;
      }
      toast.success('Login successful!');
      // Redirect Front Desk users to Add Visitor page, others to Dashboard
      if (userData.role === 'Front Desk') {
        navigate('/vms/add', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Login failed. Please check your credentials.';
      toast.error(errorMessage);
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setVerifyingEmail(true);
    try {
      await api.post('/auth/forgot-password', {
        email: forgotPasswordEmail.trim()
      });
      toast.success('Password reset successful! Please check your email for the new password.');
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || 'Failed to reset password';
      if (errorMsg.toLowerCase().includes('not found') || errorMsg.toLowerCase().includes('user not found')) {
        toast.error('User Not found');
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setVerifyingEmail(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-bg">
        <div className="login-bg-gradient"></div>
        <div className="login-bg-pattern"></div>
      </div>
      
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <img src={LOGO_URL} alt="TMS Logo" className="logo-image" />
          </div>
          <h1>Welcome Back</h1>
          <p>Sign in to your Task Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Employee ID</label>
            <div className="input-with-icon input-with-prefix" style={{ position: 'relative' }}>
              <FiMail className="input-icon" />
              <span className="input-prefix">BT-</span>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  let value = e.target.value;
                  // Remove BT- prefix if user types it
                  if (value.startsWith('BT-')) {
                    value = value.substring(3);
                  }
                  setUsername(value);
                }}
                className="form-input"
                placeholder={username ? '' : 'Employee ID'}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-with-icon">
              <FiLock className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? (
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}></div>
            ) : (
              'Sign In'
            )}
          </button>
          
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 600,
                padding: '8px 16px',
                borderRadius: '6px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = 'var(--primary)';
              }}
            >
              Forgot Password?
            </button>
          </div>
        </form>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}
          onClick={() => {
            setShowForgotPassword(false);
            setForgotPasswordEmail('');
          }}
        >
          <div 
            style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '450px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              animation: 'slideDownFade 0.3s ease'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Forgot Password
              </h3>
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordEmail('');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  color: 'var(--text-secondary)',
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FiX />
              </button>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.6' }}>
              Enter your email and we'll send you a new password.
            </p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Email Address *
              </label>
              <div className="input-with-icon">
                <FiMail className="input-icon" />
                <input
                  type="email"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  className="form-input"
                  placeholder="Enter your email address"
                  style={{ width: '100%' }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleForgotPassword();
                    }
                  }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordEmail('');
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-hover)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.95rem'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={verifyingEmail}
                className="btn btn-primary"
                style={{
                  padding: '10px 20px',
                  fontSize: '0.95rem'
                }}
              >
                {verifyingEmail ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></div>
                    <span>Verifying...</span>
                  </div>
                ) : (
                  'Verify'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
