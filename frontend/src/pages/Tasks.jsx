import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FiPlus, FiSearch, FiClock, FiUser, FiCalendar,
  FiEdit2, FiTrash2, FiPlay, FiSquare, FiFolder, FiStar
} from 'react-icons/fi';
import { tasksAPI, projectsAPI, usersAPI, ratingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import './Tasks.css';

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [tasksByEmployee, setTasksByEmployee] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // list, employee, or manager
  const [tasksByManager, setTasksByManager] = useState([]);
  const [managerHierarchy, setManagerHierarchy] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { user, isEmployee } = useAuth();
  const [manualProjectName, setManualProjectName] = useState('');

  const [formData, setFormData] = useState({
    project_id: '',
    title: '',
    description: '',
    priority: 'medium',
    assigned_to_id: '',
    assigned_by_id: '',
    start_date: '',
    due_date: '',
    estimated_days: ''
  });
  const [taskDurations, setTaskDurations] = useState({});
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedTaskForRating, setSelectedTaskForRating] = useState(null);
  const [ratingFormData, setRatingFormData] = useState({
    score: 5,
    comments: ''
  });
  const [taskRatings, setTaskRatings] = useState({}); // Store ratings for each task
  const [taskStats, setTaskStats] = useState({
    total: 0,
    todo: 0,
    in_progress: 0,
    completed: 0,
    delayed: 0
  });

  useEffect(() => {
    fetchData();
    fetchTaskStats();
  }, [filter]);

  const fetchTaskStats = async () => {
    try {
      const statsRes = await tasksAPI.getStats();
      setTaskStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching task stats:', error);
    }
  };

  useEffect(() => {
    // Fetch ratings for completed tasks to check if already rated
    const fetchRatings = async () => {
      if (!isEmployee && user) {
        try {
          const ratingsRes = await ratingsAPI.getAll();
          const ratingsMap = {};
          ratingsRes.data.forEach(rating => {
            if (rating.rater_id === user.id) {
              ratingsMap[rating.task_id] = true;
            }
          });
          setTaskRatings(ratingsMap);
        } catch (error) {
          console.error('Error fetching ratings:', error);
        }
      }
    };
    fetchRatings();
  }, [filter, user, isEmployee]);

  useEffect(() => {
    // Fetch durations for all tasks
    const fetchDurations = async () => {
      const durations = {};
      for (const task of tasks) {
        try {
          const response = await tasksAPI.getDurations(task.id);
          durations[task.id] = response.data;
        } catch (error) {
          console.error(`Error fetching duration for task ${task.id}:`, error);
        }
      }
      setTaskDurations(durations);
    };
    
    if (tasks.length > 0) {
      fetchDurations();
      // Only update continuously for tasks that are not done
      // Completed tasks don't need live updates
      const hasActiveTasks = tasks.some(task => !(task.status === 'done' && task.percent_complete === 100));
      if (hasActiveTasks) {
        // Update durations every second for live timers (01, 02, 03...)
        const interval = setInterval(fetchDurations, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [tasks]);

  const fetchData = async () => {
    try {
      let params = {};
      if (filter === 'delayed') {
        // For delayed filter, get all tasks and filter client-side
        params = {};
      } else if (filter !== 'all') {
        params = { status: filter };
      }
      
      const [tasksRes, projectsRes, employeesRes, managersRes] = await Promise.all([
        tasksAPI.getAll(params),
        projectsAPI.getAll(),
        usersAPI.getEmployees(),
        user?.role === 'Admin' ? usersAPI.getManagers() : Promise.resolve({ data: [] })
      ]);
      
      // Filter delayed tasks if needed
      let filteredTasks = tasksRes.data;
      if (filter === 'delayed') {
        filteredTasks = tasksRes.data.filter(task => {
          if (!task.due_date || task.status === 'done') return false;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const due = new Date(task.due_date);
          due.setHours(0, 0, 0, 0);
          return due < today;
        });
      }
      
      setTasks(filteredTasks);
      
      setProjects(projectsRes.data);
      setEmployees(employeesRes.data);
      if (user?.role === 'Admin') {
        setManagers(managersRes.data);
      }
      
      if (!isEmployee) {
        const byEmployeeRes = await tasksAPI.getByEmployee();
        setTasksByEmployee(byEmployeeRes.data);
        
        // Build manager hierarchy for Admin
        if (user?.role === 'Admin') {
          buildManagerHierarchy(employeesRes.data, managersRes.data, tasksRes.data);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const data = {
        ...formData,
        project_id: formData.project_id ? parseInt(formData.project_id) : null,
        assigned_to_id: formData.assigned_to_id ? parseInt(formData.assigned_to_id) : null,
        assigned_by_id: formData.assigned_by_id ? parseInt(formData.assigned_by_id) : null,
        estimated_days: formData.estimated_days ? parseInt(formData.estimated_days) : null
      };
      // If no project selected but a manual name provided, attach to description
      if (!data.project_id && manualProjectName) {
        data.description = `${manualProjectName} | ${data.description || ''}`.trim();
      }

      if (editingTask) {
        await tasksAPI.update(editingTask.id, data);
        toast.success('Task updated successfully');
      } else {
        await tasksAPI.create(data);
        toast.success('Task created successfully');
      }
      
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save task');
    }
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setFormData({
      project_id: task.project_id || '',
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'medium',
      assigned_to_id: task.assigned_to_id || '',
      assigned_by_id: task.assigned_by_id || '',
      start_date: task.start_date || '',
      due_date: task.due_date || '',
      estimated_days: task.estimated_days || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await tasksAPI.delete(id);
      toast.success('Task deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete task');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await tasksAPI.update(taskId, { status: newStatus });
      toast.success('Status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setEditingTask(null);
    setFormData({
      project_id: '',
      title: '',
      description: '',
      priority: 'medium',
      assigned_to_id: '',
      assigned_by_id: '',
      start_date: '',
      due_date: '',
      estimated_days: ''
    });
    setManualProjectName('');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'todo': return 'warning';
      case 'in-progress': return 'info';
      case 'blocked': return 'danger';
      case 'review': return 'primary';
      case 'done': return 'success';
      default: return 'primary';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'danger';
      case 'urgent': return 'danger';
      default: return 'primary';
    }
  };

  const getDelayDays = (task) => {
    if (!task.due_date || task.status === 'done') return 0;
    const today = new Date();
    const due = new Date(task.due_date);
    const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const formatDuration = (seconds) => {
    // Ensure seconds is positive
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleRateTask = (task) => {
    setSelectedTaskForRating(task);
    setRatingFormData({
      score: 5,
      comments: ''
    });
    setShowRatingModal(true);
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (!selectedTaskForRating) return;
    
    try {
      // Rate the manager who assigned the task (assigned_by_id)
      await ratingsAPI.create({
        task_id: selectedTaskForRating.id,
        ratee_id: selectedTaskForRating.assigned_by_id,
        score: ratingFormData.score,
        comments: ratingFormData.comments
      });
      toast.success('Rating submitted successfully');
      setShowRatingModal(false);
      setSelectedTaskForRating(null);
      // Update taskRatings to hide the button
      setTaskRatings(prev => ({
        ...prev,
        [selectedTaskForRating.id]: true
      }));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit rating');
    }
  };

  const isTaskCompleted = (task) => {
    return task.status === 'done' && task.percent_complete === 100;
  };

  const isTaskOverdue = (task) => {
    if (!task.due_date || task.status === 'done') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  // Build hierarchical manager structure
  const buildManagerHierarchy = (allEmployees, allManagers, allTasks) => {
    // Combine managers and employees
    const allUsers = [...allManagers, ...allEmployees];
    
    // Find all employees under a manager recursively
    const getEmployeesUnderManager = (managerEmpid, visited = new Set()) => {
      if (visited.has(managerEmpid)) return [];
      visited.add(managerEmpid);
      
      // Convert managerEmpid to string for comparison
      const managerEmpidStr = String(managerEmpid);
      const directReports = allUsers.filter(u => {
        const reportToId = u.report_to_id ? String(u.report_to_id) : null;
        return reportToId === managerEmpidStr;
      });
      
      let allUnder = [...directReports];
      
      // Recursively get employees under each direct report (if it's a manager)
      directReports.forEach(report => {
        if (report.role === 'Manager') {
          const subEmployees = getEmployeesUnderManager(report.empid, visited);
          allUnder = [...allUnder, ...subEmployees];
        }
      });
      
      return allUnder;
    };

    // Build hierarchy starting from top-level managers
    // Top-level managers are those with no report_to_id, report to '101' (Admin), or report to 101
    const topLevelManagers = allManagers.filter(m => {
      if (!m.report_to_id) return true;
      const reportToId = String(m.report_to_id);
      return reportToId === '101' || reportToId === 'null' || reportToId === '';
    });
    
    // If no top-level managers found, use all managers as starting point
    const startingManagers = topLevelManagers.length > 0 ? topLevelManagers : allManagers;
    
    const hierarchy = startingManagers.map(manager => {
      const employeesUnder = getEmployeesUnderManager(manager.empid);
      const employeeIds = employeesUnder.map(e => e.id);
      
      // Get tasks assigned to employees under this manager (only employees, not managers)
      const managerTasks = allTasks.filter(task => 
        employeeIds.includes(task.assigned_to_id) && 
        employeesUnder.find(e => e.id === task.assigned_to_id)?.role === 'Employee'
      );
      
      // Calculate stats
      const pending = managerTasks.filter(t => t.status === 'todo' || t.status === 'in-progress').length;
      const completed = managerTasks.filter(t => t.status === 'done' && t.percent_complete === 100).length;
      const delayed = managerTasks.filter(t => {
        if (!t.due_date || t.status === 'done') return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(t.due_date);
        due.setHours(0, 0, 0, 0);
        return due < today;
      }).length;
      
      const total = managerTasks.length;
      const performance = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      return {
        ...manager,
        employees: employeesUnder,
        tasks: managerTasks,
        stats: {
          total,
          pending,
          completed,
          delayed,
          performance
        }
      };
    });

    setManagerHierarchy(hierarchy);
  };

  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(search.toLowerCase())
  );

  const filteredTasksByEmployee = tasksByEmployee.filter(emp =>
    emp.name?.toLowerCase().includes(search.toLowerCase()) ||
    emp.empid?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredManagerHierarchy = managerHierarchy.filter(manager =>
    manager.name?.toLowerCase().includes(search.toLowerCase()) ||
    manager.empid?.toLowerCase().includes(search.toLowerCase()) ||
    manager.employees?.some(emp => 
      emp.name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.empid?.toLowerCase().includes(search.toLowerCase())
    )
  );

  // Assignee options depend on selected project: if project selected, show only that project's team
  const selectedProject = projects.find((p) => p.id === (formData.project_id ? parseInt(formData.project_id) : null));
  const projectTeamEmpids = selectedProject?.teams?.map((m) => m.empid).filter(Boolean) || [];
  const availableAssignees = formData.project_id
    ? employees.filter((emp) => projectTeamEmpids.includes(emp.empid))
    : employees;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="tasks-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">TASKS</h1>
          <p className="page-subtitle">Track and manage all tasks</p>
        </div>
        {!isEmployee && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <FiPlus /> New Task
          </button>
        )}
      </div>

      {/* View Toggle & Filters */}
      <div className="tasks-controls">
        {!isEmployee && (
          <div className="view-toggle">
            <button 
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              All Tasks
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
        )}

        <div className="search-box" style={{ flex: 1, maxWidth: 300 }}>
          <FiSearch className="search-box-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          {[
            { key: 'all', label: 'All', count: taskStats.total },
            { key: 'todo', label: 'Pending', count: taskStats.todo },
            { key: 'in-progress', label: 'In Progress', count: taskStats.in_progress },
            { key: 'blocked', label: 'Blocked', count: taskStats.blocked || 0 },
            { key: 'delayed', label: 'Delayed', count: taskStats.delayed },
            { key: 'done', label: 'Done', count: taskStats.completed }
          ].map((item) => (
            <button
              key={item.key}
              className={`filter-tab ${filter === item.key ? 'active' : ''}`}
              onClick={() => setFilter(item.key)}
            >
              <span>{item.label}</span>
              <span className="filter-count">{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tasks View */}
      {viewMode === 'list' ? (
        <div className="tasks-grid">
          {filteredTasks.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <FiClock className="empty-state-icon" />
              <h3>No tasks found</h3>
              <p>Create your first task to get started</p>
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isOverdue = isTaskOverdue(task);
              return (
              <div key={task.id} className={`task-card ${isOverdue ? 'overdue' : ''}`}>
                <div className="task-card-header">
                  <span className={`badge badge-${getStatusColor(task.status)}`}>
                    {task.status}
                  </span>
                  {!(isTaskCompleted(task) && !isEmployee && taskRatings[task.id]) && (
                    <span className={`badge badge-${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  )}
                  {(task.is_delayed && task.delayed_days > 0) && (
                    <span className="badge badge-danger">
                      Delayed by {task.delayed_days} day{task.delayed_days !== 1 ? 's' : ''}
                    </span>
                  )}
                  {!isEmployee && !isTaskCompleted(task) && (
                    <div className="task-actions">
                      <button 
                        className="btn-icon" 
                        onClick={() => handleEdit(task)}
                        title="Edit Task"
                      >
                        <FiEdit2 />
                      </button>
                      <button 
                        className="btn-icon" 
                        onClick={() => handleDelete(task.id)}
                        title="Delete Task"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  )}
                </div>

                <Link to={`/tasks/${task.id}`} className="task-card-body">
                  <h3 className="task-title">{task.title}</h3>
                  <p className="task-desc">{task.description || 'No description'}</p>

                  {/* Duration Information */}
                  {taskDurations[task.id] && (
                    <div className="task-durations" style={{ marginBottom: '12px' }}>
                      <div className="duration-item" style={{ 
                        fontSize: '0.85rem', 
                        color: isTaskOverdue(task) ? '#ef4444' : '#64748b',
                        fontWeight: 500,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>Assigned Duration:</span>
                        <span style={{ 
                          color: isTaskOverdue(task) ? '#ef4444' : '#1e293b',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          letterSpacing: '1px'
                        }}>
                          {formatDuration(taskDurations[task.id].assigned_duration_seconds)}
                          {isTaskCompleted(task) && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              color: '#64748b', 
                              marginLeft: '6px',
                              fontFamily: 'sans-serif',
                              fontWeight: 400
                            }}>
                              (stopped)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="duration-item" style={{ 
                        fontSize: '0.85rem', 
                        color: '#64748b',
                        fontWeight: 500,
                        marginTop: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>Working Duration:</span>
                        <span style={{ 
                          color: '#1e293b',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          letterSpacing: '1px'
                        }}>
                          {formatDuration(taskDurations[task.id].working_duration_seconds)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="task-meta">
                    <div className="meta-item">
                      <FiFolder />
                      <span>{task.project_id ? `Project #${task.project_id}` : 'No Project'}</span>
                    </div>
                    {task.assigned_to_name && (
                      <div className="meta-item">
                        <FiUser />
                        <span>{task.assigned_to_name}</span>
                      </div>
                    )}
                    {task.due_date && (
                      <div className="meta-item">
                        <FiCalendar />
                        <span>{new Date(task.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="task-progress">
                    <div className="progress-header">
                      <span>Progress</span>
                      <span>{task.percent_complete}%</span>
                    </div>
                    <div className="progress-bar">
                      <div 
                        className={`progress-bar-fill ${task.percent_complete === 100 ? 'success' : 'primary'}`}
                        style={{ width: `${task.percent_complete}%` }}
                      ></div>
                    </div>
                  </div>
                </Link>

                {/* Rating Button for Completed Tasks - Only show if not already rated */}
                {isTaskCompleted(task) && !isEmployee && (
                  <div className="task-card-footer" style={{ padding: '12px', borderTop: '1px solid #e2e8f0' }}>
                    {taskRatings[task.id] ? (
                      <div style={{ 
                        textAlign: 'center', 
                        color: '#10b981', 
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}>
                        <FiStar style={{ fill: '#10b981' }} /> Rated
                      </div>
                    ) : (
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={(e) => {
                          e.preventDefault();
                          handleRateTask(task);
                        }}
                        style={{ width: '100%' }}
                      >
                        <FiStar /> Rate Manager
                      </button>
                    )}
                  </div>
                )}

                {isEmployee && (
                  <div className="task-card-footer">
                    <select
                      className="form-select"
                      value={task.status}
                      disabled={task.status === 'done' || task.percent_complete === 100}
                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                )}
              </div>
            );
            })
          )}
        </div>
      ) : viewMode === 'employee' ? (
        <div className="employees-tasks-grid">
          {filteredTasksByEmployee.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <FiClock className="empty-state-icon" />
              <h3>No employees found</h3>
              <p>No employees match your search</p>
            </div>
          ) : (
            filteredTasksByEmployee.map((emp) => (
            <div key={emp.id} className="employee-task-card">
              <div className="employee-info">
                <div className="avatar avatar-lg">
                  {emp.image_base64 ? (
                    <img src={emp.image_base64} alt={emp.name} />
                  ) : (
                    emp.name?.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3>{emp.name}</h3>
                  <p>{emp.empid}</p>
                </div>
              </div>

              <div className="employee-stats">
                <div className="stat-item">
                  <span className="stat-label">Pending</span>
                  <span className="stat-value">{emp.pending}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Completed</span>
                  <span className="stat-value success">{emp.completed}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Delayed</span>
                  <span className="stat-value danger">{emp.delayed}</span>
                </div>
              </div>

              <div className="employee-progress">
                <div className="progress-header">
                  <span>Performance</span>
                  <span>{emp.performance}%</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className={`progress-bar-fill ${emp.performance >= 80 ? 'success' : emp.performance >= 50 ? 'warning' : 'danger'}`}
                    style={{ width: `${emp.performance}%` }}
                  ></div>
                </div>
              </div>
            </div>
            ))
          )}
        </div>
      ) : viewMode === 'manager' ? (
        <div className="managers-hierarchy-grid">
          {filteredManagerHierarchy.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <FiClock className="empty-state-icon" />
              <h3>No managers found</h3>
              <p>No managers match your search</p>
            </div>
          ) : (
            filteredManagerHierarchy.map((manager) => (
              <div key={manager.id} className="manager-hierarchy-card">
                <div className="manager-info">
                  <div className="avatar avatar-lg">
                    {manager.image_base64 ? (
                      <img src={manager.image_base64} alt={manager.name} />
                    ) : (
                      manager.name?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3>{manager.name}</h3>
                    <p>{manager.empid} - {manager.role}</p>
                  </div>
                </div>

                <div className="manager-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Tasks</span>
                    <span className="stat-value">{manager.stats?.total || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Pending</span>
                    <span className="stat-value">{manager.stats?.pending || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Completed</span>
                    <span className="stat-value success">{manager.stats?.completed || 0}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Delayed</span>
                    <span className="stat-value danger">{manager.stats?.delayed || 0}</span>
                  </div>
                </div>

                <div className="manager-progress">
                  <div className="progress-header">
                    <span>Team Performance</span>
                    <span>{manager.stats?.performance || 0}%</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className={`progress-bar-fill ${(manager.stats?.performance || 0) >= 80 ? 'success' : (manager.stats?.performance || 0) >= 50 ? 'warning' : 'danger'}`}
                      style={{ width: `${manager.stats?.performance || 0}%` }}
                    ></div>
                  </div>
                </div>

                {/* Employees under this manager */}
                {manager.employees && manager.employees.length > 0 && (
                  <div className="manager-employees-section">
                    <div className="section-header">
                      <FiUser style={{ marginRight: '8px' }} />
                      <span>Employees Under ({manager.employees.length})</span>
                    </div>
                    <div className="employees-list">
                      {manager.employees.map((emp) => {
                        const empTasks = manager.tasks?.filter(t => t.assigned_to_id === emp.id) || [];
                        const empCompleted = empTasks.filter(t => t.status === 'done' && t.percent_complete === 100).length;
                        const empPending = empTasks.filter(t => t.status === 'todo' || t.status === 'in-progress').length;
                        
                        return (
                          <div key={emp.id || emp.empid} className="employee-under-manager">
                            <div className="employee-avatar-small">
                              {emp.image_base64 ? (
                                <img src={emp.image_base64} alt={emp.name} />
                              ) : (
                                emp.name?.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="employee-details">
                              <div className="employee-name">{emp.name}</div>
                              <div className="employee-empid">{emp.empid} - {emp.role}</div>
                            </div>
                            <div className="employee-task-counts">
                              <span className="task-count-badge">{empTasks.length} tasks</span>
                              <span className="task-count-badge success">{empCompleted} done</span>
                              <span className="task-count-badge warning">{empPending} pending</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : null}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editingTask ? 'Edit Task' : 'Create Task'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Task Title *</label>
            <input
              type="text"
              className="form-input"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter task title"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Task description"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Project</label>
            <select
              className="form-select"
              value={formData.project_id}
              onChange={(e) => {
                const project_id = e.target.value;
                // Reset assignee if not in new project's team
                const newProject = projects.find((p) => p.id === (project_id ? parseInt(project_id) : null));
                const teamEmpids = newProject?.teams?.map((m) => m.empid) || [];
                const assigneeValid = !project_id || !formData.assigned_to_id
                  ? true
                  : (() => {
                      const currentAssignee = employees.find(emp => emp.id === parseInt(formData.assigned_to_id));
                      return currentAssignee ? teamEmpids.includes(currentAssignee.empid) : false;
                    })();

                setFormData({
                  ...formData,
                  project_id,
                  assigned_to_id: assigneeValid ? formData.assigned_to_id : ''
                });
              }}
            >
              <option value="">No Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <small className="form-hint">Leave as "No Project" and enter a name below if needed.</small>
          </div>

          <div className="form-group">
            <label className="form-label">Project Name (manual)</label>
            <input
              type="text"
              className="form-input"
              value={manualProjectName}
              onChange={(e) => setManualProjectName(e.target.value)}
              placeholder="Enter project name when not selecting from list"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Assign To</label>
              <select
                className="form-select"
                value={formData.assigned_to_id}
                onChange={(e) => setFormData({ ...formData, assigned_to_id: e.target.value })}
              >
                <option value="">Unassigned</option>
                {availableAssignees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.empid})
                  </option>
                ))}
              </select>
            </div>
            {user?.role === 'Admin' && (
              <div className="form-group">
                <label className="form-label">Assigned By (Manager)</label>
                <select
                  className="form-select"
                  value={formData.assigned_by_id}
                  onChange={(e) => setFormData({ ...formData, assigned_by_id: e.target.value })}
                >
                  <option value="">Select Manager</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} ({manager.empid})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-select"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-input"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input
                type="date"
                className="form-input"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Estimated Days</label>
            <input
              type="number"
              className="form-input"
              value={formData.estimated_days}
              onChange={(e) => setFormData({ ...formData, estimated_days: e.target.value })}
              placeholder="Number of days"
              min="1"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => {
              setShowModal(false);
              resetForm();
            }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingTask ? 'Update' : 'Create'} Task
            </button>
          </div>
        </form>
      </Modal>

      {/* Rating Modal */}
      <Modal
        isOpen={showRatingModal}
        onClose={() => {
          setShowRatingModal(false);
          setSelectedTaskForRating(null);
        }}
        title="Rate Manager for Task"
      >
        {selectedTaskForRating && (
          <form onSubmit={handleSubmitRating}>
            <div className="form-group">
              <label className="form-label">Task</label>
              <input
                type="text"
                className="form-input"
                value={selectedTaskForRating.title}
                disabled
              />
            </div>

            <div className="form-group">
              <label className="form-label">Manager to Rate</label>
              <input
                type="text"
                className="form-input"
                value={selectedTaskForRating.assigned_by_name || 'N/A'}
                disabled
              />
              <small className="form-hint">You are rating the manager who assigned this task</small>
            </div>

            <div className="form-group">
              <label className="form-label">Rating Score *</label>
              <div className="score-selector" style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    className={`score-btn ${ratingFormData.score === score ? 'selected' : ''}`}
                    onClick={() => setRatingFormData({ ...ratingFormData, score })}
                    style={{
                      padding: '8px 16px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      background: ratingFormData.score === score ? '#6366f1' : 'white',
                      color: ratingFormData.score === score ? 'white' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    <FiStar className={ratingFormData.score >= score ? 'filled' : ''} />
                    <span style={{ marginLeft: '4px' }}>{score}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Comments</label>
              <textarea
                className="form-textarea"
                value={ratingFormData.comments}
                onChange={(e) => setRatingFormData({ ...ratingFormData, comments: e.target.value })}
                placeholder="Add your feedback..."
                rows={4}
              />
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowRatingModal(false);
                  setSelectedTaskForRating(null);
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Submit Rating
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default Tasks;






