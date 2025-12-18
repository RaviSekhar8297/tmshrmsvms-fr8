import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './HR.css';

const SelfPermissions = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    permission_type: '',
    date: '',
    time: '',
    reason: ''
  });

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/hr/self/permissions');
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
      await api.post('/hr/self/permissions', formData);
      toast.success('Permission request submitted successfully');
      setShowForm(false);
      setFormData({
        permission_type: '',
        date: '',
        time: '',
        reason: ''
      });
      fetchPermissions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit permission request');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
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
    <div className="page-container">
      <div className="page-header">
        <h1>My Permissions</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Request Permission'}
        </button>
      </div>

      {showForm && (
        <div className="form-container">
          <form onSubmit={handleSubmit} className="permission-form">
            <div className="form-group">
              <label>Permission Type *</label>
              <select
                name="permission_type"
                value={formData.permission_type}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="">Select Type</option>
                <option value="late-arrival">Late Arrival</option>
                <option value="early-departure">Early Departure</option>
                <option value="half-day">Half Day</option>
                <option value="short-leave">Short Leave</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Time</label>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
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
                rows="4"
                required
                className="form-input"
                placeholder="Enter reason for permission..."
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Permission Request'}
            </button>
          </form>
        </div>
      )}

      {loading && !showForm ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading permissions...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Permission Type</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {permissions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center">No permission requests found</td>
                </tr>
              ) : (
                permissions.map((permission) => (
                  <tr key={permission.id}>
                    <td>{permission.permission_type}</td>
                    <td>{new Date(permission.date).toLocaleDateString()}</td>
                    <td>{permission.time || '-'}</td>
                    <td>{getStatusBadge(permission.status)}</td>
                    <td>{permission.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SelfPermissions;

