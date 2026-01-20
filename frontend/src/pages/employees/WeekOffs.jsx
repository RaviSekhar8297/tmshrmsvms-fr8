import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiCalendar, FiX, FiSearch } from 'react-icons/fi';
import DatePicker from '../../components/DatePicker';
import '../employee/Employee.css';
import './WeekOffs.css';

const WeekOffs = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [weekOffs, setWeekOffs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState('0'); // Default to "All"
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const employeeDropdownRef = useRef(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedDates, setSelectedDates] = useState([]);
  const [employeeWeekOffDates, setEmployeeWeekOffDates] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [clickedDate, setClickedDate] = useState(null); // Date clicked in calendar
  const [showAddModal, setShowAddModal] = useState(false); // Modal for adding week off
  const [modalEmployeeId, setModalEmployeeId] = useState('0'); // Employee ID in modal
  const [modalDate, setModalDate] = useState(''); // Date in modal
  const [modalEmployeeSearch, setModalEmployeeSearch] = useState(''); // Employee search in modal
  const [showModalEmployeeDropdown, setShowModalEmployeeDropdown] = useState(false); // Employee dropdown in modal
  const modalEmployeeDropdownRef = useRef(null);

  useEffect(() => {
    fetchWeekOffs();
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee && showCalendarModal) {
      fetchEmployeeWeekOffDates();
    }
  }, [selectedEmployee, calendarMonth, calendarYear, showCalendarModal]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target)) {
        setShowEmployeeDropdown(false);
      }
      if (modalEmployeeDropdownRef.current && !modalEmployeeDropdownRef.current.contains(event.target)) {
        setShowModalEmployeeDropdown(false);
      }
    };
    if (showEmployeeDropdown || showModalEmployeeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmployeeDropdown, showModalEmployeeDropdown]);

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

  const handleDateClick = (dateStr) => {
    // Only HR can add/delete weekoffs
    if (user?.role !== 'HR') {
      toast.error('Only HR can add or remove week-offs');
      return;
    }
    
    const isSelected = employeeWeekOffDates.includes(dateStr);
    
    if (isSelected) {
      // If already selected, remove it directly
      handleRemoveWeekOff(dateStr);
    } else {
      // If not selected, set clicked date and show add section
      setClickedDate(dateStr);
      setModalDate(dateStr);
      setModalEmployeeId(selectedEmployee === '0' ? '0' : selectedEmployee);
    }
  };

  const handleRemoveWeekOff = async (dateStr) => {
    const empId = selectedEmployee === '0' ? '0' : selectedEmployee;
    try {
      await api.delete(`/week-offs/dates?employee_id=${empId}&date=${dateStr}`);
      setSelectedDates(prev => prev.filter(d => d !== dateStr));
      setEmployeeWeekOffDates(prev => prev.filter(d => d !== dateStr));
      toast.success('Week off removed');
      fetchWeekOffs();
      fetchEmployeeWeekOffDates();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remove week off');
    }
  };

  const handleAddWeekOff = async () => {
    if (!modalDate) {
      toast.error('Please select a date');
      return;
    }

    if (!modalEmployeeId) {
      toast.error('Please select an employee');
      return;
    }

    try {
      await api.post('/week-offs/dates', {
        employee_id: modalEmployeeId,
        date: modalDate
      });
      toast.success('Week off added successfully');
      setShowAddModal(false);
      setClickedDate(null);
      setModalDate('');
      setModalEmployeeId('0');
      setModalEmployeeSearch('');
      fetchWeekOffs();
      if (showCalendarModal) {
        fetchEmployeeWeekOffDates();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add week off');
    }
  };

  // Auto-add week off when both employee and date are selected
  useEffect(() => {
    if (showAddModal && modalEmployeeId && modalDate) {
      // Small delay to ensure both are set
      const timer = setTimeout(async () => {
        try {
          await api.post('/week-offs/dates', {
            employee_id: modalEmployeeId,
            date: modalDate
          });
          toast.success('Week off added successfully');
          setShowAddModal(false);
          setClickedDate(null);
          setModalDate('');
          setModalEmployeeId('0');
          setModalEmployeeSearch('');
          fetchWeekOffs();
          if (showCalendarModal) {
            fetchEmployeeWeekOffDates();
          }
        } catch (error) {
          toast.error(error.response?.data?.detail || 'Failed to add week off');
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalEmployeeId, modalDate, showAddModal]);

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

  const filteredWeekOffs = weekOffs.filter((wo) => {
    // Search filter
    const term = search.trim().toLowerCase();
    if (term) {
      const matchesSearch = (
        wo.employee_id?.toLowerCase().includes(term) ||
        wo.employee_name?.toLowerCase().includes(term) ||
        wo.day_of_week?.toLowerCase().includes(term)
      );
      if (!matchesSearch) return false;
    }
    
    // Year filter
    if (wo.date) {
      const woDate = new Date(wo.date);
      if (woDate.getFullYear() !== selectedYear) return false;
    }
    
    return true;
  });

  return (
    <div className="page-container">
      <div className="page-header stacked">
        <div>
          <h1>WEEK-OFF'S HISTORY!</h1>
          <p className="page-subtitle">View and manage week-off assignments.</p>
        </div>
        <div className="header-actions filters-row toolbar">
          <div className="toolbar-left" style={{ flex: 1, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div className="filter-field" style={{ flex: 1, minWidth: '200px' }}>
              <label className="filter-label">Search</label>
              <input
                type="text"
                className="form-input"
                placeholder="Search by employee ID, name, or day..."
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
            {/* Only HR role can add weekoffs */}
            {user?.role === 'HR' && (
              <button 
                className="btn-primary" 
                onClick={() => {
                  setShowAddModal(true);
                  setModalEmployeeId('0');
                  setModalDate('');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiCalendar /> Add Week Off
              </button>
            )}
          </div>
          <div className="toolbar-right">
            <button className="btn-primary" onClick={() => toast('Excel export coming soon')}>
              Excel
            </button>
          </div>
        </div>
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
              {filteredWeekOffs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">No week-offs assigned</td>
                </tr>
              ) : (
                filteredWeekOffs.map((weekOff, index) => (
                  <tr key={weekOff.id}>
                    <td>{index + 1}</td>
                    <td>
                      <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {weekOff.employee_id === "0" ? "All" : weekOff.employee_id}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-primary)' }}>
                        {weekOff.employee_name || '-'}
                      </span>
                    </td>
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
                          className="btn-sm btn-danger"
                          onClick={() => handleDeleteWeekOff(weekOff)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: 'var(--danger)',
                            color: 'white'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.9';
                            e.currentTarget.style.transform = 'scale(1.02)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        >
                          Delete
                        </button>
                      )}
                      {user?.role !== 'HR' && (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Calendar Modal (HR role only) */}
      {user?.role === 'HR' && showCalendarModal && (
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
              
              {/* Add Week Off Section - Shows when a date is clicked (HR role only) */}
              {user?.role === 'HR' && clickedDate && !employeeWeekOffDates.includes(clickedDate) && (
                <div style={{ 
                  marginTop: '24px', 
                  padding: '20px', 
                  background: 'var(--bg-hover)', 
                  borderRadius: '12px',
                  border: '2px solid var(--primary)'
                }}>
                  <h4 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: '600' }}>Add Week Off</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>All Employees</label>
                      <input
                        type="text"
                        value={modalEmployeeId === '0' ? 'All' : employees.find(e => e.empid === modalEmployeeId)?.name || ''}
                        readOnly
                        className="form-input"
                        style={{ background: 'var(--bg-primary)', cursor: 'not-allowed' }}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Selected Date</label>
                      <input
                        type="text"
                        value={modalDate ? new Date(modalDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                        readOnly
                        className="form-input"
                        style={{ background: 'var(--bg-primary)', cursor: 'not-allowed' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setClickedDate(null);
                          setModalDate('');
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn-primary"
                        onClick={handleAddWeekOff}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

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

      {/* Add Week Off Modal (HR role only) */}
      {user?.role === 'HR' && showAddModal && (
        <div 
          className="modal-overlay" 
          onClick={() => {
            setShowAddModal(false);
            setModalDate('');
            setModalEmployeeId('0');
            setModalEmployeeSearch('');
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: '520px',
              width: '100%',
              background: 'var(--bg-card)',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '24px 28px',
              borderBottom: '1px solid var(--border-color)',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(14, 165, 233, 0.05) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '1.5rem', 
                  fontWeight: '700', 
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <FiCalendar style={{ color: 'var(--primary)' }} />
                  Add Week Off
                </h3>
                <p style={{ 
                  margin: '6px 0 0 0', 
                  fontSize: '0.9rem', 
                  color: 'var(--text-secondary)' 
                }}>
                  Select employee and date to add week off
                </p>
              </div>
              <button 
                className="modal-close" 
                onClick={() => {
                  setShowAddModal(false);
                  setModalDate('');
                  setModalEmployeeId('0');
                  setModalEmployeeSearch('');
                }}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--bg-hover)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  fontSize: '1.2rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--danger)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                <FiX />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '28px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Employee Selection */}
                <div className="form-group" ref={modalEmployeeDropdownRef} style={{ position: 'relative' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '10px', 
                    fontWeight: '600',
                    fontSize: '0.95rem',
                    color: 'var(--text-primary)'
                  }}>
                    All Employees <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={
                        showModalEmployeeDropdown 
                          ? modalEmployeeSearch 
                          : (modalEmployeeId === '0' 
                              ? 'All' 
                              : employees.find(e => e.empid === modalEmployeeId)?.name || '')
                      }
                      onChange={(e) => {
                        const searchValue = e.target.value;
                        setModalEmployeeSearch(searchValue);
                        setShowModalEmployeeDropdown(true);
                      }}
                    onFocus={(e) => {
                      setShowModalEmployeeDropdown(true);
                      setModalEmployeeSearch('');
                      e.target.style.borderColor = 'var(--primary)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--border-color)';
                      e.target.style.boxShadow = 'none';
                      setTimeout(() => {
                        if (!modalEmployeeDropdownRef.current?.contains(document.activeElement)) {
                          setShowModalEmployeeDropdown(false);
                          setModalEmployeeSearch('');
                        }
                      }, 200);
                    }}
                    placeholder="Search employee or select 'All'..."
                    className="form-input"
                    style={{ 
                      width: '100%', 
                      padding: '12px 16px 12px 44px',
                      fontSize: '0.95rem',
                      border: '2px solid var(--border-color)',
                      borderRadius: '10px',
                      background: 'var(--bg-primary)',
                      transition: 'all 0.2s'
                    }}
                    />
                    <FiSearch style={{ 
                      position: 'absolute', 
                      left: '16px', 
                      top: '50%', 
                      transform: 'translateY(-50%)', 
                      color: 'var(--text-secondary)', 
                      pointerEvents: 'none',
                      fontSize: '18px'
                    }} />
                  </div>
                  {showModalEmployeeDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      left: 0,
                      right: 0,
                      background: 'var(--bg-card)',
                      border: '2px solid var(--border-color)',
                      borderRadius: '12px',
                      maxHeight: '320px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
                      marginTop: '4px'
                    }}>
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                        onClick={() => {
                          setModalEmployeeId('0');
                          setModalEmployeeSearch('');
                          setShowModalEmployeeDropdown(false);
                        }}
                        style={{
                          padding: '14px 18px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          background: modalEmployeeId === '0' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                          fontWeight: modalEmployeeId === '0' ? 600 : 400,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (modalEmployeeId !== '0') e.currentTarget.style.background = 'var(--bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                          if (modalEmployeeId !== '0') e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>All</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>All employees</div>
                      </div>
                      {employees
                        .filter(emp => {
                          if (!modalEmployeeSearch) return true;
                          const searchTerm = modalEmployeeSearch.toLowerCase();
                          return emp.name.toLowerCase().includes(searchTerm) || 
                                 emp.empid.toLowerCase().includes(searchTerm) ||
                                 (emp.email && emp.email.toLowerCase().includes(searchTerm));
                        })
                        .map((emp) => (
                          <div
                            key={emp.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                            }}
                            onClick={() => {
                              setModalEmployeeId(emp.empid);
                              setModalEmployeeSearch('');
                              setShowModalEmployeeDropdown(false);
                            }}
                            style={{
                              padding: '14px 18px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-color)',
                              background: modalEmployeeId === emp.empid ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                              fontWeight: modalEmployeeId === emp.empid ? 600 : 400,
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (modalEmployeeId !== emp.empid) e.currentTarget.style.background = 'var(--bg-hover)';
                            }}
                            onMouseLeave={(e) => {
                              if (modalEmployeeId !== emp.empid) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>{emp.name}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              {emp.empid} {emp.email ? `• ${emp.email}` : ''}
                            </div>
                          </div>
                        ))}
                      {employees.filter(emp => {
                        if (!modalEmployeeSearch) return false;
                        const searchTerm = modalEmployeeSearch.toLowerCase();
                        return emp.name.toLowerCase().includes(searchTerm) || 
                               emp.empid.toLowerCase().includes(searchTerm) ||
                               (emp.email && emp.email.toLowerCase().includes(searchTerm));
                      }).length === 0 && modalEmployeeSearch && (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No employees found
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Date Selection */}
                <div className="form-group">
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '10px', 
                    fontWeight: '600',
                    fontSize: '0.95rem',
                    color: 'var(--text-primary)'
                  }}>
                    Selected Date <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <DatePicker
                    value={modalDate}
                    onChange={(date) => {
                      setModalDate(date);
                    }}
                    placeholder="Select date"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {/* Info Message */}
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  borderRadius: '10px',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <FiCalendar style={{ color: 'var(--primary)', fontSize: '18px', flexShrink: 0 }} />
                  <span>Week off will be automatically added once both fields are selected.</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default WeekOffs;
