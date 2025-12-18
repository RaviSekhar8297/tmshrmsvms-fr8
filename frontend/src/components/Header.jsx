import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiSearch, FiBell, FiMenu, FiSun, FiMoon } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI, tasksAPI, projectsAPI, issuesAPI } from '../services/api';
import './Header.css';

const Header = ({ onMenuClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [notifCounts, setNotifCounts] = useState({ projects: 0, issues: 0, tasks: 0 });
  const notificationWrapperRef = useRef(null);

  useEffect(() => {
    fetchUnreadCount();
    fetchSummaryCounts();
    // Check saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount();
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchSummaryCounts = async () => {
    try {
      const [taskStats, projectStats, issueStats] = await Promise.all([
        tasksAPI.getStats(),
        projectsAPI.getStats(),
        issuesAPI.getStats()
      ]);
      setNotifCounts({
        projects: projectStats?.total || 0,
        issues: issueStats?.open || 0,
        tasks: taskStats?.total || 0
      });
    } catch (error) {
      console.error('Error fetching notification counts:', error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await notificationsAPI.getAll({ limit: 10 });
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleNotificationClick = async (e) => {
    e.stopPropagation();
    if (!showNotifications) {
      await fetchNotifications();
      setShowNotifications(true);
    } else {
      setShowNotifications(false);
    }
  };

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationWrapperRef.current &&
        !notificationWrapperRef.current.contains(event.target) &&
        showNotifications
      ) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const toggleTheme = () => {
    const newTheme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const formatDate = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-toggle" onClick={onMenuClick}>
          <FiMenu />
        </button>
        <div className="header-title">
          <p className="header-date">{formatDate()}</p>
        </div>
      </div>

      <div className="header-right">
        <div className="search-box header-search">
          <FiSearch className="search-box-icon" />
          <input
            type="text"
            placeholder="Search..."
            className="form-input"
          />
        </div>

        <button className="theme-toggle-btn" onClick={toggleTheme} title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          {isDarkMode ? <FiSun /> : <FiMoon />}
        </button>

        <div className="notification-wrapper" ref={notificationWrapperRef}>
          <button className="notification-btn" onClick={handleNotificationClick}>
            <FiBell />
            {(unreadCount + notifCounts.projects + notifCounts.issues + notifCounts.tasks) > 0 && (
              <span className="notification-badge">
                {unreadCount + notifCounts.projects + notifCounts.issues + notifCounts.tasks}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <h4>Notifications</h4>
                <button 
                  className="mark-all-read"
                  onClick={async () => {
                    await notificationsAPI.markAllAsRead();
                    setUnreadCount(0);
                    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
                  }}
                >
                  Mark all read
                </button>
              </div>
              <div className="notification-summary">
                <div className="summary-row">
                  <span>Projects</span>
                  <strong>{notifCounts.projects}</strong>
                </div>
                <div className="summary-row">
                  <span>Open Issues</span>
                  <strong>{notifCounts.issues}</strong>
                </div>
                <div className="summary-row">
                  <span>Tasks Assigned</span>
                  <strong>{notifCounts.tasks}</strong>
                </div>
              </div>
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="empty-notifications">
                    <p>No notifications</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                    >
                      <div className="notification-content">
                        <h5>{notification.title}</h5>
                        <p>{notification.message?.substring(0, 60)}...</p>
                        <span className="notification-time">
                          {new Date(notification.sent_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="header-user">
          <div 
            className="avatar" 
            onClick={() => navigate('/profile')}
            style={{ cursor: 'pointer' }}
            title="View Profile"
          >
            {user?.image_base64 ? (
              <img src={user.image_base64} alt={user?.name} />
            ) : (
              user?.name?.charAt(0).toUpperCase()
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
