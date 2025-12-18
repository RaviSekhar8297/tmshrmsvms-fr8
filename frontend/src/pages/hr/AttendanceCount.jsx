import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { FiSearch, FiCalendar } from 'react-icons/fi';
import './HR.css';

const AttendanceCount = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    onLeave: 0,
    lateArrivals: 0
  });
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchAttendanceCount();
  }, [date]);

  const fetchAttendanceCount = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/hr/attendance/count?date=${date}`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching attendance count:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Employees', value: stats.totalEmployees, color: 'blue' },
    { label: 'Present Today', value: stats.presentToday, color: 'green' },
    { label: 'Absent Today', value: stats.absentToday, color: 'red' },
    { label: 'On Leave', value: stats.onLeave, color: 'orange' },
    { label: 'Late Arrivals', value: stats.lateArrivals, color: 'yellow' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Attendance Count</h1>
        <div className="header-actions">
          <div className="search-box" style={{ flex: 1, maxWidth: 300 }}>
            <FiSearch className="search-box-icon" />
            <input
              type="text"
              className="form-input"
              placeholder="Search by employee ID or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', padding: '0' }}
            />
          </div>
          <div className="date-picker-wrapper">
            <FiCalendar className="date-icon" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="date-input"
              style={{ paddingLeft: '32px' }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading attendance data...</p>
        </div>
      ) : (
        <div className="stats-grid">
          {statCards.map((stat, index) => (
            <div key={index} className={`stat-card stat-${stat.color}`}>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttendanceCount;

