import { useState, useEffect } from 'react';
import { FiStar, FiPlus, FiUser, FiTrendingUp, FiAward, FiCheckCircle, FiSearch, FiClock, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { ratingsAPI, tasksAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import './Ratings.css';

const Ratings = () => {
  const [ratings, setRatings] = useState([]);
  const [ratingsByEmployee, setRatingsByEmployee] = useState([]);
  const [ratingsByManager, setRatingsByManager] = useState([]);
  const [tasksByEmployee, setTasksByEmployee] = useState([]);
  const [stats, setStats] = useState({});
  const [taskStats, setTaskStats] = useState({
    total: 0,
    todo: 0,
    in_progress: 0,
    completed: 0,
    delayed: 0
  });
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const { isEmployee, user } = useAuth();

  const [formData, setFormData] = useState({
    task_id: '',
    ratee_id: '',
    score: 5,
    comments: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // For admin, fetch all users; for others, fetch only employees
      const usersPromise = user?.role === 'Admin' 
        ? usersAPI.getAll() 
        : usersAPI.getEmployees();
      
      const [ratingsRes, statsRes, usersRes] = await Promise.all([
        ratingsAPI.getAll(),
        ratingsAPI.getStats(),
        usersPromise
      ]);
      
      setRatings(ratingsRes.data);
      setStats(statsRes.data);
      setEmployees(usersRes.data);
      
      // Fetch task stats for Employee role only (displayed in separate cards)
      if (isEmployee) {
        try {
          const taskStatsRes = await tasksAPI.getStats();
          setTaskStats(taskStatsRes.data);
        } catch (error) {
          console.error('Error fetching task stats:', error);
        }
      }
      
      // Fetch only unrated tasks for the modal
      if (!isEmployee) {
        try {
          const unratedTasksRes = await ratingsAPI.getUnratedTasks();
          setTasks(unratedTasksRes.data);
        } catch (error) {
          console.error('Error fetching unrated tasks:', error);
          // Fallback to all completed tasks if endpoint fails
          const tasksRes = await tasksAPI.getAll({ status: 'done' });
          setTasks(tasksRes.data);
        }
        
        // Fetch ratings by employee and tasks by employee in parallel
        const [byEmployeeRes, tasksByEmpRes] = await Promise.all([
          ratingsAPI.getByEmployee(),
          tasksAPI.getByEmployee()
        ]);
        setRatingsByEmployee(byEmployeeRes.data);
        setTasksByEmployee(tasksByEmpRes.data);
        
        // Fetch managers data if Admin
        if (user?.role === 'Admin') {
          try {
            const byManagerRes = await ratingsAPI.getByManager();
            setRatingsByManager(byManagerRes.data);
          } catch (error) {
            console.error('Error fetching managers:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load ratings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (alreadyRatedByMe(formData.task_id)) {
        toast.error('You already rated this task');
        return;
      }
      await ratingsAPI.create({
        task_id: parseInt(formData.task_id),
        ratee_id: parseInt(formData.ratee_id),
        score: formData.score,
        comments: formData.comments
      });
      
      toast.success('Rating submitted successfully');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit rating');
    }
  };

  const resetForm = () => {
    setFormData({
      task_id: '',
      ratee_id: '',
      score: 5,
      comments: ''
    });
  };

  const renderStars = (score, size = 'md') => {
    return (
      <div className={`stars stars-${size}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <FiStar
            key={star}
            className={star <= score ? 'filled' : ''}
          />
        ))}
      </div>
    );
  };

  const getScoreColor = (score) => {
    if (score >= 4) return 'success';
    if (score >= 3) return 'warning';
    return 'danger';
  };

  const getPerformanceLabel = (score) => {
    if (score >= 4.5) return 'Excellent';
    if (score >= 4) return 'Very Good';
    if (score >= 3) return 'Good';
    if (score >= 2) return 'Needs Improvement';
    return 'Poor';
  };

  const filteredRatings = ratings.filter((rating) => {
    const query = search.toLowerCase();
    return (
      rating.ratee_name?.toLowerCase().includes(query) ||
      rating.task_title?.toLowerCase().includes(query)
    );
  });

  const filteredEmployees = ratingsByEmployee.filter((emp) => {
    const query = search.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(query) ||
      emp.empid?.toLowerCase().includes(query)
    );
  });

  // Pagination for By Employee tab
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const indexOfLastRecord = currentPage * itemsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - itemsPerPage;
  const currentEmployees = filteredEmployees.slice(indexOfFirstRecord, indexOfLastRecord);

  // Reset to page 1 when search changes or view mode changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, viewMode]);

  const filteredManagers = ratingsByManager.filter((manager) => {
    const query = search.toLowerCase();
    return (
      manager.name?.toLowerCase().includes(query) ||
      manager.empid?.toLowerCase().includes(query)
    );
  });

  const getEmployeeImage = (id) => {
    const emp = employees.find((e) => e.id === id);
    if (!emp?.image_base64) return null;
    // Ensure image has proper data URL prefix
    const image = emp.image_base64;
    if (image.startsWith('data:')) {
      return image;
    }
    // If it's just base64, add the data URL prefix
    return `data:image/jpeg;base64,${image}`;
  };

  const getDefaultScoreForTask = (taskId) => {
    const t = tasks.find((task) => task.id === parseInt(taskId));
    if (!t) return 5;
    if (t.percent_complete >= 100) return 5;
    if (t.percent_complete >= 80) return 4;
    if (t.percent_complete >= 60) return 3;
    if (t.percent_complete >= 40) return 2;
    return 1;
  };

  const alreadyRatedByMe = (taskId) =>
    ratings.some((r) => r.task_id === parseInt(taskId) && r.rater_id === user?.id);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading ratings...</p>
      </div>
    );
  }

  return (
    <div className="ratings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">RATINGS</h1>
          <p className="page-subtitle">Performance ratings and reviews</p>
        </div>
        {!isEmployee && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <FiPlus /> Add Rating
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="ratings-stats-grid">
        <div className="stat-card-main">
          <div className="stat-card-icon">
            <FiAward />
          </div>
          <div className="stat-card-content">
            <div className="big-score-display">
              <span className="score-value">{(stats.average_score || 0).toFixed(1)}</span>
              <span className="score-max">/5</span>
            </div>
            {renderStars(Math.round(stats.average_score || 0), 'lg')}
            <p className="stat-label">Average Score</p>
          </div>
        </div>

        <div className="stat-card-info">
          <div className="stat-info-item">
            <FiCheckCircle className="stat-info-icon success" />
            <div>
              <span className="stat-info-value">{stats.total_ratings || 0}</span>
              <span className="stat-info-label">Total Ratings</span>
            </div>
          </div>
          <div className="stat-info-item">
            <FiTrendingUp className="stat-info-icon primary" />
            <div>
              <span className="stat-info-value">{employees.length}</span>
              <span className="stat-info-label">Employees Rated</span>
            </div>
          </div>
        </div>

        <div className="stat-card-distribution">
          <h4>Score Distribution</h4>
          <div className="score-distribution">
            {[5, 4, 3, 2, 1].map((score) => {
              const count = stats.score_distribution?.[score] || 0;
              const percentage = stats.total_ratings ? (count / stats.total_ratings * 100) : 0;
              return (
                <div key={score} className="distribution-row">
                  <span className="score-label">{score} ★</span>
                  <div className="distribution-bar">
                    <div 
                      className={`distribution-fill score-${score}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="score-count">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Task Count Cards - Only for Employee role */}
      {isEmployee && (
        <div className="task-stats-cards">
          <div className="task-stat-card">
            <div className="task-stat-icon total">
              <FiCheckCircle />
            </div>
            <div className="task-stat-content">
              <span className="task-stat-value">{taskStats.total || 0}</span>
              <span className="task-stat-label">Total</span>
            </div>
          </div>
          <div className="task-stat-card">
            <div className="task-stat-icon done">
              <FiCheckCircle />
            </div>
            <div className="task-stat-content">
              <span className="task-stat-value">{taskStats.completed || 0}</span>
              <span className="task-stat-label">Done</span>
            </div>
          </div>
          <div className="task-stat-card">
            <div className="task-stat-icon pending">
              <FiClock />
            </div>
            <div className="task-stat-content">
              <span className="task-stat-value">{taskStats.todo || 0}</span>
              <span className="task-stat-label">Pending</span>
            </div>
          </div>
          <div className="task-stat-card">
            <div className="task-stat-icon delayed">
              <FiClock />
            </div>
            <div className="task-stat-content">
              <span className="task-stat-value">{taskStats.delayed || 0}</span>
              <span className="task-stat-label">Delayed</span>
            </div>
          </div>
        </div>
      )}

      {/* View Toggle */}
      {!isEmployee && (
        <div className="ratings-view-toolbar">
          <div className="ratings-view-toggle">
            <button 
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              All Ratings
            </button>
            <button 
              className={`toggle-btn ${viewMode === 'employee' ? 'active' : ''}`}
              onClick={() => setViewMode('employee')}
            >
              By Employee
            </button>
            {user?.role === 'Admin' && (
              <button 
                className={`toggle-btn ${viewMode === 'manager' ? 'active' : ''}`}
                onClick={() => setViewMode('manager')}
              >
                By Manager
              </button>
            )}
          </div>
          <div className="search-box" style={{ maxWidth: 260 }}>
            <FiSearch className="search-box-icon" />
            <input
              type="text"
              className="form-input"
              placeholder="Search ratings or employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Ratings View */}
      {viewMode === 'list' ? (
        <div className="ratings-cards-grid">
          {filteredRatings.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <FiStar className="empty-state-icon" />
              <h3>No ratings yet</h3>
              <p>Ratings will appear here once submitted</p>
            </div>
          ) : (
            filteredRatings.map((rating) => (
              <div key={rating.id} className="rating-card">
                <div className="rating-card-header">
                  <div className={`rating-score-badge ${getScoreColor(rating.score)}`}>
                    <span className="score-num">{rating.score}</span>
                    <FiStar className="filled" />
                  </div>
                  <span className="rating-date">
                    {new Date(rating.rated_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>

                <div className="rating-card-body">
                  <div className="rating-parties">
                    <div className="party-info ratee">
                      <div className="avatar">
                        {getEmployeeImage(rating.ratee_id) ? (
                          <img 
                            src={getEmployeeImage(rating.ratee_id)} 
                            alt={rating.ratee_name}
                            onError={(e) => {
                              // Hide image and show fallback initial
                              e.target.style.display = 'none';
                              const fallback = e.target.parentElement.querySelector('.avatar-fallback');
                              if (fallback) {
                                fallback.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <span 
                          className="avatar-fallback"
                          style={{ display: getEmployeeImage(rating.ratee_id) ? 'none' : 'flex' }}
                        >
                          {rating.ratee_name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="party-name">{rating.ratee_name}</span>
                        <span className="party-label">Employee</span>
                      </div>
                    </div>
                    <div className="rating-arrow">→</div>
                    <div className="party-info rater">
                      <div className="avatar small">
                        {rating.rater_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="party-name">{rating.rater_name}</span>
                        <span className="party-label">Rated by</span>
                      </div>
                    </div>
                  </div>

                  {rating.task_title && (
                    <div className="rating-task">
                      <span className="task-label">Task:</span>
                      <span className="task-title">{rating.task_title}</span>
                    </div>
                  )}

                  {rating.comments && (
                    <div className="rating-comments">
                      <p>"{rating.comments}"</p>
                    </div>
                  )}
                </div>

                <div className="rating-card-footer">
                  {renderStars(rating.score)}
                  <span className={`performance-label ${getScoreColor(rating.score)}`}>
                    {getPerformanceLabel(rating.score)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : viewMode === 'employee' ? (
        <>
        <div className="employees-ratings-grid">
          {currentEmployees.map((emp) => {
            // Find matching task stats for this employee
            const empTasks = tasksByEmployee.find(t => t.id === emp.id) || {};
            const empTaskStats = {
              total: empTasks.total_tasks || 0,
              pending: empTasks.pending || 0,
              completed: empTasks.completed || 0,
              delayed: empTasks.delayed || 0
            };

            return (
              <div key={emp.id} className="employee-rating-card">
                <div className="employee-card-bg"></div>
                <div className="employee-card-content">
                  <div className="employee-card-header">
                    <div className="employee-avatar-section">
                      <div className="avatar avatar-xl">
                        {emp.image_base64 ? (
                          <img 
                            src={emp.image_base64.startsWith('data:') ? emp.image_base64 : `data:image/jpeg;base64,${emp.image_base64}`}
                            alt={emp.name}
                            onError={(e) => {
                              // Fallback to initial if image fails to load
                              e.target.style.display = 'none';
                              e.target.parentElement.textContent = emp.name?.charAt(0).toUpperCase();
                            }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                          />
                        ) : (
                          emp.name?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className={`score-ring ${getScoreColor(emp.average_score)}`}>
                        <span>{emp.average_score?.toFixed(1) || '0.0'}</span>
                      </div>
                    </div>
                    <div className="employee-info">
                      <h3>{emp.name}</h3>
                      <p className="empid">{emp.empid}</p>
                    </div>
                  </div>

                  <div className="employee-stats">
                    <div className="employee-stat">
                      <span className="stat-value">{emp.total_ratings || 0}</span>
                      <span className="stat-label">Ratings</span>
                    </div>
                    <div className="employee-stat">
                      <span className={`stat-value ${getScoreColor(emp.average_score)}`}>
                        {getPerformanceLabel(emp.average_score || 0)}
                      </span>
                      <span className="stat-label">Performance</span>
                    </div>
                  </div>

                  <div className="employee-stars">
                    {renderStars(Math.round(emp.average_score || 0))}
                  </div>

                  {/* Task Count Cards - Inside employee card */}
                  <div className="employee-task-counts">
                    <div className="employee-task-count-card">
                      <span className="employee-task-count-value">{empTaskStats.total}</span>
                      <span className="employee-task-count-label">Total</span>
                    </div>
                    <div className="employee-task-count-card">
                      <span className="employee-task-count-value">{empTaskStats.pending}</span>
                      <span className="employee-task-count-label">Pending</span>
                    </div>
                    <div className="employee-task-count-card">
                      <span className="employee-task-count-value">{empTaskStats.completed}</span>
                      <span className="employee-task-count-label">Completed</span>
                    </div>
                    <div className="employee-task-count-card">
                      <span className="employee-task-count-value">{empTaskStats.delayed}</span>
                      <span className="employee-task-count-label">Delayed</span>
                    </div>
                  </div>

                  <div className="rating-progress">
                    <div 
                      className={`progress-fill ${getScoreColor(emp.average_score)}`}
                      style={{ width: `${(emp.average_score || 0) * 20}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Pagination for By Employee tab */}
        {totalPages > 1 && (
          <div className="pagination" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="pagination-info" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredEmployees.length)} of {filteredEmployees.length} employees
            </div>
            <div className="pagination-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FiChevronLeft />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    background: currentPage === page ? 'var(--primary-color)' : 'var(--bg-card)',
                    color: currentPage === page ? 'white' : 'var(--text-primary)',
                    cursor: 'pointer',
                    minWidth: '40px'
                  }}
                >
                  {page}
                </button>
              ))}
              <button 
                className="pagination-btn"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
        )}
        </>
      ) : viewMode === 'manager' && user?.role === 'Admin' ? (
        <div className="employees-ratings-grid">
          {filteredManagers.map((manager) => (
            <div key={manager.id} className="employee-rating-card manager-card">
              <div className="employee-card-bg"></div>
              <div className="employee-card-content">
                <div className="employee-card-header">
                  <div className="employee-avatar-section">
                    <div className="avatar avatar-xl">
                      {manager.image_base64 ? (
                        <img 
                          src={manager.image_base64.startsWith('data:') ? manager.image_base64 : `data:image/jpeg;base64,${manager.image_base64}`}
                          alt={manager.name}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.textContent = manager.name?.charAt(0).toUpperCase();
                          }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                        />
                      ) : (
                        manager.name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className={`score-ring ${getScoreColor(manager.average_score)}`}>
                      <span>{manager.average_score?.toFixed(1) || '0.0'}</span>
                    </div>
                  </div>
                  <div className="employee-info">
                    <h3>{manager.name}</h3>
                    <p className="empid">{manager.empid}</p>
                  </div>
                </div>

                <div className="employee-stats">
                  <div className="employee-stat">
                    <span className="stat-value">{manager.total_ratings || 0}</span>
                    <span className="stat-label">Ratings</span>
                  </div>
                  <div className="employee-stat">
                    <span className={`stat-value ${getScoreColor(manager.average_score)}`}>
                      {getPerformanceLabel(manager.average_score || 0)}
                    </span>
                    <span className="stat-label">Performance</span>
                  </div>
                </div>

                <div className="employee-stars">
                  {renderStars(Math.round(manager.average_score || 0))}
                </div>

                {/* Task Count Cards */}
                <div className="employee-task-counts">
                  <div className="employee-task-count-card">
                    <span className="employee-task-count-value">{manager.task_total || 0}</span>
                    <span className="employee-task-count-label">Total Tasks</span>
                  </div>
                  <div className="employee-task-count-card">
                    <span className="employee-task-count-value">{manager.task_pending || 0}</span>
                    <span className="employee-task-count-label">Pending</span>
                  </div>
                  <div className="employee-task-count-card">
                    <span className="employee-task-count-value">{manager.task_completed || 0}</span>
                    <span className="employee-task-count-label">Completed</span>
                  </div>
                  <div className="employee-task-count-card">
                    <span className="employee-task-count-value">{manager.task_delayed || 0}</span>
                    <span className="employee-task-count-label">Delayed</span>
                  </div>
                </div>

                {/* Project Count Cards */}
                <div className="employee-project-counts">
                  <div className="employee-task-count-card project-card">
                    <span className="employee-task-count-value">{manager.project_total || 0}</span>
                    <span className="employee-task-count-label">Total Projects</span>
                  </div>
                  <div className="employee-task-count-card project-card">
                    <span className="employee-task-count-value">{manager.project_pending || 0}</span>
                    <span className="employee-task-count-label">Pending</span>
                  </div>
                  <div className="employee-task-count-card project-card">
                    <span className="employee-task-count-value">{manager.project_completed || 0}</span>
                    <span className="employee-task-count-label">Completed</span>
                  </div>
                  <div className="employee-task-count-card project-card">
                    <span className="employee-task-count-value">{manager.project_delayed || 0}</span>
                    <span className="employee-task-count-label">Delayed</span>
                  </div>
                </div>

                <div className="rating-progress">
                  <div 
                    className={`progress-fill ${getScoreColor(manager.average_score)}`}
                    style={{ width: `${(manager.average_score || 0) * 20}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Add Rating Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title="Add Rating"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Task *</label>
            <select
              className="form-select"
              value={formData.task_id}
              onChange={(e) => {
                const selectedTask = tasks.find(t => t.id === parseInt(e.target.value));
                setFormData({ 
                  ...formData, 
                  task_id: e.target.value,
                  ratee_id: selectedTask?.assigned_to_id || '',
                  score: getDefaultScoreForTask(e.target.value)
                });
              }}
              required
            >
              <option value="">Select a completed task (unrated only)</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
            <small className="form-hint">Only tasks that haven't been rated yet are shown</small>
          </div>

          <div className="form-group">
            <label className="form-label">Employee *</label>
            <select
              className="form-select"
              value={formData.ratee_id}
              onChange={(e) => setFormData({ ...formData, ratee_id: e.target.value })}
              required
              disabled={!formData.task_id}
            >
              <option value="">
                {formData.task_id ? 'Select employee to rate' : 'Select a task first'}
              </option>
              {(() => {
                // If task is selected, show only employees assigned to that task
                if (formData.task_id) {
                  const selectedTask = tasks.find(t => t.id === parseInt(formData.task_id));
                  if (selectedTask) {
                    // Get assigned employee
                    if (selectedTask.assigned_to_id) {
                      const assignedEmp = employees.find(e => e.id === selectedTask.assigned_to_id);
                      if (assignedEmp) {
                        return (
                          <option key={assignedEmp.id} value={assignedEmp.id}>
                            {assignedEmp.name} ({assignedEmp.empid})
                          </option>
                        );
                      }
                    }
                    // If multiple employees assigned
                    if (selectedTask.assigned_to_ids && selectedTask.assigned_to_ids.length > 0) {
                      return selectedTask.assigned_to_ids.map((assigned) => {
                        const emp = employees.find(e => e.empid === assigned.empid);
                        if (emp) {
                          return (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} ({emp.empid})
                            </option>
                          );
                        }
                        return null;
                      });
                    }
                  }
                  return null;
                }
                // If no task selected, show all employees
                return employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.empid})
                  </option>
                ));
              })()}
            </select>
            <small className="form-hint">
              {formData.task_id ? 'Employee assigned to the selected task' : 'Select a task to see assigned employees'}
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Score *</label>
            <div className="score-selector">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  className={`score-btn ${formData.score === score ? 'selected' : ''}`}
                  onClick={() => setFormData({ ...formData, score })}
                >
                  <FiStar className={formData.score >= score ? 'filled' : ''} />
                  <span>{score}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Comments</label>
            <textarea
              className="form-textarea"
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              placeholder="Add your feedback..."
              rows={4}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => {
              setShowModal(false);
              resetForm();
            }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={alreadyRatedByMe(formData.task_id)}>
              Submit Rating
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Ratings;
