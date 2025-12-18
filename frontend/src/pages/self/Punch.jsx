import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiClock, FiCamera, FiX } from 'react-icons/fi';
import '../employee/Employee.css';
import './Punch.css';

const Punch = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [todayPunches, setTodayPunches] = useState([]);
  const [punchHistory, setPunchHistory] = useState([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // total for today
  const [baseElapsed, setBaseElapsed] = useState(0); // completed elapsed (seconds)
  const [runningStart, setRunningStart] = useState(null); // Date when current run started
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [leaves, setLeaves] = useState([]);
  const [weekOffDates, setWeekOffDates] = useState([]);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    fetchTodayPunches();
    fetchPunchHistory();
    fetchLeaves();
    fetchWeekOffDates();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (runningStart) {
      timerIntervalRef.current = setInterval(() => {
        const now = new Date();
        const running = Math.max(0, Math.floor((now - runningStart) / 1000));
        setElapsedSeconds(baseElapsed + running);
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [runningStart, baseElapsed]);

  useEffect(() => {
    fetchPunchHistory();
    fetchLeaves();
    fetchWeekOffDates();
  }, [selectedMonth, selectedYear]);

  const fetchLeaves = async () => {
    try {
      const response = await api.get('/leaves/self');
      setLeaves(response.data || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      setLeaves([]);
    }
  };

  const fetchWeekOffDates = async () => {
    try {
      const response = await api.get(`/week-offs/dates?employee_id=${user?.empid}&month=${selectedMonth + 1}&year=${selectedYear}`);
      const dates = response.data || [];
      setWeekOffDates(dates.map(d => d.date || d));
    } catch (error) {
      console.error('Error fetching week off dates:', error);
      setWeekOffDates([]);
    }
  };

  const fetchTodayPunches = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get(`/attendance/today-punches?date=${today}`);
      const punches = response.data || [];
      setTodayPunches(punches);
      let total = 0;
      let openStart = null;
      punches.forEach(p => {
        if (p.check_in && p.check_out) {
          total += Math.max(0, (new Date(p.check_out) - new Date(p.check_in)) / 1000);
        } else if (p.check_in && !p.check_out) {
          openStart = new Date(p.check_in);
        }
      });
      setBaseElapsed(Math.max(0, Math.floor(total)));
      if (openStart) {
        setRunningStart(openStart);
        const now = new Date();
        setElapsedSeconds(Math.max(0, Math.floor(total + (now - openStart) / 1000)));
      } else {
        setRunningStart(null);
        setElapsedSeconds(Math.max(0, Math.floor(total)));
      }
    } catch (error) {
      setTodayPunches([]);
      setElapsedSeconds(0);
      setBaseElapsed(0);
      setRunningStart(null);
    }
  };

  const fetchPunchHistory = async () => {
    try {
      const response = await api.get(`/attendance/punch-calendar?month=${selectedMonth + 1}&year=${selectedYear}`);
      setPunchHistory(response.data || []);
    } catch (error) {
      console.error('Error fetching punch history:', error);
      setPunchHistory([]);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      toast.error('Failed to access camera');
      console.error('Camera error:', error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);
      stopCamera();
    }
  };

  const handlePunchClick = () => {
    setShowCameraModal(true);
    setCapturedImage(null);
    startCamera();
  };

  const handleCancelCamera = () => {
    stopCamera();
    setShowCameraModal(false);
    setCapturedImage(null);
  };

  const handleSubmitPunch = async (punchType) => {
    if (!capturedImage) {
      toast.error('Please capture an image first');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`/attendance/punch-${punchType}`, {
        image: capturedImage
      });
      
      toast.success(`Punched ${punchType === 'in' ? 'In' : 'Out'} successfully`);
      setShowCameraModal(false);
      setCapturedImage(null);
      fetchTodayPunches();
      fetchPunchHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to punch ${punchType}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      month: 'short',
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getCalendarStatus = (dayData, dateStr) => {
    // Check if it's a week off (WO takes priority)
    if (weekOffDates.includes(dateStr)) {
      return { status: 'WO', color: '#8b5cf6', cls: 'cal-weekoff' };
    }
    
    // Check if it's a leave
    const leave = leaves.find(l => {
      const fromDate = new Date(l.from_date);
      const toDate = new Date(l.to_date);
      const checkDate = new Date(dateStr);
      return checkDate >= fromDate && checkDate <= toDate && l.status === 'approved';
    });
    
    if (leave) {
      return { status: leave.leave_type?.substring(0, 3).toUpperCase() || 'L', color: '#3b82f6', cls: 'cal-leave', leaveType: leave.leave_type };
    }
    
    // Calculate status based on hours (Max - Min time)
    // Hours already calculated in backend from punch logs
    if (!dayData || dayData.hours === undefined || dayData.hours === null) {
      return { status: 'Abs', color: '#ef4444', cls: 'cal-abs' };
    }
    
    const hours = parseFloat(dayData.hours);
    if (hours >= 9) {
      return { status: 'P', color: '#10b981', cls: 'cal-present' };
    } else if (hours >= 4.5) {
      return { status: 'H/D', color: '#f59e0b', cls: 'cal-half' };
    } else {
      return { status: 'Abs', color: '#ef4444', cls: 'cal-abs' };
    }
  };

  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const firstDay = getFirstDayOfMonth(selectedMonth, selectedYear);
    const days = [];
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = punchHistory.find(h => h.date === dateStr);
      const status = getCalendarStatus(dayData, dateStr);
      
      days.push(
        <div key={day} className={`calendar-day ${status.cls}`}>
          <div className="calendar-day-number">{day}</div>
          <div className="calendar-day-info">
            <div className="calendar-status" style={{ color: status.color }}>
              {status.status}
            </div>
            {status.leaveType && (
              <div className="calendar-leave-type" style={{ fontSize: '0.65rem', color: status.color, marginTop: '2px' }}>
                {status.leaveType}
              </div>
            )}
            {dayData && dayData.hours !== undefined && dayData.hours !== null && status.cls !== 'cal-weekoff' && status.cls !== 'cal-leave' && (
              <>
                <div className="calendar-hours-bottom">
                  {parseFloat(dayData.hours).toFixed(1)}H
                </div>
              </>
            )}
          </div>
        </div>
      );
    }
    
    return days;
  };

  const targetSeconds = 9 * 3600;
  const progressRatio = Math.min(1, elapsedSeconds / targetSeconds);
  const firstPunchTime = todayPunches.length > 0 ? todayPunches[0]?.check_in : null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h1>Punch In/Out</h1>
          {user && user.role === 'Employee' && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '8px 16px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              borderRadius: '8px',
              border: '1px solid rgba(99, 102, 241, 0.2)'
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                Employee({user.empid || 'UL'})
              </span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Punch Card */}
        <div className="form-container punch-attendance-card">
          <div className="attendance-header">
            <div className="attendance-icon-wrapper">
              <FiClock className="attendance-icon" />
            </div>
            <div className="attendance-info">
              <h2 className="attendance-title">Today's Attendance</h2>
              <div className="attendance-date">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div className="attendance-entry-time">
                Entry Time: {firstPunchTime ? formatDateTime(firstPunchTime) : 'Not yet'}
              </div>
            </div>
          </div>

          {/* Timer with Linear Progress */}
          <div style={{ marginBottom: '24px', width: '100%', maxWidth: '520px', marginInline: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              <span>Worked</span>
              <span>{formatTime(elapsedSeconds)} / 09:00:00</span>
            </div>
            <div style={{ position: 'relative', height: '18px', width: '100%', background: 'var(--bg-hover)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${progressRatio * 100}%`,
                  background: progressRatio >= 1 ? '#16a34a' : '#10b981',
                  transition: 'width 0.3s ease',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: `${progressRatio * 100}%`,
                  top: 0,
                  bottom: 0,
                  right: 0,
                  background: progressRatio >= 1 ? '#16a34a' : '#ef4444',
                  opacity: progressRatio >= 1 ? 0.15 : 0.35,
                  transition: 'left 0.3s ease'
                }}
              />
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Remaining to 9h: {formatTime(Math.max(0, Math.floor(targetSeconds - elapsedSeconds)))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
            {todayPunches.length === 0 || todayPunches[todayPunches.length - 1]?.check_out ? (
              <button 
                className="btn-primary" 
                onClick={handlePunchClick}
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? 'Processing...' : 'Punch In'}
              </button>
            ) : (
              <button 
                className="btn-primary" 
                onClick={handlePunchClick}
                disabled={loading}
                style={{ flex: 1, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
              >
                {loading ? 'Processing...' : 'Punch Out'}
              </button>
            )}
          </div>
        </div>

        {/* Today's Punches list */}
        <div className="form-container" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)', border: '2px solid rgba(99, 102, 241, 0.2)' }}>
          <h3 style={{ marginBottom: '20px', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiClock style={{ color: 'var(--primary)' }} /> Today's Punches
          </h3>
          <div className="punches-scroll-container">
            {todayPunches.length === 0 ? (
              <div className="empty-state">
                <p>No punches today</p>
              </div>
            ) : (
              todayPunches.map((punch, index) => (
                <div key={punch.id || index} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '12px',
                  padding: '16px',
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(249, 250, 251, 0.8) 100%)',
                  borderRadius: '12px',
                  border: '2px solid rgba(99, 102, 241, 0.15)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.15)';
                }}
                >
                  <div>
                <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Punch {index + 1}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <strong>Punch In</strong>
                </div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: punch.check_out ? '6px' : '0' }}>
                  {formatDateTime(punch.check_in)}
                </div>
                {punch.check_out && (
                  <>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <strong>Punch Out</strong>
                    </div>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {formatDateTime(punch.check_out)}
                    </div>
                  </>
                )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    {punch.check_in_image && (
                      <img
                        src={punch.check_in_image}
                        alt="In"
                        style={{ width: '56px', height: '56px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                      />
                    )}
                    {punch.check_out_image && (
                      <img
                        src={punch.check_out_image}
                        alt="Out"
                        style={{ width: '56px', height: '56px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="form-container full-width-card punch-calendar-full" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.95) 100%)', border: '2px solid rgba(99, 102, 241, 0.15)', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Punch History Calendar</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(parseInt(e.target.value));
              }}
              className="form-select"
              style={{ width: '150px' }}
            >
              {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => (
                <option key={index} value={index}>{month}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(parseInt(e.target.value));
              }}
              className="form-select"
              style={{ width: '100px' }}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="calendar-container">
          <div className="calendar-header">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="calendar-header-day">{day}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {renderCalendar()}
          </div>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', gap: '16px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '2px' }}></div>
            <span>Present (≥9H)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '2px' }}></div>
            <span>Half Day (4.5H-8.59H)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px' }}></div>
            <span>Absent (&lt;4.5H)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', background: '#8b5cf6', borderRadius: '2px' }}></div>
            <span>Week Off (WO)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '2px' }}></div>
            <span>Leave</span>
          </div>
        </div>
      </div>

      {/* Camera Modal */}
      {showCameraModal && (
        <div className="modal-overlay" onClick={handleCancelCamera}>
          <div className="modal-content camera-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Capture Image</h3>
              <button className="modal-close" onClick={handleCancelCamera}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              {!capturedImage ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    style={{ width: '100%', maxWidth: '500px', borderRadius: '8px' }}
                  />
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                    <button className="btn-primary" onClick={captureImage}>
                      <FiCamera /> Capture
                    </button>
                    <button className="btn-secondary" onClick={handleCancelCamera}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <img 
                    src={capturedImage} 
                    alt="Captured" 
                    style={{ width: '100%', maxWidth: '500px', borderRadius: '8px', marginBottom: '16px' }}
                  />
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button 
                      className="btn-primary" 
                      onClick={() => {
                        const lastPunch = todayPunches[todayPunches.length - 1];
                        if (!lastPunch || lastPunch.check_out) {
                          handleSubmitPunch('in');
                        } else {
                          handleSubmitPunch('out');
                        }
                      }}
                      disabled={loading}
                    >
                      {loading ? 'Submitting...' : 'Submit'}
                    </button>
                    <button 
                      className="btn-secondary" 
                      onClick={() => {
                        setCapturedImage(null);
                        startCamera();
                      }}
                    >
                      Retake
                    </button>
                    <button className="btn-secondary" onClick={handleCancelCamera}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Punch;
