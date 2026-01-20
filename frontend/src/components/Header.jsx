import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiBell, FiMenu, FiSun, FiMoon } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI } from '../services/api';
import './Header.css';

const Header = ({ onMenuClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const notificationWrapperRef = useRef(null);

  useEffect(() => {
    fetchUnreadCount();
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
        <button 
          className={`theme-toggle-btn refresh-btn ${isRefreshing ? 'refreshing' : ''}`}
          onClick={() => {
            setIsRefreshing(true);
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }} 
          title="Refresh Page"
          disabled={isRefreshing}
        >
          <FiRefreshCw />
        </button>

        <button className="theme-toggle-btn" onClick={toggleTheme} title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          {isDarkMode ? <FiSun /> : <FiMoon />}
        </button>

        <div className="notification-wrapper" ref={notificationWrapperRef}>
          <button className="notification-btn" onClick={handleNotificationClick}>
            <FiBell />
            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount}
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
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="empty-notifications">
                    <p>No notifications</p>
                    <small style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '8px', display: 'block' }}>
                      You're all caught up!
                    </small>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const timeAgo = (() => {
                      const now = new Date();
                      const sent = new Date(notification.sent_at);
                      const diffMs = now - sent;
                      const diffMins = Math.floor(diffMs / 60000);
                      const diffHours = Math.floor(diffMs / 3600000);
                      const diffDays = Math.floor(diffMs / 86400000);
                      
                      if (diffMins < 1) return 'Just now';
                      if (diffMins < 60) return `${diffMins}m ago`;
                      if (diffHours < 24) return `${diffHours}h ago`;
                      if (diffDays < 7) return `${diffDays}d ago`;
                      return sent.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    })();

                    return (
                      <div 
                        key={notification.id} 
                        className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                        onClick={() => {
                          // Navigate to notification or mark as read
                          if (!notification.is_read) {
                            notificationsAPI.markAsRead(notification.id);
                            setNotifications(notifications.map(n => 
                              n.id === notification.id ? { ...n, is_read: true } : n
                            ));
                            setUnreadCount(prev => Math.max(0, prev - 1));
                          }
                        }}
                      >
                        <div className="notification-content">
                          <h5>{notification.title}</h5>
                          <p>{notification.message || 'No message'}</p>
                          <span className="notification-time">
                            {timeAgo}
                          </span>
                        </div>
                      </div>
                    );
                  })
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
            {user?.role === 'Front Desk' ? (
              user?.name?.charAt(0).toUpperCase()
            ) : user?.image_base64 ? (
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
