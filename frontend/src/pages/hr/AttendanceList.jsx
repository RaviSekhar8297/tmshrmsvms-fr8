import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { attendanceAPI } from '../../services/api';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import './HR.css';

const AttendanceList = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState({ employees: [], dates: [] });
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchAttendanceHistory();
  }, [currentMonth, currentYear]);

  const fetchAttendanceHistory = async () => {
    setLoading(true);
    try {
      const response = await attendanceAPI.getHistoryMonth(currentMonth, currentYear);
      setAttendanceData(response.data);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
    } finally {
      setLoading(false);
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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Attendance History</h1>
        <div className="header-actions">
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
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading attendance history...</p>
        </div>
      ) : (
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
                {attendanceData.employees && attendanceData.employees.length === 0 ? (
                  <tr>
                    <td colSpan={attendanceData.dates.length + 2} className="text-center">
                      No attendance records found
                    </td>
                  </tr>
                ) : (
                  attendanceData.employees.map((emp) => (
                    <tr key={emp.employee_id}>
                      <td className="sticky-col">{emp.employee_name}</td>
                      <td className="sticky-col">{emp.employee_id}</td>
                      {attendanceData.dates && attendanceData.dates.map((dateStr) => {
                        const dayData = emp.dates[dateStr] || {};
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
