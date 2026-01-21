import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api, { attendanceAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiDownload, FiUpload, FiRefreshCw, FiFileText, FiChevronLeft, FiChevronRight, FiSearch, FiCalendar, FiChevronDown } from 'react-icons/fi';
import '../employee/Employee.css';
import './Attendance.css';
import '../self/Punch.css';

const AttendanceCount = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    total_pages: 0
  });
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    employee_id: '',
    search: ''
  });
  const [employees, setEmployees] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [generateEmployee, setGenerateEmployee] = useState('all');
  const [generateEmployeeSearch, setGenerateEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  // Calculate previous month
  const getPreviousMonth = () => {
    const today = new Date();
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  };

  const [generateMonthYear, setGenerateMonthYear] = useState(getPreviousMonth());
  const [showGenerateMonthPicker, setShowGenerateMonthPicker] = useState(false);
  const employeeDropdownRef = useRef(null);
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);
  const monthYearPickerRef = useRef(null);

  // Initial load - fetch current month/year data on component mount
  useEffect(() => {
    fetchAttendanceData(1);
    fetchEmployees();
  }, []); // Empty dependency array - only run once on mount

  // Fetch data automatically when month/year/search filters change (user selects different month/year or searches)
  useEffect(() => {
    if (filters.month && filters.year) {
      fetchAttendanceData(1); // Reset to page 1 when filters change
    }
  }, [filters.month, filters.year, filters.search]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target)) {
        setShowEmployeeDropdown(false);
      }
      if (showGenerateMonthPicker && !event.target.closest('.month-picker-wrapper')) {
        setShowGenerateMonthPicker(false);
      }
      if (showMonthYearPicker && monthYearPickerRef.current && !monthYearPickerRef.current.contains(event.target)) {
        setShowMonthYearPicker(false);
      }
    };
    if (showEmployeeDropdown || showGenerateMonthPicker || showMonthYearPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmployeeDropdown, showGenerateMonthPicker, showMonthYearPicker]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/users/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchAttendanceData = async (pageNum = pagination.page) => {
    setLoading(true);
    try {
      const response = await api.get('/attendance/count-details', {
        params: {
          month: filters.month,
          year: filters.year,
          employee_id: filters.employee_id || undefined,
          search: filters.search || undefined,
          page: pageNum,
          limit: pagination.limit
        }
      });
      if (response.data && response.data.data) {
        // New paginated response
        setAttendanceData(response.data.data || []);
        setPagination(response.data.pagination || pagination);
      } else {
        // Fallback for old response format
        setAttendanceData(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await api.get('/attendance/export-excel', {
        params: {
          month: filters.month,
          year: filters.year,
          employee_id: filters.employee_id || undefined,
          search: filters.search || undefined
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${filters.month}_${filters.year}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      toast.error('Failed to export Excel');
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please choose a file');
      return;
    }
    const formData = new FormData();
    formData.append('file', uploadFile);
    try {
      const response = await api.post('/attendance/upload-excel-list', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Upload successful! Updated: ${response.data.updated}, Inserted: ${response.data.inserted}`);
      setShowUploadModal(false);
      setUploadFile(null);
      fetchAttendanceData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload');
    }
  };

  const handleUpload = () => {
    setShowUploadModal(true);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const [year, month] = generateMonthYear.split('-').map(Number);
      await attendanceAPI.generate({
        month: month,
        year: year,
        employee_id: generateEmployee === 'all' ? null : generateEmployee
      });
      toast.success('Attendance generated successfully');
      setShowGenerateModal(false);
      fetchAttendanceData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate attendance');
    } finally {
      setLoading(false);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>ATTENDANCE COUNT</h1>
        <div className="header-buttons" style={{ flexWrap: 'wrap', gap: '2px', alignItems: 'center', width: '100%' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search employee name or ID"
            style={{ minWidth: '220px', flex: '1 1 220px' }}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <div className="month-year" style={{ display: 'flex', gap: '8px', flex: '0 0 auto' }}>
            <div className="month-picker-wrapper" ref={monthYearPickerRef} style={{ width: '200px' }}>
              <div 
                className="month-picker-input"
                onClick={() => setShowMonthYearPicker(!showMonthYearPicker)}
              >
                <FiCalendar size={18} />
                <span>
                  {new Date(filters.year, filters.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <FiChevronDown size={18} className={showMonthYearPicker ? 'rotate' : ''} />
              </div>
              {showMonthYearPicker && (
                <div className="month-picker-dropdown" style={{ zIndex: 1000 }}>
                  <div className="month-picker-header">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilters({ ...filters, year: filters.year - 1 });
                      }}
                      className="month-picker-nav"
                    >
                      ←
                    </button>
                    <span className="month-picker-year">{filters.year}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const currentDate = new Date();
                        const maxYear = currentDate.getFullYear();
                        if (filters.year < maxYear) {
                          setFilters({ ...filters, year: filters.year + 1 });
                        }
                      }}
                      className="month-picker-nav"
                      disabled={filters.year >= new Date().getFullYear()}
                    >
                      →
                    </button>
                  </div>
                  <div className="month-picker-grid">
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => {
                      const currentDate = new Date();
                      const currentYearNow = currentDate.getFullYear();
                      const currentMonthNow = currentDate.getMonth() + 1;
                      const isCurrentMonth = filters.year === currentYearNow && (index + 1) === currentMonthNow;
                      const isFutureMonth = filters.year > currentYearNow || (filters.year === currentYearNow && (index + 1) > currentMonthNow);
                      
                      return (
                        <button
                          key={month}
                          type="button"
                          className={`month-picker-option ${isCurrentMonth ? 'current' : ''} ${filters.month === (index + 1) ? 'selected' : ''} ${isFutureMonth ? 'disabled' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isFutureMonth) {
                              setFilters({ ...filters, month: index + 1 });
                              setShowMonthYearPicker(false);
                            }
                          }}
                          disabled={isFutureMonth}
                        >
                          {month.substring(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="header-buttons" style={{ marginLeft: 'auto' }}>
            <button 
              className="btn-primary" 
              onClick={handleExportExcel}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiDownload /> Excel
            </button>
            <button 
              className="btn-primary" 
              onClick={handleUpload}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiUpload /> Upload
            </button>
            <button 
              className="btn-primary" 
              onClick={() => setShowGenerateModal(true)}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiRefreshCw /> Generate
            </button>
          </div>
        </div>
      </div>



      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading attendance data...</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>EMPLOYEE-NAME</th>
                  <th>EMP-ID</th>
                  <th>TOTAL</th>
                  <th>WORK</th>
                  <th>W.O</th>
                  <th>HOLIDAYS</th>
                  <th>PRESENT</th>
                  <th>ABSENT</th>
                  <th>HALFDAYS</th>
                  <th>LATE</th>
                  <th>LOPs</th>
                  <th>CL</th>
                  <th>SL</th>
                  <th>COMP</th>
                  <th>PAYBLE</th>
                  <th>MONTH</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.length === 0 ? (
                  <tr>
                    <td colSpan="16" className="text-center">No attendance data found</td>
                  </tr>
                ) : (
                  attendanceData.map((record) => (
                    <tr key={record.id || record.employee_id}>
                      <td>{record.employee_name || '-'}</td>
                      <td>{record.employee_id || '-'}</td>
                      <td>{record.total_days || 0}</td>
                      <td>{record.working_days || 0}</td>
                      <td>{record.week_offs || 0}</td>
                      <td>{record.holidays || 0}</td>
                      <td>{record.presents || 0}</td>
                      <td>{record.absents || 0}</td>
                      <td>{record.half_days || 0}</td>
                      <td>{record.late_logs || 0}</td>
                      <td>{record.lops || 0}</td>
                      <td>{record.cl || 0}</td>
                      <td>{record.sl || 0}</td>
                      <td>{record.comp_offs || 0}</td>
                      <td>{record.payble_days || 0}</td>
                      <td>{monthNames[filters.month - 1]} {filters.year}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination - Below table (matching History page style) */}
          {pagination.total_pages > 1 && (
            <div className="pagination">
              <div className="pagination-info">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} employees
              </div>
              <div className="pagination-controls">
                <button 
                  className="pagination-btn"
                  onClick={() => fetchAttendanceData(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <FiChevronLeft />
                </button>
                {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    className={`pagination-btn ${pagination.page === page ? 'active' : ''}`}
                    onClick={() => fetchAttendanceData(page)}
                  >
                    {page}
                  </button>
                ))}
                <button 
                  className="pagination-btn"
                  onClick={() => fetchAttendanceData(pagination.page + 1)}
                  disabled={pagination.page >= pagination.total_pages}
                >
                  <FiChevronRight />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showGenerateModal && (
        <div className="modal-overlay" onClick={() => {
          setShowGenerateModal(false);
          setShowEmployeeDropdown(false);
          setGenerateEmployeeSearch('');
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
            <div className="modal-header">
              <h3>Generate Attendance</h3>
              <button className="modal-close" onClick={() => {
                setShowGenerateModal(false);
                setShowEmployeeDropdown(false);
                setGenerateEmployeeSearch('');
              }}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ position: 'relative', width: '100%' }}>
                <label>Employee</label>
                <div ref={employeeDropdownRef} style={{ position: 'relative', width: '100%' }}>
                  <input
                    type="text"
                    value={
                      showEmployeeDropdown 
                        ? generateEmployeeSearch 
                        : (generateEmployee === 'all' 
                            ? 'All Employees' 
                            : employees.find(e => e.empid === generateEmployee)?.name || '')
                    }
                    onChange={(e) => {
                      const searchValue = e.target.value;
                      setGenerateEmployeeSearch(searchValue);
                      setShowEmployeeDropdown(true);
                    }}
                    onFocus={() => {
                      setShowEmployeeDropdown(true);
                      // When focusing, clear search to allow new search
                      setGenerateEmployeeSearch('');
                    }}
                    onBlur={(e) => {
                      // Delay closing to allow click events on dropdown items
                      setTimeout(() => {
                        if (!employeeDropdownRef.current?.contains(document.activeElement)) {
                          setShowEmployeeDropdown(false);
                          // Clear search text when dropdown closes
                          setGenerateEmployeeSearch('');
                        }
                      }, 200);
                    }}
                    placeholder="Search employee or select 'All'..."
                    className="form-input"
                    style={{ width: '100%', paddingRight: '40px' }}
                  />
                  <FiSearch style={{ 
                    position: 'absolute', 
                    right: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: 'var(--text-secondary)', 
                    pointerEvents: 'none',
                    fontSize: '18px'
                  }} />
                  {showEmployeeDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--bg-card)',
                      border: '2px solid var(--border-color)',
                      borderRadius: '8px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                      marginTop: '4px'
                    }}>
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                        onClick={() => {
                          setGenerateEmployee('all');
                          setGenerateEmployeeSearch('');
                          setShowEmployeeDropdown(false);
                        }}
                        style={{
                          padding: '14px 16px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          background: generateEmployee === 'all' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          fontWeight: generateEmployee === 'all' ? 600 : 400,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (generateEmployee !== 'all') e.currentTarget.style.background = 'var(--bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                          if (generateEmployee !== 'all') e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>All Employees</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Generate for all employees</div>
                      </div>
                      {employees
                        .filter(emp => {
                          if (!generateEmployeeSearch) return true;
                          const search = generateEmployeeSearch.toLowerCase();
                          return emp.name.toLowerCase().includes(search) || 
                                 emp.empid.toLowerCase().includes(search) ||
                                 (emp.email && emp.email.toLowerCase().includes(search));
                        })
                        .map((emp) => (
                          <div
                            key={emp.id}
                            onMouseDown={(e) => {
                              // Prevent blur event from firing before click
                              e.preventDefault();
                            }}
                            onClick={() => {
                              setGenerateEmployee(emp.empid);
                              setGenerateEmployeeSearch('');
                              setShowEmployeeDropdown(false);
                            }}
                            style={{
                              padding: '14px 16px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-color)',
                              background: generateEmployee === emp.empid ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                              fontWeight: generateEmployee === emp.empid ? 600 : 400,
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (generateEmployee !== emp.empid) e.currentTarget.style.background = 'var(--bg-hover)';
                            }}
                            onMouseLeave={(e) => {
                              if (generateEmployee !== emp.empid) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>{emp.name}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {emp.empid} {emp.email ? `• ${emp.email}` : ''}
                            </div>
                          </div>
                        ))}
                      {employees.filter(emp => {
                        if (!generateEmployeeSearch) return false;
                        const search = generateEmployeeSearch.toLowerCase();
                        return emp.name.toLowerCase().includes(search) || 
                               emp.empid.toLowerCase().includes(search) ||
                               (emp.email && emp.email.toLowerCase().includes(search));
                      }).length === 0 && generateEmployeeSearch && (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No employees found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ width: '100%' }}>
                <label>Month & Year</label>
                <div className="month-picker-wrapper" style={{ width: '100%' }}>
                  <div 
                    className="month-picker-input"
                    onClick={() => setShowGenerateMonthPicker(!showGenerateMonthPicker)}
                  >
                    <FiCalendar size={18} />
                    <span>
                      {generateMonthYear 
                        ? new Date(generateMonthYear + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                        : 'Select month'}
                    </span>
                    <FiChevronDown size={18} className={showGenerateMonthPicker ? 'rotate' : ''} />
                  </div>
                  {showGenerateMonthPicker && (
                    <div className="month-picker-dropdown">
                      <div className="month-picker-header">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const [year] = generateMonthYear ? generateMonthYear.split('-').map(Number) : [new Date().getFullYear()];
                            const currentYear = year || new Date().getFullYear();
                            const newYear = currentYear - 1;
                            const [_, month] = generateMonthYear ? generateMonthYear.split('-') : [null, String(new Date().getMonth() + 1).padStart(2, '0')];
                            setGenerateMonthYear(`${newYear}-${month}`);
                          }}
                          className="month-picker-nav"
                        >
                          ←
                        </button>
                        <span className="month-picker-year">
                          {generateMonthYear ? generateMonthYear.split('-')[0] : new Date().getFullYear()}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const [year] = generateMonthYear ? generateMonthYear.split('-').map(Number) : [new Date().getFullYear()];
                            const currentYear = year || new Date().getFullYear();
                            const currentDate = new Date();
                            const maxYear = currentDate.getFullYear();
                            // Only allow going forward if the year is less than current year
                            if (currentYear < maxYear) {
                              const newYear = currentYear + 1;
                              const [_, month] = generateMonthYear ? generateMonthYear.split('-') : [null, String(new Date().getMonth() + 1).padStart(2, '0')];
                              setGenerateMonthYear(`${newYear}-${month}`);
                            }
                          }}
                          className="month-picker-nav"
                          disabled={generateMonthYear ? parseInt(generateMonthYear.split('-')[0]) >= new Date().getFullYear() : true}
                        >
                          →
                        </button>
                      </div>
                      <div className="month-picker-grid">
                        {['December', 'November', 'October', 'September', 'August', 'July', 'June', 'May', 'April', 'March', 'February', 'January'].map((month, index) => {
                          const monthNum = 12 - index; // Reverse order: Dec=12, Nov=11, etc.
                          const year = generateMonthYear ? parseInt(generateMonthYear.split('-')[0]) : new Date().getFullYear();
                          const currentDate = new Date();
                          const currentYear = currentDate.getFullYear();
                          const currentMonth = currentDate.getMonth() + 1;
                          const isCurrentMonth = year === currentYear && monthNum === currentMonth;
                          const isPastMonth = year < currentYear || (year === currentYear && monthNum < currentMonth);
                          
                          // Only show past months (not current or future)
                          if (!isPastMonth) {
                            return null;
                          }
                          
                          return (
                            <button
                              key={month}
                              type="button"
                              className={`month-picker-option ${isCurrentMonth ? 'current' : ''} ${generateMonthYear === `${year}-${String(monthNum).padStart(2, '0')}` ? 'selected' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                const monthValue = `${year}-${String(monthNum).padStart(2, '0')}`;
                                setGenerateMonthYear(monthValue);
                                setShowGenerateMonthPicker(false);
                              }}
                            >
                              {month.substring(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowGenerateModal(false);
                    setShowEmployeeDropdown(false);
                    setGenerateEmployeeSearch('');
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {loading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Attendance Excel</h3>
              <button className="modal-close" onClick={() => setShowUploadModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUploadSubmit}>
                <div className="form-group">
                  <label>Select Excel File</label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="form-input"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Uploading...' : 'Submit'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCount;
