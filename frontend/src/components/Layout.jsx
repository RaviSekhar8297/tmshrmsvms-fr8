import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { policiesAPI } from '../services/api';
import Sidebar from './Sidebar';
import Header from './Header';
import PolicyPopup from './PolicyPopup';
import Chatbot from './Chatbot';
import './Layout.css';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPolicyPopup, setShowPolicyPopup] = useState(false);
  const [checkingPolicies, setCheckingPolicies] = useState(true);
  const { user, loading } = useAuth();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarOpen && !e.target.closest('.sidebar') && !e.target.closest('.menu-toggle')) {
        setSidebarOpen(false);
        document.body.classList.remove('sidebar-open');
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [sidebarOpen]);

  // Check for unread policies when user is logged in
  useEffect(() => {
    const checkUnreadPolicies = async () => {
      if (!loading && user) {
        try {
          setCheckingPolicies(true);
          const response = await policiesAPI.getUnread();
          const unreadPolicies = response.data || [];
          
          // Only show popup if there are unread policies
          if (unreadPolicies.length > 0) {
            // Check if we've already shown the popup in this session
            const popupShown = sessionStorage.getItem('policyPopupShown');
            if (!popupShown) {
              setShowPolicyPopup(true);
              sessionStorage.setItem('policyPopupShown', 'true');
            }
          }
        } catch (error) {
          console.error('Error checking unread policies:', error);
        } finally {
          setCheckingPolicies(false);
        }
      } else if (!loading && !user) {
        setCheckingPolicies(false);
      }
    };

    checkUnreadPolicies();
  }, [user, loading]);

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} onClose={() => {
        setSidebarOpen(false);
        document.body.classList.remove('sidebar-open');
      }} />
      <div className="main-content">
        <Header onMenuClick={() => {
          setSidebarOpen(!sidebarOpen);
          document.body.classList.toggle('sidebar-open', !sidebarOpen);
        }} />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
      {showPolicyPopup && (
        <PolicyPopup onClose={() => setShowPolicyPopup(false)} />
      )}
      {user && <Chatbot />}
    </div>
  );
};

export default Layout;






