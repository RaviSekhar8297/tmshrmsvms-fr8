import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './HR.css';

const EmpLeaves = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    employee_id: '',
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
    status: 'pending'
  });
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    fetchLeaves();
    fetchEmployees();
  }, []);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const response = await api.get('/hr/leaves');
      setLeaves(response.data);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/users');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/hr/leaves', formData);
      toast.success('Leave request created successfully');
      setShowForm(false);
      setFormData({
        employee_id: '',
        leave_type: '',
        start_date: '',
        end_date: '',
        reason: '',
        status: 'pending'
      });
      fetchLeaves();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create leave request');
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

  const updateLeaveStatus = async (leaveId, status) => {
    try {
      await api.put(`/hr/leaves/${leaveId}`, { status });
      toast.success('Leave status updated');
      fetchLeaves();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update leave status');
    }
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

  const filteredLeaves = leaves.filter(leave => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      leave.employee_name?.toLowerCase().includes(searchLower) ||
      leave.employee_id?.toLowerCase().includes(searchLower) ||
      leave.leave_type?.toLowerCase().includes(searchLower) ||
      leave.reason?.toLowerCase().includes(searchLower) ||
      leave.status?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="page-container">
      <div className="page-header stacked">
        <div>
          <h1>Employee Leaves</h1>
          <p className="page-subtitle">Review and manage employee leave requests.</p>
        </div>
        <div className="header-actions filters-row toolbar">
          <div className="toolbar-left" style={{ flex: 1 }}>
            <div className="filter-field" style={{ flex: 1 }}>
              <label className="filter-label">Search</label>
              <input
                type="text"
                className="form-input"
                placeholder="Search by employee, leave type, reason, or status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ marginBottom: 0, minWidth: '280px' }}
              />
            </div>
          </div>
          <div className="toolbar-right">
            <button className="btn-primary" onClick={() => toast('Excel export coming soon')}>
              Excel
            </button>
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : '+ Add Leave Request'}
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="form-container">
          <form onSubmit={handleSubmit} className="leave-form">
            <div className="form-group">
              <label>Employee *</label>
              <select
                name="employee_id"
                value={formData.employee_id}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.empid}>
                    {emp.name} ({emp.empid})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Leave Type *</label>
                <select
                  name="leave_type"
                  value={formData.leave_type}
                  onChange={handleChange}
                  required
                  className="form-input"
                >
                  <option value="">Select Type</option>
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="annual">Annual Leave</option>
                  <option value="emergency">Emergency Leave</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="form-input"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>End Date *</label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
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
                rows="4"
                required
                className="form-input"
                placeholder="Enter reason for leave..."
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Leave Request'}
            </button>
          </form>
        </div>
      )}

      {loading && !showForm ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading leaves...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Days</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">No leave requests found</td>
                </tr>
              ) : (
                filteredLeaves.map((leave) => {
                  const start = new Date(leave.start_date);
                  const end = new Date(leave.end_date);
                  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                  
                  return (
                    <tr key={leave.id}>
                      <td>
                        <div className="employee-name">{leave.employee_name}</div>
                        <div className="employee-id">{leave.employee_id}</div>
                      </td>
                      <td>{leave.leave_type}</td>
                      <td>{new Date(leave.start_date).toLocaleDateString()}</td>
                      <td>{new Date(leave.end_date).toLocaleDateString()}</td>
                      <td>{days} days</td>
                      <td>{getStatusBadge(leave.status)}</td>
                      <td>
                        <div className="action-buttons">
                          {leave.status === 'pending' && (
                            <>
                              <button
                                className="btn-sm btn-success"
                                onClick={() => updateLeaveStatus(leave.id, 'approved')}
                              >
                                Approve
                              </button>
                              <button
                                className="btn-sm btn-danger"
                                onClick={() => updateLeaveStatus(leave.id, 'rejected')}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EmpLeaves;

