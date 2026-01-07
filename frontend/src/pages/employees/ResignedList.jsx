import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { resignationsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiXCircle, FiClock, FiEye, FiRefreshCw } from 'react-icons/fi';
import Modal from '../../components/Modal';
import './ResignedList.css';

const ResignedList = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [resignations, setResignations] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedResignation, setSelectedResignation] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [approvalData, setApprovalData] = useState({
    status: 'Approved',
    comments: ''
  });

  useEffect(() => {
    fetchResignations();
  }, [filter]);

  const fetchResignations = async () => {
    setLoading(true);
    try {
      const status = filter === 'all' ? null : filter;
      const response = await resignationsAPI.getAll(status);
      setResignations(response.data || []);
    } catch (error) {
      console.error('Error fetching resignations:', error);
      toast.error('Failed to load resignations');
    } finally {
      setLoading(false);
    }
  };

  const handleView = (resignation) => {
    setSelectedResignation(resignation);
    setShowModal(true);
  };

  const handleApprove = async (resignation, approver) => {
    if (!approvalData.status) {
      toast.error('Please select approval status');
      return;
    }

    try {
      let response;
      if (approver === 'manager') {
        response = await resignationsAPI.approveManager(resignation.id, approvalData);
      } else if (approver === 'hr') {
        response = await resignationsAPI.approveHR(resignation.id, approvalData);
      } else if (approver === 'hod') {
        response = await resignationsAPI.approveHOD(resignation.id, approvalData);
      }

      toast.success(response.data?.message || 'Resignation updated successfully');
      setShowModal(false);
      setApprovalData({ status: 'Approved', comments: '' });
      fetchResignations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error updating resignation');
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      'Pending': { color: '#f59e0b', icon: FiClock, label: 'Pending' },
      'Approved': { color: '#10b981', icon: FiCheckCircle, label: 'Approved' },
      'Rejected': { color: '#ef4444', icon: FiXCircle, label: 'Rejected' },
      'Processed': { color: '#3b82f6', icon: FiCheckCircle, label: 'Processed' }
    };
    
    const cfg = config[status] || config['Pending'];
    const Icon = cfg.icon;
    
    return (
      <span className="status-badge" style={{ color: cfg.color, borderColor: cfg.color }}>
        <Icon size={12} />
        {cfg.label}
      </span>
    );
  };

  const canApprove = (resignation) => {
    const role = user?.role;
    
    // New step-by-step approval workflow: Manager → HOD → HR
    // 1. Manager approves first (if manager_status is Pending)
    // 2. HOD approves after Manager (if manager_status is Approved and hod_status is Pending)
    // 3. HR approves after HOD (if hod_status is Approved and hr_status is Pending)
    
    if (role === 'Manager') {
      // Manager can approve only if manager_status is Pending
      // (Backend will verify employee reports to this manager)
      return resignation.manager_status === 'Pending';
    } else if (role === 'Admin') {
      // HOD can approve only if:
      // - Manager has approved (manager_status = 'Approved')
      // - HOD status is still Pending
      // - Manager status is not Rejected
      if (resignation.manager_status === 'Rejected') {
        return false; // Cannot proceed if manager rejected
      }
      return resignation.manager_status === 'Approved' && resignation.hod_status === 'Pending';
    } else if (role === 'HR') {
      // HR can approve only if:
      // - HOD has approved (hod_status = 'Approved')
      // - HR status is still Pending
      // - HOD status is not Rejected
      if (resignation.hod_status === 'Rejected') {
        return false; // Cannot proceed if HOD rejected
      }
      return resignation.hod_status === 'Approved' && resignation.hr_status === 'Pending';
    }
    
    return false;
  };

  const getApprover = (resignation) => {
    const role = user?.role;
    
    if (role === 'Manager') {
      return 'manager';
    } else if (role === 'Admin') {
      return 'hod';
    } else if (role === 'HR') {
      return 'hr';
    }
    
    return null;
  };

  const filteredResignations = resignations.filter(r => !r.withdrawal_date);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Resigned List</h1>
          <p className="page-subtitle">View and manage employee resignation applications</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchResignations} disabled={loading}>
          <FiRefreshCw className={loading ? 'spinning' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="filters-row">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button
          className={`filter-btn ${filter === 'approved' ? 'active' : ''}`}
          onClick={() => setFilter('approved')}
        >
          Approved
        </button>
        <button
          className={`filter-btn ${filter === 'rejected' ? 'active' : ''}`}
          onClick={() => setFilter('rejected')}
        >
          Rejected
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      ) : filteredResignations.length === 0 ? (
        <div className="empty-state">
          <p>No resignations found</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Applied Date</th>
                  <th>Resign Date</th>
                  <th>Last Working Date</th>
                  <th>Notice Period</th>
                  <th>Manager</th>
                  <th>HR</th>
                  <th>HOD</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredResignations.map((resignation) => (
                  <tr key={resignation.id}>
                    <td>{resignation.empid}</td>
                    <td>{resignation.name}</td>
                    <td>{new Date(resignation.applied_date).toLocaleDateString()}</td>
                    <td>{new Date(resignation.resign_date).toLocaleDateString()}</td>
                    <td>
                      {resignation.requested_date
                        ? new Date(resignation.requested_date).toLocaleDateString()
                        : resignation.last_working_date
                        ? new Date(resignation.last_working_date).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td>{resignation.notice_period_days} days</td>
                    <td>
                      {getStatusBadge(resignation.manager_status)}
                      {canApprove(resignation) && user?.role === 'Manager' && (
                        <span className="action-required-badge" title="Action Required">⚠️</span>
                      )}
                    </td>
                    <td>
                      {getStatusBadge(resignation.hod_status)}
                      {canApprove(resignation) && user?.role === 'Admin' && (
                        <span className="action-required-badge" title="Action Required">⚠️</span>
                      )}
                    </td>
                    <td>
                      {getStatusBadge(resignation.hr_status)}
                      {canApprove(resignation) && user?.role === 'HR' && (
                        <span className="action-required-badge" title="Action Required">⚠️</span>
                      )}
                    </td>
                    <td>
                      {canApprove(resignation) ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleView(resignation)}
                          title="Approve/Reject"
                        >
                          Action
                        </button>
                      ) : (
                        <button
                          className="btn-icon"
                          onClick={() => handleView(resignation)}
                          title="View Details"
                        >
                          <FiEye />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View/Approve Modal */}
      {showModal && selectedResignation && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setApprovalData({ status: 'Approved', comments: '' });
          }}
          title="Resignation Details"
        >
          <div className="resignation-modal-content">
            <div className="detail-section">
              <h3>Employee Information</h3>
              <div className="detail-grid">
                <div>
                  <span className="label">Employee ID:</span>
                  <span>{selectedResignation.empid}</span>
                </div>
                <div>
                  <span className="label">Name:</span>
                  <span>{selectedResignation.name}</span>
                </div>
                <div>
                  <span className="label">Department:</span>
                  <span>{selectedResignation.department || 'N/A'}</span>
                </div>
                <div>
                  <span className="label">Position:</span>
                  <span>{selectedResignation.position || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3>Resignation Details</h3>
              <div className="detail-grid">
                <div>
                  <span className="label">Applied Date:</span>
                  <span>{new Date(selectedResignation.applied_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="label">Resignation Date:</span>
                  <span>{new Date(selectedResignation.resign_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="label">Requested Date (Last Working):</span>
                  <span>
                    {selectedResignation.requested_date
                      ? new Date(selectedResignation.requested_date).toLocaleDateString()
                      : selectedResignation.last_working_date
                      ? new Date(selectedResignation.last_working_date).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="label">Last Working Date:</span>
                  <span>
                    {selectedResignation.last_working_date
                      ? new Date(selectedResignation.last_working_date).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="label">Notice Period:</span>
                  <span>{selectedResignation.notice_period_days} days</span>
                </div>
                <div>
                  <span className="label">Type:</span>
                  <span>{selectedResignation.resignation_type}</span>
                </div>
                {selectedResignation.reason && (
                  <div className="full-width">
                    <span className="label">Reason:</span>
                    <span>{selectedResignation.reason}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="detail-section">
              <h3>Approval Status (Workflow: Manager → HOD → HR)</h3>
              <div className="approval-status-grid">
                <div className="approval-item">
                  <span className="approval-label">Manager (Step 1):</span>
                  {getStatusBadge(selectedResignation.manager_status)}
                  {selectedResignation.manager_comments && (
                    <p className="approval-comments">{selectedResignation.manager_comments}</p>
                  )}
                  {selectedResignation.manager_approval_date && (
                    <p className="approval-date">
                      {new Date(selectedResignation.manager_approval_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="approval-item">
                  <span className="approval-label">HOD (Step 2):</span>
                  {getStatusBadge(selectedResignation.hod_status)}
                  {selectedResignation.hod_comments && (
                    <p className="approval-comments">{selectedResignation.hod_comments}</p>
                  )}
                  {selectedResignation.hod_approval_date && (
                    <p className="approval-date">
                      {new Date(selectedResignation.hod_approval_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="approval-item">
                  <span className="approval-label">HR (Step 3):</span>
                  {getStatusBadge(selectedResignation.hr_status)}
                  {selectedResignation.hr_comments && (
                    <p className="approval-comments">{selectedResignation.hr_comments}</p>
                  )}
                  {selectedResignation.hr_approval_date && (
                    <p className="approval-date">
                      {new Date(selectedResignation.hr_approval_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {canApprove(selectedResignation) && (
              <div className="approval-section">
                <h3>Approve/Reject</h3>
                <div className="form-group">
                  <label>Status *</label>
                  <select
                    value={approvalData.status}
                    onChange={(e) => setApprovalData({ ...approvalData, status: e.target.value })}
                  >
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    {user?.role === 'HR' && <option value="Processed">Processed</option>}
                  </select>
                </div>
                <div className="form-group">
                  <label>Comments</label>
                  <textarea
                    value={approvalData.comments}
                    onChange={(e) => setApprovalData({ ...approvalData, comments: e.target.value })}
                    rows={3}
                    placeholder="Enter comments..."
                  />
                </div>
                <div className="modal-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleApprove(selectedResignation, getApprover(selectedResignation))}
                  >
                    Submit
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowModal(false);
                      setApprovalData({ status: 'Approved', comments: '' });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ResignedList;

