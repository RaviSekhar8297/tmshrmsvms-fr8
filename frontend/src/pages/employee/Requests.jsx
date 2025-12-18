import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './Employee.css';

const Requests = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isSelfPage = location.pathname.includes('/self/');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const isPrivileged = ['Admin', 'Manager', 'HR'].includes(user?.role);
  const [formData, setFormData] = useState({
    type: '',
    subject: '',
    description: '',
    intime: '',
    outtime: ''
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const endpoint = isPrivileged ? '/requests' : '/requests/self';
      const response = await api.get(endpoint);
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!formData.type || !formData.subject || !formData.description) {
        toast.error('Please fill all required fields');
        setLoading(false);
        return;
      }
      await api.post('/requests', formData);
      toast.success('Request submitted successfully');
      setShowForm(false);
      setFormData({
        type: '',
        subject: '',
        description: '',
        intime: '',
        outtime: ''
      });
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit request');
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
      completed: { class: 'badge-info', text: 'Completed' },
    };
    const badge = badges[status] || badges.pending;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  const filteredRequests = requests.filter((req) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      req.type?.toLowerCase().includes(term) ||
      req.subject?.toLowerCase().includes(term) ||
      req.status?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="page-container employee-requests-page">
      <div className="page-header stacked">
        <div>
          <h1>Requests</h1>
          <p className="page-subtitle">Submit and track requests across roles.</p>
        </div>
        <div className="header-actions filters-row toolbar">
          <div className="toolbar-left" style={{ flex: 1 }}>
            <div className="filter-field" style={{ minWidth: '240px' }}>
              <label className="filter-label">Search</label>
              <input
                type="text"
                className="form-input"
                placeholder="Search by type, subject, or status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ marginBottom: 0 }}
              />
            </div>
          </div>
          <div className="toolbar-right" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={fetchRequests}>
              Refresh
            </button>
            <button className="btn-primary" onClick={() => toast('Excel export coming soon')}>
              Excel
            </button>
            {(user?.role === 'Employee' || isSelfPage) && (
              <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Cancel' : '+ Add Request'}
              </button>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Request</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Request Type *</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    required
                    className="form-select"
                  >
                    <option value="">Select Type</option>
                    <option value="intime">Intime</option>
                    <option value="outtime">Outtime</option>
                    <option value="overtime">OverTime</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Subject *</label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="form-input"
                    placeholder="Enter request subject"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>In Time</label>
                    <input
                      type="datetime-local"
                      name="intime"
                      value={formData.intime}
                      onChange={handleChange}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Out Time</label>
                    <input
                      type="datetime-local"
                      name="outtime"
                      value={formData.outtime}
                      onChange={handleChange}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="5"
                    required
                    className="form-input"
                    placeholder="Enter request description..."
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {loading && !showForm ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading requests...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Applied Date</th>
                <th>Type</th>
                <th>Subject</th>
                <th>In Time</th>
                <th>Out Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center">No requests found</td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{new Date(request.applied_date).toLocaleDateString()}</td>
                    <td>{request.type}</td>
                    <td>{request.subject}</td>
                    <td>{request.intime ? new Date(request.intime).toLocaleString() : '-'}</td>
                    <td>{request.outtime ? new Date(request.outtime).toLocaleString() : '-'}</td>
                    <td>{getStatusBadge(request.status)}</td>
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

export default Requests;

