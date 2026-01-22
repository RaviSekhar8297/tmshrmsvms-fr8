import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FiPlus, FiSearch, FiFilter, FiUsers, FiCalendar, 
  FiMoreVertical, FiEdit2, FiTrash2, FiDollarSign, FiFolder
} from 'react-icons/fi';
import { projectsAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import DatePicker from '../components/DatePicker';
import toast from 'react-hot-toast';
import './Projects.css';

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [managers, setManagers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { isAdmin, isManager, user } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    priority: 'medium',
    project_head_id: '',
    project_head_manual: '',
    project_cost: 0,
    teams: []
  });

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    try {
      const [projectsRes, managersRes, employeesRes] = await Promise.all([
        // Always fetch all projects so we can show counts for every status tab
        projectsAPI.getAll({}),
        isAdmin ? usersAPI.getManagers() : Promise.resolve({ data: [] }),
        usersAPI.getEmployees()
      ]);
      
      setProjects(projectsRes.data || []);
      setManagers(managersRes.data);
      setEmployees(employeesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required field
    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    // Validate project name (letters/spaces only, max 40)
    const projectName = formData.name.trim();
    const nameRegex = /^[A-Za-z\s]+$/;
    if (!nameRegex.test(projectName)) {
      toast.error('Project name must contain only letters and spaces');
      return;
    }
    if (projectName.length > 40) {
      toast.error('Project name must be 40 characters or less');
      return;
    }

    // Validate description (0-500 characters, all characters and numbers acceptable)
    if (formData.description && formData.description.length > 500) {
      toast.error('Description must be 500 characters or less');
      return;
    }

    // Validate start date (required)
    if (!formData.start_date) {
      toast.error('Start date is required');
      return;
    }

    // Validate end date (required)
    if (!formData.end_date) {
      toast.error('End date is required');
      return;
    }

    // Validate dates
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start > end) {
        toast.error('Start date cannot be after end date');
        return;
      }
    }

    // Validate Project Manager (required for Admin)
    if (isAdmin && !formData.project_head_id && !formData.project_head_manual) {
      toast.error('Project Manager is required');
      return;
    }

    // Validate Priority (required)
    if (!formData.priority) {
      toast.error('Priority is required');
      return;
    }
    
    try {
      // If manager is creating, set project_head_id to current user
      let projectHeadId = formData.project_head_id ? parseInt(formData.project_head_id) : null;
      if (isManager && !isAdmin) {
        projectHeadId = user?.id || null;
      }
      
      const submitData = {
        ...formData,
        project_head_id: projectHeadId,
        project_cost: Math.max(0, formData.project_cost ? parseFloat(formData.project_cost) : 0)
      };
      
      // Remove manual entry field from submit data
      delete submitData.project_head_manual;
      
      if (editingProject) {
        await projectsAPI.update(editingProject.id, submitData);
        toast.success('Project updated successfully');
      } else {
        await projectsAPI.create(submitData);
        toast.success('Project created successfully');
      }
      
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      if (Array.isArray(errorDetail)) {
        toast.error(errorDetail.map(e => e.msg).join(', '));
      } else {
        toast.error(errorDetail || 'Failed to save project');
      }
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      priority: project.priority || 'medium',
      project_head_id: project.project_head_id || '',
      project_cost: project.project_cost || 0,
      teams: project.teams || []
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    
    try {
      await projectsAPI.delete(id);
      toast.success('Project deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete project');
    }
  };

  const resetForm = () => {
    setEditingProject(null);
    setFormData({
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      priority: 'medium',
      project_head_id: '',
      project_head_manual: '',
      project_cost: 0,
      teams: []
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'planning': return 'warning';
      case 'active': return 'info';
      case 'on-hold': return 'danger';
      case 'completed': return 'success';
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

  const isDelayedProject = (project) => {
    if (!project?.end_date || project.status === 'completed') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(project.end_date);
    endDate.setHours(0, 0, 0, 0);
    return endDate < today;
  };

  const getTabCount = (status) => {
    if (status === 'all') return projects.length;
    if (status === 'delayed') return projects.filter(isDelayedProject).length;
    return projects.filter((p) => p.status === status).length;
  };

  const filteredProjects = projects
    .filter((project) => {
      if (filter === 'all') return true;
      if (filter === 'delayed') return isDelayedProject(project);
      return project.status === filter;
    })
    .filter((project) => project.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div className="projects-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">PROJECTS!</h1>
          <p className="page-subtitle">Manage and track all your projects</p>
        </div>
        {(isAdmin || isManager) && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <FiPlus /> NEW
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="projects-filters">
        <div className="search-box">
          <FiSearch className="search-box-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="filter-tabs">
          {['all', 'planning', 'active', 'on-hold', 'completed', 'delayed'].map((status) => (
            <button
              key={status}
              className={`filter-tab ${filter === status ? 'active' : ''}`}
              onClick={() => setFilter(status)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span>{status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}</span>
                <span
                  style={{
                    minWidth: '24px',
                    height: '20px',
                    padding: '0 8px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: filter === status ? 'rgba(255,255,255,0.25)' : 'var(--bg-hover)',
                    color: filter === status ? 'white' : 'var(--text-secondary)',
                    border: filter === status ? '1px solid rgba(255,255,255,0.25)' : '1px solid var(--border-color)'
                  }}
                >
                  {getTabCount(status)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="projects-grid">
        {filteredProjects.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <FiFolder className="empty-state-icon" />
            <h3>No projects found</h3>
            <p>Create your first project to get started</p>
          </div>
        ) : (
          filteredProjects.map((project) => (
            <div
              key={project.id}
              className="project-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/projects/${project.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/projects/${project.id}`);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <div className="project-card-header">
                <span className={`badge badge-${getStatusColor(project.status)}`}>
                  {project.status.toUpperCase()}
                </span>
                <span className={`badge badge-${getPriorityColor(project.priority)}`}>
                  {project.priority.toUpperCase()}
                </span>
                {project.is_delayed && project.delayed_days > 0 && (
                  <span className="badge badge-danger">
                    Delayed by {project.delayed_days} day{project.delayed_days !== 1 ? 's' : ''}
                  </span>
                )}
                <div className="project-actions">
                  <button
                    className="btn-icon"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEdit(project);
                    }}
                  >
                    <FiEdit2 />
                  </button>
                  {isAdmin && (
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(project.id);
                      }}
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              </div>

              <Link 
                to={`/projects/${project.id}`} 
                className="project-card-body"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('=== PROJECT CLICKED ===');
                  console.log('Project ID:', project.id);
                  console.log('Project Name:', project.name);
                  console.log('Teams Array:', project.teams);
                  console.log('Teams Type:', typeof project.teams);
                  if (project.teams && Array.isArray(project.teams)) {
                    console.log('Number of team members:', project.teams.length);
                    project.teams.forEach((member, index) => {
                      console.log(`  Member ${index}:`, {
                        empid: member.empid,
                        name: member.name,
                        role: member.role,
                        fullObject: member
                      });
                    });
                    const empids = project.teams.map(m => m.empid).filter(Boolean);
                    console.log('All Empids in this project:', empids);
                  } else {
                    console.log('⚠️ Teams is not an array or is null/undefined');
                  }
                  console.log('=== END PROJECT INFO ===');
                }}
              >
                <h3 className="project-title">{project.name}</h3>
                <p className="project-desc">{project.description || 'No description'}</p>

                <div className="project-meta">
                  <div className="meta-item">
                    <FiCalendar />
                    <span>
                      {project.start_date ? new Date(project.start_date).toLocaleDateString() : 'N/A'} - 
                      {project.end_date ? new Date(project.end_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="meta-item">
                    <FiDollarSign />
                    <span>${parseFloat(project.project_cost || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="project-progress">
                  <div className="progress-header">
                    <span>Progress</span>
                    <span>{project.progress_percent}%</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className={`progress-bar-fill ${project.progress_percent === 100 ? 'success' : 'primary'}`}
                      style={{ width: `${project.progress_percent}%` }}
                    ></div>
                  </div>
                </div>
              </Link>

              <div className="project-card-footer">
                <div className="project-head">
                  <div className="avatar avatar-sm">
                    {project.project_head_name?.charAt(0) || '?'}
                  </div>
                  <span>{project.project_head_name || 'Unassigned'}</span>
                </div>
                <div className="project-team">
                  <div className="team-avatars">
                    {project.teams?.slice(0, 4).map((member, idx) => (
                      <div key={idx} className="avatar avatar-sm" title={member.name}>
                        {member.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                    ))}
                    {project.teams?.length > 4 && (
                      <div className="avatar avatar-sm more">
                        +{project.teams.length - 4}
                      </div>
                    )}
                  </div>
                  <Link to={`/projects/${project.id}`} className="team-count" onClick={(e) => e.stopPropagation()}>
                    {project.teams?.length || 0} members
                  </Link>
                </div>
              </div>
              
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editingProject ? 'Edit Project' : 'Create Project'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Project Name</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => {
                const value = e.target.value;
                // Only allow letters and spaces
                if (value === '' || /^[A-Za-z\s]+$/.test(value)) {
                  setFormData({ ...formData, name: value });
                }
              }}
              placeholder="Enter project name"
              maxLength={40}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (0-500 characters)</label>
            <textarea
              className="form-textarea"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Project description"
              rows={3}
              maxLength={500}
            />
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {formData.description.length}/500 characters
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <DatePicker
                value={formData.start_date}
                onChange={(date) => {
                  // If start is set after end, clear end to keep a valid range
                  if (formData.end_date && date && date > formData.end_date) {
                    toast.error('Start date cannot be after end date');
                    setFormData({ ...formData, start_date: date, end_date: '' });
                    return;
                  }
                  setFormData({ ...formData, start_date: date });
                }}
                max={formData.end_date || undefined}
                placeholder="Select start date"
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Date *</label>
              <DatePicker
                value={formData.end_date}
                onChange={(date) => {
                  // Block selecting end before start
                  if (formData.start_date && date && date < formData.start_date) {
                    toast.error('End date cannot be before start date');
                    return;
                  }
                  setFormData({ ...formData, end_date: date });
                }}
                min={formData.start_date || undefined}
                placeholder="Select end date"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Priority *</label>
              <select
                className="form-select"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <option value="">Select Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Project Cost</label>
              <input
                type="number"
                className="form-input"
                value={formData.project_cost}
                min={0}
                onKeyDown={(e) => {
                  if (e.key === '-') e.preventDefault();
                }}
                onChange={(e) => {
                  const next = parseFloat(e.target.value);
                  setFormData({ ...formData, project_cost: Number.isFinite(next) ? Math.max(0, next) : 0 });
                }}
                placeholder="0.00"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="form-group">
              <label className="form-label">Project Manager *</label>
              {managers.length > 0 ? (
                <select
                  className="form-select"
                  value={formData.project_head_id}
                  onChange={(e) => setFormData({ ...formData, project_head_id: e.target.value, project_head_manual: '' })}
                >
                  <option value="">Select Manager</option>
                  {managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.name} ({manager.empid})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="form-input"
                  value={formData.project_head_manual}
                  onChange={(e) => setFormData({ ...formData, project_head_manual: e.target.value, project_head_id: '' })}
                  placeholder="Enter manager name manually"
                />
              )}
            </div>
          )}
          {isManager && !isAdmin && (
            <div className="form-group">
              <label className="form-label">Project Manager</label>
              <input
                type="text"
                className="form-input"
                value={user?.name || ''}
                disabled
                style={{ opacity: 0.7, cursor: 'not-allowed' }}
              />
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => {
              setShowModal(false);
              resetForm();
            }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingProject ? 'Update' : 'Create'} Project
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Projects;


