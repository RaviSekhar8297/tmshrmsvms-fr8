import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  FiFolder, FiCheckSquare, FiAlertCircle, FiUsers, 
  FiCalendar, FiClock, FiArrowRight, FiTrendingUp
} from 'react-icons/fi';
import { dashboardAPI } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [progress, setProgress] = useState(null);
  const [birthdays, setBirthdays] = useState([]);
  const [anniversaries, setAnniversaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const todayMatches = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getMonth() === new Date().getMonth() && d.getDate() === new Date().getDate();
  };

  const filterByToday = (list, dateKeys = [], fallbackToAll = false) => {
    const filtered = list.filter((person) => {
      return dateKeys.some((key) => person[key] && todayMatches(person[key]));
    });
    return filtered.length > 0 ? filtered : (fallbackToAll ? list : []);
  };

  const getYearsCompleted = (dateStr) => {
    if (!dateStr) return 0;
    const start = new Date(dateStr);
    const now = new Date();
    let years = now.getFullYear() - start.getFullYear();
    const isBeforeAnniversary =
      now.getMonth() < start.getMonth() ||
      (now.getMonth() === start.getMonth() && now.getDate() < start.getDate());
    return isBeforeAnniversary ? Math.max(0, years - 1) : Math.max(0, years);
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Check for calendar connection status from OAuth callback
    const calendarConnected = searchParams.get('calendar_connected');
    const calendarError = searchParams.get('calendar_error');
    
    if (calendarConnected === 'true') {
      // Show success message
      setTimeout(() => {
        toast.success('Google Calendar connected successfully!');
        // Remove query param
        setSearchParams({});
      }, 500);
    } else if (calendarError === 'true') {
      // Show error message
      setTimeout(() => {
        toast.error('Failed to connect Google Calendar. Please try again from Settings.');
        // Remove query param
        setSearchParams({});
      }, 500);
    }
  }, [searchParams, setSearchParams]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, activitiesRes, progressRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getActivities(10),
        dashboardAPI.getProgress()
      ]);
      
      setStats(statsRes.data);
      setActivities(activitiesRes.data);
      setProgress(progressRes.data);
      
      // Fetch birthdays and anniversaries separately to handle errors gracefully
      try {
        const birthdaysRes = await dashboardAPI.getBirthdays();
        const birthdayData = birthdaysRes.data || [];
        const todaysOrAllBirthdays = filterByToday(
          birthdayData,
          ['dob', 'date', 'date_of_birth', 'birth_date'],
          true // show all if no birthdays today
        );
        setBirthdays(todaysOrAllBirthdays);
      } catch (error) {
        console.error('Error fetching birthdays:', error);
        setBirthdays([]);
      }
      
      try {
        const anniversariesRes = await dashboardAPI.getAnniversaries();
        const anniversaryData = anniversariesRes.data || [];
        const todaysOrAll = filterByToday(
          anniversaryData,
          ['doj', 'date', 'joining_date', 'anniversary_date'],
          true // fall back to all if no anniversaries today
        ).map((person) => {
          const joiningDate = person.doj || person.joining_date || person.date || person.anniversary_date;
          return {
            ...person,
            years: person.years ?? getYearsCompleted(joiningDate),
          };
        });
        setAnniversaries(todaysOrAll);
      } catch (error) {
        console.error('Error fetching anniversaries:', error);
        setAnniversaries([]);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9'];

  const getPersonName = (person) =>
    person?.name ||
    person?.full_name ||
    person?.employee_name ||
    person?.emp_name ||
    'Unknown';

  const getPersonId = (person) =>
    person?.empid || person?.employee_id || person?.id || person?.code || '-';

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const projectChartData = progress?.projects ? 
    progress.projects.labels.map((label, index) => ({
      name: label,
      value: progress.projects.data[index]
    })).filter(item => item.value > 0) : [];

  const taskChartData = progress?.tasks ?
    progress.tasks.labels.map((label, index) => ({
      name: label,
      value: progress.tasks.data[index]
    })) : [];

  return (
    <div className="dashboard">
      <div className="dashboard-topline">
        <div className="topline-title">
          <span className="pill">Dashboard</span>
          <h2>Overview</h2>
        </div>
        <div className="user-meta-strip">
          <div className="user-chip">
            <span className="chip-label">User</span>
            <span className="chip-value">{user?.name || 'Unknown'}</span>
          </div>
          <div className="user-chip">
            <span className="chip-label">Profile Type</span>
            <span className="chip-value">{user?.role || user?.profile_type || 'N/A'}</span>
          </div>
          <div className="user-chip">
            <span className="chip-label">Dashboard</span>
            <span className="chip-value">Overview</span>
          </div>
        </div>
      </div>

      <div className="welcome-banner">
        <div className="welcome-content">
          <h2>WELCOME BACK, {user?.name.toUpperCase()?.split(' ')[0]}! 👋</h2>
          <p>Here's what's happening with your projects today.</p>
        </div>
        <div className="welcome-image">
          <FiTrendingUp className="welcome-icon" />
        </div>
      </div>

      {/* <div className="user-meta-strip">
        <div className="user-chip">
          <span className="chip-label">User</span>
          <span className="chip-value">{user?.name || 'Unknown'}</span>
        </div>
        <div className="user-chip">
          <span className="chip-label">Profile Type</span>
          <span className="chip-value">{user?.role || user?.profile_type || 'N/A'}</span>
        </div>
        <div className="user-chip">
          <span className="chip-label">Dashboard</span>
          <span className="chip-value">Overview</span>
        </div>
      </div> */}

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-inner">
            <div className="stat-left">
              <div className="stat-icon primary">
                <FiFolder />
              </div>
              <p className="stat-label">Total Projects</p>
            </div>
            <div className="stat-right">
              <h4 className="stat-count">{stats?.total_projects || 0}</h4>
            </div>
          </div>
          <div className="stat-progress">
            <div className="progress-bar">
              <div 
                className="progress-bar-fill primary" 
                style={{ width: `${stats?.total_projects ? (stats.completed_projects / stats.total_projects * 100) : 0}%` }}
              ></div>
            </div>
            <span>{stats?.completed_projects || 0} completed</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-inner">
            <div className="stat-left">
              <div className="stat-icon success">
                <FiCheckSquare />
              </div>
              <p className="stat-label">Total Tasks</p>
            </div>
            <div className="stat-right">
              <h4 className="stat-count">{stats?.total_tasks || 0}</h4>
            </div>
          </div>
          <div className="stat-progress">
            <div className="progress-bar">
              <div 
                className="progress-bar-fill success" 
                style={{ width: `${stats?.total_tasks ? (stats.completed_tasks / stats.total_tasks * 100) : 0}%` }}
              ></div>
            </div>
            <span>{stats?.completed_tasks || 0} completed</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-inner">
            <div className="stat-left">
              <div className="stat-icon warning">
                <FiAlertCircle />
              </div>
              <p className="stat-label">Total Issues</p>
            </div>
            <div className="stat-right">
              <h4 className="stat-count">{stats?.total_issues || 0}</h4>
            </div>
          </div>
          <div className="stat-progress">
            <div className="progress-bar">
              <div 
                className="progress-bar-fill warning" 
                style={{ width: `${stats?.total_issues ? (stats.resolved_issues / stats.total_issues * 100) : 0}%` }}
              ></div>
            </div>
            <span>{stats?.resolved_issues || 0} resolved</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-inner">
            <div className="stat-left">
              <div className="stat-icon info">
                <FiUsers />
              </div>
              <p className="stat-label">Team Members</p>
            </div>
            <div className="stat-right">
              <h4 className="stat-count">{stats?.total_teams || 0}</h4>
            </div>
          </div>
          <div className="stat-meta">
            <FiCalendar />
            <span>{stats?.today_meetings || 0} meetings today</span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="quick-stat pending">
          <span className="quick-stat-value">{stats?.pending_projects || 0}</span>
          <span className="quick-stat-label">Pending Projects</span>
        </div>
        <div className="quick-stat progress">
          <span className="quick-stat-value">{stats?.in_progress_projects || 0}</span>
          <span className="quick-stat-label">In Progress</span>
        </div>
        <div className="quick-stat tasks">
          <span className="quick-stat-value">{stats?.pending_tasks || 0}</span>
          <span className="quick-stat-label">Pending Tasks</span>
        </div>
        <div className="quick-stat issues">
          <span className="quick-stat-value">{stats?.pending_issues || 0}</span>
          <span className="quick-stat-label">Open Issues</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="dashboard-row">
        <div className="card chart-card">
          <div className="card-header">
            <h3 className="card-title">Project Overview</h3>
          </div>
          <div className="chart-container">
            {projectChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={projectChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {projectChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      background: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">
                <p>No project data available</p>
              </div>
            )}
            <div className="chart-legend">
              {projectChartData.map((entry, index) => (
                <div key={entry.name} className="legend-item">
                  <span className="legend-dot" style={{ background: COLORS[index % COLORS.length] }}></span>
                  <span className="legend-label">{entry.name}</span>
                  <span className="legend-value">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card chart-card">
          <div className="card-header">
            <h3 className="card-title">Task Distribution</h3>
          </div>
          <div className="chart-container">
            {taskChartData.some(item => item.value > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={taskChartData}>
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <YAxis 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      background: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">
                <p>No task data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Birthdays and Anniversaries - side by side like charts */}
      <div className="dashboard-row marquee-grid">
        {/* Birthdays Card */}
        <div className="card chart-card marquee-card-wrap">
          <div className="card-header">
            <h3 className="card-title">🎂 Birthdays</h3>
          </div>
          <div className="marquee-container">
            {birthdays.length === 0 ? (
              <div className="empty-state full-height-center">
                <p>No birthdays to show</p>
              </div>
            ) : (
              <div className="marquee-track">
                {[...birthdays, ...birthdays].map((person, idx) => (
                  <div key={`${person.id || person.empid}-${idx}`} className="marquee-card">
                    <div className="marquee-avatar">
                      {person.image_base64 ? (
                        <img src={person.image_base64} alt={getPersonName(person)} />
                      ) : (
                        <div className="marquee-avatar-fallback">
                          {getPersonName(person)?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="marquee-info">
                      <div className="marquee-name">{getPersonName(person)}</div>
                      <div className="marquee-id">{getPersonId(person)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Anniversaries Card */}
        <div className="card chart-card marquee-card-wrap">
          <div className="card-header">
            <h3 className="card-title">🎉 Anniversaries</h3>
          </div>
          <div className="marquee-container">
            {anniversaries.length === 0 ? (
              <div className="empty-state full-height-center">
                <p>No anniversaries to show</p>
              </div>
            ) : (
              <div className="marquee-track">
                {[...anniversaries, ...anniversaries].map((person, idx) => (
                  <div key={`${person.id || person.empid}-${idx}`} className="marquee-card">
                    <div className="marquee-avatar">
                      {person.image_base64 ? (
                        <img src={person.image_base64} alt={getPersonName(person)} />
                      ) : (
                        <div className="marquee-avatar-fallback">
                          {getPersonName(person)?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                      )}
                    </div>
                    <div className="marquee-info">
                      <div className="marquee-name">{getPersonName(person)}</div>
                      <div className="marquee-id">{getPersonId(person)}</div>
                      <div className="marquee-years">{person.years} {person.years === 1 ? 'year' : 'years'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="card activities-card">
        <div className="card-header">
          <h3 className="card-title">Recent Activities</h3>
        </div>
        <div className="activities-grid">
          {activities.length === 0 ? (
            <div className="empty-state">
              <FiClock className="empty-state-icon" style={{ fontSize: '2rem' }} />
              <p>No recent activities</p>
            </div>
          ) : (
            activities.map((activity, index) => (
              <div key={activity.id} className="activity-card" style={{ animationDelay: `${index * 0.05}s` }}>
                <div className="activity-card-header">
                  <div className="activity-avatar">
                    {activity.user_image ? (
                      <img src={activity.user_image} alt={activity.user_name} />
                    ) : (
                      <span>{activity.user_name?.charAt(0)?.toUpperCase() || 'U'}</span>
                    )}
                  </div>
                  <div className="activity-card-info">
                    <h4 className="activity-user-name">{activity.user_name?.toUpperCase() || 'Unknown User'}</h4>
                    <span className="activity-time">
                      {new Date(activity.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="activity-card-body">
                  <p className="activity-action">
                    <span className="activity-action-text">{activity.action}</span> {activity.entity_type}
                    {activity.entity_name && <span className="activity-entity"> "{activity.entity_name}"</span>}
                  </p>
                  {activity.details && (
                    <p className="activity-details">{activity.details}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;






