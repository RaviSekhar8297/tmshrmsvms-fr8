import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { resignationsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiAlertCircle, FiCheckCircle, FiXCircle, FiClock, FiCalendar, FiFileText } from 'react-icons/fi';
import DatePicker from '../../components/DatePicker';
import './Resignation.css';

const Resignation = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [resignation, setResignation] = useState(null);
  const [noticePeriodInfo, setNoticePeriodInfo] = useState(null);
  const [formData, setFormData] = useState({
    resign_date: '',
    requested_date: '',  // User can manually select requested date
    reason: '',
    resignation_type: 'Voluntary'
  });

  useEffect(() => {
    fetchResignation();
    fetchNoticePeriodInfo();
  }, []);

  const fetchResignation = async () => {
    try {
      const response = await resignationsAPI.getSelf();
      if (response.data) {
        setResignation(response.data);
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error fetching resignation:', error);
      }
    }
  };

  const fetchNoticePeriodInfo = async () => {
    try {
      const response = await resignationsAPI.getNoticePeriodInfo();
      setNoticePeriodInfo(response.data);
    } catch (error) {
      console.error('Error fetching notice period info:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.resign_date) {
      toast.error('Please select a resignation date');
      return;
    }

    // Validate requested_date
    const requestedDate = formData.requested_date || (formData.resign_date && noticePeriodInfo 
      ? calculateLastWorkingDate(formData.resign_date, noticePeriodInfo.notice_period_days)
      : null);
    
    if (!requestedDate) {
      toast.error('Please select a requested date (last working date)');
      return;
    }

    // Validate that requested_date is after resign_date
    if (new Date(requestedDate) <= new Date(formData.resign_date)) {
      toast.error('Requested date must be after the resignation date');
      return;
    }

    setLoading(true);
    try {
      await resignationsAPI.create({
        resign_date: formData.resign_date,
        requested_date: requestedDate,
        reason: formData.reason,
        resignation_type: formData.resignation_type
      });
      
      toast.success('Resignation applied successfully');
        setFormData({
          resign_date: '',
          requested_date: '',
          reason: '',
          resignation_type: 'Voluntary'
        });
      fetchResignation();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error applying resignation');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!window.confirm('Are you sure you want to withdraw your resignation?')) {
      return;
    }

    try {
      await resignationsAPI.withdraw(resignation.id);
      toast.success('Resignation withdrawn successfully');
      fetchResignation();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error withdrawing resignation');
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'Pending': { color: '#f59e0b', icon: FiClock, label: 'Pending' },
      'Approved': { color: '#10b981', icon: FiCheckCircle, label: 'Approved' },
      'Rejected': { color: '#ef4444', icon: FiXCircle, label: 'Rejected' },
      'Processed': { color: '#3b82f6', icon: FiCheckCircle, label: 'Processed' }
    };
    
    const config = statusConfig[status] || statusConfig['Pending'];
    const Icon = config.icon;
    
    return (
      <span className="status-badge" style={{ color: config.color, borderColor: config.color }}>
        <Icon size={14} />
        {config.label}
      </span>
    );
  };

  const getNextApprover = () => {
    if (!resignation) return null;
    
    const { manager_status, hr_status, hod_status } = resignation;
    const role = user?.role;
    
    // New workflow: Manager → HOD → HR
    if (role === 'Employee') {
      if (manager_status === 'Pending') return 'Manager';
      if (manager_status === 'Approved' && hod_status === 'Pending') return 'HOD';
      if (hod_status === 'Approved' && hr_status === 'Pending') return 'HR';
    } else if (role === 'Manager') {
      // Manager applies: HOD → HR
      if (hod_status === 'Pending') return 'HOD';
      if (hod_status === 'Approved' && hr_status === 'Pending') return 'HR';
    } else if (role === 'HR') {
      // HR applies: HOD only
      if (hod_status === 'Pending') return 'HOD';
    }
    
    return null;
  };

  const canWithdraw = () => {
    if (!resignation || resignation.withdrawal_date) return false;
    
    const { manager_status, hr_status, hod_status } = resignation;
    const role = user?.role;
    
    // New workflow: Manager → HOD → HR
    if (role === 'Employee') {
      return !(manager_status === 'Approved' && hod_status === 'Approved' && hr_status === 'Approved');
    } else if (role === 'Manager') {
      return !(hod_status === 'Approved' && hr_status === 'Approved');
    } else if (role === 'HR') {
      return !(hod_status === 'Approved' && hr_status === 'Approved');
    }
    
    return false;
  };

  const calculateLastWorkingDate = (resignDate, noticePeriodDays) => {
    if (!resignDate || !noticePeriodDays) return null;
    const date = new Date(resignDate);
    date.setDate(date.getDate() + noticePeriodDays);
    return date.toISOString().split('T')[0];
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>RESIGNATION</h1>
      </div>

      {/* Instructions Card */}
      <div className="card instructions-card">
        <div className="card-header">
          <h2>📋 Resignation Instructions</h2>
        </div>
        <div className="instructions-content">
          <div className="instruction-section">
            <h3>Approval Process</h3>
            <ul>
              <li><strong>Employee:</strong> Manager → HOD (Admin) → HR</li>
              <li><strong>Manager:</strong> HOD (Admin) → HR</li>
              <li><strong>HR:</strong> HOD (Admin) only</li>
            </ul>
          </div>
          
          <div className="instruction-section">
            <h3>Notice Period</h3>
            <ul>
              <li><strong>Probation Period (less than 3 months):</strong> 15 days notice period</li>
              <li><strong>Regular Employee (6+ months):</strong> 60 days (2 months) notice period</li>
              <li>The last working date will be automatically calculated based on your notice period</li>
            </ul>
          </div>
          
          <div className="instruction-section">
            <h3>Important Rules</h3>
            <ul>
              <li>You can only apply for resignation once at a time</li>
              <li>If your resignation is rejected, you can apply again</li>
              <li>Once fully approved by all authorities, you cannot withdraw your resignation</li>
              <li>You can withdraw your resignation only if it's not fully approved</li>
              <li>The approval process is step-by-step - if any approver rejects, the process stops</li>
            </ul>
          </div>
          
          <div className="instruction-section">
            <h3>Resignation Types</h3>
            <ul>
              <li><strong>Voluntary:</strong> Employee-initiated resignation</li>
              <li><strong>Involuntary:</strong> Company-initiated termination</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Notice Period Alert */}
      {noticePeriodInfo && (
        <div className={`notice-alert ${noticePeriodInfo.is_probation ? 'probation' : 'regular'}`}>
          <FiAlertCircle size={20} />
          <div>
            <strong>Notice Period Information:</strong>
            <p>
              {noticePeriodInfo.is_probation 
                ? `You are in probation period. Notice period is ${noticePeriodInfo.notice_period_days} days.`
                : `Your notice period is ${noticePeriodInfo.notice_period_days} days (2 months).`
              }
            </p>
            {noticePeriodInfo.doj && (
              <p className="info-text">
                Date of Joining: {new Date(noticePeriodInfo.doj).toLocaleDateString()}
                {noticePeriodInfo.days_since_joining !== null && (
                  <span> • Days since joining: {noticePeriodInfo.days_since_joining}</span>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Existing Resignation */}
      {resignation && !resignation.withdrawal_date && (
        <div className="card existing-resignation">
          <div className="card-header">
            <h2>Your Resignation Application</h2>
            {canWithdraw() && (
              <button className="btn btn-danger" onClick={handleWithdraw}>
                Withdraw Resignation
              </button>
            )}
          </div>
          
          <div className="resignation-details">
            <div className="detail-row">
              <span className="label">Applied Date:</span>
              <span>{new Date(resignation.applied_date).toLocaleDateString()}</span>
            </div>
            <div className="detail-row">
              <span className="label">Resignation Date:</span>
              <span>{new Date(resignation.resign_date).toLocaleDateString()}</span>
            </div>
            <div className="detail-row">
              <span className="label">Requested Date (Last Working):</span>
              <span>
                {resignation.requested_date
                  ? new Date(resignation.requested_date).toLocaleDateString()
                  : resignation.last_working_date
                  ? new Date(resignation.last_working_date).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">Last Working Date:</span>
              <span>{resignation.last_working_date ? new Date(resignation.last_working_date).toLocaleDateString() : 'N/A'}</span>
            </div>
            <div className="detail-row">
              <span className="label">Notice Period:</span>
              <span>{resignation.notice_period_days} days</span>
            </div>
            <div className="detail-row">
              <span className="label">Type:</span>
              <span>{resignation.resignation_type}</span>
            </div>
            {resignation.reason && (
              <div className="detail-row full-width">
                <span className="label">Reason:</span>
                <span>{resignation.reason}</span>
              </div>
            )}
          </div>

          <div className="approval-status">
            <h3>Approval Status</h3>
            
            {/* Progress Bar Stepper */}
            <div className="approval-progress-bar">
              <div className="progress-step completed">
                <div className="step-number">1</div>
                <div className="step-label-progress">Applied</div>
                {resignation.applied_date && (
                  <div className="step-date-small">
                    {new Date(resignation.applied_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </div>
              <div className={`progress-connector ${resignation.manager_status === 'Approved' ? 'completed' : ''}`}></div>
              
              <div className={`progress-step ${resignation.manager_status === 'Approved' ? 'completed' : resignation.manager_status === 'Rejected' ? 'rejected' : 'active'}`}>
                <div className="step-number">2</div>
                <div className="step-label-progress">Manager</div>
                {resignation.manager_approval_date && (
                  <div className="step-date-small">
                    {new Date(resignation.manager_approval_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </div>
              <div className={`progress-connector ${resignation.hod_status === 'Approved' ? 'completed' : ''}`}></div>
              
              <div className={`progress-step ${resignation.hod_status === 'Approved' ? 'completed' : resignation.hod_status === 'Rejected' ? 'rejected' : resignation.manager_status === 'Approved' ? 'active' : ''}`}>
                <div className="step-number">3</div>
                <div className="step-label-progress">HOD</div>
                {resignation.hod_approval_date && (
                  <div className="step-date-small">
                    {new Date(resignation.hod_approval_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </div>
              <div className={`progress-connector ${resignation.hr_status === 'Approved' || resignation.hr_status === 'Processed' ? 'completed' : ''}`}></div>
              
              <div className={`progress-step ${resignation.hr_status === 'Approved' || resignation.hr_status === 'Processed' ? 'completed' : resignation.hr_status === 'Rejected' ? 'rejected' : resignation.hod_status === 'Approved' ? 'active' : ''}`}>
                <div className="step-number">4</div>
                <div className="step-label-progress">HR</div>
                {resignation.hr_approval_date && (
                  <div className="step-date-small">
                    {new Date(resignation.hr_approval_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </div>
            </div>
            
            <div className="approval-flow">
              {user?.role === 'Employee' && (
                <div className={`approval-step ${resignation.manager_status === 'Pending' ? 'pending' : resignation.manager_status === 'Approved' ? 'approved' : 'rejected'}`}>
                  <div className="step-header">
                    <div className="step-title">
                      <span className="step-label">Manager Approval (Step 1)</span>
                      {getStatusBadge(resignation.manager_status)}
                    </div>
                  </div>
                  {resignation.manager_status !== 'Pending' && (
                    <div className="step-details">
                      {resignation.manager_approval_date && (
                        <div className="approval-date-info">
                          <span className="date-label">Date:</span>
                          <span className="date-value">
                            {new Date(resignation.manager_approval_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      )}
                      {resignation.manager_comments && (
                        <div className="comments-box">
                          <span className="comments-label">Comments:</span>
                          <p className="comments-text">{resignation.manager_comments}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className={`approval-step ${resignation.hod_status === 'Pending' ? 'pending' : resignation.hod_status === 'Approved' ? 'approved' : 'rejected'}`}>
                <div className="step-header">
                  <div className="step-title">
                    <span className="step-label">HOD Approval (Step 2)</span>
                    {getStatusBadge(resignation.hod_status)}
                  </div>
                </div>
                {resignation.hod_status !== 'Pending' && (
                  <div className="step-details">
                    {resignation.hod_approval_date && (
                      <div className="approval-date-info">
                        <span className="date-label">Date:</span>
                        <span className="date-value">
                          {new Date(resignation.hod_approval_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                    {resignation.hod_comments && (
                      <div className="comments-box">
                        <span className="comments-label">Comments:</span>
                        <p className="comments-text">{resignation.hod_comments}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className={`approval-step ${resignation.hr_status === 'Pending' ? 'pending' : resignation.hr_status === 'Approved' || resignation.hr_status === 'Processed' ? 'approved' : 'rejected'}`}>
                <div className="step-header">
                  <div className="step-title">
                    <span className="step-label">HR Approval (Step 3)</span>
                    {getStatusBadge(resignation.hr_status)}
                  </div>
                </div>
                {resignation.hr_status !== 'Pending' && (
                  <div className="step-details">
                    {resignation.hr_approval_date && (
                      <div className="approval-date-info">
                        <span className="date-label">Date:</span>
                        <span className="date-value">
                          {new Date(resignation.hr_approval_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                    {resignation.hr_comments && (
                      <div className="comments-box">
                        <span className="comments-label">Comments:</span>
                        <p className="comments-text">{resignation.hr_comments}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {getNextApprover() && (
              <div className="next-approver">
                <FiClock size={16} />
                Waiting for approval from: <strong>{getNextApprover()}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Apply Resignation Form */}
      {(!resignation || resignation.withdrawal_date) && (
        <div className="card">
          <div className="card-header">
            <h2>Apply for Resignation</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="resignation-form">
            <div className="form-group">
              <label htmlFor="resign_date">Resignation Applied Date *</label>
              <DatePicker
                id="resign_date"
                value={formData.resign_date}
                onChange={(date) => {
                  setFormData({ ...formData, resign_date: date });
                  // Auto-calculate requested_date if not manually set
                  if (!formData.requested_date && date && noticePeriodInfo) {
                    const calculatedDate = calculateLastWorkingDate(date, noticePeriodInfo.notice_period_days);
                    setFormData(prev => ({ ...prev, resign_date: date, requested_date: calculatedDate || '' }));
                  }
                }}
                minDate={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            {formData.resign_date && noticePeriodInfo && (
              <div className="form-group">
                <label htmlFor="requested_date">Requested Date (Last Working Date) *</label>
                <DatePicker
                  id="requested_date"
                  value={formData.requested_date || calculateLastWorkingDate(formData.resign_date, noticePeriodInfo.notice_period_days)}
                  onChange={(date) => setFormData({ ...formData, requested_date: date })}
                  minDate={(() => {
                    // Minimum date should be the day after resignation date
                    if (formData.resign_date) {
                      const minDate = new Date(formData.resign_date);
                      minDate.setDate(minDate.getDate() + 1);
                      return minDate.toISOString().split('T')[0];
                    }
                    // If no resign_date, allow from tomorrow onwards
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return tomorrow.toISOString().split('T')[0];
                  })()}
                  required
                />
                <p className="helper-text">
                  Select your requested last working date. Must be after the resignation date.
                </p>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="resignation_type">Resignation Type</label>
              <select
                id="resignation_type"
                value={formData.resignation_type}
                onChange={(e) => setFormData({ ...formData, resignation_type: e.target.value })}
              >
                <option value="Voluntary">Voluntary</option>
                <option value="Involuntary">Involuntary</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="reason">Reason (Optional)</label>
              <textarea
                id="reason"
                className="resignation-textarea"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={4}
                placeholder="Enter reason for resignation..."
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Resignation'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Resignation;

