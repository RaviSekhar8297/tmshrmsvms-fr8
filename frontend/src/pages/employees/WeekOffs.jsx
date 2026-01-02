import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiCalendar, FiX } from 'react-icons/fi';
import '../employee/Employee.css';
import './WeekOffs.css';

const WeekOffs = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [weekOffs, setWeekOffs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('0'); // Default to "All"
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedDates, setSelectedDates] = useState([]);
  const [employeeWeekOffDates, setEmployeeWeekOffDates] = useState([]);

  useEffect(() => {
    fetchWeekOffs();
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee && showCalendarModal) {
      fetchEmployeeWeekOffDates();
    }
  }, [selectedEmployee, calendarMonth, calendarYear, showCalendarModal]);

  const fetchWeekOffs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/week-offs');
      setWeekOffs(response.data);
    } catch (error) {
      console.error('Error fetching week-offs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/users/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    }
  };

  const fetchEmployeeWeekOffDates = async () => {
    try {
      const empId = selectedEmployee === '0' ? '0' : selectedEmployee;
      const response = await api.get(`/week-offs/dates?employee_id=${empId}&month=${calendarMonth + 1}&year=${calendarYear}`);
      const dates = response.data || [];
      setEmployeeWeekOffDates(dates.map(d => d.date || d));
      setSelectedDates(dates.map(d => d.date || d));
    } catch (error) {
      console.error('Error fetching employee week off dates:', error);
      setEmployeeWeekOffDates([]);
      setSelectedDates([]);
    }
  };

  const handleOpenCalendar = () => {
    setShowCalendarModal(true);
    fetchEmployeeWeekOffDates();
  };

  const handleDateClick = async (dateStr) => {
    // Only HR can add/delete weekoffs
    if (user?.role !== 'HR') {
      toast.error('Only HR can add or remove week-offs');
      return;
    }
    
    const isSelected = selectedDates.includes(dateStr);
    const empId = selectedEmployee === '0' ? '0' : selectedEmployee;
    const empName = selectedEmployee === '0' ? 'All' : employees.find(e => e.empid === selectedEmployee)?.name || 'All';
    
    try {
      if (isSelected) {
        // Remove week off
        await api.delete(`/week-offs/dates?employee_id=${empId}&date=${dateStr}`);
        setSelectedDates(prev => prev.filter(d => d !== dateStr));
        setEmployeeWeekOffDates(prev => prev.filter(d => d !== dateStr));
        toast.success('Week off removed');
      } else {
        // Add week off
        await api.post('/week-offs/dates', {
          employee_id: empId,
          date: dateStr
        });
        setSelectedDates(prev => [...prev, dateStr]);
        setEmployeeWeekOffDates(prev => [...prev, dateStr]);
        toast.success('Week off added');
      }
      fetchWeekOffs();
      fetchEmployeeWeekOffDates();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update week off');
    }
  };

  const handleDeleteWeekOff = async (weekOff) => {
    // Show toast confirmation
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '250px' }}>
        <span style={{ marginBottom: '4px' }}>Are you sure you want to delete this week off?</span>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await api.delete(`/week-offs/dates?employee_id=${weekOff.employee_id}&date=${weekOff.date}`);
                toast.success('Week off deleted successfully');
                fetchWeekOffs();
                if (showCalendarModal) {
                  fetchEmployeeWeekOffDates();
                }
              } catch (error) {
                toast.error(error.response?.data?.detail || 'Failed to delete week off');
              }
            }}
            style={{
              padding: '6px 16px',
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            Yes, Delete
          </button>
          <button
            onClick={() => {
              toast.dismiss(t.id);
            }}
            style={{
              padding: '6px 16px',
              background: 'var(--bg-hover)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    ), {
      duration: 10000,
      id: `delete-confirm-${weekOff.id}`,
      position: 'top-center'
    });
  };

  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calendarMonth, calendarYear);
    const firstDay = getFirstDayOfMonth(calendarMonth, calendarYear);
    const days = [];
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="wo-calendar-day empty"></div>);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = employeeWeekOffDates.includes(dateStr);
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      
      days.push(
        <div
          key={day}
          className={`wo-calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
          onClick={() => handleDateClick(dateStr)}
        >
          <div className="wo-day-number">{day}</div>
          {isSelected && <div className="wo-indicator">WO</div>}
        </div>
      );
    }
    
    return days;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>WEEK-OFF'S HISTORY</h1>
        {/* Only HR role can add weekoffs */}
        {user?.role === 'HR' && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              value={selectedEmployee}
              onChange={(e) => {
                setSelectedEmployee(e.target.value);
              }}
              className="form-select"
              style={{ minWidth: '200px' }}
            >
              <option value="0">All</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.empid}>
                  {emp.name} ({emp.empid})
                </option>
              ))}
            </select>
            <button 
              className="btn-primary" 
              onClick={handleOpenCalendar}
            >
              <FiCalendar />  Date
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading week-offs...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sl.No</th>
                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Date</th>
                <th>Day of Week</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {weekOffs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">No week-offs assigned</td>
                </tr>
              ) : (
                weekOffs.map((weekOff, index) => (
                  <tr key={weekOff.id}>
                    <td>{index + 1}</td>
                    <td>{weekOff.employee_id === "0" ? "All" : weekOff.employee_id}</td>
                    <td>{weekOff.employee_name || '-'}</td>
                    <td>{weekOff.date ? new Date(weekOff.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</td>
                    <td>{weekOff.day_of_week || '-'}</td>
                    <td>
                      <span className={`badge ${weekOff.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {weekOff.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {/* Only HR role can delete weekoffs */}
                      {user?.role === 'HR' && (
                        <button 
                          className="btn-sm btn-secondary"
                          onClick={() => handleDeleteWeekOff(weekOff)}
                        >
                          Delete
                        </button>
                      )}
                      {user?.role !== 'HR' && <span>-</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Calendar Modal */}
      {showCalendarModal && (
        <div className="modal-overlay" onClick={() => setShowCalendarModal(false)}>
          <div className="modal-content wo-calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Select Week Off Dates</h3>
                <p className="modal-subtitle">Click dates to add/remove week offs</p>
              </div>
              <button className="modal-close" onClick={() => setShowCalendarModal(false)}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <select
                    value={calendarMonth}
                    onChange={(e) => setCalendarMonth(parseInt(e.target.value))}
                    className="form-select"
                    style={{ width: '150px' }}
                  >
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => (
                      <option key={index} value={index}>{month}</option>
                    ))}
                  </select>
                  <select
                    value={calendarYear}
                    onChange={(e) => setCalendarYear(parseInt(e.target.value))}
                    className="form-select"
                    style={{ width: '100px' }}
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="wo-calendar-container">
                <div className="wo-calendar-header">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="wo-calendar-header-day">{day}</div>
                  ))}
                </div>
                <div className="wo-calendar-grid">
                  {renderCalendar()}
                </div>
              </div>
              <div style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <div style={{ width: '12px', height: '12px', background: '#8b5cf6', borderRadius: '2px' }}></div>
                  <span>Selected Week Off</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', border: '2px solid var(--primary)', borderRadius: '2px' }}></div>
                  <span>Today</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeekOffs;
