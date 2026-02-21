import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import { attendanceAPI } from '../../services/api';
import toast from 'react-hot-toast';
import DatePicker from '../../components/DatePicker';
import * as XLSX from 'xlsx';
import './Employee.css';

const Permission = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isSelfPage = location.pathname.includes('/self/');
  const isEmployeesPage = location.pathname.includes('/employees/');
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [attendanceCycle, setAttendanceCycle] = useState(null);
  const [formData, setFormData] = useState({
    type: '',
    from_date: '',
    from_time: '',
    to_date: '',
    to_time: '',
    reason: ''
  });

  useEffect(() => {
    fetchPermissions();
    fetchAttendanceCycle();
  }, []);

  const fetchAttendanceCycle = async () => {
    try {
      const response = await attendanceAPI.getCycle();
      if (response.data) {
        setAttendanceCycle(response.data);
      }
    } catch (error) {
      console.error('Error fetching attendance cycle:', error);
      // Default to 26-25 cycle if fetch fails
      setAttendanceCycle({
        attendance_cycle_start_date: 26,
        attendance_cycle_end_date: 25
      });
    }
  };

  // Calculate valid date range based on attendance cycle (inclusive: 26th and 25th are both included)
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

  // Get current cycle permissions count (excluding rejected)
  const getCurrentCyclePermissions = () => {
    if (!attendanceCycle) return { total: 2, used: 0 };
    
    const dateRange = getValidDateRange();
    const minDate = new Date(dateRange.min);
    const maxDate = new Date(dateRange.max);
    
    const cyclePermissions = permissions.filter(perm => {
      if (perm.status === 'rejected') return false; // Don't count rejected
      const permDate = new Date(perm.from_datetime || perm.applied_date);
      return permDate >= minDate && permDate <= maxDate;
    });
    
    return {
      total: 2, // Maximum 2 permissions per cycle
      used: cyclePermissions.length
    };
  };

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const endpoint = (['Admin', 'Manager', 'HR'].includes(user?.role) && isEmployeesPage) ? '/permissions' : '/permissions/self';
      const response = await api.get(endpoint);
      setPermissions(response.data);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast.error('Failed to fetch permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Validate required fields
    if (!formData.type) {
      toast.error('Please select Permission Type');
      setLoading(false);
      return;
    }
    if (!formData.from_date) {
      toast.error('Please select From Date');
      setLoading(false);
      return;
    }
    if (!formData.from_time) {
      toast.error('Please select From Time');
      setLoading(false);
      return;
    }
    if (!formData.to_date) {
      toast.error('Please ensure To Date is set');
      setLoading(false);
      return;
    }
    if (!formData.to_time) {
      toast.error('Please ensure To Time is set');
      setLoading(false);
      return;
    }
    if (!formData.reason || formData.reason.trim() === '') {
      toast.error('Please enter Reason');
      setLoading(false);
      return;
    }
    
    // Validate time range (09:30 to 17:30)
    const [hours, minutes] = formData.from_time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const minMinutes = 9 * 60 + 30; // 09:30
    const maxMinutes = 17 * 60 + 30; // 17:30
    
    if (totalMinutes < minMinutes || totalMinutes > maxMinutes) {
      toast.error('From Time must be between 09:30 and 17:30');
      setLoading(false);
      return;
    }
    
    // Check limit: Maximum 2 permissions per cycle (except rejected)
    const fromDate = new Date(formData.from_date);
    const dateRange = getValidDateRange();
    const minDate = new Date(dateRange.min);
    const maxDate = new Date(dateRange.max);
    
    const cyclePermissions = permissions.filter(perm => {
      if (perm.status === 'rejected') return false; // Don't count rejected
      const permDate = new Date(perm.from_datetime);
      return permDate >= minDate && permDate <= maxDate;
    });
    
    if (cyclePermissions.length >= 2) {
      toast.error(`You can apply only 2 permissions per cycle. You have already applied ${cyclePermissions.length} permission(s) for the current cycle (${dateRange.min} to ${dateRange.max}).`);
      setLoading(false);
      return;
    }
    
    try {
      // Combine date and time into datetime strings for API
      const submitData = {
        permission_type: formData.type,
        from_datetime: formData.from_date && formData.from_time 
          ? `${formData.from_date}T${formData.from_time}:00` 
          : '',
        to_datetime: formData.to_date && formData.to_time 
          ? `${formData.to_date}T${formData.to_time}:00` 
          : '',
        reason: formData.reason || ''
      };
      await api.post('/permissions', submitData);
      toast.success('Permission request submitted successfully');
      setShowForm(false);
      setFormData({ type: '', from_date: '', from_time: '', to_date: '', to_time: '', reason: '' });
      fetchPermissions();
    } catch (error) {
      // Handle validation errors (422)
      if (error.response?.status === 422 && error.response?.data?.detail) {
        const details = error.response.data.detail;
        if (Array.isArray(details)) {
          // Pydantic validation errors
          const errorMessages = details.map(err => err.msg || err.message || JSON.stringify(err)).join(', ');
          toast.error(`Validation error: ${errorMessages}`);
        } else if (typeof details === 'string') {
          toast.error(details);
        } else {
          toast.error('Validation error occurred');
        }
      } else {
        const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Failed to submit permission request';
        toast.error(typeof errorMessage === 'string' ? errorMessage : 'Failed to submit permission request');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedFormData = { ...formData, [name]: value };
    
    // When from_time changes, automatically calculate to_datetime (add 2 hours)
    if (name === 'from_time' && value && formData.from_date) {
      const [hours, minutes] = value.split(':');
      let newHours = parseInt(hours) + 2;
      const newMinutes = minutes;
      
      // Handle day overflow (if hours exceed 23)
      let newDate = formData.from_date;
      if (newHours >= 24) {
        newHours = newHours - 24;
        const currentDate = new Date(formData.from_date);
        currentDate.setDate(currentDate.getDate() + 1);
        newDate = currentDate.toISOString().split('T')[0];
      }
      
      const newTime = `${String(newHours).padStart(2, '0')}:${newMinutes}`;
      updatedFormData.to_date = newDate;
      updatedFormData.to_time = newTime;
    }
    
    // When from_date changes, update to_date if from_time is set
    if (name === 'from_date' && value && formData.from_time) {
      const [hours, minutes] = formData.from_time.split(':');
      let newHours = parseInt(hours) + 2;
      const newMinutes = minutes;
      
      let newDate = value;
      if (newHours >= 24) {
        newHours = newHours - 24;
        const currentDate = new Date(value);
        currentDate.setDate(currentDate.getDate() + 1);
        newDate = currentDate.toISOString().split('T')[0];
      }
      
      const newTime = `${String(newHours).padStart(2, '0')}:${newMinutes}`;
      updatedFormData.to_date = newDate;
      updatedFormData.to_time = newTime;
    }
    
    setFormData(updatedFormData);
  };

  const handleFromDateChange = (date) => {
    const updatedFormData = { ...formData, from_date: date };
    
    // When from_date changes, update to_date if from_time is set
    if (date && formData.from_time) {
      const [hours, minutes] = formData.from_time.split(':');
      let newHours = parseInt(hours) + 2;
      const newMinutes = minutes;
      
      let newDate = date;
      if (newHours >= 24) {
        newHours = newHours - 24;
        const currentDate = new Date(date);
        currentDate.setDate(currentDate.getDate() + 1);
        newDate = currentDate.toISOString().split('T')[0];
      }
      
      const newTime = `${String(newHours).padStart(2, '0')}:${newMinutes}`;
      updatedFormData.to_date = newDate;
      updatedFormData.to_time = newTime;
    }
    
    setFormData(updatedFormData);
  };

  const handleStatusUpdate = async (permissionId, status) => {
    try {
      await api.put(`/permissions/${permissionId}`, { status });
      toast.success(`Permission ${status} successfully`);
      fetchPermissions();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Failed to update permission status';
      toast.error(errorMessage);
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

  const exportToExcel = () => {
    const dateRange = getValidDateRange();
    const minDate = new Date(dateRange.min);
    const maxDate = new Date(dateRange.max);
    
    const filteredPermissions = permissions.filter((p) => {
      // Filter by current cycle date range
      const permissionDate = new Date(p.from_datetime || p.applied_date);
      if (permissionDate < minDate || permissionDate > maxDate) return false;
      
      // Date range filter (if fromDate/toDate are set)
      if (fromDate || toDate) {
        const permDateStr = permissionDate.toISOString().split('T')[0];
        if (fromDate && permDateStr < fromDate) return false;
        if (toDate && permDateStr > toDate) return false;
      }
      
      return true;
    });

    if (filteredPermissions.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      // Prepare data for Excel
      const data = [];
      
      // Header row
      const headerRow = isEmployeesPage 
        ? ['Employee ID', 'Employee Name', 'Applied Date', 'Date', 'From Time', 'To Time', 'Type', 'Status', 'Reason', 'Approved By']
        : ['Applied Date', 'Date', 'From Time', 'To Time', 'Type', 'Status', 'Reason', 'Approved By'];
      data.push(headerRow);
      
      // Data rows
      filteredPermissions.forEach((permission) => {
        const row = isEmployeesPage
          ? [
              permission.empid || '',
              permission.name || '',
              new Date(permission.applied_date).toLocaleDateString(),
              new Date(permission.from_datetime).toLocaleDateString(),
              new Date(permission.from_datetime).toLocaleTimeString(),
              new Date(permission.to_datetime).toLocaleTimeString(),
              permission.type || '',
              permission.status || '',
              permission.reason || '',
              permission.approved_by || 'Pending'
            ]
          : [
              new Date(permission.applied_date).toLocaleDateString(),
              new Date(permission.from_datetime).toLocaleDateString(),
              new Date(permission.from_datetime).toLocaleTimeString(),
              new Date(permission.to_datetime).toLocaleTimeString(),
              permission.type || '',
              permission.status || '',
              permission.reason || '',
              permission.approved_by || 'Pending'
            ];
        data.push(row);
      });
      
      // Create workbook and worksheet
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Permissions');
      
      // Set column widths
      const colWidths = isEmployeesPage
        ? [
            { wch: 15 }, // Employee ID
            { wch: 25 }, // Employee Name
            { wch: 12 }, // Applied Date
            { wch: 12 }, // Date
            { wch: 12 }, // From Time
            { wch: 12 }, // To Time
            { wch: 20 }, // Type
            { wch: 12 }, // Status
            { wch: 40 }, // Reason
            { wch: 20 }  // Approved By
          ]
        : [
            { wch: 12 }, // Applied Date
            { wch: 12 }, // Date
            { wch: 12 }, // From Time
            { wch: 12 }, // To Time
            { wch: 20 }, // Type
            { wch: 12 }, // Status
            { wch: 40 }, // Reason
            { wch: 20 }  // Approved By
          ];
      ws['!cols'] = colWidths;
      
      // Generate filename
      let filename = 'permissions';
      if (fromDate || toDate) {
        const from = fromDate ? new Date(fromDate).toISOString().split('T')[0] : 'all';
        const to = toDate ? new Date(toDate).toISOString().split('T')[0] : 'all';
        filename += `_${from}_to_${to}`;
      } else {
        const dateRange = getValidDateRange();
        filename += `_${dateRange.min}_to_${dateRange.max}`;
      }
      
      // Download
      XLSX.writeFile(wb, `${filename}.xlsx`);
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export Excel file');
    }
  };

  return (
    <div className="page-container employee-permission-page">
      <div className="page-header stacked">
        <div>
          <h1>PERMISSIONS</h1>
          <p className="page-subtitle">View your permission history with quick filters.</p>
        </div>
        <div className="header-actions filters-row toolbar">
          <div className="toolbar-left" style={{ flex: 1, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div className="filter-field" style={{ minWidth: '150px' }}>
              <label className="filter-label">From Date</label>
              <DatePicker
                value={fromDate}
                onChange={(date) => setFromDate(date)}
                placeholder="Select from date"
              />
            </div>
            <div className="filter-field" style={{ minWidth: '150px' }}>
              <label className="filter-label">To Date</label>
              <DatePicker
                value={toDate}
                onChange={(date) => setToDate(date)}
                min={fromDate || undefined}
                placeholder="Select to date"
              />
            </div>
          </div>
          <div className="toolbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isSelfPage && (
              <>
                {/* This Month Permissions Card - Compact inline version */}
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  whiteSpace: 'nowrap'
                }}>
                  <span style={{ opacity: 0.9 }}>This Month Your Permissions are</span>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {getCurrentCyclePermissions().total}
                  </span>
                  <span style={{ opacity: 0.9 }}>used</span>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {getCurrentCyclePermissions().used}
                  </span>
                </div>
                <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
                  {showForm ? 'Cancel' : '+ Add Permission'}
                </button>
              </>
            )}
            <button className="btn-primary" onClick={exportToExcel}>
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
                    className="form-select"
                    style={{ 
                      width: '100%',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Select Type</option>
                    <option value="morning-short-leave" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Morning-Short Leave</option>
                    <option value="evening-short-leave" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Evening-Short Leave</option>
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>From Date *</label>
                    <DatePicker
                      value={formData.from_date}
                      onChange={handleFromDateChange}
                      placeholder="Select from date"
                      min={getValidDateRange().min}
                      max={getValidDateRange().max}
                    />
                  </div>
                  <div className="form-group">
                    <label>From Time *</label>
                    <input
                      type="time"
                      name="from_time"
                      value={formData.from_time}
                      onChange={(e) => {
                        const selectedTime = e.target.value;
                        // Validate time range (09:30 to 17:30)
                        if (selectedTime) {
                          const [hours, minutes] = selectedTime.split(':').map(Number);
                          const totalMinutes = hours * 60 + minutes;
                          const minMinutes = 9 * 60 + 30; // 09:30
                          const maxMinutes = 17 * 60 + 30; // 17:30
                          
                          if (totalMinutes < minMinutes || totalMinutes > maxMinutes) {
                            toast.error('Time must be between 09:30 and 17:30');
                            return;
                          }
                        }
                        handleChange(e);
                      }}
                      min="09:30"
                      max="17:30"
                      className="form-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>To Date *</label>
                    <input
                      type="date"
                      name="to_date"
                      value={formData.to_date}
                      onChange={handleChange}
                      className="form-input"
                      readOnly
                      style={{ 
                        width: '100%',
                        background: 'var(--bg-hover)', 
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>To Time *</label>
                    <input
                      type="time"
                      name="to_time"
                      value={formData.to_time}
                      onChange={handleChange}
                      
                      className="form-input"
                      readOnly
                      style={{ 
                        width: '100%',
                        background: 'var(--bg-hover)', 
                        cursor: 'not-allowed'
                      }}
                    />
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
                    style={{ width: '100%' }}
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
                {isEmployeesPage && <th>Employee</th>}
                <th>Applied Date</th>
                <th>Date</th>
                <th>From Time</th>
                <th>To Time</th>
                <th>Type</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Approved By</th>
                {isEmployeesPage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {permissions
                .filter((p) => {
                  // Filter by current cycle date range
                  const dateRange = getValidDateRange();
                  const minDate = new Date(dateRange.min);
                  const maxDate = new Date(dateRange.max);
                  const permissionDate = new Date(p.from_datetime || p.applied_date);
                  
                  if (permissionDate < minDate || permissionDate > maxDate) return false;
                  
                  // Date range filter (if fromDate/toDate are set)
                  if (fromDate || toDate) {
                    const permDateStr = permissionDate.toISOString().split('T')[0];
                    if (fromDate && permDateStr < fromDate) return false;
                    if (toDate && permDateStr > toDate) return false;
                  }
                  
                  return true;
                })
                .map((permission) => (
                  <tr key={permission.id}>
                    {isEmployeesPage && (
                      <td>
                        <div>{permission.name || '-'}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{permission.empid || '-'}</div>
                      </td>
                    )}
                    <td>{new Date(permission.applied_date).toLocaleDateString()}</td>
                    <td>{new Date(permission.from_datetime).toLocaleDateString()}</td>
                    <td>{new Date(permission.from_datetime).toLocaleTimeString()}</td>
                    <td>{new Date(permission.to_datetime).toLocaleTimeString()}</td>
                    <td>{permission.type}</td>
                    <td>{getStatusBadge(permission.status)}</td>
                    <td>{permission.reason || '-'}</td>
                    <td>{permission.approved_by || 'Pending'}</td>
                    {isEmployeesPage && (
                      <td>
                        {permission.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn"
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '0.85rem',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleStatusUpdate(permission.id, 'approved')}
                            >
                              Approve
                            </button>
                            <button
                              className="btn"
                              style={{ 
                                padding: '6px 12px', 
                                fontSize: '0.85rem',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                              onClick={() => handleStatusUpdate(permission.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              {permissions.filter((p) => {
                  // Filter by current cycle date range
                  const dateRange = getValidDateRange();
                  const minDate = new Date(dateRange.min);
                  const maxDate = new Date(dateRange.max);
                  const permissionDate = new Date(p.from_datetime || p.applied_date);
                  
                  if (permissionDate < minDate || permissionDate > maxDate) return false;
                  
                  // Date range filter (if fromDate/toDate are set)
                  if (fromDate || toDate) {
                    const permDateStr = permissionDate.toISOString().split('T')[0];
                    if (fromDate && permDateStr < fromDate) return false;
                    if (toDate && permDateStr > toDate) return false;
                  }
                  
                  return true;
                }).length === 0 ? (
                <tr>
                  <td colSpan={isEmployeesPage ? 10 : 8} className="text-center">No permission requests found</td>
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

