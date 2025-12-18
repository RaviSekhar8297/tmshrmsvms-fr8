import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  FiArrowLeft, FiUsers, FiCalendar, FiDollarSign, 
  FiPlus, FiEdit2, FiTrash2, FiCheckSquare
} from 'react-icons/fi';
import { projectsAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import './ProjectDetails.css';

const ProjectDetails = () => {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskStats, setTaskStats] = useState({});
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const { isAdmin, isManager, user } = useAuth();

  useEffect(() => {
    fetchProjectDetails();
    fetchEmployees();
  }, [id]);

  const fetchProjectDetails = async () => {
    try {
      const response = await projectsAPI.getDetails(id);
      const projectData = response.data.project;
      setProject(projectData);
      setTeamMembers(response.data.team_members);
      setTasks(response.data.tasks);
      setTaskStats(response.data.task_stats);
      
      // Console log team information
      console.log('=== PROJECT DETAILS LOADED ===');
      console.log('Project ID:', projectData.id);
      console.log('Project Name:', projectData.name);
      console.log('Raw Teams Array:', projectData.teams);
      console.log('Teams Type:', typeof projectData.teams);
      
      if (projectData.teams && Array.isArray(projectData.teams)) {
        console.log('Number of team members:', projectData.teams.length);
        projectData.teams.forEach((member, index) => {
          console.log(`  Member ${index}:`, {
            empid: member.empid,
            name: member.name,
            role: member.role,
            fullObject: member
          });
        });
        const empids = projectData.teams.map(m => m.empid).filter(Boolean);
        console.log('All Empids in this project:', empids);
      } else {
        console.log('⚠️ Teams is not an array or is null/undefined');
        console.log('Teams value:', projectData.teams);
      }
      
      console.log('Team Members (from API):', response.data.team_members);
      console.log('=== END PROJECT DETAILS ===');
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await usersAPI.getEmployees();
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleAddMember = async () => {
    if (!selectedEmployees.length) return;
    
    try {
      // Add members sequentially to reuse existing API
      for (const empid of selectedEmployees) {
        await projectsAPI.addTeamMember(id, empid);
      }
      toast.success('Team members added');
      setShowAddMember(false);
      setSelectedEmployees([]);
      fetchProjectDetails();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add members');
    }
  };

  const handleRemoveMember = async (empid) => {
    if (!window.confirm('Remove this team member?')) return;
    
    try {
      await projectsAPI.removeTeamMember(id, empid);
      toast.success('Team member removed');
      fetchProjectDetails();
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await projectsAPI.update(id, { status: newStatus });
      toast.success('Status updated');
      fetchProjectDetails();
    } catch (error) {
      toast.error('Failed to update status');
    }
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

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="empty-state">
        <h3>Project not found</h3>
        <Link to="/projects" className="btn btn-primary">Back to Projects</Link>
      </div>
    );
  }

  return (
    <div className="project-details-page">
      <Link to="/projects" className="back-link">
        <FiArrowLeft /> Back to Projects
      </Link>

      <div className="project-header">
        <div className="project-info">
          <h1>{project.name}</h1>
          <p>{project.description || 'No description'}</p>
        </div>
        <div className="project-actions">
          <select
            className="form-select"
            value={project.status}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="project-stats">
        <div className="stat-card">
          <div className="stat-card-inner">
            <div className="stat-left">
              <div className="stat-icon primary">
                <FiCheckSquare />
              </div>
              <p className="stat-label">Total Tasks</p>
            </div>
            <div className="stat-right">
              <h4 className="stat-count">{taskStats.total || 0}</h4>
            </div>
          </div>
          <div className="stat-progress">
            <div className="progress-bar">
              <div 
                className="progress-bar-fill primary" 
                style={{ width: `${taskStats.total ? (taskStats.completed / taskStats.total * 100) : 0}%` }}
              ></div>
            </div>
            <span>{taskStats.completed || 0} completed</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-inner">
            <div className="stat-left">
              <div className="stat-icon warning">
                <FiCheckSquare />
              </div>
              <p className="stat-label">To Do</p>
            </div>
            <div className="stat-right">
              <h4 className="stat-count">{taskStats.todo || 0}</h4>
            </div>
          </div>
          <div className="stat-progress">
            <div className="progress-bar">
              <div 
                className="progress-bar-fill warning" 
                style={{ width: `${taskStats.total ? (taskStats.todo / taskStats.total * 100) : 0}%` }}
              ></div>
            </div>
            <span>Pending tasks</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-inner">
            <div className="stat-left">
              <div className="stat-icon info">
                <FiCheckSquare />
              </div>
              <p className="stat-label">In Progress</p>
            </div>
            <div className="stat-right">
              <h4 className="stat-count">{taskStats.in_progress || 0}</h4>
            </div>
          </div>
          <div className="stat-progress">
            <div className="progress-bar">
              <div 
                className="progress-bar-fill info" 
                style={{ width: `${taskStats.total ? (taskStats.in_progress / taskStats.total * 100) : 0}%` }}
              ></div>
            </div>
            <span>Active tasks</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-inner">
            <div className="stat-left">
              <div className="stat-icon success">
                <FiCheckSquare />
              </div>
              <p className="stat-label">Completed</p>
            </div>
            <div className="stat-right">
              <h4 className="stat-count">{taskStats.completed || 0}</h4>
            </div>
          </div>
          <div className="stat-progress">
            <div className="progress-bar">
              <div 
                className="progress-bar-fill success" 
                style={{ width: `${taskStats.total ? (taskStats.completed / taskStats.total * 100) : 0}%` }}
              ></div>
            </div>
            <span>Finished tasks</span>
          </div>
        </div>
      </div>

      {/* Project Details */}
      <div className="project-details-grid">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Project Details</h3>
          </div>
          <div className="details-list">
            <div className="detail-item">
              <FiCalendar />
              <span>Start Date: {project.start_date ? new Date(project.start_date).toLocaleDateString() : 'Not set'}</span>
            </div>
            <div className="detail-item">
              <FiCalendar />
              <span>End Date: {project.end_date ? new Date(project.end_date).toLocaleDateString() : 'Not set'}</span>
            </div>
            <div className="detail-item">
              <FiDollarSign />
              <span>Budget: ${parseFloat(project.project_cost || 0).toLocaleString()}</span>
            </div>
            <div className="detail-item">
              <FiUsers />
              <span>Manager: {project.project_head_name || 'Not assigned'}</span>
            </div>
          </div>
          
          <div className="project-progress-section">
            <div className="progress-header">
              <span>Overall Progress</span>
              <span>{project.progress_percent}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className={`progress-bar-fill ${project.progress_percent === 100 ? 'success' : 'primary'}`}
                style={{ width: `${project.progress_percent}%` }}
              ></div>
            </div>
            {(isManager && project.project_head_id === user?.id) && (
              <div style={{ marginTop: '12px' }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                  Update Progress (Manager)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={project.progress_percent}
                  onChange={async (e) => {
                    const newProgress = parseInt(e.target.value);
                    try {
                      await projectsAPI.update(id, { progress_percent: newProgress });
                      toast.success('Progress updated');
                      fetchProjectDetails();
                    } catch (error) {
                      toast.error('Failed to update progress');
                    }
                  }}
                  className="progress-slider"
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Team Members */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Team Members ({teamMembers.length})</h3>
            {(isAdmin || isManager) && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddMember(true)}>
                <FiPlus /> Add
              </button>
            )}
          </div>
          <div className="team-list">
            {teamMembers.length === 0 ? (
              <div className="empty-team">
                <p>No team members assigned</p>
              </div>
            ) : (
              teamMembers.map((member) => (
                <div key={member.empid} className="team-member">
                  <div className="avatar">
                    {member.image_base64 ? (
                      <img src={member.image_base64} alt={member.name} />
                    ) : (
                      member.name?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="member-info">
                    <h4>{member.name}</h4>
                    <p>{member.empid} • {member.role}</p>
                  </div>
                  {(isAdmin || isManager) && (
                    <button 
                      className="btn-icon"
                      onClick={() => handleRemoveMember(member.empid)}
                    >
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="card tasks-section">
        <div className="card-header">
          <h3 className="card-title">Tasks</h3>
          <Link to="/tasks" className="btn btn-secondary btn-sm">
            View All Tasks
          </Link>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>
                    No tasks for this project
                  </td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <Link to={`/tasks/${task.id}`} className="task-link">
                        {task.title}
                      </Link>
                    </td>
                    <td>{task.assigned_to_name || '-'}</td>
                    <td>
                      <span className={`badge badge-${getStatusColor(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                    <td>{task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}</td>
                    <td>
                      <div className="progress-bar" style={{ width: 100 }}>
                        <div 
                          className="progress-bar-fill primary"
                          style={{ width: `${task.percent_complete}%` }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddMember}
        onClose={() => {
          setShowAddMember(false);
          setSelectedEmployees([]);
        }}
        title="Add Team Member"
      >
        <div className="form-group">
          <label className="form-label">Select Employees</label>
          <div className="participants-selector">
            {employees
              .filter(emp => !teamMembers.some(m => m.empid === emp.empid))
              .map((emp) => {
                const selected = selectedEmployees.includes(emp.empid);
                return (
                  <div
                    key={emp.empid}
                    className={`participant-chip ${selected ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedEmployees((prev) =>
                        prev.includes(emp.empid)
                          ? prev.filter((id) => id !== emp.empid)
                          : [...prev, emp.empid]
                      );
                    }}
                  >
                    <div className="avatar avatar-sm">
                      {emp.image_base64 ? (
                        <img src={emp.image_base64} alt={emp.name} />
                      ) : (
                        emp.name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span>{emp.name} ({emp.empid})</span>
                  </div>
                );
              })}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setShowAddMember(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleAddMember}>
            Add Selected
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectDetails;






