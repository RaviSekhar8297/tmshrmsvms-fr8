import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './HR.css';

const EmpRequests = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/hr/requests?filter=${filter}`);
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (requestId, status) => {
    try {
      await api.put(`/hr/requests/${requestId}`, { status });
      toast.success('Request status updated');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update request status');
    }
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

  const getRequestTypeBadge = (type) => {
    const types = {
      equipment: { class: 'badge-info', text: 'Equipment' },
      access: { class: 'badge-secondary', text: 'Access' },
      training: { class: 'badge-warning', text: 'Training' },
      other: { class: 'badge-secondary', text: 'Other' },
    };
    const typeBadge = types[type] || types.other;
    return <span className={`badge ${typeBadge.class}`}>{typeBadge.text}</span>;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Employee Requests</h1>
        <div className="header-actions">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Requests</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading requests...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Request Type</th>
                <th>Subject</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center">No requests found</td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <div className="employee-name">{request.employee_name}</div>
                      <div className="employee-id">{request.employee_id}</div>
                    </td>
                    <td>{getRequestTypeBadge(request.request_type)}</td>
                    <td>{request.subject}</td>
                    <td>{new Date(request.created_at).toLocaleDateString()}</td>
                    <td>{getStatusBadge(request.status)}</td>
                    <td>
                      <div className="action-buttons">
                        {request.status === 'pending' && (
                          <>
                            <button
                              className="btn-sm btn-success"
                              onClick={() => updateRequestStatus(request.id, 'approved')}
                            >
                              Approve
                            </button>
                            <button
                              className="btn-sm btn-danger"
                              onClick={() => updateRequestStatus(request.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button className="btn-sm btn-primary">View</button>
                      </div>
                    </td>
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

export default EmpRequests;

