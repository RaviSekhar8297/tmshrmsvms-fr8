import { useState, useEffect } from 'react';
import { 
  FiClock, FiVideo, FiCalendar, FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import { meetingsAPI } from '../services/api';
import toast from 'react-hot-toast';
import './Calendar.css';

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({});
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Initialize with current date
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCalendarData();
    fetchUpcoming();
  }, [currentDate]);

  const fetchCalendarData = async () => {
    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const response = await meetingsAPI.getCalendar(month, year);
      setCalendarData(response.data);
      
      // Set current date if viewing current month
      const today = new Date();
      if (currentDate.getMonth() === today.getMonth() && 
          currentDate.getFullYear() === today.getFullYear() && 
          !selectedDate) {
        setSelectedDate(getDateKeyFromDate(today));
      }
    } catch (error) {
      console.error('Error fetching calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcoming = async () => {
    try {
      const response = await meetingsAPI.getUpcoming(7);
      setUpcomingMeetings(response.data);
    } catch (error) {
      console.error('Error fetching upcoming:', error);
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    return { daysInMonth, startingDay };
  };

  const navigateMonth = (direction) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const isToday = (day) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };
  
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(getDateKeyFromDate(today));
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDateKeyFromDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getMeetingsByDateKey = (dateKey) => {
    // Get meetings from calendar data
    return calendarData[dateKey] || [];
  };

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Calculate only current month days (no prev/next filler)
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return {
        date: new Date(year, month, day),
        isCurrentMonth: true,
        day
      };
    });
  };
  
  const calendarDays = getCalendarDays();

  const renderCalendarDays = () => {
    return calendarDays.map((dayObj, index) => {
      const dateKey = getDateKeyFromDate(dayObj.date);
      const dayMeetings = calendarData[dateKey] || [];
      const hasEvents = dayMeetings.length > 0;
      const isTodayDate = isToday(dayObj.day);
      const isSelected = selectedDate === dateKey;
      const weekday = dayNames[dayObj.date.getDay()];
      
      return (
        <div
          key={index}
          className={`calendar-day-card ${isTodayDate ? 'today' : ''} ${hasEvents ? 'has-events' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => setSelectedDate(dateKey)}
        >
          <div className="weekday-label">{weekday}</div>
          <div className="day-number-large">{dayObj.day}</div>
          {hasEvents && (
            <div className="event-count-badge">
              {dayMeetings.length}
            </div>
          )}
        </div>
      );
    });
  };

  const selectedMeetings = selectedDate ? (calendarData[selectedDate] || []) : [];
  const selectedList = selectedDate ? getMeetingsByDateKey(selectedDate) : [];
  const selectedDateLabel = selectedDate
    ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'Select a date';

  return (
    <div className="calendar-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">CALENDAR</h1>
          <p className="page-subtitle">View your scheduled meetings</p>
        </div>
      </div>

      {/* Full Month Calendar View */}
      <div className="calendar-section">
        <div className="calendar-card">
          <div className="calendar-header-nav">
            <button className="nav-btn" onClick={() => navigateMonth(-1)}>
              <FiChevronLeft />
            </button>
            <div className="calendar-month-year">
              <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
              <button className="today-btn" onClick={goToToday}>Today</button>
            </div>
            <button className="nav-btn" onClick={() => navigateMonth(1)}>
              <FiChevronRight />
            </button>
          </div>
          
          <div className="calendar-grid-container">
            <div className="calendar-grid">
              {renderCalendarDays()}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Date Meetings */}
      {selectedDate && (
        <div className="day-cards-section">
          <div className="day-cards-grid">
            <div className="day-card current">
              <div className="day-card-header">
                <div className="day-info">
                  <span className="day-name">{selectedDateLabel}</span>
                </div>
                <div className="meeting-count">
                  <span className="count">{selectedList.length}</span>
                  <span className="label">Meeting{selectedList.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="day-card-body">
                {selectedList.length === 0 ? (
                  <p className="no-events">No meetings scheduled</p>
                ) : (
                  <div className="day-meetings-list">
                    {selectedList.map((meeting, idx) => (
                      <div key={idx} className="day-meeting-item">
                        <div className="meeting-time-badge">
                          <FiClock />
                          {formatTime(meeting.meeting_datetime)}
                        </div>
                        <div className="meeting-details">
                          <h5>{meeting.title}</h5>
                          {meeting.description && (
                            <p>{meeting.description.substring(0, 80)}...</p>
                          )}
                        </div>
                        {meeting.meeting_type === 'offline' ? (
                          <div className="offline-badge">
                            Offline
                          </div>
                        ) : meeting.link ? (() => {
                          const now = new Date();
                          const meetingTime = new Date(meeting.meeting_datetime);
                          const duration = meeting.duration_minutes || 60;
                          const fiveMinutesBefore = new Date(meetingTime.getTime() - 5 * 60 * 1000);
                          const meetingEnd = new Date(meetingTime.getTime() + duration * 60 * 1000);
                          const canJoin = now >= fiveMinutesBefore && now < meetingEnd;
                          const isPast = now >= meetingEnd;
                          const startingSoon = now < fiveMinutesBefore;

                          if (isPast) {
                            return <div className="join-btn disabled">Closed</div>;
                          }
                          if (startingSoon) {
                            return <div className="join-btn disabled">Starting soon</div>;
                          }
                          return (
                            <a 
                              href={meeting.link} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="join-btn"
                            >
                              <FiVideo /> Join
                            </a>
                          );
                        })() : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Calendar;
