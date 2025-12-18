import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './Employee.css';

const ApplyLeave = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState({
    casual: 0,
    sick: 0,
    comp_off: 0,
    total: 0
  });
  const [managerName, setManagerName] = useState('');
  const [contacts, setContacts] = useState([]);
  const [formData, setFormData] = useState({
    from_date: '',
    to_date: '',
    leave_type: '',
    reason: '',
    half_from: '',
    half_to: '',
    manager: ''
  });

  useEffect(() => {
    // Fetch contacts once
    fetchContacts();
  }, []);

  useEffect(() => {
    // Auto-populate manager from user's report_to_id
    if (user?.report_to_id) {
      setFormData(prev => ({
        ...prev,
        manager: user.report_to_id
      }));
    }

    // Resolve manager name from contacts
    if (user?.report_to_id && contacts.length) {
      const mgr = contacts.find(c => c.empid === user.report_to_id);
      setManagerName(mgr ? `${mgr.name} (${mgr.empid})` : user.report_to_id);
    }
    
    // Fetch leave balance
    fetchLeaveBalance();
  }, [user, contacts]);

  const fetchContacts = async () => {
    try {
      const res = await api.get('/users/contacts');
      setContacts(res.data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      const response = await api.get('/leaves/balance');
      setLeaveBalance(response.data);
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    }
  };

  const calculateDuration = () => {
    if (formData.from_date && formData.to_date) {
      const start = new Date(formData.from_date);
      const end = new Date(formData.to_date);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.leave_type || !formData.from_date || !formData.to_date || !formData.reason) {
      toast.error('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      const duration = calculateDuration();
      await api.post('/leaves', {
        ...formData,
        duration
      });
      toast.success('Leave application submitted successfully');
      setFormData({
        from_date: '',
        to_date: '',
        leave_type: '',
        reason: '',
        half_from: '',
        half_to: '',
        manager: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit leave application');
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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Apply Leave</h1>
      </div>

      {/* Leave Balance Cards */}
      <div className="leave-balance-cards">
        <div className="balance-card">
          <div className="balance-label">Casual Leave</div>
          <div className="balance-value">{leaveBalance.casual}</div>
        </div>
        <div className="balance-card">
          <div className="balance-label">Sick Leave</div>
          <div className="balance-value">{leaveBalance.sick}</div>
        </div>
        <div className="balance-card">
          <div className="balance-label">Comp-off Leave</div>
          <div className="balance-value">{leaveBalance.comp_off}</div>
        </div>
        <div className="balance-card">
          <div className="balance-label">Total Leaves</div>
          <div className="balance-value">{leaveBalance.total}</div>
        </div>
      </div>

      <div className="form-container full-width-card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Leave Type *</label>
              <select
                name="leave_type"
                value={formData.leave_type}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Select Leave Type</option>
                <option value="sick">Sick Leave</option>
                <option value="casual">Casual Leave</option>
                <option value="annual">Annual Leave</option>
                <option value="emergency">Emergency Leave</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Number of Days</label>
              <input
                type="text"
                value={calculateDuration()}
                readOnly
                className="form-input"
                style={{ background: 'var(--bg-hover)' }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>From Date *</label>
              <input
                type="date"
                name="from_date"
                value={formData.from_date}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>To Date *</label>
              <input
                type="date"
                name="to_date"
                value={formData.to_date}
                onChange={handleChange}
                min={formData.from_date || new Date().toISOString().split('T')[0]}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>HalfDay From</label>
              <select
                name="half_from"
                value={formData.half_from}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">None</option>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </select>
            </div>
            <div className="form-group">
              <label>HalfDay To</label>
              <select
                name="half_to"
                value={formData.half_to}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">None</option>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Reason *</label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows="5"
              className="form-input"
              placeholder="Enter reason for leave..."
            />
          </div>

          <div className="form-group">
            <label>Manager (Report ID)</label>
            <input
              type="text"
              name="manager"
              value={managerName || formData.manager}
              className="form-input"
              placeholder="Manager"
              readOnly
              style={{ background: 'var(--bg-hover)' }}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Leave Application'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ApplyLeave;

