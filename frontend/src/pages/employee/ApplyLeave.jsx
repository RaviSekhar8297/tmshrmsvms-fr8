import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { weekOffsAPI, holidaysAPI, attendanceAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiCalendar } from 'react-icons/fi';
import DatePicker from '../../components/DatePicker';
import './Employee.css';

const ApplyLeave = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [actualDays, setActualDays] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [leaveBalance, setLeaveBalance] = useState({
    total_casual_leaves: 0,
    used_casual_leaves: 0,
    balance_casual_leaves: 0,
    total_sick_leaves: 0,
    used_sick_leaves: 0,
    balance_sick_leaves: 0,
    total_comp_off_leaves: 0,
    used_comp_off_leaves: 0,
    balance_comp_off_leaves: 0,
    this_month: {
      casual: 0,
      sick: 0,
      comp_off: 0
    }
  });
  const [managerName, setManagerName] = useState('');
  const [contacts, setContacts] = useState([]);
  const [invalidDatesList, setInvalidDatesList] = useState([]);
  const [disabledDates, setDisabledDates] = useState([]);
  const [attendanceCycle, setAttendanceCycle] = useState(null);
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
    // Fetch week off dates and holidays
    fetchDisabledDates();
    // Fetch attendance cycle
    fetchAttendanceCycle();
    
    // Refresh balance when page becomes visible (e.g., after leave approval/rejection)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchLeaveBalance();
      }
    };
    
    // Refresh balance on window focus (user returns to page)
    const handleFocus = () => {
      fetchLeaveBalance();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const fetchDisabledDates = async () => {
    try {
      if (!user?.empid) {
        return; // Don't fetch if user is not available
      }
      const currentYear = new Date().getFullYear();
      const [weekOffsRes, holidaysRes] = await Promise.all([
        weekOffsAPI.getDates(user.empid, null, currentYear).catch(err => {
          console.error('Error fetching week offs:', err);
          return { data: [] };
        }),
        holidaysAPI.getAll(currentYear).catch(err => {
          console.error('Error fetching holidays:', err);
          return { data: [] };
        })
      ]);
      
      const disabledDatesSet = new Set();
      
      // Add week off dates
      if (weekOffsRes?.data) {
        weekOffsRes.data.forEach(wo => {
          if (wo?.date) {
            const dateStr = wo.date.split('T')[0]; // Get YYYY-MM-DD format
            disabledDatesSet.add(dateStr);
          }
        });
      }
      
      // Add holidays - filter by user's branch_id matching holiday_permissions
      if (holidaysRes?.data) {
        // Get user's branch_id (default to 1 if null/empty, similar to backend logic)
        const userBranchId = user?.branch_id || 1;
        
        holidaysRes.data.forEach(holiday => {
          if (!holiday?.date) return;
          
          // If holiday has no permissions, skip it
          if (!holiday.holiday_permissions || holiday.holiday_permissions.length === 0) {
            return;
          }
          
          // Check if user's branch_id exists in the holiday's holiday_permissions array
          // Normalize branch_id to int for comparison (permissions may store as int or string)
          const branchMatches = holiday.holiday_permissions.some(perm => {
            if (!perm || perm.branch_id === null || perm.branch_id === undefined) {
              return false;
            }
            try {
              const permBranchId = typeof perm.branch_id === 'string' ? parseInt(perm.branch_id) : perm.branch_id;
              return permBranchId === userBranchId;
            } catch {
              return false;
            }
          });
          
          // Only add holiday if branch matches
          if (branchMatches) {
            const dateStr = holiday.date.split('T')[0]; // Get YYYY-MM-DD format
            disabledDatesSet.add(dateStr);
          }
        });
      }
      
      setDisabledDates(Array.from(disabledDatesSet));
    } catch (error) {
      console.error('Error fetching disabled dates:', error);
      setDisabledDates([]); // Set empty array on error
    }
  };

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

  const fetchAttendanceCycle = async () => {
    try {
      const response = await attendanceAPI.getCycle();
      if (response.data) {
        setAttendanceCycle(response.data);
      }
    } catch (error) {
      // Default to 26-25 cycle if fetch fails
      setAttendanceCycle({
        attendance_cycle_start_date: 26,
        attendance_cycle_end_date: 25
      });
    }
  };

  // Calculate valid date range based on attendance cycle (inclusive: start and end dates are both included)
  const getValidDateRange = () => {
    // Helper function to format date as YYYY-MM-DD in local timezone
    const formatLocalDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (!attendanceCycle) {
      // Default to 26-25 cycle
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      // Previous month 26th (inclusive)
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const minDate = new Date(prevYear, prevMonth, 26);
      
      // Current month 25th (inclusive)
      const maxDate = new Date(currentYear, currentMonth, 25);
      
      return {
        min: formatLocalDate(minDate), // Includes 26th
        max: formatLocalDate(maxDate)  // Includes 25th
      };
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const cycleStartDate = attendanceCycle.attendance_cycle_start_date || 26;
    const cycleEndDate = attendanceCycle.attendance_cycle_end_date || 25;

    // Previous month cycle start date (inclusive)
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const minDate = new Date(prevYear, prevMonth, cycleStartDate);
    
    // Current month cycle end date (inclusive)
    const maxDate = new Date(currentYear, currentMonth, cycleEndDate);
    
    return {
      min: formatLocalDate(minDate), // Includes cycle start date (e.g., 26th)
      max: formatLocalDate(maxDate)  // Includes cycle end date (e.g., 25th)
    };
  };

  const fetchContacts = async () => {
    try {
      const res = await api.get('/users/contacts');
      setContacts(res.data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      setContacts([]); // Set empty array on error
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      const response = await api.get('/leaves/balance');
      setLeaveBalance(response.data);
    } catch (error) {
      console.error('Error fetching leave balance:', error);
      // Set default values to prevent undefined errors
      setLeaveBalance({
        total_casual_leaves: 0,
        used_casual_leaves: 0,
        balance_casual_leaves: 0,
        total_sick_leaves: 0,
        used_sick_leaves: 0,
        balance_sick_leaves: 0,
        total_comp_off_leaves: 0,
        used_comp_off_leaves: 0,
        balance_comp_off_leaves: 0,
        this_month: {
          casual: 0,
          sick: 0,
          comp_off: 0
        }
      });
    }
  };

  const getAvailableBalance = () => {
    if (!formData.leave_type) return 0;
    
    switch(formData.leave_type) {
      case 'casual':
        return leaveBalance.this_month?.casual || 0;
      case 'sick':
        return leaveBalance.this_month?.sick || 0;
      case 'comp-off':
      case 'comp_off':
      case 'compensatory':
        return leaveBalance.this_month?.comp_off || 0;
      default:
        return 0;
    }
  };

  const validateDates = async () => {
    if (!formData.from_date || !formData.to_date) {
      setActualDays(0);
      setInvalidDatesList([]);
      return;
    }

    setValidating(true);
    try {
      const params = {
          from_date: formData.from_date,
          to_date: formData.to_date
      };
      
      // Include leave_type if selected to check for same leave_type conflicts
      if (formData.leave_type) {
        params.leave_type = formData.leave_type;
      }
      
      // Include half day fields for half day calculation
      if (formData.half_from) {
        params.half_from = formData.half_from;
      }
      if (formData.half_to) {
        params.half_to = formData.half_to;
      }
      
      const response = await api.get('/leaves/validate-dates', { params });
      
      setActualDays(response.data.actual_days);
      
      // Store invalid dates list
      const invalidDates = response.data.invalid_dates || [];
      setInvalidDatesList(invalidDates);
      
      // Show individual alerts for each invalid date
      if (response.data.has_invalid_dates && invalidDates.length > 0) {
        invalidDates.forEach(invalidDate => {
          const dateStr = new Date(invalidDate.date).toLocaleDateString();
          const reason = invalidDate.reason === 'week_off' ? 'Week Off' : 'Holiday';
          toast.error(`Cannot apply leave on ${dateStr} (${reason})`, {
            duration: 3000,
            icon: '⚠️'
          });
        });
        
        // Show suggestion to hide week-offs and holidays
        toast('Tip: Week-offs and holidays are automatically excluded from working days calculation.', {
          duration: 4000,
          icon: '💡'
        });
        
        setActualDays(0); // Set to 0 to prevent submission
      }
      
      // Check for conflicts (already applied dates) - only for pending/approved, not rejected
      if (response.data.has_conflict) {
        const conflictDates = response.data.conflicting_dates.map(c => {
          const dateStr = new Date(c.date).toLocaleDateString();
          const leaveType = c.leave_type ? ` (${c.leave_type})` : '';
          return `${dateStr}${leaveType} - ${c.status}`;
        }).join(', ');
        
        // Check if conflicts are for the same leave_type
        const sameTypeConflicts = response.data.conflicting_dates.filter(
          c => c.leave_type && c.leave_type === formData.leave_type && (c.status === 'pending' || c.status === 'approved')
        );
        
        // Only show error if conflicts are pending or approved (rejected can be reapplied)
        const nonRejectedConflicts = response.data.conflicting_dates.filter(
          c => c.status !== 'rejected'
        );
        
        if (nonRejectedConflicts.length > 0) {
          if (sameTypeConflicts.length > 0 && formData.leave_type) {
            toast.error(`You already have a ${formData.leave_type} leave (pending or approved) for: ${conflictDates}. Please wait for approval/rejection or select different dates.`);
          } else {
            toast.error(`These dates are already applied: ${conflictDates}. Please select different dates or wait for approval/rejection.`);
          }
          setActualDays(0); // Set to 0 to prevent submission
        } else {
          // All conflicts are rejected - allow reapplication
          toast('You can reapply for these dates as previous applications were rejected.', {
            duration: 3000
          });
        }
      }
    } catch (error) {
      console.error('Error validating dates:', error);
      toast.error(error.response?.data?.detail || 'Error validating dates');
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    if (formData.from_date && formData.to_date) {
      validateDates();
    } else {
      setActualDays(0);
      setInvalidDatesList([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.from_date, formData.to_date, formData.leave_type, formData.half_from, formData.half_to]);

  useEffect(() => {
    setAvailableBalance(getAvailableBalance());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.leave_type, leaveBalance]);

  // Handle half day logic
  useEffect(() => {
    // If actualDays is 0.5 (half day), ensure both half_from and half_to are same
    if (actualDays === 0.5) {
      if (formData.half_from && !formData.half_to) {
        setFormData(prev => ({ ...prev, half_to: prev.half_from }));
      } else if (formData.half_to && !formData.half_from) {
        setFormData(prev => ({ ...prev, half_from: prev.half_to }));
      }
    }
  }, [actualDays, formData.half_from, formData.half_to]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.leave_type || !formData.from_date || !formData.to_date || !formData.reason) {
      toast.error('Please fill all required fields');
      return;
    }

    // Validate reason length
    if (formData.reason.trim().length < 10) {
      toast.error('Reason must be at least 10 characters long');
      return;
    }
    if (formData.reason.trim().length > 150) {
      toast.error('Reason must not exceed 150 characters');
      return;
    }

    // Check if actualDays is 0 (means week-off or holiday dates selected)
    if (actualDays === 0) {
      toast.error('Cannot apply leave on week-offs or holidays. Please select different dates.');
      return;
    }

    // Check available balance
    const available = getAvailableBalance();
    if (actualDays > available) {
      toast.error(`Insufficient leave balance. Available: ${available} days, Requested: ${actualDays} days`);
      return;
    }

    // Validate half day fields
    if (actualDays === 0.5) {
      if (!formData.half_from || !formData.half_to) {
        toast.error('Please select HalfDay From and HalfDay To for half day leave');
        return;
      }
      if (formData.half_from !== formData.half_to) {
        toast.error('For half day leave, HalfDay From and HalfDay To must be the same (both Morning or both Evening)');
        return;
      }
    }

    // For full day spanning multiple days, allow different sessions
    // e.g., 2025-12-29 evening to 2025-12-30 morning
    if (actualDays > 0.5 && actualDays !== 0.5) {
      // Full day leave - half_from and half_to can be different or empty
      // If specified, they represent start and end sessions
    }

    setLoading(true);
    try {
      await api.post('/leaves', {
        ...formData,
        duration: actualDays
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
      setActualDays(0);
      setInvalidDatesList([]);
      // Refresh balance - handle errors silently
      try {
        await fetchLeaveBalance();
      } catch (err) {
        console.error('Error refreshing leave balance:', err);
        // Don't show error to user as leave was already submitted successfully
      }
    } catch (error) {
      console.error('Error submitting leave application:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit leave application');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // If half day and changing half_from, auto-update half_to
    if (name === 'half_from' && actualDays === 0.5) {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        half_to: value // Auto-set half_to to same value
      }));
    } else if (name === 'half_to' && actualDays === 0.5) {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        half_from: value // Auto-set half_from to same value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>APPLY LEAVE!</h1>
      </div>

      {/* Leave Balance Table */}
      <div className="leave-balance-container">
        <div className="leave-balance-table-wrapper">
          <table className="leave-balance-table">
            <thead>
              <tr>
                <th colSpan="3" className="leave-type-header">Casual Leave</th>
                <th colSpan="3" className="leave-type-header">Sick Leaves</th>
                <th colSpan="3" className="leave-type-header">Comp-Off Leaves</th>
              </tr>
              <tr>
                <th>Total</th>
                <th>Used</th>
                <th>Bls</th>
                <th>Total</th>
                <th>Used</th>
                <th>Bls</th>
                <th>Total</th>
                <th>Used</th>
                <th>Bls</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="balance-cell">{leaveBalance.total_casual_leaves}</td>
                <td className="balance-cell">{leaveBalance.used_casual_leaves}</td>
                <td className="balance-cell balance-value">{leaveBalance.balance_casual_leaves}</td>
                <td className="balance-cell">{leaveBalance.total_sick_leaves}</td>
                <td className="balance-cell">{leaveBalance.used_sick_leaves}</td>
                <td className="balance-cell balance-value">{leaveBalance.balance_sick_leaves}</td>
                <td className="balance-cell">{leaveBalance.total_comp_off_leaves}</td>
                <td className="balance-cell">{leaveBalance.used_comp_off_leaves}</td>
                <td className="balance-cell balance-value">{leaveBalance.balance_comp_off_leaves}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* This Month Availability Cards */}
      <div className="this-month-container">
        <h3 className="this-month-title">THIS MONTH</h3>
        <div className="this-month-cards">
          <div className="this-month-card">
            <div className="this-month-label">Casual</div>
            <div className="this-month-value">{leaveBalance.this_month?.casual || 0}</div>
            <div className="this-month-subtitle">Available</div>
          </div>
          <div className="this-month-card">
            <div className="this-month-label">Sick</div>
            <div className="this-month-value">{leaveBalance.this_month?.sick || 0}</div>
            <div className="this-month-subtitle">Available</div>
          </div>
          <div className="this-month-card">
            <div className="this-month-label">Comp-Off</div>
            <div className="this-month-value">{leaveBalance.this_month?.comp_off || 0}</div>
            <div className="this-month-subtitle">Available</div>
          </div>
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
                <option value="comp-off">Comp-Off Leave</option>
                
              </select>
              {formData.leave_type && (
                <div className="available-balance-info">
                  Available: <strong>{availableBalance}</strong> day(s)
                  {availableBalance === 0 && (
                    <span className="balance-warning"> (No balance available)</span>
                  )}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Number of Days (Working Days)</label>
              <input
                type="text"
                value={actualDays || 0}
                readOnly
                className={`form-input ${actualDays > availableBalance ? 'error-input' : ''}`}
                style={{ background: 'var(--bg-hover)', fontWeight: '600' }}
              />
              {validating && (
                <div className="validation-message">Calculating working days...</div>
              )}
              {actualDays > availableBalance && formData.leave_type && (
                <div className="error-message">
                  Insufficient balance! Available: {availableBalance}, Requested: {actualDays}
                </div>
              )}
              {invalidDatesList.length > 0 && (
                <div className="error-message" style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                  <strong>Invalid dates:</strong> {invalidDatesList.map(d => {
                    const dateStr = new Date(d.date).toLocaleDateString();
                    const reason = d.reason === 'week_off' ? 'Week Off' : 'Holiday';
                    return `${dateStr} (${reason})`;
                  }).join(', ')}
                </div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <FiCalendar style={{ color: 'var(--primary)' }} />
                From Date *
              </label>
              <div style={{ position: 'relative' }}>
                <DatePicker
                  value={formData.from_date}
                  onChange={(date) => {
                    setFormData(prev => ({ ...prev, from_date: date }));
                  }}
                  min={getValidDateRange().min}
                  max={getValidDateRange().max}
                  placeholder="Select from date"
                  disabledDates={disabledDates}
                />
                {formData.from_date && (
                  <div style={{
                    marginTop: '6px',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    background: 'var(--bg-hover)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <FiCalendar size={14} style={{ color: 'var(--primary)' }} />
                    <span>
                      {new Date(formData.from_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <FiCalendar style={{ color: 'var(--primary)' }} />
                To Date *
              </label>
              <div style={{ position: 'relative' }}>
                <DatePicker
                  value={formData.to_date}
                  onChange={(date) => {
                    setFormData(prev => ({ ...prev, to_date: date }));
                  }}
                  min={formData.from_date || getValidDateRange().min}
                  max={getValidDateRange().max}
                  placeholder="Select to date"
                  disabledDates={disabledDates}
                />
                {formData.to_date && (
                  <div style={{
                    marginTop: '6px',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    background: 'var(--bg-hover)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <FiCalendar size={14} style={{ color: 'var(--primary)' }} />
                    <span>
                      {new Date(formData.to_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>HalfDay From {actualDays === 0.5 && <span style={{ color: '#ef4444' }}>*</span>}</label>
              <select
                name="half_from"
                value={formData.half_from}
                onChange={handleChange}
                className="form-select"
                disabled={actualDays === 0}
              >
                <option value="">None</option>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </select>
              {actualDays === 0.5 && (
                <div className="form-hint" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Required for half day leave
                </div>
              )}
            </div>
            <div className="form-group">
              <label>HalfDay To {actualDays === 0.5 && <span style={{ color: '#ef4444' }}>*</span>}</label>
              <select
                name="half_to"
                value={formData.half_to}
                onChange={handleChange}
                className="form-select"
                disabled={actualDays === 0}
              >
                <option value="">None</option>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </select>
              {actualDays === 0.5 && (
                <div className="form-hint" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Required for half day leave (must match HalfDay From)
                </div>
              )}
              {actualDays > 0.5 && actualDays !== 0.5 && (
                <div className="form-hint" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Optional: For multi-day leaves, specify start and end sessions
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>
              Reason * (10-150 characters) 
              <span style={{ 
                marginLeft: '8px',
                color: formData.reason.length < 10 ? '#f59e0b' : formData.reason.length > 150 ? '#ef4444' : '#64748b',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}>
                ({formData.reason.length} characters)
              </span>
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows="5"
              className="form-input"
              placeholder="Enter reason for leave (minimum 10 characters, maximum 150 characters)..."
              minLength={10}
              maxLength={150}
            />
            <small className="form-hint" style={{ 
              color: formData.reason.length < 10 ? '#f59e0b' : formData.reason.length > 150 ? '#ef4444' : '#64748b',
              marginTop: '4px',
              display: 'block'
            }}>
              {formData.reason.length < 10 
                ? `${10 - formData.reason.length} more characters required (minimum 10)` 
                : formData.reason.length > 150
                ? `${formData.reason.length - 150} characters over limit (maximum 150)`
                : `${formData.reason.length}/150 characters`}
            </small>
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
              style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
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
