import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { attendanceAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiEdit, FiSave, FiX, FiClock, FiCalendar, FiInfo, FiBell } from 'react-icons/fi';
import '../employee/Employee.css';
import './Attendance.css';
import './Cycle.css';

const AttendanceCycle = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [cycle, setCycle] = useState(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    shift_start_time: '09:00',
    shift_end_time: '18:00',
    late_log_time: '09:45',
    full_day_duration: '09:00',
    half_day_duration: '04:30',
    attendance_cycle_start_date: 26,
    attendance_cycle_end_date: 25,
    birthdays_send: { day: '', time: '' },
    anniversaries_send: { day: '', time: '' },
    weekly_attendance_send: { day: '', time: '' }
  });

  useEffect(() => {
    fetchCycle();
  }, []);

  const fetchCycle = async () => {
    setLoading(true);
    try {
      const response = await attendanceAPI.getCycle();
      if (response.data) {
        setCycle(response.data);
        setFormData({
          name: response.data.name || '',
          shift_start_time: response.data.shift_start_time || '09:00',
          shift_end_time: response.data.shift_end_time || '18:00',
          late_log_time: response.data.late_log_time || '09:45',
          full_day_duration: response.data.full_day_duration || '09:00',
          half_day_duration: response.data.half_day_duration || '04:30',
          attendance_cycle_start_date: response.data.attendance_cycle_start_date || 26,
          attendance_cycle_end_date: response.data.attendance_cycle_end_date || 25,
          birthdays_send: response.data.birthdays_send || { day: '', time: '' },
          anniversaries_send: response.data.anniversaries_send || { day: '', time: '' },
          weekly_attendance_send: response.data.weekly_attendance_send || { day: '', time: '' }
        });
      }
    } catch (error) {
      console.error('Error fetching cycle:', error);
      if (error.response?.status !== 404) {
        toast.error('Failed to load attendance cycle');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (cycle) {
        await attendanceAPI.updateCycle(formData);
        toast.success('Attendance cycle updated successfully');
      } else {
        await attendanceAPI.createCycle(formData);
        toast.success('Attendance cycle created successfully');
      }
      setEditing(false);
      fetchCycle();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save attendance cycle');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('date') ? parseInt(value) : value
    }));
  };

  const handleNotificationChange = (field, key, value) => {
    setFormData(prev => {
      const updatedField = {
        ...prev[field],
        [key]: value
      };
      
      // If day is set to empty/None, clear the time as well
      if (key === 'day' && (!value || value === '')) {
        updatedField.time = '';
      }
      
      return {
        ...prev,
        [field]: updatedField
      };
    });
  };

  if (loading && !cycle) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading attendance cycle...</p>
      </div>
    );
  }

  return (
    <div className="page-container attendance-cycle-page">
      <div className="cycle-header">
        <h1>
          <FiCalendar style={{ marginRight: '12px', display: 'inline' }} />
          ATTENDANCE CYCLE
        </h1>
        <div className="header-actions">
          {!editing && (user?.role === 'Admin' || user?.role === 'HR') ? (
            <button 
              className="btn-primary" 
              onClick={() => setEditing(true)} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                padding: '12px 24px',
                fontSize: '1rem',
                fontWeight: 600,
                borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
              }}
            >
              <FiEdit /> {cycle ? 'Edit' : 'Create'} Cycle
            </button>
          ) : editing && (user?.role === 'Admin' || user?.role === 'HR') ? (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => {
                  setEditing(false);
                  if (cycle) {
                    setFormData({
                      name: cycle.name || '',
                      shift_start_time: cycle.shift_start_time || '09:00',
                      shift_end_time: cycle.shift_end_time || '18:00',
                      late_log_time: cycle.late_log_time || '09:45',
                      full_day_duration: cycle.full_day_duration || '09:00',
                      half_day_duration: cycle.half_day_duration || '04:30',
                      attendance_cycle_start_date: cycle.attendance_cycle_start_date || 26,
                      attendance_cycle_end_date: cycle.attendance_cycle_end_date || 25,
                      birthdays_send: cycle.birthdays_send || { day: '', time: '' },
                      anniversaries_send: cycle.anniversaries_send || { day: '', time: '' },
                      weekly_attendance_send: cycle.weekly_attendance_send || { day: '', time: '' }
                    });
                  }
                }} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  padding: '12px 24px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  borderRadius: '10px'
                }}
              >
                <FiX /> Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleSave} 
                disabled={loading} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  padding: '12px 24px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  borderRadius: '10px',
                  boxShadow: loading ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.3)'
                }}
              >
                <FiSave /> {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="cycle-form-container">
        <div className="cycle-shift-timings-card">
          <div className="cycle-section-title">
            <FiClock style={{ marginRight: '8px', display: 'inline' }} />
            Shift Timings
          </div>
          
          <div className="cycle-form-grid cycle-shift-grid">
          <div className="cycle-form-group">
            <label>Cycle Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={!editing}
              className="cycle-form-input"
              placeholder="e.g., Monthly Cycle"
              required
            />
          </div>

          <div className="cycle-form-group">
            <label>Shift Start Time</label>
            <input
              type="time"
              name="shift_start_time"
              value={formData.shift_start_time}
              onChange={handleChange}
              disabled={!editing}
              className="cycle-form-input"
              required
            />
          </div>

          <div className="cycle-form-group">
            <label>Shift End Time</label>
            <input
              type="time"
              name="shift_end_time"
              value={formData.shift_end_time}
              onChange={handleChange}
              disabled={!editing}
              className="cycle-form-input"
              required
            />
          </div>

          <div className="cycle-form-group">
            <label>Late Log Time</label>
            <input
              type="time"
              name="late_log_time"
              value={formData.late_log_time}
              onChange={handleChange}
              disabled={!editing}
              className="cycle-form-input"
              required
            />
            <small className="cycle-form-input-small">
              Employees logging in after this time will be marked as late
            </small>
          </div>
          </div>
        </div>

        <div className="cycle-shift-timings-card">
          <div className="cycle-section-title">
            <FiClock style={{ marginRight: '8px', display: 'inline' }} />
            Duration Settings
          </div>
          
          <div className="cycle-form-grid">
            <div className="cycle-form-group">
              <label>Full Day Duration</label>
              <input
                type="time"
                name="full_day_duration"
                value={formData.full_day_duration}
                onChange={handleChange}
                disabled={!editing}
                className="cycle-form-input"
                required
              />
              <small className="cycle-form-input-small">
                Minimum hours required for a full day (e.g., 09:00 = 9 hours)
              </small>
            </div>

            <div className="cycle-form-group">
              <label>Half Day Duration</label>
              <input
                type="time"
                name="half_day_duration"
                value={formData.half_day_duration}
                onChange={handleChange}
                disabled={!editing}
                className="cycle-form-input"
                required
              />
              <small className="cycle-form-input-small">
                Minimum hours for half day (e.g., 04:30 = 4.5 hours)
              </small>
            </div>
          </div>
        </div>

        <div className="cycle-shift-timings-card">
          <div className="cycle-section-title">
            <FiCalendar style={{ marginRight: '8px', display: 'inline' }} />
            Cycle Dates
          </div>
          
          <div className="cycle-form-grid">
            <div className="cycle-form-group">
              <label>Cycle Start Date (Day)</label>
              <input
                type="number"
                name="attendance_cycle_start_date"
                value={formData.attendance_cycle_start_date}
                onChange={handleChange}
                disabled={!editing}
                className="cycle-form-input"
                min="1"
                max="31"
                required
              />
              <small className="cycle-form-input-small">
                Day of month when cycle starts (1-31)
              </small>
            </div>

            <div className="cycle-form-group">
              <label>Cycle End Date (Day)</label>
              <input
                type="number"
                name="attendance_cycle_end_date"
                value={formData.attendance_cycle_end_date}
                onChange={handleChange}
                disabled={!editing}
                className="cycle-form-input"
                min="1"
                max="31"
                required
              />
              <small className="cycle-form-input-small">
                Day of month when cycle ends (1-31). Use cross-month cycle (e.g., 26-25 means Nov 26 to Dec 25)
              </small>
            </div>
          </div>
        </div>

        <div className="cycle-shift-timings-card">
          <div className="cycle-section-title">
            <FiBell style={{ marginRight: '8px', display: 'inline' }} />
            Notification Settings
          </div>
          
          <div className="cycle-form-grid">
          <div className="cycle-form-group">
            <label>Birthdays Send Day</label>
            <select
              value={formData.birthdays_send?.day || ''}
              onChange={(e) => handleNotificationChange('birthdays_send', 'day', e.target.value)}
              disabled={!editing}
              className="cycle-form-input"
            >
              <option value="">None</option>
              <option value="Sunday">Sunday</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Everyday">Everyday</option>
            </select>
            <small className="cycle-form-input-small">
              Select the day to send birthday notifications
            </small>
          </div>

          <div className="cycle-form-group">
            <label>Birthdays Send Time</label>
            <div className="time-input-wrapper">
              <input
                type="time"
                value={formData.birthdays_send?.time || ''}
                onChange={(e) => handleNotificationChange('birthdays_send', 'time', e.target.value)}
                disabled={!editing || !formData.birthdays_send?.day || formData.birthdays_send?.day === ''}
                className="cycle-form-input"
                placeholder="Select time"
              />
              <FiClock className="time-icon" />
            </div>
            <small className="cycle-form-input-small">
              {formData.birthdays_send?.day && formData.birthdays_send?.day !== '' 
                ? 'Time to send birthday notifications (00:00 - 23:59)'
                : 'Please select a day first to enable time selection'}
            </small>
          </div>

          <div className="cycle-form-group">
            <label>Anniversaries Send Day</label>
            <select
              value={formData.anniversaries_send?.day || ''}
              onChange={(e) => handleNotificationChange('anniversaries_send', 'day', e.target.value)}
              disabled={!editing}
              className="cycle-form-input"
            >
              <option value="">None</option>
              <option value="Sunday">Sunday</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Everyday">Everyday</option>
            </select>
            <small className="cycle-form-input-small">
              Select the day to send anniversary notifications
            </small>
          </div>

          <div className="cycle-form-group">
            <label>Anniversaries Send Time</label>
            <div className="time-input-wrapper">
              <input
                type="time"
                value={formData.anniversaries_send?.time || ''}
                onChange={(e) => handleNotificationChange('anniversaries_send', 'time', e.target.value)}
                disabled={!editing || !formData.anniversaries_send?.day || formData.anniversaries_send?.day === ''}
                className="cycle-form-input"
                placeholder="Select time"
              />
              <FiClock className="time-icon" />
            </div>
            <small className="cycle-form-input-small">
              {formData.anniversaries_send?.day && formData.anniversaries_send?.day !== '' 
                ? 'Time to send anniversary notifications (00:00 - 23:59)'
                : 'Please select a day first to enable time selection'}
            </small>
          </div>

          <div className="cycle-form-group">
            <label>Weekly Attendance Send Day</label>
            <select
              value={formData.weekly_attendance_send?.day || ''}
              onChange={(e) => handleNotificationChange('weekly_attendance_send', 'day', e.target.value)}
              disabled={!editing}
              className="cycle-form-input"
            >
              <option value="">None</option>
              <option value="Sunday">Sunday</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Everyday">Everyday</option>
            </select>
            <small className="cycle-form-input-small">
              Select the day to send weekly attendance reports
            </small>
          </div>

          <div className="cycle-form-group">
            <label>Weekly Attendance Send Time</label>
            <div className="time-input-wrapper">
              <input
                type="time"
                value={formData.weekly_attendance_send?.time || ''}
                onChange={(e) => handleNotificationChange('weekly_attendance_send', 'time', e.target.value)}
                disabled={!editing || !formData.weekly_attendance_send?.day || formData.weekly_attendance_send?.day === ''}
                className="cycle-form-input"
                placeholder="Select time"
              />
              <FiClock className="time-icon" />
            </div>
            <small className="cycle-form-input-small">
              {formData.weekly_attendance_send?.day && formData.weekly_attendance_send?.day !== '' 
                ? 'Time to send weekly attendance reports (00:00 - 23:59)'
                : 'Please select a day first to enable time selection'}
            </small>
          </div>
          </div>
        </div>

        {cycle && (
          <div className="cycle-info-card">
            <h3>
              <FiInfo style={{ marginRight: '8px' }} />
              Cycle Information
            </h3>
            <div className="cycle-info-grid">
              <div className="cycle-info-item">
                <strong>Created At</strong>
                <span>{new Date(cycle.created_at).toLocaleString()}</span>
              </div>
              <div className="cycle-info-item">
                <strong>Cycle Range</strong>
                <span>{cycle.attendance_cycle_start_date} - {cycle.attendance_cycle_end_date}</span>
              </div>
              <div className="cycle-info-item">
                <strong>Shift Timing</strong>
                <span>{cycle.shift_start_time} - {cycle.shift_end_time}</span>
              </div>
              <div className="cycle-info-item">
                <strong>Late Log Time</strong>
                <span>{cycle.late_log_time}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceCycle;

