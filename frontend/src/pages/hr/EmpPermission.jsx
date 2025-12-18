import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './HR.css';

const EmpPermission = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchPermissions();
  }, [filter]);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/hr/permissions?filter=${filter}`);
      setPermissions(response.data);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePermissionStatus = async (permissionId, status) => {
    try {
      await api.put(`/hr/permissions/${permissionId}`, { status });
      toast.success('Permission status updated');
      fetchPermissions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update permission status');
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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Employee Permissions</h1>
        <div className="header-actions">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Permissions</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

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
                <th>Employee</th>
                <th>Permission Type</th>
                <th>Date</th>
                <th>Time</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {permissions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">No permission requests found</td>
                </tr>
              ) : (
                permissions.map((permission) => (
                  <tr key={permission.id}>
                    <td>
                      <div className="employee-name">{permission.employee_name}</div>
                      <div className="employee-id">{permission.employee_id}</div>
                    </td>
                    <td>{permission.permission_type}</td>
                    <td>{new Date(permission.date).toLocaleDateString()}</td>
                    <td>{permission.time || '-'}</td>
                    <td>{permission.reason || '-'}</td>
                    <td>{getStatusBadge(permission.status)}</td>
                    <td>
                      <div className="action-buttons">
                        {permission.status === 'pending' && (
                          <>
                            <button
                              className="btn-sm btn-success"
                              onClick={() => updatePermissionStatus(permission.id, 'approved')}
                            >
                              Approve
                            </button>
                            <button
                              className="btn-sm btn-danger"
                              onClick={() => updatePermissionStatus(permission.id, 'rejected')}
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

export default EmpPermission;

