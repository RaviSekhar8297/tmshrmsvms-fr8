import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  FiFolder, FiCheckSquare, FiAlertCircle, FiUsers, 
  FiCalendar, FiClock, FiArrowRight, FiTrendingUp, FiFileText, FiCheckCircle,
  FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import { dashboardAPI, policiesAPI } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [progress, setProgress] = useState(null);
  const [birthdays, setBirthdays] = useState([]);
  const [anniversaries, setAnniversaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [unreadPolicies, setUnreadPolicies] = useState([]);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [acknowledgingPolicy, setAcknowledgingPolicy] = useState(null);
  const [currentPolicyIndex, setCurrentPolicyIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [policySubmitted, setPolicySubmitted] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const acknowledgeSectionRef = useRef(null);
  const [monthlyAttendance, setMonthlyAttendance] = useState(null);
  const [attendanceViewType, setAttendanceViewType] = useState('bars'); // 'bars' or 'circles'
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().getMonth() + 1);
  const [attendanceYear, setAttendanceYear] = useState(new Date().getFullYear());

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

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const promises = [
        dashboardAPI.getStats(),
        dashboardAPI.getActivities(10),
        dashboardAPI.getProgress()
      ];
      
      // Only fetch attendance if user is HR or Admin
      if (user?.role === 'HR' || user?.role === 'Admin') {
        promises.push(dashboardAPI.getMonthlyAttendance(attendanceMonth, attendanceYear));
      }
      
      const results = await Promise.all(promises);
      setStats(results[0].data);
      setActivities(results[1].data);
      setProgress(results[2].data);
      
      if (user?.role === 'HR' || user?.role === 'Admin') {
        setMonthlyAttendance(results[3].data);
      }
      
      // Fetch birthdays and anniversaries separately to handle errors gracefully
      // Only fetch if user is authenticated
      if (user) {
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
          // Silently handle 401 errors - token might be expired
          if (error.response?.status !== 401) {
            console.error('Error fetching birthdays:', error);
          }
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
          // Silently handle 401 errors - token might be expired
          if (error.response?.status !== 401) {
            console.error('Error fetching anniversaries:', error);
          }
          setAnniversaries([]);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, attendanceMonth, attendanceYear]);

  const fetchUnreadPolicies = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await policiesAPI.getUnread();
      const policies = response.data || [];
      
      // Backend already filters by current user's empid, so use directly
      setUnreadPolicies(policies);
      
      // Show modal if there are unread policies
      if (policies.length > 0) {
        setShowPolicyModal(true);
      }
    } catch (error) {
      // Silently handle errors - don't show popup if API fails
      console.error('Error fetching unread policies:', error);
      setUnreadPolicies([]);
    }
  }, [user]);

  useEffect(() => {
    // Only fetch data if user is authenticated
    if (user) {
      fetchDashboardData();
      fetchUnreadPolicies();
    }
  }, [user, fetchDashboardData, fetchUnreadPolicies, attendanceMonth, attendanceYear]);

  // Calculate current policy and page info
  const currentPolicy = unreadPolicies[currentPolicyIndex];
  const totalPages = currentPolicy?.policy?.pages || 1;
  const isLastPage = currentPage === totalPages && totalPages > 0;

  // Reset page and state when policy changes
  useEffect(() => {
    if (currentPolicy) {
      setCurrentPage(1);
      setAcknowledged(false);
      setPolicySubmitted(false);
    }
  }, [currentPolicyIndex, unreadPolicies, currentPolicy]);

  // Auto-scroll to acknowledge section when reaching last page
  useEffect(() => {
    if (isLastPage && acknowledgeSectionRef.current) {
      setTimeout(() => {
        acknowledgeSectionRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end',
          inline: 'nearest'
        });
      }, 300);
    }
  }, [isLastPage]);

  const handleAcknowledgePolicy = async (policyId) => {
    if (!user || !acknowledged) return;
    
    setAcknowledgingPolicy(policyId);
    try {
      await policiesAPI.acknowledge(policyId);
      setPolicySubmitted(true);
      
      // Wait for animation, then remove policy and move to next
      setTimeout(() => {
        const remainingPolicies = unreadPolicies.filter(p => p.id !== policyId);
        setUnreadPolicies(remainingPolicies);
        setPolicySubmitted(false);
        setAcknowledged(false);
        setCurrentPage(1);
        setAcknowledgingPolicy(null);
        
        // Move to next policy or close modal
        if (remainingPolicies.length > 0) {
          // Stay on index 0 (which will be the next policy after filtering)
          setCurrentPolicyIndex(0);
        } else {
          setShowPolicyModal(false);
        }
      }, 2000);
    } catch (error) {
      console.error('Error acknowledging policy:', error);
      toast.error('Failed to acknowledge policy');
      setAcknowledgingPolicy(null);
      setPolicySubmitted(false);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handlePageClick = (pageNum) => {
    setCurrentPage(pageNum);
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9'];

  const getPersonName = (person) =>
    person?.name ||
    person?.full_name ||
    person?.employee_name ||
    person?.emp_name ||
    'Unknown';

  const getPersonId = (person) => {
    // Return designation if available, otherwise "pending"
    const designation = person.designation || person.Designation || person.designation_name;
    return designation && designation.trim() !== '' ? designation : 'Pending';
  }

  if (loading && !stats) {
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
          <span className="pill">DASHBOARD</span>
          {/* <h2>Overview</h2> */}
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

      {/* Monthly Attendance Card - Only for HR and Admin */}
      {monthlyAttendance && (user?.role === 'HR' || user?.role === 'Admin') && (
        <div className="card monthly-attendance-card">
          <div className="card-header attendance-card-header">
            <div className="attendance-header-left">
              <h3 className="card-title">Monthly Attendance</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span className="attendance-subtitle">
                  {new Date(attendanceYear, attendanceMonth - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                {monthlyAttendance?.attendance && Object.keys(monthlyAttendance.attendance).length > 0 && (
                  <span style={{ 
                    fontSize: '0.875rem', 
                    color: 'var(--text-secondary)', 
                    fontWeight: '600',
                    padding: '4px 12px',
                    background: 'var(--bg-hover)',
                    borderRadius: '6px'
                  }}>
                    Total: {monthlyAttendance.attendance[Object.keys(monthlyAttendance.attendance)[0]]?.total || 0} Employees
                  </span>
                )}
              </div>
            </div>
            <div className="attendance-header-actions">
              <div className="attendance-month-navigation">
                <button
                  className="month-nav-btn"
                  onClick={() => {
                    let newMonth = attendanceMonth - 1;
                    let newYear = attendanceYear;
                    if (newMonth < 1) {
                      newMonth = 12;
                      newYear--;
                    }
                    setAttendanceMonth(newMonth);
                    setAttendanceYear(newYear);
                  }}
                  title="Previous Month"
                >
                  <FiChevronLeft />
                </button>
                <button
                  className="month-nav-btn"
                  onClick={() => {
                    const today = new Date();
                    setAttendanceMonth(today.getMonth() + 1);
                    setAttendanceYear(today.getFullYear());
                  }}
                  title="Current Month"
                >
                  Today
                </button>
                <button
                  className="month-nav-btn"
                  onClick={() => {
                    let newMonth = attendanceMonth + 1;
                    let newYear = attendanceYear;
                    if (newMonth > 12) {
                      newMonth = 1;
                      newYear++;
                    }
                    setAttendanceMonth(newMonth);
                    setAttendanceYear(newYear);
                  }}
                  title="Next Month"
                >
                  <FiChevronRight />
                </button>
              </div>
              <div className="attendance-view-toggle">
                <button
                  className={`toggle-btn ${attendanceViewType === 'bars' ? 'active' : ''}`}
                  onClick={() => setAttendanceViewType('bars')}
                  title="Bar View"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <rect x="2" y="10" width="3" height="4" rx="1" />
                    <rect x="7" y="7" width="3" height="7" rx="1" />
                    <rect x="12" y="4" width="3" height="10" rx="1" />
                  </svg>
                  Bars
                </button>
                <button
                  className={`toggle-btn ${attendanceViewType === 'circles' ? 'active' : ''}`}
                  onClick={() => setAttendanceViewType('circles')}
                  title="Circle View"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="4" cy="8" r="2.5" />
                    <circle cx="8" cy="8" r="2.5" />
                    <circle cx="12" cy="8" r="2.5" />
                  </svg>
                  Circles
                </button>
              </div>
            </div>
          </div>
          <div className={`attendance-calendar ${attendanceViewType === 'circles' ? 'circle-view' : 'bar-view'}`}>
            {monthlyAttendance.dates
              .filter((dateStr) => {
                // Filter out future dates - only show current month and previous months
                const date = new Date(dateStr);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                date.setHours(0, 0, 0, 0);
                return date <= today;
              })
              .map((dateStr) => {
              const date = new Date(dateStr);
              const dayOfMonth = date.getDate();
              const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
              const today = new Date();
              const isToday = dateStr === today.toISOString().split('T')[0] && 
                             attendanceMonth === today.getMonth() + 1 && 
                             attendanceYear === today.getFullYear();
              const attendance = monthlyAttendance.attendance[dateStr] || { present: 0, absent: 0, total: 0 };
              const presentCount = attendance.present || 0;
              const absentCount = attendance.absent || 0;
              const totalCount = attendance.total || 0;
              const presentPercentage = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;
              const absentPercentage = totalCount > 0 ? (absentCount / totalCount) * 100 : 0;
              
              // Determine status: Present (green) if presentCount > 0, Absent (red) if 0
              const isPresent = presentCount > 0;
              
              if (attendanceViewType === 'circles') {
                return (
                  <div
                    key={dateStr}
                    className={`attendance-day circle-day ${isToday ? 'today' : ''} ${isPresent ? 'present' : 'absent'}`}
                    title={`${dayOfWeek}, ${dayOfMonth} ${date.toLocaleDateString('en-US', { month: 'short' })}: ${presentCount} Present, ${absentCount} Absent`}
                  >
                    <div className="attendance-day-header">
                      <span className="attendance-day-name">{dayOfWeek}</span>
                      <span className="attendance-day-number">{dayOfMonth}</span>
                    </div>
                    <div className="attendance-circle-container">
                      <div className={`attendance-circle ${isPresent ? 'circle-present' : 'circle-absent'}`}>
                        <span className="circle-count circle-present-count">{presentCount}</span>
                        {absentCount > 0 && (
                          <span className="circle-count circle-absent-count">/{absentCount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
              
              return (
                <div
                  key={dateStr}
                  className={`attendance-day bar-day ${isToday ? 'today' : ''}`}
                  title={`${dayOfWeek}, ${dayOfMonth} ${date.toLocaleDateString('en-US', { month: 'short' })}: ${presentCount} Present, ${absentCount} Absent`}
                >
                  <div className="attendance-day-header">
                    <span className="attendance-day-name">{dayOfWeek}</span>
                    <span className="attendance-day-number">{dayOfMonth}</span>
                  </div>
                  <div className="attendance-bar-container stacked">
                    {absentPercentage > 0 && (
                      <div 
                        className="attendance-bar bar-absent"
                        style={{ 
                          height: `${absentPercentage}%`
                        }}
                        title={`Absent: ${absentCount}`}
                      ></div>
                    )}
                    {presentPercentage > 0 && (
                      <div 
                        className="attendance-bar bar-present"
                        style={{ 
                          height: `${presentPercentage}%`
                        }}
                        title={`Present: ${presentCount}`}
                      ></div>
                    )}
                  </div>
                  <div className="attendance-count">
                    <span className="count-present">{presentCount}</span>
                    {absentCount > 0 && (
                      <span className="count-absent">/{absentCount}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="attendance-legend">
            <div className="legend-item">
              <span className="legend-dot present"></span>
              <span>Present</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot absent"></span>
              <span>Absent</span>
            </div>
          </div>
        </div>
      )}

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
          <div className={`marquee-container ${birthdays.length > 6 ? 'has-many-items' : ''}`}>
            {birthdays.length === 0 ? (
              <div className="empty-state full-height-center">
                <p>No birthdays to show</p>
              </div>
            ) : (
              <div className="marquee-track">
                {[...birthdays, ...birthdays].map((person, idx) => (
                  <div key={`${person.id || person.empid}-${idx}`} className="marquee-card birthday-card-animated">
                    {/* Animated GIF Background */}
                    <div className="celebration-bg">
                      <img 
                        src="https://media.tenor.com/eVpv63c7j9oAAAAM/happybirthday-hbd.gif"
                        alt="Birthday Celebration"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                    
                    {/* Floating Emoji */}
                    <div className="floating-emoji birthday-emoji">🎂</div>
                    
                    {/* Sparkle Effects */}
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="sparkle-dot birthday-sparkle"
                        style={{
                          top: `${15 + i * 12}%`,
                          left: `${10 + i * 15}%`,
                          animationDelay: `${i * 0.15}s`
                        }}
                      />
                    ))}
                    
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
          <div className={`marquee-container ${anniversaries.length > 6 ? 'has-many-items' : ''}`}>
            {anniversaries.length === 0 ? (
              <div className="empty-state full-height-center">
                <p>No anniversaries to show</p>
              </div>
            ) : (
              <div className="marquee-track">
                {[...anniversaries, ...anniversaries].map((person, idx) => (
                  <div key={`${person.id || person.empid}-${idx}`} className="marquee-card anniversary-card-animated">
                    {/* Animated GIF Background */}
                    <div className="celebration-bg">
                      <img 
                        src="https://i.pinimg.com/originals/89/f2/67/89f267bef0f5538b1fbe206b065a6724.gif"
                        alt="Anniversary Celebration"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                    
                    {/* Floating Emoji */}
                    <div className="floating-emoji anniversary-emoji">🎉</div>
                    
                    {/* Sparkle Effects */}
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="sparkle-dot anniversary-sparkle"
                        style={{
                          top: `${15 + i * 12}%`,
                          left: `${10 + i * 15}%`,
                          animationDelay: `${i * 0.15}s`
                        }}
                      />
                    ))}
                    
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

      {/* Policy Popup Modal */}
      <Modal
        isOpen={showPolicyModal && unreadPolicies.length > 0 && currentPolicy}
        onClose={() => {
          // Show toast message when trying to close, but don't actually close
          toast.error('Please read and submit your response to proceed');
        }}
        allowClose={false}
        title=""
        size="full"
      >
        {policySubmitted ? (
          <div className="policy-success-animation">
            <div className="success-checkmark">
              <FiCheckCircle />
            </div>
            <h2 className="success-title">Submitted Successfully!</h2>
            <p className="success-message">Policy acknowledged</p>
          </div>
        ) : currentPolicy && currentPolicy.policy?.file_url ? (
          <div className="policy-viewer-container">
            {/* Policy Header - Moved to top */}
            <div className="policy-viewer-header">
              <div className="policy-header-info">
                <FiFileText className="policy-header-icon" />
                <div className="policy-header-content">
                  <h3 className="policy-viewer-title">{currentPolicy.policy.name}</h3>
                  <div className="policy-viewer-meta">
                    <span>{currentPolicy.policy.type || 'PDF'}</span>
                    <span>•</span>
                    <span>{totalPages} {totalPages === 1 ? 'page' : 'pages'}</span>
                    <span>•</span>
                    <span>{new Date(currentPolicy.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="policy-header-actions">
                {unreadPolicies.length > 1 && (
                  <div className="policy-counter">
                    Policy {currentPolicyIndex + 1} of {unreadPolicies.length}
                  </div>
                )}
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="policy-pdf-viewer">
              <iframe
                src={`${currentPolicy.policy.file_url}#page=${currentPage}&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                className="policy-iframe"
                title={`Page ${currentPage} of ${totalPages}`}
                style={{ border: 'none' }}
                key={`pdf-${currentPolicy.id}-${currentPage}`}
                scrolling="no"
              />
            </div>

            {/* Page Navigation - Always visible */}
            {totalPages > 0 && (
              <div className="policy-navigation">
                <button
                  className="nav-arrow-btn"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1 || totalPages === 1}
                  title="Previous Page"
                >
                  <FiChevronLeft />
                </button>

                <div className="page-indicators">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      className={`page-indicator ${currentPage === pageNum ? 'active' : ''} ${pageNum === totalPages ? 'last-page' : ''}`}
                      onClick={() => handlePageClick(pageNum)}
                      title={`Go to page ${pageNum}`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <button
                  className="nav-arrow-btn"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages || totalPages === 1}
                  title="Next Page"
                >
                  <FiChevronRight />
                </button>
              </div>
            )}

            {/* Last Page Indicator */}
            {isLastPage && (
              <div className="last-page-indicator">
                <FiCheckCircle className="indicator-icon" />
                <span>You're on the last page. Please acknowledge below.</span>
              </div>
            )}

            {/* Acknowledge Section - Only on Last Page */}
            {isLastPage && currentPolicy && (
              <div 
                ref={acknowledgeSectionRef}
                className="policy-acknowledge-section" 
                style={{ display: 'flex', visibility: 'visible', opacity: 1 }}
              >
                <div className="acknowledge-content">
                  <label className={`acknowledge-checkbox-label ${acknowledged ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      className="acknowledge-checkbox-input"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                    />
                    <span className="acknowledge-text">
                      I have read and understood this policy document
                    </span>
                  </label>
                  <button
                    className="btn btn-primary btn-submit-policy"
                    onClick={() => handleAcknowledgePolicy(currentPolicy.id)}
                    disabled={!acknowledged || acknowledgingPolicy === currentPolicy.id}
                    style={{ display: 'flex', visibility: 'visible', opacity: 1 }}
                  >
                    {acknowledgingPolicy === currentPolicy.id ? (
                      <>
                        <span className="spinner-small"></span>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <FiCheckCircle />
                        Submit
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="policy-error">
            <p>Policy document not available</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;






