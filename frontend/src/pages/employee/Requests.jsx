import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import './Employee.css';

const Requests = () => {
  const { user } = useAuth();
  const location = useLocation();
  const isSelfPage = location.pathname.includes('/self/');
  const isEmployeesPage = location.pathname.includes('/employees/');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const isPrivileged = ['Admin', 'Manager', 'HR'].includes(user?.role);
  const [formData, setFormData] = useState({
    type: '',
    subject: '',
    description: '',
    intime_date: '',
    intime_time: '',
    outtime_date: '',
    outtime_time: ''
  });
  const [holidays, setHolidays] = useState([]);
  const [weekOffDates, setWeekOffDates] = useState([]);
  const [duplicateError, setDuplicateError] = useState('');

  useEffect(() => {
    fetchRequests();
    // Fetch holidays and week off dates for Over-Time(Comp-off) option
    if (user?.role === 'Employee' || user?.role === 'Manager' || user?.role === 'HR') {
      fetchHolidays();
      fetchWeekOffDates();
    }
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const endpoint = (isPrivileged && isEmployeesPage) ? '/requests' : '/requests/self';
      const response = await api.get(endpoint);
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Validate required fields
    if (!formData.type) {
      toast.error('Please select Request Type');
      setLoading(false);
      return;
    }
    if (!formData.subject) {
      toast.error('Please enter Subject');
      setLoading(false);
      return;
    }
    if (!formData.description) {
      toast.error('Please enter Description');
      setLoading(false);
      return;
    }
    
    // Check for duplicate requests - check all types (intime, outtime, full-day, overtime) on same date
    if (formData.intime_date && formData.type) {
      const endpoint = (isPrivileged && isEmployeesPage) ? '/requests' : '/requests/self';
      try {
        const response = await api.get(endpoint);
        const existingRequests = response.data || [];
        const duplicate = existingRequests.find(req => {
          if (req.status === 'rejected') return false; // Allow if rejected
          
          const reqDate = req.intime ? new Date(req.intime).toISOString().split('T')[0] : null;
          if (reqDate !== formData.intime_date) return false;
          
          // Check if status is pending or approved (for any request type on this date)
          return req.status === 'pending' || req.status === 'approved';
        });
        
        if (duplicate) {
          const statusText = duplicate.status === 'approved' ? 'Approved' : duplicate.status === 'pending' ? 'Pending' : duplicate.status;
          const typeText = duplicate.type === 'full-day' ? 'Full-Day' : 
                          duplicate.type === 'in-time' ? 'In-time' : 
                          duplicate.type === 'out-time' ? 'Out-Time' : 
                          duplicate.type === 'overtime-comp-off' ? 'Over-Time(Comp-off)' : duplicate.type;
          toast.error(`This date already applied for ${typeText} on ${new Date(formData.intime_date).toLocaleDateString()}. Status: ${statusText}`, {
            duration: 5000
          });
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('Error checking duplicate:', error);
      }
    }
    
    // Validate conditional required fields based on type
    if (isIntimeEnabled() && (!formData.intime_date || !formData.intime_time)) {
      toast.error('Please enter In Time (Date and Time)');
      setLoading(false);
      return;
    }
    if (isOuttimeEnabled() && (!formData.outtime_date || !formData.outtime_time)) {
      toast.error('Please enter Out Time (Date and Time)');
      setLoading(false);
      return;
    }
    
    try {
      // Combine date and time into datetime strings for API
      const submitData = {
        type: formData.type,
        subject: formData.subject,
        description: formData.description,
        intime: (formData.intime_date && formData.intime_time) 
          ? `${formData.intime_date}T${formData.intime_time}:00` 
          : '',
        outtime: (formData.outtime_date && formData.outtime_time) 
          ? `${formData.outtime_date}T${formData.outtime_time}:00` 
          : ''
      };
      
      await api.post('/requests', submitData);
      toast.success('Request submitted successfully');
      setShowForm(false);
      setFormData({
        type: '',
        subject: '',
        description: '',
        intime_date: '',
        intime_time: '',
        outtime_date: '',
        outtime_time: ''
      });
      fetchRequests();
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
        const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Failed to submit request';
        toast.error(typeof errorMessage === 'string' ? errorMessage : 'Failed to submit request');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchHolidays = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const response = await api.get('/holidays');
      // Filter holidays to only current year
      const filteredHolidays = (response.data || []).filter(holiday => {
        const holidayDate = new Date(holiday.date);
        return holidayDate.getFullYear() === currentYear;
      });
      setHolidays(filteredHolidays);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const fetchWeekOffDates = async () => {
    try {
      const currentYear = new Date().getFullYear();
      // Fetch week off dates for current year
      const response = await api.get(`/week-offs/dates?year=${currentYear}`);
      setWeekOffDates(response.data || []);
    } catch (error) {
      console.error('Error fetching week off dates:', error);
      // If endpoint is not accessible, set empty array
      setWeekOffDates([]);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedFormData = { ...formData, [name]: value };
    setDuplicateError(''); // Clear duplicate error on change
    
    // Reset intime and outtime when type changes
    if (name === 'type') {
      updatedFormData.intime_date = '';
      updatedFormData.intime_time = '';
      updatedFormData.outtime_date = '';
      updatedFormData.outtime_time = '';
    }
    
    // For overtime-comp-off: When intime_date is selected, automatically set outtime_date to the same date
    if (name === 'intime_date' && formData.type === 'overtime-comp-off' && value) {
      updatedFormData.outtime_date = value;
      // Check for duplicate requests
      checkDuplicateRequest(value, formData.type);
    }
    
    setFormData(updatedFormData);
  };

  const checkDuplicateRequest = async (date, type) => {
    if (!date || !type) return;
    
    try {
      const endpoint = (isPrivileged && isEmployeesPage) ? '/requests' : '/requests/self';
      const response = await api.get(endpoint);
      const existingRequests = response.data || [];
      
      // Check if there's a pending or approved request for the same date (any type: intime, outtime, full-day, overtime)
      const duplicate = existingRequests.find(req => {
        if (req.status === 'rejected') return false; // Allow if rejected
        
        const reqDate = req.intime ? new Date(req.intime).toISOString().split('T')[0] : null;
        if (reqDate !== date) return false;
        
        // Check if status is pending or approved
        return req.status === 'pending' || req.status === 'approved';
      });
      
      if (duplicate) {
        const statusText = duplicate.status === 'approved' ? 'Approved' : duplicate.status === 'pending' ? 'Pending' : duplicate.status;
        const typeText = duplicate.type === 'full-day' ? 'Full-Day' : 
                        duplicate.type === 'in-time' ? 'In-time' : 
                        duplicate.type === 'out-time' ? 'Out-Time' : 
                        duplicate.type === 'overtime-comp-off' ? 'Over-Time(Comp-off)' : duplicate.type;
        setDuplicateError(`This date already applied for ${typeText} on ${new Date(date).toLocaleDateString()}. Status: ${statusText}`);
        toast.error(`This date already applied for ${typeText} on ${new Date(date).toLocaleDateString()}. Status: ${statusText}`, {
          duration: 5000
        });
      } else {
        setDuplicateError('');
      }
    } catch (error) {
      console.error('Error checking duplicate:', error);
    }
  };

  // Combine holidays and week off dates for Over-Time(Comp-off) dropdown options
  // Only show dates from current year and filter holidays by branch_id matching holiday_permissions
  const getCompOffDates = () => {
    const dateSet = new Set();
    const allDates = [];
    const currentYear = new Date().getFullYear();
    
    // Get user's branch_id (default to 1 if null/empty, similar to backend logic)
    const userBranchId = user?.branch_id || 1;
    
    // Add holidays - filter by current year and branch_id matching holiday_permissions
    holidays.forEach(holiday => {
      const dateStr = holiday.date.split('T')[0]; // Get just the date part
      const holidayDate = new Date(dateStr);
      
      // Only include if it's from current year
      if (holidayDate.getFullYear() !== currentYear) {
        return;
      }
      
      // Filter by branch_id matching holiday_permissions (same logic as punch.jsx and Holidays.jsx)
      // If holiday has no permissions, don't show it
      if (!holiday.holiday_permissions || holiday.holiday_permissions.length === 0) {
        return;
      }
      
      // Check if user's branch_id exists in the holiday's holiday_permissions array
      // Logic: If logged user's branch_id matches any branch_id in holiday_permissions → Show holiday
      const branchMatches = holiday.holiday_permissions.some(
        perm => perm.branch_id === userBranchId
      );
      
      if (branchMatches && !dateSet.has(dateStr)) {
        dateSet.add(dateStr);
        allDates.push({
          date: dateStr,
          label: holiday.name || 'Holiday',
          type: 'holiday'
        });
      }
    });
    
    // Add week off dates - filter by current year
    weekOffDates.forEach(wo => {
      const dateStr = wo.date.split('T')[0]; // Get just the date part
      const woDate = new Date(dateStr);
      // Only include if it's from current year
      if (woDate.getFullYear() === currentYear && !dateSet.has(dateStr)) {
        dateSet.add(dateStr);
        allDates.push({
          date: dateStr,
          label: wo.employee_name ? `Week Off - ${wo.employee_name}` : 'Week Off',
          type: 'weekoff'
        });
      }
    });
    
    // Sort by date and return unique dates
    return allDates.sort((a, b) => new Date(a.date) - new Date(b.date));
  };
  
  // Check if request type requires both fields enabled
  const isIntimeEnabled = () => {
    return formData.type === 'full-day' || formData.type === 'in-time' || formData.type === 'overtime-comp-off';
  };
  
  const isOuttimeEnabled = () => {
    return formData.type === 'full-day' || formData.type === 'out-time' || formData.type === 'overtime-comp-off';
  };

  const handleStatusUpdate = async (requestId, status) => {
    try {
      await api.put(`/requests/${requestId}`, { status });
      toast.success(`Request ${status} successfully`);
      fetchRequests();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Failed to update request status';
      toast.error(errorMessage);
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

  const exportToExcel = () => {
    if (filteredRequests.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      // Prepare data for Excel
      const data = [];
      
      // Header row
      const headerRow = isEmployeesPage
        ? ['Employee ID', 'Employee Name', 'Applied Date', 'Request Type', 'Subject', 'In Time', 'Out Time', 'Status', 'Approved By']
        : ['Applied Date', 'Request Type', 'Subject', 'In Time', 'Out Time', 'Status', 'Approved By'];
      data.push(headerRow);
      
      // Data rows
      filteredRequests.forEach((request) => {
        const row = isEmployeesPage
          ? [
              request.empid || '',
              request.name || '',
              new Date(request.applied_date).toLocaleDateString(),
              request.type || '',
              request.subject || '',
              request.intime ? new Date(request.intime).toLocaleString() : '-',
              request.outtime ? new Date(request.outtime).toLocaleString() : '-',
              request.status || '',
              request.approved_by || 'Pending'
            ]
          : [
              new Date(request.applied_date).toLocaleDateString(),
              request.type || '',
              request.subject || '',
              request.intime ? new Date(request.intime).toLocaleString() : '-',
              request.outtime ? new Date(request.outtime).toLocaleString() : '-',
              request.status || '',
              request.approved_by || 'Pending'
            ];
        data.push(row);
      });
      
      // Create workbook and worksheet
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Requests');
      
      // Set column widths
      const colWidths = isEmployeesPage
        ? [
            { wch: 15 }, // Employee ID
            { wch: 25 }, // Employee Name
            { wch: 12 }, // Applied Date
            { wch: 20 }, // Request Type
            { wch: 30 }, // Subject
            { wch: 20 }, // In Time
            { wch: 20 }, // Out Time
            { wch: 12 }, // Status
            { wch: 20 }  // Approved By
          ]
        : [
            { wch: 12 }, // Applied Date
            { wch: 20 }, // Request Type
            { wch: 30 }, // Subject
            { wch: 20 }, // In Time
            { wch: 20 }, // Out Time
            { wch: 12 }, // Status
            { wch: 20 }  // Approved By
          ];
      ws['!cols'] = colWidths;
      
      // Generate filename
      const filename = `requests_${selectedYear}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Download
      XLSX.writeFile(wb, filename);
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export Excel file');
    }
  };

  const filteredRequests = requests.filter((req) => {
    // Search filter
    const term = search.trim().toLowerCase();
    if (term) {
      const matchesSearch = (
        req.type?.toLowerCase().includes(term) ||
        req.subject?.toLowerCase().includes(term) ||
        req.status?.toLowerCase().includes(term)
      );
      if (!matchesSearch) return false;
    }
    
    // Year filter
    const requestDate = new Date(req.applied_date || req.intime);
    if (requestDate.getFullYear() !== selectedYear) return false;
    
    return true;
  });

  return (
    <div className="page-container employee-requests-page">
      <div className="page-header stacked">
        <div>
          <h1>REQUESTS</h1>
          <p className="page-subtitle">Submit and track requests across roles.</p>
        </div>
        <div className="header-actions filters-row toolbar">
          <div className="toolbar-left" style={{ flex: 1, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div className="filter-field" style={{ flex: 1, minWidth: '200px' }}>
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
            <div className="filter-field" style={{ minWidth: '120px' }}>
              <label className="filter-label">Year</label>
              <select
                className="form-input"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                style={{ marginBottom: 0 }}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="toolbar-right" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={exportToExcel}>
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
                    className="form-select"
                    style={{ 
                      width: '100%',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Select Type</option>
                    <option value="full-day" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Full-Day</option>
                    <option value="in-time" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>In-time</option>
                    <option value="out-time" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Out-Time</option>
                    <option value="overtime-comp-off" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Over-Time(Comp-off)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Subject *</label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="form-input"
                    style={{ width: '100%' }}
                    placeholder="Enter request subject"
                  />
                </div>

                {formData.type === 'overtime-comp-off' ? (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>In Time Date {isIntimeEnabled() ? '*' : ''}</label>
                        {user?.role !== 'Admin' ? (
                          // For Employee, Manager, and HR: Show dropdown with available dates only
                          <select
                            name="intime_date"
                            value={formData.intime_date}
                            onChange={(e) => {
                              const selectedDate = e.target.value;
                              setFormData(prev => ({
                                ...prev,
                                intime_date: selectedDate,
                                outtime_date: selectedDate
                              }));
                              if (selectedDate) {
                                checkDuplicateRequest(selectedDate, formData.type);
                              }
                            }}
                            required={isIntimeEnabled()}
                            className="form-select"
                            style={{ 
                              width: '100%',
                              background: 'var(--bg-card)',
                              color: 'var(--text-primary)'
                            }}
                          >
                            <option value="" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Select Available Date</option>
                            {getCompOffDates().map((item, idx) => (
                              <option 
                                key={idx} 
                                value={item.date}
                                style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                              >
                                {new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} ({item.type === 'holiday' ? 'H' : 'WO'})
                              </option>
                            ))}
                          </select>
                        ) : (
                          // For Admin: Show regular date input
                          <input
                            type="date"
                            name="intime_date"
                            value={formData.intime_date}
                            onChange={handleChange}
                            required={isIntimeEnabled()}
                            className="form-input"
                            style={{ width: '100%' }}
                            max={new Date().toISOString().split('T')[0]}
                          />
                        )}
                        {duplicateError && (
                          <small style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
                            {duplicateError}
                          </small>
                        )}
                      </div>
                      <div className="form-group">
                        <label>In Time {isIntimeEnabled() ? '*' : ''}</label>
                        <input
                          type="time"
                          name="intime_time"
                          value={formData.intime_time}
                          onChange={handleChange}
                          required={isIntimeEnabled()}
                          className="form-input"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Out Time Date {isOuttimeEnabled() ? '*' : ''}</label>
                        <input
                          type="date"
                          name="outtime_date"
                          value={formData.outtime_date}
                          onChange={handleChange}
                          required={isOuttimeEnabled()}
                          className="form-input"
                          readOnly
                          style={{ 
                            width: '100%',
                            background: 'var(--bg-hover)', 
                            cursor: 'not-allowed'
                          }}
                        />
                        <small style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          Same as In Time Date
                        </small>
                      </div>
                      <div className="form-group">
                        <label>Out Time {isOuttimeEnabled() ? '*' : ''}</label>
                        <input
                          type="time"
                          name="outtime_time"
                          value={formData.outtime_time}
                          onChange={handleChange}
                          required={isOuttimeEnabled()}
                          className="form-input"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>In Time Date {isIntimeEnabled() ? '*' : ''}</label>
                        <input
                          type="date"
                          name="intime_date"
                          value={formData.intime_date}
                          onChange={handleChange}
                          required={isIntimeEnabled()}
                          disabled={!isIntimeEnabled()}
                          className="form-input"
                          style={!isIntimeEnabled() ? { 
                            width: '100%',
                            background: 'var(--bg-hover)', 
                            cursor: 'not-allowed',
                            color: 'var(--text-secondary)'
                          } : { width: '100%' }}
                        />
                        {!isIntimeEnabled() && (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-/00:00</span>
                        )}
                      </div>
                      <div className="form-group">
                        <label>In Time {isIntimeEnabled() ? '*' : ''}</label>
                        <input
                          type="time"
                          name="intime_time"
                          value={formData.intime_time}
                          onChange={handleChange}
                          required={isIntimeEnabled()}
                          disabled={!isIntimeEnabled()}
                          className="form-input"
                          style={!isIntimeEnabled() ? { 
                            width: '100%',
                            background: 'var(--bg-hover)', 
                            cursor: 'not-allowed',
                            color: 'var(--text-secondary)'
                          } : { width: '100%' }}
                        />
                        {!isIntimeEnabled() && (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-/00:00</span>
                        )}
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Out Time Date {isOuttimeEnabled() ? '*' : ''}</label>
                        <input
                          type="date"
                          name="outtime_date"
                          value={formData.outtime_date}
                          onChange={handleChange}
                          required={isOuttimeEnabled()}
                          disabled={!isOuttimeEnabled()}
                          className="form-input"
                          style={!isOuttimeEnabled() ? { 
                            width: '100%',
                            background: 'var(--bg-hover)', 
                            cursor: 'not-allowed',
                            color: 'var(--text-secondary)'
                          } : { width: '100%' }}
                        />
                        {!isOuttimeEnabled() && (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-/00:00</span>
                        )}
                      </div>
                      <div className="form-group">
                        <label>Out Time {isOuttimeEnabled() ? '*' : ''}</label>
                        <input
                          type="time"
                          name="outtime_time"
                          value={formData.outtime_time}
                          onChange={handleChange}
                          required={isOuttimeEnabled()}
                          disabled={!isOuttimeEnabled()}
                          className="form-input"
                          style={!isOuttimeEnabled() ? { 
                            width: '100%',
                            background: 'var(--bg-hover)', 
                            cursor: 'not-allowed',
                            color: 'var(--text-secondary)'
                          } : { width: '100%' }}
                        />
                        {!isOuttimeEnabled() && (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-/00:00</span>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="5"
                    className="form-input"
                    style={{ width: '100%' }}
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
                {isEmployeesPage && <th>Employee</th>}
                <th>Applied Date</th>
                <th>Request Type</th>
                <th>Subject</th>
                <th>In Time</th>
                <th>Out Time</th>
                <th>Status</th>
                <th>Approved By</th>
                {isEmployeesPage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={isEmployeesPage ? 9 : 7} className="text-center">No requests found</td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr key={request.id}>
                    {isEmployeesPage && (
                      <td>
                        <div>{request.name || '-'}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{request.empid || '-'}</div>
                      </td>
                    )}
                    <td>{new Date(request.applied_date).toLocaleDateString()}</td>
                    <td>{request.type}</td>
                    <td>{request.subject}</td>
                    <td>{request.intime ? new Date(request.intime).toLocaleString() : '-'}</td>
                    <td>{request.outtime ? new Date(request.outtime).toLocaleString() : '-'}</td>
                    <td>{getStatusBadge(request.status)}</td>
                    <td>{request.approved_by || 'Pending'}</td>
                    {isEmployeesPage && (
                      <td>
                        {request.status === 'pending' ? (
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
                              onClick={() => handleStatusUpdate(request.id, 'approved')}
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
                              onClick={() => handleStatusUpdate(request.id, 'rejected')}
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

