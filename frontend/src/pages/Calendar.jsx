import { useState, useEffect, useRef } from 'react';
import { 
  FiClock, FiVideo, FiCalendar, FiChevronLeft, FiChevronRight, 
  FiPlus, FiCheckSquare, FiX, FiSearch, FiChevronDown
} from 'react-icons/fi';
import { meetingsAPI, tasksAPI, usersAPI, projectsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import DatePicker from '../components/DatePicker';
import toast from 'react-hot-toast';
import './Calendar.css';

// Searchable Select Component
const SearchableSelect = ({ value, onChange, options, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const filteredOptions = options.filter(opt => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (opt.label || '').toLowerCase().includes(search) || 
           (opt.searchText || opt.label || '').toLowerCase().includes(search);
  });

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="searchable-select" ref={dropdownRef}>
      <div
        className={`searchable-select-trigger ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <input
          type="text"
          readOnly
          value={selectedOption?.label || placeholder || 'Select...'}
          placeholder={placeholder}
          disabled={disabled}
          className="searchable-select-input"
        />
        <FiChevronDown className={`searchable-select-arrow ${isOpen ? 'open' : ''}`} />
      </div>
      {isOpen && (
        <div className="searchable-select-dropdown">
          <div className="searchable-select-search">
            <FiSearch />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              autoFocus
              className="searchable-select-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="searchable-select-clear"
              >
                <FiX size={14} />
              </button>
            )}
          </div>
          <div className="searchable-select-options">
            {filteredOptions.length === 0 ? (
              <div className="searchable-select-no-results">No results found</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`searchable-select-option ${value === option.value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Calendar = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState({}); // Meetings by date
  const [tasksData, setTasksData] = useState({}); // Tasks by date
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalDate, setAddModalDate] = useState(null);
  const [addModalType, setAddModalType] = useState(null); // 'meeting' or 'task'
  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [managers, setManagers] = useState([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [useManualProject, setUseManualProject] = useState(false);
  const [manualProjectName, setManualProjectName] = useState('');
  
  // Meeting form data
  const [meetingFormData, setMeetingFormData] = useState({
    title: '',
    description: '',
    meeting_datetime: '',
    duration_minutes: 60,
    participants: [],
    meeting_type: 'online',
    platform: 'gmeet',
    link: '',
    location: ''
  });
  
  // Task form data
  const [taskFormData, setTaskFormData] = useState({
    project_id: '',
    title: '',
    description: '',
    priority: 'medium',
    assigned_to_id: '',
    assigned_by_id: '',
    start_date: '',
    due_date: '',
    estimated_days: ''
  });
  const [estimatedDaysManuallyEdited, setEstimatedDaysManuallyEdited] = useState(false);

  useEffect(() => {
    fetchCalendarData();
    fetchUpcoming();
    fetchProjects();
    fetchEmployees();
    if (user?.role === 'Admin') {
      fetchManagers();
    }
  }, [currentDate, user]);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const [meetingsRes, tasksRes] = await Promise.all([
        meetingsAPI.getCalendar(month, year),
        tasksAPI.getCalendar(month, year)
      ]);
      setCalendarData(meetingsRes.data || {});
      setTasksData(tasksRes.data || {});
      
      // Set current date if viewing current month
      const today = new Date();
      if (currentDate.getMonth() === today.getMonth() && 
          currentDate.getFullYear() === today.getFullYear() && 
          !selectedDate) {
        setSelectedDate(getDateKeyFromDate(today));
      }
    } catch (error) {
      console.error('Error fetching calendar:', error);
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await projectsAPI.getAll();
      setProjects(response.data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await usersAPI.getEmployees();
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchManagers = async () => {
    try {
      const response = await usersAPI.getManagers();
      setManagers(response.data || []);
    } catch (error) {
      console.error('Error fetching managers:', error);
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

  const handleAddClick = (e, dateKey) => {
    e.stopPropagation();
    // Prevent creating events on past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(dateKey);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      toast.error('Cannot create events for past dates');
      return;
    }
    
    setAddModalDate(dateKey);
    setShowAddModal(true);
  };

  const handleAddTypeSelect = (type) => {
    setAddModalType(type);
    if (type === 'meeting') {
      const dateTime = new Date(addModalDate + 'T09:00');
      setMeetingFormData({
        ...meetingFormData,
        meeting_datetime: dateTime.toISOString().slice(0, 16)
      });
    } else if (type === 'task') {
      setTaskFormData({
        ...taskFormData,
        due_date: addModalDate
      });
    }
  };

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!meetingFormData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!meetingFormData.meeting_datetime) {
      toast.error('Date & Time is required');
      return;
    }
    if (meetingFormData.meeting_type === 'online' && meetingFormData.platform !== 'gmeet' && !meetingFormData.link.trim()) {
      toast.error('Meeting Link is required for non-Google Meet platforms');
      return;
    }
    if (meetingFormData.meeting_type === 'offline' && !meetingFormData.location.trim()) {
      toast.error('Location is required for offline meetings');
      return;
    }
    
    setCreatingMeeting(true);
    try {
      const data = {
        ...meetingFormData,
        meeting_datetime: new Date(meetingFormData.meeting_datetime).toISOString(),
        link: meetingFormData.meeting_type === 'online' && meetingFormData.platform !== 'gmeet' 
          ? meetingFormData.link 
          : null
      };
      await meetingsAPI.create(data);
      toast.success('Meeting created successfully');
      setShowAddModal(false);
      setAddModalType(null);
      setAddModalDate(null);
      resetMeetingForm();
      setParticipantSearch('');
      fetchCalendarData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create meeting');
    } finally {
      setCreatingMeeting(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!taskFormData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    
    setCreatingTask(true);
    try {
      const data = {
        ...taskFormData,
        project_id: taskFormData.project_id ? parseInt(taskFormData.project_id) : null,
        assigned_to_id: taskFormData.assigned_to_id ? parseInt(taskFormData.assigned_to_id) : null,
        assigned_by_id: taskFormData.assigned_by_id ? parseInt(taskFormData.assigned_by_id) : (user?.id || null),
        estimated_days: taskFormData.estimated_days ? parseInt(taskFormData.estimated_days) : null
      };
      // If no project selected but a manual name provided, attach to description
      if (!data.project_id && manualProjectName) {
        data.description = `${manualProjectName} | ${data.description || ''}`.trim();
      }
      await tasksAPI.create(data);
      toast.success('Task created successfully');
      setShowAddModal(false);
      setAddModalType(null);
      setAddModalDate(null);
      resetTaskForm();
      fetchCalendarData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create task');
    } finally {
      setCreatingTask(false);
    }
  };

  const toggleParticipant = (emp) => {
    const exists = meetingFormData.participants.some(p => p.empid === emp.empid);
    if (exists) {
      setMeetingFormData({
        ...meetingFormData,
        participants: meetingFormData.participants.filter(p => p.empid !== emp.empid)
      });
    } else {
      setMeetingFormData({
        ...meetingFormData,
        participants: [...meetingFormData.participants, {
          empid: emp.empid,
          name: emp.name,
          image_base64: emp.image_base64
        }]
      });
    }
  };

  const resetMeetingForm = () => {
    setMeetingFormData({
      title: '',
      description: '',
      meeting_datetime: '',
      duration_minutes: 60,
      participants: [],
      meeting_type: 'online',
      platform: 'gmeet',
      link: '',
      location: ''
    });
    setParticipantSearch('');
  };

  const resetTaskForm = () => {
    setTaskFormData({
      project_id: '',
      title: '',
      description: '',
      priority: 'medium',
      assigned_to_id: '',
      assigned_by_id: '',
      start_date: '',
      due_date: '',
      estimated_days: ''
    });
    setEstimatedDaysManuallyEdited(false);
    setUseManualProject(false);
    setManualProjectName('');
  };

  const renderCalendarDays = () => {
    return calendarDays.map((dayObj, index) => {
      const dateKey = getDateKeyFromDate(dayObj.date);
      const dayMeetings = calendarData[dateKey] || [];
      const dayTasks = tasksData[dateKey] || [];
      const meetingsCount = dayMeetings.length;
      const tasksCount = dayTasks.length;
      const totalEvents = meetingsCount + tasksCount;
      const hasEvents = totalEvents > 0;
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
            <div className="event-counts">
              {meetingsCount > 0 && (
                <div className="event-count-badge meetings-badge" title={`${meetingsCount} Meeting${meetingsCount !== 1 ? 's' : ''}`}>
                  <FiVideo size={10} />
                  {meetingsCount}
                </div>
              )}
              {tasksCount > 0 && (
                <div className="event-count-badge tasks-badge" title={`${tasksCount} Task${tasksCount !== 1 ? 's' : ''}`}>
                  <FiCheckSquare size={10} />
                  {tasksCount}
                </div>
              )}
            </div>
          )}
          {user?.role !== 'Employee' && (
          <button
            className="add-event-btn"
            onClick={(e) => handleAddClick(e, dateKey)}
            title="Add Meeting or Task"
          >
            <FiPlus size={16} />
          </button>
          )}
        </div>
      );
    });
  };

  const selectedMeetings = selectedDate ? (calendarData[selectedDate] || []) : [];
  const selectedTasks = selectedDate ? (tasksData[selectedDate] || []) : [];
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

      {/* Selected Date Meetings and Tasks */}
      {selectedDate && (
        <div className="day-cards-section">
          <div className="day-cards-grid">
            {/* Meetings Card */}
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

            {/* Tasks Card */}
            <div className="day-card current">
              <div className="day-card-header">
                <div className="day-info">
                  <span className="day-name">Tasks Due</span>
                </div>
                <div className="meeting-count">
                  <span className="count">{selectedTasks.length}</span>
                  <span className="label">Task{selectedTasks.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="day-card-body">
                {selectedTasks.length === 0 ? (
                  <p className="no-events">No tasks due on this date</p>
                ) : (
                  <div className="day-tasks-list">
                    {selectedTasks.map((task, idx) => (
                      <div key={idx} className="day-task-item">
                        <div className="task-priority-badge" style={{
                          background: task.priority === 'urgent' ? '#ef4444' : 
                                     task.priority === 'high' ? '#f59e0b' : 
                                     task.priority === 'medium' ? '#3b82f6' : '#10b981'
                        }}>
                          {task.priority?.charAt(0).toUpperCase() || 'M'}
                        </div>
                        <div className="task-details">
                          <h5>{task.title}</h5>
                          {task.description && (
                            <p>{task.description.substring(0, 80)}...</p>
                          )}
                          <div className="task-meta">
                            <span className={`status-badge status-${task.status}`}>
                              {task.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Meeting/Task Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setAddModalType(null);
          setAddModalDate(null);
          resetMeetingForm();
          resetTaskForm();
        }}
        title={addModalType ? (addModalType === 'meeting' ? 'Add Meeting' : 'Add Task') : 'Add Event'}
        size="large"
      >
        {!addModalType ? (
          <div className="add-type-selector">
            <button
              className="add-type-btn"
              onClick={() => handleAddTypeSelect('meeting')}
            >
              <FiVideo size={24} />
              <span>Add Meeting</span>
            </button>
            <button
              className="add-type-btn"
              onClick={() => handleAddTypeSelect('task')}
            >
              <FiCheckSquare size={24} />
              <span>Add Task</span>
            </button>
          </div>
        ) : addModalType === 'meeting' ? (
          <form onSubmit={handleCreateMeeting}>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input
                type="text"
                className="form-input"
                value={meetingFormData.title}
                onChange={(e) => setMeetingFormData({ ...meetingFormData, title: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                value={meetingFormData.description}
                onChange={(e) => setMeetingFormData({ ...meetingFormData, description: e.target.value })}
                rows="3"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date & Time *</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={meetingFormData.meeting_datetime}
                  onClick={(e) => e.target.showPicker?.()}
                  onChange={(e) => setMeetingFormData({ ...meetingFormData, meeting_datetime: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Duration (minutes)</label>
                <input
                  type="number"
                  className="form-input"
                  value={meetingFormData.duration_minutes}
                  onChange={(e) => setMeetingFormData({ ...meetingFormData, duration_minutes: parseInt(e.target.value) })}
                  min="15"
                  step="15"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Meeting Type *</label>
                <select
                  className="form-select"
                  value={meetingFormData.meeting_type}
                  onChange={(e) => setMeetingFormData({ ...meetingFormData, meeting_type: e.target.value })}
                >
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
              {meetingFormData.meeting_type === 'online' && (
                <div className="form-group">
                  <label className="form-label">Platform</label>
                  <select
                    className="form-select"
                    value={meetingFormData.platform}
                    onChange={(e) => setMeetingFormData({ ...meetingFormData, platform: e.target.value })}
                  >
                    <option value="gmeet">Google Meet (Auto)</option>
                    <option value="zoom">Zoom</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              )}
            </div>
            {meetingFormData.meeting_type === 'online' && meetingFormData.platform !== 'gmeet' && (
              <div className="form-group">
                <label className="form-label">Meeting Link *</label>
                <input
                  type="url"
                  className="form-input"
                  value={meetingFormData.link}
                  onChange={(e) => setMeetingFormData({ ...meetingFormData, link: e.target.value })}
                  required={meetingFormData.platform !== 'gmeet'}
                />
              </div>
            )}
            {meetingFormData.meeting_type === 'offline' && (
              <div className="form-group">
                <label className="form-label">Location *</label>
                <input
                  type="text"
                  className="form-input"
                  value={meetingFormData.location}
                  onChange={(e) => setMeetingFormData({ ...meetingFormData, location: e.target.value })}
                  required
                />
              </div>
            )}
            
            <div className="form-group">
              <label className="form-label">Participants</label>
              <div className="participants-search-container">
                <div className="participants-search">
                  <FiSearch />
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="participants-search-input"
                  />
                  {participantSearch && (
                    <button
                      type="button"
                      onClick={() => setParticipantSearch('')}
                      className="participants-search-clear"
                    >
                      <FiX size={14} />
                    </button>
                  )}
                </div>
                {meetingFormData.participants.length > 0 && (
                  <div className="selected-participants">
                    {meetingFormData.participants.map((p) => (
                      <div key={p.empid} className="selected-participant-chip">
                        <div className="avatar avatar-xs">
                          {p.image_base64 ? (
                            <img src={p.image_base64} alt={p.name} />
                          ) : (
                            p.name?.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span>{p.name}</span>
                        <button
                          type="button"
                          onClick={() => toggleParticipant({ empid: p.empid, name: p.name, image_base64: p.image_base64 })}
                          className="remove-participant-btn"
                        >
                          <FiX size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="participants-selector">
                  {employees
                    .filter((emp) => {
                      if (!participantSearch) return true;
                      const search = participantSearch.toLowerCase();
                      return (emp.name || '').toLowerCase().includes(search) || 
                             (emp.empid || '').toLowerCase().includes(search) ||
                             (emp.email || '').toLowerCase().includes(search);
                    })
                    .map((emp) => {
                      const isSelected = meetingFormData.participants.some(p => p.empid === emp.empid);
                      return (
                        <div 
                          key={emp.empid} 
                          className={`participant-chip ${isSelected ? 'selected' : ''}`}
                          onClick={() => toggleParticipant(emp)}
                        >
                          <div className="avatar avatar-sm">
                            {emp.image_base64 ? (
                              <img src={emp.image_base64} alt={emp.name} />
                            ) : (
                              emp.name?.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span>{emp.name} ({emp.empid})</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => {
                setShowAddModal(false);
                setAddModalType(null);
                resetMeetingForm();
              }}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={creatingMeeting}>
                {creatingMeeting ? 'Creating...' : 'Create Meeting'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleCreateTask}>
            <div className="form-group">
              <label className="form-label">Task Title *</label>
              <input
                type="text"
                className="form-input"
                value={taskFormData.title}
                onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                placeholder="Enter task title"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                placeholder="Task description"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Project</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {!useManualProject ? (
                  <>
                    <select
                      className="form-select"
                      style={{ flex: 1 }}
                      value={taskFormData.project_id}
                      onChange={(e) => {
                        const project_id = e.target.value;
                        // Reset assignee if not in new project's team
                        const newProject = projects.find((p) => p.id === (project_id ? parseInt(project_id) : null));
                        const teamEmpids = newProject?.teams?.map((m) => m.empid) || [];
                        const assigneeValid = !project_id || !taskFormData.assigned_to_id
                          ? true
                          : (() => {
                              const currentAssignee = employees.find(emp => emp.id === parseInt(taskFormData.assigned_to_id));
                              return currentAssignee ? teamEmpids.includes(currentAssignee.empid) : false;
                            })();

                        setTaskFormData({
                          ...taskFormData,
                          project_id,
                          assigned_to_id: assigneeValid ? taskFormData.assigned_to_id : ''
                        });
                      }}
                    >
                      <option value="">No Project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setUseManualProject(true);
                        setTaskFormData({ ...taskFormData, project_id: '' });
                      }}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      Enter manually
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1 }}
                      value={manualProjectName}
                      onChange={(e) => setManualProjectName(e.target.value)}
                      placeholder="Enter project name"
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setUseManualProject(false);
                        setManualProjectName('');
                      }}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      Select Project
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Assign To</label>
                <SearchableSelect
                  value={taskFormData.assigned_to_id}
                  onChange={(value) => setTaskFormData({ ...taskFormData, assigned_to_id: value })}
                  options={[
                    { value: '', label: 'Unassigned' },
                    ...(() => {
                      const selectedProject = projects.find((p) => p.id === (taskFormData.project_id ? parseInt(taskFormData.project_id) : null));
                      const projectTeamEmpids = selectedProject?.teams?.map((m) => m.empid).filter(Boolean) || [];
                      const availableAssignees = taskFormData.project_id
                        ? employees.filter((emp) => projectTeamEmpids.includes(emp.empid))
                        : employees;
                      return availableAssignees.map((emp) => ({
                        value: emp.id.toString(),
                        label: `${emp.name} (${emp.empid})`,
                        searchText: `${emp.name} ${emp.empid}`
                      }));
                    })()
                  ]}
                  placeholder="Search employee..."
                />
              </div>
              {user?.role === 'Admin' && (
                <div className="form-group">
                  <label className="form-label">Assigned By (Manager)</label>
                  <select
                    className="form-select"
                    value={taskFormData.assigned_by_id}
                    onChange={(e) => setTaskFormData({ ...taskFormData, assigned_by_id: e.target.value })}
                  >
                    <option value="">Select Manager</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name} ({manager.empid})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select
                  className="form-select"
                  value={taskFormData.priority}
                  onChange={(e) => setTaskFormData({ ...taskFormData, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <DatePicker
                  value={taskFormData.start_date}
                  onChange={(date) => {
                    const newStartDate = date || '';
                    let newEstimatedDays = taskFormData.estimated_days;
                    let newDueDate = taskFormData.due_date;
                    
                    // Validate: due date cannot be before start date
                    if (newStartDate && taskFormData.due_date) {
                      const start = new Date(newStartDate);
                      const due = new Date(taskFormData.due_date);
                      if (due < start) {
                        toast.error('Due date cannot be before start date');
                        newDueDate = ''; // Clear due date if invalid
                      } else if (!estimatedDaysManuallyEdited) {
                        // Auto-calculate estimated days only if user hasn't manually edited it
                        const diffTime = due - start;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays > 0) {
                          newEstimatedDays = diffDays.toString();
                        }
                      }
                    }
                    
                    setTaskFormData({ ...taskFormData, start_date: newStartDate, due_date: newDueDate, estimated_days: newEstimatedDays });
                  }}
                  placeholder="Select start date"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date</label>
                <DatePicker
                  value={taskFormData.due_date}
                  onChange={(date) => {
                    const newDueDate = date || '';
                    let newEstimatedDays = taskFormData.estimated_days;
                    
                    // Validate: due date cannot be before start date
                    if (taskFormData.start_date && newDueDate) {
                      const start = new Date(taskFormData.start_date);
                      const due = new Date(newDueDate);
                      if (due < start) {
                        toast.error('Due date cannot be before start date');
                        return; // Don't update if invalid
                      }
                      
                      // Auto-calculate estimated days only if user hasn't manually edited it
                      if (!estimatedDaysManuallyEdited) {
                        const diffTime = due - start;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays > 0) {
                          newEstimatedDays = diffDays.toString();
                        }
                      }
                    }
                    
                    setTaskFormData({ ...taskFormData, due_date: newDueDate, estimated_days: newEstimatedDays });
                  }}
                  placeholder="Select due date"
                  min={taskFormData.start_date || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Estimated Days</label>
              <input
                type="number"
                className="form-input"
                value={taskFormData.estimated_days}
                onChange={(e) => {
                  setEstimatedDaysManuallyEdited(true);
                  setTaskFormData({ ...taskFormData, estimated_days: e.target.value });
                }}
                onKeyDown={(e) => {
                  // Track manual edits via arrow keys
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    setEstimatedDaysManuallyEdited(true);
                  }
                }}
                placeholder="Auto-calculated from dates or enter manually"
                min="1"
              />
              <small className="form-hint">
                {taskFormData.start_date && taskFormData.due_date && !estimatedDaysManuallyEdited
                  ? `Auto-calculated: ${Math.ceil((new Date(taskFormData.due_date) - new Date(taskFormData.start_date)) / (1000 * 60 * 60 * 24))} days`
                  : 'Enter manually or select start and due dates to auto-calculate'}
              </small>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => {
                setShowAddModal(false);
                setAddModalType(null);
                resetTaskForm();
              }}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={creatingTask}>
                {creatingTask ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        )}
      </Modal>

    </div>
  );
};

export default Calendar;
