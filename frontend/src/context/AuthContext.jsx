import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchUser().then(() => {
        // Check if we need to auto-connect calendar after OAuth callback
        const pendingConnect = localStorage.getItem('pending_calendar_connect');
        if (pendingConnect === 'true') {
          localStorage.removeItem('pending_calendar_connect');
        }
      });
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
      // Clear invalid token
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      const { access_token, user: userData, calendar_connected } = response.data;
      
      if (!access_token || !userData) {
        throw new Error('Invalid response from server');
      }
      
      localStorage.setItem('token', access_token);
      setToken(access_token);
      setUser(userData);
      
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      if (error.response) {
        throw new Error(error.response.data?.detail || 'Login failed');
      }
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('theme');
    setToken(null);
    setUser(null);
    // Clear browser history to prevent back button after logout
    window.history.pushState(null, '', '/login');
    window.location.href = '/login';
  };

  const updateUser = (userData) => {
    setUser(userData);
  };

  const hasRole = (roles) => {
    if (!user) return false;
    if (typeof roles === 'string') return user.role === roles;
    return roles.includes(user.role);
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    updateUser,
    hasRole,
    isAdmin: user?.role === 'Admin',
    isHR: user?.role === 'HR',
    isManager: user?.role === 'Manager',
    isEmployee: user?.role === 'Employee',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
