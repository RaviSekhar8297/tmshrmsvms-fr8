import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './Employee.css';

const Permission = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isSelfPage = location.pathname.includes('/self/');
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: '',
    from_datetime: '',
    to_datetime: '',
    reason: ''
  });

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/permissions/self');
      setPermissions(response.data);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/permissions', formData);
      toast.success('Permission request submitted successfully');
      setShowForm(false);
      setFormData({ type: '', from_datetime: '', to_datetime: '', reason: '' });
      fetchPermissions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit permission request');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'badge-warning', text: 'Pending' },
      approved: { class: 'badge-success', text: 'Approved' },
      rejected: { class: 'badge-danger', text: 'Rejected' },
    };
    const badge = badges[status] || badges.pending;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  return (
    <div className="page-container employee-permission-page">
      <div className="page-header stacked">
        <div>
          <h1>Permission Requests</h1>
          <p className="page-subtitle">View your permission history with quick filters.</p>
        </div>
        <div className="header-actions filters-row toolbar">
          <div className="toolbar-left" style={{ flex: 1 }}>
            <div className="filter-field" style={{ flex: 1 }}>
              <label className="filter-label">Search</label>
              <input
                type="text"
                className="form-input"
                placeholder="Search by type, date, status or reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ marginBottom: 0, minWidth: '280px' }}
              />
            </div>
          </div>
          <div className="toolbar-right">
            {isSelfPage && (
              <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Cancel' : '+ Add Permission'}
              </button>
            )}
            <button className="btn-primary" onClick={() => toast('Excel export coming soon')}>
              Excel
            </button>
          </div>
        </div>
      </div>

      {showForm && isSelfPage && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Permission</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Permission Type *</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    required
                    className="form-select"
                  >
                    <option value="">Select Type</option>
                    <option value="late-arrival">Late Arrival</option>
                    <option value="early-departure">Early Departure</option>
                    <option value="half-day">Half Day</option>
                    <option value="short-leave">Short Leave</option>
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>From Date & Time *</label>
                    <input
                      type="datetime-local"
                      name="from_datetime"
                      value={formData.from_datetime}
                      onChange={handleChange}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>To Date & Time *</label>
                    <input
                      type="datetime-local"
                      name="to_datetime"
                      value={formData.to_datetime}
                      onChange={handleChange}
                      required
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Reason *</label>
                  <textarea
                    name="reason"
                    value={formData.reason}
                    onChange={handleChange}
                    required
                    rows="5"
                    className="form-input"
                    placeholder="Enter reason for permission..."
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading permissions...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Applied Date</th>
                <th>Date</th>
                <th>From Time</th>
                <th>To Time</th>
                <th>Type</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {permissions
                .filter((p) => {
                  const term = search.trim().toLowerCase();
                  if (!term) return true;
                  return (
                    p.type?.toLowerCase().includes(term) ||
                    p.status?.toLowerCase().includes(term) ||
                    p.reason?.toLowerCase().includes(term)
                  );
                })
                .map((permission) => (
                  <tr key={permission.id}>
                    <td>{new Date(permission.applied_date).toLocaleDateString()}</td>
                    <td>{new Date(permission.from_datetime).toLocaleDateString()}</td>
                    <td>{new Date(permission.from_datetime).toLocaleTimeString()}</td>
                    <td>{new Date(permission.to_datetime).toLocaleTimeString()}</td>
                    <td>{permission.type}</td>
                    <td>{getStatusBadge(permission.status)}</td>
                    <td>{permission.reason || '-'}</td>
                  </tr>
                ))}
              {permissions.filter((p) => {
                const term = search.trim().toLowerCase();
                if (!term) return true;
                return (
                  p.type?.toLowerCase().includes(term) ||
                  p.status?.toLowerCase().includes(term) ||
                  p.reason?.toLowerCase().includes(term)
                );
              }).length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">No permission requests found</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Permission;

