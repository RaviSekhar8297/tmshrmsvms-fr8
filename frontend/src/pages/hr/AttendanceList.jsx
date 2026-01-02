import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { attendanceAPI } from '../../services/api';
import api from '../../services/api';
import { FiChevronLeft, FiChevronRight, FiSearch, FiFilter } from 'react-icons/fi';
import './HR.css';

const AttendanceList = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState({ employees: [], dates: [] });
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [dateFilteredData, setDateFilteredData] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (selectedDate) {
      fetchAttendanceByDate();
    } else {
      fetchAttendanceHistory();
    }
  }, [currentMonth, currentYear, selectedDate]);

  useEffect(() => {
    filterData();
  }, [searchQuery, attendanceData]);

  const fetchAttendanceHistory = async () => {
    setLoading(true);
    try {
      const response = await attendanceAPI.getHistoryMonth(currentMonth, currentYear);
      const data = response.data || {};
      setAttendanceData({
        employees: data.employees || [],
        dates: data.dates || []
      });
      setFilteredData(data.employees || []);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      setAttendanceData({ employees: [], dates: [] });
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceByDate = async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const response = await api.get(`/attendance/history?date=${selectedDate}`);
      setDateFilteredData(response.data || []);
    } catch (error) {
      console.error('Error fetching attendance by date:', error);
      setDateFilteredData([]);
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    if (!searchQuery.trim()) {
      setFilteredData(attendanceData.employees || []);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = (attendanceData.employees || []).filter(emp => 
      emp.employee_name?.toLowerCase().includes(query) ||
      emp.employee_id?.toLowerCase().includes(query)
    );
    setFilteredData(filtered);
  };

  const handleFilter = () => {
    if (selectedDate) {
      fetchAttendanceByDate();
    } else {
      fetchAttendanceHistory();
    }
  };

  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      if (currentMonth === 1) {
        setCurrentMonth(12);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 12) {
        setCurrentMonth(1);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const getStatusBadge = (status) => {
    if (!status) return <span className="status-text">-</span>;
    const badges = {
      present: { class: 'badge-success', text: 'P' },
      absent: { class: 'badge-danger', text: 'A' },
      leave: { class: 'badge-warning', text: 'L' },
      late: { class: 'badge-info', text: 'L' },
    };
    const badge = badges[status] || badges.absent;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  const formatHours = (hours) => {
    if (!hours || hours === 0) return '00:00';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '00:00';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return dateString;
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Attendance History</h1>
        <div className="header-actions">
          {!selectedDate && (
            <div className="month-navigator">
              <button onClick={() => navigateMonth('prev')} className="nav-btn">
                <FiChevronLeft />
              </button>
              <span className="month-year">
                {monthNames[currentMonth - 1]} {currentYear}
              </span>
              <button onClick={() => navigateMonth('next')} className="nav-btn">
                <FiChevronRight />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search and Filter Section */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '20px', 
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <FiSearch style={{ 
            position: 'absolute', 
            left: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'var(--text-secondary)'
          }} />
          <input
            type="text"
            placeholder="Search by name or employee ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '0.9rem',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '10px 12px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '0.9rem',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)'
            }}
          />
          <button
            onClick={handleFilter}
            style={{
              padding: '10px 20px',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.9rem',
              fontWeight: 600
            }}
          >
            <FiFilter /> Filter
          </button>
          {selectedDate && (
            <button
              onClick={() => {
                setSelectedDate('');
                fetchAttendanceHistory();
              }}
              style={{
                padding: '10px 20px',
                background: 'var(--bg-hover)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading attendance history...</p>
        </div>
      ) : selectedDate ? (
        // Table view for selected date
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Date</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {dateFilteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center">
                    No attendance records found
                  </td>
                </tr>
              ) : (
                dateFilteredData
                  .filter(record => {
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase();
                    return record.employee_name?.toLowerCase().includes(query) ||
                           record.employee_id?.toLowerCase().includes(query);
                  })
                  .map((record, index) => (
                    <tr key={record.id || index}>
                      <td>{index + 1}</td>
                      <td>{record.employee_id}</td>
                      <td>{record.employee_name}</td>
                      <td>{selectedDate}</td>
                      <td>
                        {record.check_in ? formatDateTime(record.check_in) : '00:00'} - {record.check_out ? formatDateTime(record.check_out) : '00:00'}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        // Month view (existing calendar table)
        <div className="table-container history-table-wrapper">
          <div className="history-table-scroll">
            <table className="data-table history-table">
              <thead>
                <tr>
                  <th className="sticky-col">Name</th>
                  <th className="sticky-col">Employee Id</th>
                  {attendanceData.dates && attendanceData.dates.map((dateStr) => (
                    <th key={dateStr} className="date-header">
                      <div className="date-header-content">
                        <div>{dateStr.split('-')[0]}</div>
                        <div className="date-subheader">
                          {dateStr.split('-')[1]}-{dateStr.split('-')[2]}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="sub-header">
                  <th className="sticky-col"></th>
                  <th className="sticky-col"></th>
                  {attendanceData.dates && attendanceData.dates.map((dateStr) => (
                    <th key={dateStr} className="sub-header-cell">
                      <div className="sub-header-grid">
                        <span>In</span>
                        <span>Out</span>
                        <span>St</span>
                        <span>Hrs</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(filteredData.length === 0 || (attendanceData.employees && attendanceData.employees.length === 0)) ? (
                  <tr>
                    <td colSpan={(attendanceData.dates?.length || 0) + 2} className="text-center">
                      No attendance records found
                    </td>
                  </tr>
                ) : (
                  filteredData.map((emp) => (
                    <tr key={emp.employee_id}>
                      <td className="sticky-col">{emp.employee_name}</td>
                      <td className="sticky-col">{emp.employee_id}</td>
                      {attendanceData.dates && attendanceData.dates.map((dateStr) => {
                        const dayData = emp.dates?.[dateStr] || {};
                        return (
                          <td key={dateStr} className="attendance-cell">
                            <div className="attendance-grid">
                              <span>{dayData.check_in || '00:00'}</span>
                              <span>{dayData.check_out || '00:00'}</span>
                              <span>{getStatusBadge(dayData.status)}</span>
                              <span>{formatHours(dayData.hours)}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceList;
