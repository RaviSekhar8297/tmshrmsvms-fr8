import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api, { usersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiChevronLeft, FiChevronRight, FiFilter } from 'react-icons/fi';
import DatePicker from '../../components/DatePicker';
import * as XLSX from 'xlsx';
import './HR.css';

const EmpLeaves = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [formData, setFormData] = useState({
    employee_id: '',
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: '',
    status: 'pending'
  });
  const [employees, setEmployees] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 50;
  const [approversMap, setApproversMap] = useState({});
  const [showStartDateFilter, setShowStartDateFilter] = useState(false);
  const [showEndDateFilter, setShowEndDateFilter] = useState(false);
  const [showEmployeeFilter, setShowEmployeeFilter] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState('');

  useEffect(() => {
    // Always fetch approvers first to build the mapping
    fetchApprovers();
    
    // Only fetch if user is loaded and has the correct role
    if (user && (user.role === 'Manager' || user.role === 'HR' || user.role === 'Admin')) {
      // Fetch leaves
      fetchLeaves();
      // Fetch employees separately and handle errors gracefully (this is optional)
      if (user.role === 'HR' || user.role === 'Admin') {
        // Delay to ensure authentication is fully ready
        const timer = setTimeout(() => {
          fetchEmployees();
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  // Close filter dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showStartDateFilter || showEndDateFilter || showEmployeeFilter) {
        const target = event.target;
        if (!target.closest('[data-date-filter]') && !target.closest('[data-employee-filter]')) {
          setShowStartDateFilter(false);
          setShowEndDateFilter(false);
          setShowEmployeeFilter(false);
        }
      }
    };

    if (showStartDateFilter || showEndDateFilter || showEmployeeFilter) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showStartDateFilter, showEndDateFilter, showEmployeeFilter]);

  const fetchApprovers = async () => {
    try {
      const response = await usersAPI.getAll();
      const users = response.data || [];
      const map = {};
      
      users.forEach(user => {
        if (user.empid && user.name) {
          // Store empid exactly as it appears in the database (as string)
          const empid = String(user.empid).trim();
          
          // Store with exact empid (primary key)
          map[empid] = user.name;
          
          // If empid is numeric, also store variations for lookup
          if (!isNaN(empid) && empid !== '' && !empid.includes('-')) {
            const numValue = Number(empid);
            // Store as number (JavaScript converts to string key anyway, but explicit for clarity)
            map[numValue] = user.name;
            // Store as normalized string (removes leading zeros if any)
            const normalizedStr = String(numValue);
            if (normalizedStr !== empid) {
              map[normalizedStr] = user.name;
            }
          }
        }
      });
      
      setApproversMap(map);
      console.log('✅ Approvers map created:', Object.keys(map).length, 'entries');
      // Show sample of empids in the map for debugging
      const sampleEmpids = Object.keys(map).slice(0, 10);
      console.log('📋 Sample empids in map:', sampleEmpids);
    } catch (error) {
      console.error('❌ Error fetching approvers:', error);
    }
  };

  // Helper function to get approver name from empid
  const getApproverName = (approvedBy) => {
    if (!approvedBy) return 'Pending';
    
    const approvedByStr = String(approvedBy).trim();
    
    // Try direct string lookup first
    if (approversMap[approvedByStr]) {
      return approversMap[approvedByStr];
    }
    
    // If numeric, try as number
    if (!isNaN(approvedByStr) && approvedByStr !== '') {
      const numValue = Number(approvedByStr);
      if (approversMap[numValue]) {
        return approversMap[numValue];
      }
      // Try normalized string
      const normalized = String(numValue);
      if (normalized !== approvedByStr && approversMap[normalized]) {
        return approversMap[normalized];
      }
    }
    
    // Not found - return empid as fallback
    console.warn('⚠️ Approver name not found for empid:', approvedByStr, 
      '| Map size:', Object.keys(approversMap).length,
      '| Has key as string?', approvedByStr in approversMap,
      '| Has key as number?', !isNaN(approvedByStr) ? (Number(approvedByStr) in approversMap) : false);
    return approvedByStr;
  };

  const fetchLeaves = async () => {
    // Check if user is loaded and has correct role
    if (!user || (user.role !== 'Manager' && user.role !== 'HR' && user.role !== 'Admin')) {
      console.error('User not authorized to view employee leaves');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.get('/hr/leaves');
      setLeaves(response.data || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
      } else if (error.response?.status === 403) {
        toast.error('Access denied. You do not have permission to view employee leaves.');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to load leaves');
      }
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    // Only fetch employees if user is HR or Admin and is loaded
    if (!user || (user.role !== 'HR' && user.role !== 'Admin')) {
      return;
    }
    
    try {
      // Use a timeout to ensure token is ready
      await new Promise(resolve => setTimeout(resolve, 200));
      // Use usersAPI service which already has the correct endpoint with trailing slash
      const response = await usersAPI.getAll();
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      // Don't show error toast for employees fetch - it's optional for the form
      // Don't redirect to login - this is a non-critical call
      // Just set empty array so form can still work
      setEmployees([]);
      // If it's a 401, it might be a token issue, but don't break the page
      if (error.response?.status === 401) {
        console.warn('Failed to fetch employees: Authentication issue. Page will still work.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (user?.role !== 'HR' && user?.role !== 'Admin') {
      toast.error('Only HR or Admin can create leave requests for employees');
      return;
    }
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
      toast.success(`Leave ${status} successfully`);
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
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch = (
        leave.employee_name?.toLowerCase().includes(searchLower) ||
        leave.employee_id?.toLowerCase().includes(searchLower) ||
        leave.leave_type?.toLowerCase().includes(searchLower) ||
        leave.reason?.toLowerCase().includes(searchLower) ||
        leave.status?.toLowerCase().includes(searchLower)
      );
      if (!matchesSearch) return false;
    }
    
    // Employee filter
    if (employeeFilter) {
      const filterLower = employeeFilter.toLowerCase();
      const matchesEmployee = (
        leave.employee_name?.toLowerCase().includes(filterLower) ||
        leave.employee_id?.toLowerCase().includes(filterLower)
      );
      if (!matchesEmployee) return false;
    }
    
    // Date range filter
    if (fromDate || toDate) {
      const leaveStartDate = new Date(leave.start_date);
      const leaveEndDate = new Date(leave.end_date);
      
      if (fromDate) {
        const from = new Date(fromDate);
        if (leaveEndDate < from) return false;
      }
      
      if (toDate) {
        const to = new Date(toDate);
        if (leaveStartDate > to) return false;
      }
    }
    
    return true;
  });

  // Calculate statistics
  const totalLeaves = filteredLeaves.length;
  const pendingLeaves = filteredLeaves.filter(l => l.status === 'pending').length;
  const approvedLeaves = filteredLeaves.filter(l => l.status === 'approved').length;
  const rejectedLeaves = filteredLeaves.filter(l => l.status === 'rejected').length;

  // Pagination logic
  const totalPages = Math.ceil(filteredLeaves.length / recordsPerPage);
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredLeaves.slice(indexOfFirstRecord, indexOfLastRecord);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when search or filters change
  }, [search, fromDate, toDate]);

  const exportToExcel = () => {
    if (filteredLeaves.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      // Prepare data for Excel
      const data = [];
      
      // Header row
      const headerRow = [
        'Employee ID',
        'Employee Name',
        'Leave Type',
        'Start Date',
        'End Date',
        'Days',
        'Status',
        'Reason'
      ];
      data.push(headerRow);
      
      // Data rows
      filteredLeaves.forEach((leave) => {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        
        const row = [
          leave.employee_id || '',
          leave.employee_name || '',
          leave.leave_type || '',
          new Date(leave.start_date).toLocaleDateString(),
          new Date(leave.end_date).toLocaleDateString(),
          days,
          leave.status || '',
          leave.reason || ''
        ];
        data.push(row);
      });
      
      // Create workbook and worksheet
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Employee Leaves');
      
      // Set column widths
      const colWidths = [
        { wch: 15 }, // Employee ID
        { wch: 25 }, // Employee Name
        { wch: 15 }, // Leave Type
        { wch: 12 }, // Start Date
        { wch: 12 }, // End Date
        { wch: 8 },  // Days
        { wch: 12 }, // Status
        { wch: 40 }  // Reason
      ];
      ws['!cols'] = colWidths;
      
      // Generate filename with date range if filters are applied
      let filename = 'employee_leaves';
      if (fromDate || toDate) {
        const from = fromDate ? new Date(fromDate).toISOString().split('T')[0] : 'all';
        const to = toDate ? new Date(toDate).toISOString().split('T')[0] : 'all';
        filename += `_${from}_to_${to}`;
      } else {
        filename += `_${new Date().toISOString().split('T')[0]}`;
      }
      
      // Download
      XLSX.writeFile(wb, `${filename}.xlsx`);
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export Excel file');
    }
  };

  // Show loading if user is not loaded yet
  if (authLoading || !user) {
    return (
      <div className="loading-container" style={{ height: '100vh' }}>
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Check if user has permission
  if (user.role !== 'Manager' && user.role !== 'HR' && user.role !== 'Admin') {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>Access Denied</h1>
        </div>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header stacked">
        <div>
          <h1>EMPLOYEE LEAVES</h1>
          <p className="page-subtitle">
            {user?.role === 'Manager' 
              ? 'Review and manage leave requests from your team members.' 
              : 'Review and manage employee leave requests.'}
          </p>
        </div>
        <div className="header-actions filters-row toolbar">
          <div className="toolbar-left" style={{ flex: 1, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div className="filter-field" style={{ flex: 1, minWidth: '200px' }}>
              <label className="filter-label">Search</label>
              <input
                type="text"
                className="form-input"
                placeholder="Search by employee, leave type, reason, or status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ marginBottom: 0 }}
              />
            </div>
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
          <div className="toolbar-right">
            <button className="btn-primary" onClick={exportToExcel} disabled={filteredLeaves.length === 0}>
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card stat-blue">
          <div className="stat-value">{totalLeaves}</div>
          <div className="stat-label">Total Leaves</div>
        </div>
        <div className="stat-card stat-orange">
          <div className="stat-value">{pendingLeaves}</div>
          <div className="stat-label">Pending Leaves</div>
        </div>
        <div className="stat-card stat-green">
          <div className="stat-value">{approvedLeaves}</div>
          <div className="stat-label">Approved Leaves</div>
        </div>
        <div className="stat-card stat-red">
          <div className="stat-value">{rejectedLeaves}</div>
          <div className="stat-label">Rejected Leaves</div>
        </div>
      </div>

      {showForm && (user?.role === 'HR' || user?.role === 'Admin') && (
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
                disabled={employees.length === 0 && loading}
              >
                <option value="">
                  {loading ? 'Loading employees...' : employees.length === 0 ? 'No employees available' : 'Select Employee'}
                </option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.empid}>
                    {emp.name} ({emp.empid})
                  </option>
                ))}
              </select>
              {employees.length === 0 && !loading && (
                <small style={{ color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  Unable to load employees list. Please refresh the page or contact support.
                </small>
              )}
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
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <div style={{ position: 'relative' }} data-employee-filter>
                      <div 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                        onClick={() => {
                          setShowEmployeeFilter(!showEmployeeFilter);
                          setShowStartDateFilter(false);
                          setShowEndDateFilter(false);
                        }}
                      >
                        <span>Employee</span>
                        <FiFilter 
                          size={12} 
                          style={{ 
                            color: showEmployeeFilter ? 'var(--primary)' : 'var(--text-secondary)',
                            transition: 'color 0.2s'
                          }} 
                        />
                      </div>
                      {showEmployeeFilter && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: '8px',
                          padding: '12px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                          zIndex: 100,
                          minWidth: '280px'
                        }}>
                          <div style={{ marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Filter by Employee
                          </div>
                          <input
                            type="text"
                            value={employeeFilter}
                            onChange={(e) => setEmployeeFilter(e.target.value)}
                            placeholder="Search employee name or ID..."
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              fontSize: '0.85rem',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              background: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              outline: 'none'
                            }}
                            autoFocus
                          />
                          {employeeFilter && (
                            <button
                              type="button"
                              onClick={() => setEmployeeFilter('')}
                              style={{
                                marginTop: '8px',
                                padding: '6px 12px',
                                fontSize: '0.8rem',
                                border: 'none',
                                borderRadius: '4px',
                                background: 'var(--bg-hover)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                width: '100%'
                              }}
                            >
                              Clear Filter
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                  <th>Leave Type</th>
                  <th>
                    <div style={{ position: 'relative' }} data-date-filter>
                      <div 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                        onClick={() => {
                          setShowStartDateFilter(!showStartDateFilter);
                          setShowEndDateFilter(false);
                          setShowEmployeeFilter(false);
                        }}
                      >
                        <span>Start Date</span>
                        <FiFilter 
                          size={12} 
                          style={{ 
                            color: showStartDateFilter ? 'var(--primary)' : 'var(--text-secondary)',
                            transition: 'color 0.2s'
                          }} 
                        />
                      </div>
                      {showStartDateFilter && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: '8px',
                          padding: '12px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                          zIndex: 100,
                          minWidth: '280px'
                        }}>
                          <div style={{ marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Filter by Start Date
                          </div>
                          <DatePicker
                            value={fromDate}
                            onChange={(date) => {
                              setFromDate(date);
                            }}
                            placeholder="Select start date"
                          />
                        </div>
                      )}
                    </div>
                  </th>
                  <th>
                    <div style={{ position: 'relative' }} data-date-filter>
                      <div 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                        onClick={() => {
                          setShowEndDateFilter(!showEndDateFilter);
                          setShowStartDateFilter(false);
                          setShowEmployeeFilter(false);
                        }}
                      >
                        <span>End Date</span>
                        <FiFilter 
                          size={12} 
                          style={{ 
                            color: showEndDateFilter ? 'var(--primary)' : 'var(--text-secondary)',
                            transition: 'color 0.2s'
                          }} 
                        />
                      </div>
                      {showEndDateFilter && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: '8px',
                          padding: '12px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                          zIndex: 100,
                          minWidth: '280px'
                        }}>
                          <div style={{ marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Filter by End Date
                          </div>
                          <DatePicker
                            value={toDate}
                            onChange={(date) => {
                              setToDate(date);
                            }}
                            placeholder="Select end date"
                            min={fromDate || undefined}
                          />
                        </div>
                      )}
                    </div>
                  </th>
                  <th>Days</th>
                  <th>Status</th>
                  <th>Approved By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center">No leave requests found</td>
                  </tr>
                ) : (
                  currentRecords.map(leave => {
                    const start = new Date(leave.start_date);
                    const end = new Date(leave.end_date);
                    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
                    // Use helper function to get approver name
                    const approverName = getApproverName(leave.approved_by);
                    
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
                          <span style={{ 
                            color: approverName === 'Pending' ? 'var(--text-secondary)' : 'var(--text-primary)',
                            fontStyle: approverName === 'Pending' ? 'italic' : 'normal'
                          }}>
                            {approverName}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            {leave.status === 'pending' && (
                              <>
                                <button
                                  className="btn-sm btn-success"
                                  onClick={() => updateLeaveStatus(leave.id, 'approved')}
                                  style={{ marginRight: '8px' }}
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
                            {leave.status !== 'pending' && (
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                {leave.status === 'approved' ? 'Approved' : 'Rejected'}
                              </span>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="pagination-info" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredLeaves.length)} of {filteredLeaves.length} leaves
              </div>
              <div className="pagination-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  className="pagination-btn"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  <FiChevronLeft />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      background: currentPage === page ? 'var(--primary)' : 'var(--bg-card)',
                      color: currentPage === page ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: currentPage === page ? 600 : 400
                    }}
                  >
                    {page}
                  </button>
                ))}
                <button 
                  className="pagination-btn"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
                >
                  <FiChevronRight />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EmpLeaves;
