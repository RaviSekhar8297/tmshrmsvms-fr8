import { useState, useEffect } from 'react';
import { 
  FiPlus, FiSearch, FiAlertCircle, FiEdit2, 
  FiTrash2, FiCheckCircle
} from 'react-icons/fi';
import { issuesAPI, tasksAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import './Issues.css';

const Issues = () => {
  const [issues, setIssues] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIssue, setEditingIssue] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { isEmployee, isAdmin, user } = useAuth();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    project_id: ''
  });

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const [issuesRes, statsRes, tasksRes] = await Promise.all([
        issuesAPI.getAll(params),
        issuesAPI.getStats(),
        tasksAPI.getAll()
      ]);
      
      setIssues(issuesRes.data);
      setStats(statsRes.data);
      setTasks(tasksRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load issues');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const data = {
        ...formData,
        project_id: formData.project_id ? parseInt(formData.project_id) : null
      };

      if (editingIssue) {
        await issuesAPI.update(editingIssue.id, data);
        toast.success('Issue updated successfully');
      } else {
        await issuesAPI.create(data);
        toast.success('Issue created successfully');
      }
      
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save issue');
    }
  };

  const handleEdit = (issue) => {
    setEditingIssue(issue);
    setFormData({
      title: issue.title,
      description: issue.description || '',
      priority: issue.priority || 'medium',
      project_id: issue.project_id || '',
      status: issue.status,
      resolution_notes: issue.resolution_notes || ''
    });
    setShowModal(true);
  };

  const handleStatusChange = async (issueId, newStatus) => {
    try {
      await issuesAPI.update(issueId, { status: newStatus });
      toast.success('Status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this issue?')) return;
    
    try {
      await issuesAPI.delete(id);
      toast.success('Issue deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete issue');
    }
  };

  const resetForm = () => {
    setEditingIssue(null);
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      project_id: ''
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return 'warning';
      case 'in-progress': return 'info';
      case 'resolved': return 'success';
      case 'closed': return 'primary';
      case 'delayed': return 'danger';
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

  const filteredIssues = issues.filter(issue =>
    issue.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading issues...</p>
      </div>
    );
  }

  return (
    <div className="issues-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">ISSUES</h1>
          <p className="page-subtitle">Track and resolve issues</p>
        </div>
        {!isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <FiPlus /> Raise Issue
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="issues-stats">
        <div className="stat-card">
          <div className="stat-icon primary">
            <FiAlertCircle />
          </div>
          <div className="stat-content">
            <h4>{stats.total || 0}</h4>
            <p>Total Issues</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warning">
            <FiAlertCircle />
          </div>
          <div className="stat-content">
            <h4>{stats.open || 0}</h4>
            <p>Open</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon info">
            <FiAlertCircle />
          </div>
          <div className="stat-content">
            <h4>{stats.in_progress || 0}</h4>
            <p>In Progress</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon success">
            <FiCheckCircle />
          </div>
          <div className="stat-content">
            <h4>{stats.resolved || 0}</h4>
            <p>Resolved</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon danger">
            <FiAlertCircle />
          </div>
          <div className="stat-content">
            <h4>{stats.delayed || 0}</h4>
            <p>Delayed</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="issues-filters">
        <div className="search-box" style={{ flex: 1, maxWidth: 300 }}>
          <FiSearch className="search-box-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          {['all', 'open', 'in-progress', 'delayed', 'resolved', 'closed'].map((status) => (
            <button
              key={status}
              className={`filter-tab ${filter === status ? 'active' : ''}`}
              onClick={() => setFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Issues List */}
      <div className="issues-list">
        {filteredIssues.length === 0 ? (
          <div className="empty-state">
            <FiAlertCircle className="empty-state-icon" />
            <h3>No issues found</h3>
            <p>All clear! No issues to display.</p>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div key={issue.id} className="issue-item">
              <div className="issue-header">
                <div className="issue-badges">
                  <span className={`badge badge-${getStatusColor(issue.status)}`}>
                    {issue.status}
                  </span>
                  <span className={`badge badge-${getPriorityColor(issue.priority)}`}>
                    {issue.priority}
                  </span>
                </div>
                <div className="issue-actions">
                  {!isEmployee && (
                    <select
                      className="form-select form-select-sm"
                      value={issue.status}
                      onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                    >
                      <option value="open">Open</option>
                      <option value="in-progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  )}
                  <button className="btn-icon" onClick={() => handleEdit(issue)}>
                    <FiEdit2 />
                  </button>
                  {!isEmployee && (
                    <button className="btn-icon" onClick={() => handleDelete(issue.id)}>
                      <FiTrash2 />
                    </button>
                  )}
                </div>
              </div>

              <div className="issue-content">
                <h3>{issue.title}</h3>
                <p>{issue.description || 'No description'}</p>
              </div>

              <div className="issue-meta">
                <span>Raised by: {issue.raised_by_name}</span>
                <span>•</span>
                <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                {issue.resolved_at && (
                  <>
                    <span>•</span>
                    <span>Resolved: {new Date(issue.resolved_at).toLocaleDateString()}</span>
                  </>
                )}
              </div>

              {issue.resolution_notes && (
                <div className="resolution-notes">
                  <strong>Resolution:</strong> {issue.resolution_notes}
                </div>
              )}
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
        title={editingIssue ? 'Edit Issue' : 'Raise Issue'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              type="text"
              className="form-input"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Brief description of the issue"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description"
              rows={4}
            />
          </div>

          <div className="form-row">
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
            <div className="form-group">
              <label className="form-label">Related Task</label>
              <select
                className="form-select"
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              >
                <option value="">None</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
            </div>
          </div>

          {editingIssue && !isEmployee && (
            <div className="form-group">
              <label className="form-label">Resolution Notes</label>
              <textarea
                className="form-textarea"
                value={formData.resolution_notes || ''}
                onChange={(e) => setFormData({ ...formData, resolution_notes: e.target.value })}
                placeholder="How was this issue resolved?"
                rows={3}
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
              {editingIssue ? 'Update' : 'Create'} Issue
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Issues;






