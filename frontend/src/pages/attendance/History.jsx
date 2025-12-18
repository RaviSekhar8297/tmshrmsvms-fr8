import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { FiSearch, FiDownload, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './Attendance.css';
import '../employee/Employee.css';

const AttendanceHistory = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState({ employees: [], dates: [] });
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 20;

  useEffect(() => {
    fetchAttendanceHistory();
  }, [currentMonth, currentYear]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchAttendanceHistory = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/attendance/history-month?month=${currentMonth}&year=${currentYear}`);
      console.log('Attendance history response:', response.data);
      setAttendanceData(response.data);
      setFilteredEmployees(response.data.employees || []);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      console.error('Error details:', error.response?.data);
      setAttendanceData({ employees: [], dates: [] });
      setFilteredEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter employees based on search query (matching Count page style)
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setFilteredEmployees(attendanceData.employees || []);
    } else {
      const term = debouncedSearchQuery.toLowerCase().trim();
      const filtered = (attendanceData.employees || []).filter(emp => {
        const name = (emp.employee_name || '').toLowerCase();
        const empId = (emp.employee_id || '').toLowerCase();
        return name.includes(term) || empId.includes(term);
      });
      setFilteredEmployees(filtered);
    }
    setCurrentPage(1); // Reset to page 1 when search changes
  }, [debouncedSearchQuery, attendanceData.employees]);

  // Pagination logic
  const totalPages = Math.ceil(filteredEmployees.length / recordsPerPage);
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredEmployees.slice(indexOfFirstRecord, indexOfLastRecord);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const formatDuration = (hours) => {
    if (!hours || hours === 0) return '00:00';
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const getStatusDisplay = (status, hours) => {
    if (status) return status;
    if (hours && hours >= 9) return 'P';
    if (hours && hours >= 4.5 && hours < 9) return 'H/D';
    if (hours && hours > 0 && hours < 4.5) return 'Abs';
    return '';
  };

  const handleExportExcel = async () => {
    try {
      // Include search query if present to export filtered results
      const params = new URLSearchParams({
        month: currentMonth.toString(),
        year: currentYear.toString()
      });
      
      if (debouncedSearchQuery.trim()) {
        params.append('search', debouncedSearchQuery.trim());
      }
      
      const response = await api.get(
        `/attendance/export-excel?${params.toString()}`,
        { responseType: 'blob' }
      );
      
      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const searchSuffix = debouncedSearchQuery.trim() ? `_filtered` : '';
      const filename = `attendance_history_${currentYear}_${String(currentMonth).padStart(2, '0')}${searchSuffix}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Failed to export Excel file');
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === '00:00' || timeStr === null) return '00:00';
    // If it's already in HH:MM format, return as is
    if (timeStr.includes(':')) {
      return timeStr;
    }
    return '00:00';
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>ATTENDANCE HISTORY</h1>
        <div className="header-buttons" style={{ flexWrap: 'wrap', gap: '2px', alignItems: 'center', width: '100%' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search employee name or ID"
            style={{ minWidth: '220px', flex: '1 1 220px' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="month-year" style={{ display: 'flex', gap: '8px', flex: '0 0 auto' }}>
            <select
              value={currentMonth}
              onChange={(e) => {
                setCurrentMonth(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="form-select"
            >
              {monthNames.map((month, index) => (
                <option key={index + 1} value={index + 1}>{month}</option>
              ))}
            </select>
            <select
              value={currentYear}
              onChange={(e) => {
                setCurrentYear(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="form-select"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="header-buttons" style={{ marginLeft: 'auto' }}>
            <button 
              className="btn-primary" 
              onClick={handleExportExcel}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiDownload /> Excel
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading attendance history...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="empty-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
            {searchQuery ? 'No employees found matching your search' : 'No attendance records found'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-container" style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 300px)', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <table className="data-table attendance-history-table" style={{ minWidth: '1200px', borderCollapse: 'collapse', width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 100 }}>
              {/* First header row - Date headers spanning 4 columns */}
              <tr style={{ background: '#366092', color: '#FFFFFF' }}>
                <th 
                  rowSpan={2}
                  style={{ 
                    position: 'sticky', 
                    left: 0, 
                    background: '#366092', 
                    zIndex: 102, 
                    minWidth: '150px', 
                    textAlign: 'center',
                    border: '1px solid #2a4a6b',
                    padding: '12px 8px',
                    fontWeight: 600
                  }}
                >
                  NAME
                </th>
                <th 
                  rowSpan={2}
                  style={{ 
                    position: 'sticky', 
                    left: '150px', 
                    background: '#366092', 
                    zIndex: 102, 
                    minWidth: '120px', 
                    textAlign: 'center',
                    border: '1px solid #2a4a6b',
                    padding: '12px 8px',
                    fontWeight: 600
                  }}
                >
                  EmployeeId
                </th>
                {attendanceData.dates.map((date, idx) => {
                  // Convert dd-mm-yyyy to yyyy-mm-dd
                  const [day, month, year] = date.split('-');
                  const dateStr = `${year}-${month}-${day}`;
                  return (
                    <th 
                      key={idx} 
                      colSpan={4}
                      style={{ 
                        minWidth: '200px', 
                        textAlign: 'center', 
                        fontSize: '0.85rem', 
                        fontWeight: 600,
                        border: '1px solid #2a4a6b',
                        padding: '8px 4px',
                        background: '#366092'
                      }}
                    >
                      {dateStr}
                    </th>
                  );
                })}
              </tr>
              {/* Second header row - Column names (IN-TIME, OUT-TIME, DURATION, STATUS) */}
              <tr style={{ background: '#366092', color: '#FFFFFF' }}>
                {attendanceData.dates.map((date, idx) => (
                  <React.Fragment key={idx}>
                    <th style={{ 
                      minWidth: '50px', 
                      textAlign: 'center', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      border: '1px solid #2a4a6b',
                      padding: '8px 4px',
                      background: '#366092'
                    }}>IN-TIME</th>
                    <th style={{ 
                      minWidth: '50px', 
                      textAlign: 'center', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      border: '1px solid #2a4a6b',
                      padding: '8px 4px',
                      background: '#366092'
                    }}>OUT-TIME</th>
                    <th style={{ 
                      minWidth: '50px', 
                      textAlign: 'center', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      border: '1px solid #2a4a6b',
                      padding: '8px 4px',
                      background: '#366092'
                    }}>DURATION</th>
                    <th style={{ 
                      minWidth: '50px', 
                      textAlign: 'center', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      border: '1px solid #2a4a6b',
                      padding: '8px 4px',
                      background: '#366092'
                    }}>STATUS</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentRecords.map((emp, empIdx) => {
                const isLoggedInUser = user && user.empid === emp.employee_id;
                const actualIndex = indexOfFirstRecord + empIdx;
                return (
                  <tr 
                    key={emp.employee_id}
                    style={{ 
                      background: actualIndex % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)',
                      borderBottom: isLoggedInUser ? '2px solid #4CAF50' : `1px solid var(--border-color)`
                    }}
                  >
                    <td style={{ 
                      position: 'sticky', 
                      left: 0, 
                      background: actualIndex % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)', 
                      fontWeight: 600, 
                      zIndex: 10, 
                      padding: '10px 8px',
                      border: `1px solid var(--border-color)`,
                      borderRight: isLoggedInUser ? '2px solid #4CAF50' : `1px solid var(--border-color)`,
                      color: 'var(--text-primary)'
                    }}>
                      {emp.employee_name}
                    </td>
                    <td style={{ 
                      position: 'sticky', 
                      left: '150px', 
                      background: actualIndex % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)', 
                      fontWeight: 600, 
                      zIndex: 10, 
                      textAlign: 'center',
                      padding: '10px 8px',
                      border: `1px solid var(--border-color)`,
                      borderRight: isLoggedInUser ? '2px solid #4CAF50' : `1px solid var(--border-color)`,
                      color: 'var(--text-primary)'
                    }}>
                      {emp.employee_id}
                    </td>
                    {attendanceData.dates.map((date, idx) => {
                      const dayData = emp.dates[date];
                      const checkIn = formatTime(dayData?.check_in);
                      const checkOut = formatTime(dayData?.check_out);
                      const duration = formatDuration(dayData?.hours);
                      const status = getStatusDisplay(dayData?.status, dayData?.hours);
                      
                      return (
                        <React.Fragment key={idx}>
                          <td style={{ 
                            textAlign: 'center', 
                            padding: '10px 4px', 
                            fontSize: '0.85rem',
                            border: `1px solid var(--border-color)`,
                            color: checkIn === '00:00' ? 'var(--text-muted)' : 'var(--text-primary)',
                            fontWeight: checkIn === '00:00' ? 400 : 500
                          }}>
                            {checkIn}
                          </td>
                          <td style={{ 
                            textAlign: 'center', 
                            padding: '10px 4px', 
                            fontSize: '0.85rem',
                            border: `1px solid var(--border-color)`,
                            color: checkOut === '00:00' ? 'var(--text-muted)' : 'var(--text-primary)',
                            fontWeight: checkOut === '00:00' ? 400 : 500
                          }}>
                            {checkOut}
                          </td>
                          <td style={{ 
                            textAlign: 'center', 
                            padding: '10px 4px', 
                            fontSize: '0.85rem',
                            border: `1px solid var(--border-color)`,
                            color: duration === '00:00' ? 'var(--text-muted)' : 'var(--text-primary)',
                            fontWeight: duration === '00:00' ? 400 : 500
                          }}>
                            {duration}
                          </td>
                          <td style={{ 
                            textAlign: 'center', 
                            padding: '10px 4px', 
                            fontSize: '0.85rem',
                            border: `1px solid var(--border-color)`
                          }}>
                            {status ? (
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: status === 'P' ? '#4CAF50' : status === 'H/D' ? '#FF9800' : '#F44336',
                                color: '#FFFFFF'
                              }}>
                                {status}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <div className="pagination-info">
              Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredEmployees.length)} of {filteredEmployees.length} employees
            </div>
            <div className="pagination-controls">
              <button 
                className="pagination-btn"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <FiChevronLeft />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </button>
              ))}
              <button 
                className="pagination-btn"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
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

export default AttendanceHistory;
