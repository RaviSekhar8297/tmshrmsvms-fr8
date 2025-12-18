import { useState, useEffect, useRef } from 'react';
import { 
  FiPlus, FiSearch, FiVideo, FiClock, FiUsers, 
  FiCalendar, FiEdit2, FiTrash2, FiExternalLink, FiX
} from 'react-icons/fi';
import { meetingsAPI, usersAPI, googleCalendarAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import './Meetings.css';

const Meetings = () => {
  const [meetings, setMeetings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [filter, setFilter] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetingNotes, setMeetingNotes] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [checkingCalendar, setCheckingCalendar] = useState(true);
  const notesPopupRef = useRef(null);
  const { isEmployee, user } = useAuth();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    meeting_datetime: '',
    duration_minutes: 60,
    participants: [],
    meeting_type: 'online',
    platform: 'gmeet',
    link: '',
    location: '',
    status: ''
  });

  useEffect(() => {
    fetchData();
    checkCalendarStatus();
  }, [filter]);

  const checkCalendarStatus = async () => {
    try {
      const response = await googleCalendarAPI.getStatus();
      setCalendarConnected(response.data.connected);
    } catch (error) {
      console.error('Error checking calendar status:', error);
      setCalendarConnected(false);
    } finally {
      setCheckingCalendar(false);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      const response = await googleCalendarAPI.getAuthUrl();
      const authUrl = response.data.authorization_url;
      // Open in same window to allow OAuth flow
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error connecting calendar:', error);
      toast.error('Failed to connect Google Calendar. Please check your credentials.');
    }
  };

  const fetchData = async () => {
    try {
      let meetingsRes;
      if (filter === 'upcoming') {
        meetingsRes = await meetingsAPI.getUpcoming(30);
      } else if (filter === 'today') {
        meetingsRes = await meetingsAPI.getToday();
      } else {
        meetingsRes = await meetingsAPI.getAll({ status: filter });
      }
      
      const employeesRes = await usersAPI.getEmployees();
      
      setMeetings(meetingsRes.data);
      setEmployees(employeesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const isOffline = formData.meeting_type === 'offline';

      const data = {
        ...formData,
        // Always send ISO with timezone to avoid date-shift issues in calendar
        meeting_datetime: formData.meeting_datetime ? new Date(formData.meeting_datetime).toISOString() : '',
        // If platform is gmeet, let backend generate link; otherwise send provided link (only for online)
        link: isOffline ? null : (formData.platform === 'gmeet' ? null : (formData.link || null)),
        location: isOffline ? formData.location : formData.location || null,
        status: formData.status || undefined
      };

      // Validate form data
      // Validate form data
      if (!isOffline && data.platform !== 'gmeet' && !data.link) {
        throw new Error('Please provide meeting link');
      }
      if (isOffline && !data.location) {
        throw new Error('Please provide meeting location/area for offline meeting');
      }
      // Block submission if trying to use Google Meet without calendar connection
      if (!isOffline && data.platform === 'gmeet' && !calendarConnected && !checkingCalendar) {
        const action = window.confirm(
          '⚠️ Google Calendar is not connected!\n\n' +
          'To create Google Meet links automatically, you need to connect your Google Calendar account.\n\n' +
          'Click OK to connect Google Calendar now.\n' +
          'Click Cancel to switch to a different platform (Zoom/Custom) and provide a meeting link manually.'
        );
        
        if (action) {
          // User wants to connect - redirect to OAuth
          handleConnectCalendar();
          setSubmitting(false);
          return;
        } else {
          // User cancelled - show error and stop submission
          toast.error(
            'Cannot create meeting with Google Meet (auto) without Google Calendar connection.\n\n' +
            'Please either:\n' +
            '1. Connect Google Calendar (click "Connect Google Calendar" button), OR\n' +
            '2. Change platform to "Zoom" or "Custom" and provide a meeting link',
            {
              duration: 8000,
              style: {
                maxWidth: '500px',
                whiteSpace: 'pre-line',
                fontSize: '14px'
              }
            }
          );
          setSubmitting(false);
          return;
        }
      }

      if (editingMeeting) {
        await meetingsAPI.update(editingMeeting.id, data);
        toast.success('Meeting updated successfully');
        // If meeting status is being set to completed, switch filter
        if (data.status === 'completed') {
          setFilter('completed');
        }
      } else {
        await meetingsAPI.create(data);
        toast.success('Meeting created successfully');
        // Refresh calendar status after creating meeting
        checkCalendarStatus();
      }
      
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to save meeting';
      console.error('Meeting creation error:', error);
      
      // Check if error is about Google Calendar
      if (errorMessage.includes('Google Calendar') || errorMessage.includes('Google Meet link') || errorMessage.includes('Failed to create')) {
        // Show detailed error with action buttons
        const shouldConnect = window.confirm(
          errorMessage + '\n\n' +
          'Would you like to connect Google Calendar now?\n\n' +
          'Click OK to connect, or Cancel to switch to a different platform (Zoom/Custom) and provide a meeting link manually.'
        );
        
        if (shouldConnect) {
          handleConnectCalendar();
        } else {
          toast.error(
            'Please either:\n' +
            '1. Connect Google Calendar (click button above), OR\n' +
            '2. Change platform to "Zoom" or "Custom" and provide a meeting link',
            {
              duration: 10000,
              style: {
                maxWidth: '500px',
                whiteSpace: 'pre-line',
                fontSize: '14px'
              }
            }
          );
        }
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (meeting) => {
    const datetime = new Date(meeting.meeting_datetime);
    const localDatetime = datetime.toISOString().slice(0, 16);
    
    setEditingMeeting(meeting);
    setFormData({
      title: meeting.title,
      description: meeting.description || '',
      meeting_datetime: localDatetime,
      duration_minutes: meeting.duration_minutes || 60,
      participants: meeting.participants || [],
      meeting_type: meeting.meeting_type || 'online',
      platform: meeting.meeting_type === 'offline' ? 'gmeet' : (meeting.link?.includes('zoom') ? 'zoom' : 'gmeet'),
      link: meeting.meeting_type === 'offline' ? '' : (meeting.link || ''),
      location: meeting.location || '',
      status: meeting.status || 'scheduled'
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this meeting?')) return;
    
    try {
      await meetingsAPI.delete(id);
      toast.success('Meeting deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete meeting');
    }
  };

  const toggleParticipant = (emp) => {
    const exists = formData.participants.some(p => p.empid === emp.empid);
    if (exists) {
      setFormData({
        ...formData,
        participants: formData.participants.filter(p => p.empid !== emp.empid)
      });
    } else {
      setFormData({
        ...formData,
        participants: [...formData.participants, {
          empid: emp.empid,
          name: emp.name,
          image_base64: emp.image_base64
        }]
      });
    }
  };

  const resetForm = () => {
    setEditingMeeting(null);
    setFormData({
      title: '',
      description: '',
      meeting_datetime: '',
      duration_minutes: 60,
      participants: [],
      meeting_type: 'online',
      platform: 'gmeet',
      link: '',
      location: '',
      status: ''
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'info';
      case 'ongoing': return 'success';
      case 'completed': return 'primary';
      case 'cancelled': return 'danger';
      default: return 'primary';
    }
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getJoinState = (meeting) => {
    const now = new Date();
    const start = new Date(meeting.meeting_datetime);
    const duration = meeting.duration_minutes || 60;
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const fiveMinutesBefore = new Date(start.getTime() - 5 * 60 * 1000);

    const isPast = now >= end;
    const canJoin = now >= fiveMinutesBefore && now < end;
    const startingSoon = now < fiveMinutesBefore;

    return { isPast, canJoin, startingSoon };
  };

  const handleMeetingCardClick = async (meeting, e) => {
    // Don't open popup if clicking on action buttons
    if (e.target.closest('.meeting-actions') || e.target.closest('.meeting-link') || e.target.closest('a')) {
      return;
    }
    
    setSelectedMeeting(meeting);
    setNotesLoading(true);
    try {
      const response = await meetingsAPI.getNotes(meeting.id);
      setMeetingNotes(response.data.notes || '');
    } catch (error) {
      console.error('Error fetching notes:', error);
      setMeetingNotes('');
    } finally {
      setNotesLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedMeeting) return;
    
    try {
      // Try to get existing notes first
      const existingNotesResponse = await meetingsAPI.getNotes(selectedMeeting.id);
      const existingNotes = existingNotesResponse.data;
      
      // If id is 0, it means notes don't exist, create new
      if (existingNotes && existingNotes.id === 0) {
        await meetingsAPI.saveNotes(selectedMeeting.id, meetingNotes);
      } else {
        // Update existing notes
        await meetingsAPI.updateNotes(selectedMeeting.id, meetingNotes);
      }
      
      toast.success('Notes saved successfully');
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error(error.response?.data?.detail || 'Failed to save notes');
    }
  };

  const handleCloseNotesPopup = () => {
    setSelectedMeeting(null);
    setMeetingNotes('');
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notesPopupRef.current && !notesPopupRef.current.contains(event.target)) {
        handleCloseNotesPopup();
      }
    };

    if (selectedMeeting) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedMeeting]);

  const filteredMeetings = meetings.filter(meeting =>
    meeting.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading meetings...</p>
      </div>
    );
  }

  return (
    <div className="meetings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">MEETINGS</h1>
          <p className="page-subtitle">Schedule and manage your meetings</p>
        </div>
        {!isEmployee && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <FiPlus /> Schedule Meeting
          </button>
        )}
      </div>

      {/* Google Calendar Connection Banner */}
      {!checkingCalendar && !calendarConnected && (
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <FiCalendar style={{ color: '#856404', fontSize: '20px' }} />
            <div>
              <strong style={{ color: '#856404' }}>Google Calendar Not Connected</strong>
              <p style={{ margin: '4px 0 0 0', color: '#856404', fontSize: '14px' }}>
                Connect your Google Calendar to automatically create real Google Meet links when scheduling meetings.
              </p>
            </div>
          </div>
          <button
            onClick={handleConnectCalendar}
            style={{
              background: '#ffc107',
              color: '#000',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Connect Google Calendar
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="meetings-filters">
        <div className="search-box" style={{ flex: 1, maxWidth: 300 }}>
          <FiSearch className="search-box-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Search meetings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          {['upcoming', 'today', 'scheduled', 'completed'].map((status) => (
            <button
              key={status}
              className={`filter-tab ${filter === status ? 'active' : ''}`}
              onClick={() => setFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Meetings Grid */}
      <div className="meetings-grid">
        {filteredMeetings.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <FiVideo className="empty-state-icon" />
            <h3>No meetings found</h3>
            <p>Schedule a meeting to get started</p>
          </div>
        ) : (
          filteredMeetings.map((meeting) => {
            const { date, time } = formatDateTime(meeting.meeting_datetime);
            return (
              <div 
                key={meeting.id} 
                className="meeting-card"
                onClick={(e) => handleMeetingCardClick(meeting, e)}
                style={{ cursor: 'pointer' }}
              >
                <div className="meeting-card-header">
                  <span className={`badge badge-${getStatusColor(meeting.status)}`}>
                    {meeting.status}
                  </span>
                  {!isEmployee && (
                    <div className="meeting-actions">
                      <button className="btn-icon" onClick={() => handleEdit(meeting)}>
                        <FiEdit2 />
                      </button>
                      <button className="btn-icon" onClick={() => handleDelete(meeting.id)}>
                        <FiTrash2 />
                      </button>
                    </div>
                  )}
                </div>

                <div className="meeting-card-body">
                  <div className="meeting-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <h3 className="meeting-title" style={{ margin: 0 }}>{meeting.title}</h3>
                    <span className="badge badge-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          display: 'inline-block',
                          backgroundColor: meeting.meeting_type === 'offline' ? '#22c55e' : '#ef4444'
                        }}
                      />
                      {meeting.meeting_type === 'offline' ? 'Offline' : 'Online'}
                    </span>
                  </div>
                  <p className="meeting-desc">{meeting.description || 'No description'}</p>
                  {meeting.meeting_type === 'offline' && meeting.location && (
                    <p className="meeting-location"><strong>Location:</strong> {meeting.location}</p>
                  )}

                  <div className="meeting-datetime">
                    <div className="datetime-item">
                      <FiCalendar />
                      <span>{date}</span>
                    </div>
                    <div className="datetime-item">
                      <FiClock />
                      <span>{time} ({meeting.duration_minutes} min)</span>
                    </div>
                  </div>

                  <div className="meeting-participants">
                    <FiUsers />
                    <div className="avatar-group">
                      {meeting.participants?.slice(0, 4).map((p) => (
                        <div key={p.empid} className="avatar avatar-sm" title={p.name}>
                          {p.image_base64 ? (
                            <img src={p.image_base64} alt={p.name} />
                          ) : (
                            p.name?.charAt(0).toUpperCase()
                          )}
                        </div>
                      ))}
                      {meeting.participants?.length > 4 && (
                        <div className="avatar avatar-sm more">
                          +{meeting.participants.length - 4}
                        </div>
                      )}
                    </div>
                    <span>{meeting.participants?.length || 0} participants</span>
                  </div>
                </div>

                {meeting.meeting_type === 'offline' ? (
                  meeting.location ? (
                    <div className="meeting-link disabled">📍 {meeting.location}</div>
                  ) : null
                ) : meeting.link && (() => {
                  const { isPast, canJoin, startingSoon } = getJoinState(meeting);

                  if (isPast) {
                    return <div className="meeting-link disabled">Meeting Closed</div>;
                  }

                  if (startingSoon) {
                    return <div className="meeting-link disabled">Starting soon</div>;
                  }

                  return (
                    <a 
                      href={meeting.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="meeting-link"
                    >
                      <FiExternalLink /> Join Now
                    </a>
                  );
                })()}
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editingMeeting ? 'Edit Meeting' : 'Schedule Meeting'}
        size="large"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Meeting Title *</label>
            <input
              type="text"
              className="form-input"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter meeting title"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Meeting agenda"
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date & Time *</label>
              <input
                type="datetime-local"
                className="form-input"
                value={formData.meeting_datetime}
                onChange={(e) => setFormData({ ...formData, meeting_datetime: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Duration (minutes)</label>
              <select
                className="form-select"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Meeting Type *</label>
              <select
                className="form-select"
                value={formData.meeting_type}
                onChange={(e) => setFormData({ ...formData, meeting_type: e.target.value })}
              >
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Meeting Platform</label>
              <select
                className="form-select"
                value={formData.platform}
                onChange={(e) => {
                  setFormData({ 
                    ...formData, 
                    platform: e.target.value,
                    link: e.target.value === 'gmeet' ? '' : formData.link // Clear link if switching to gmeet
                  });
                }}
                disabled={formData.meeting_type === 'offline'}
              >
                <option value="gmeet">Google Meet (auto)</option>
                <option value="zoom">Zoom (enter link)</option>
                <option value="custom">Custom link</option>
              </select>
              {formData.platform === 'gmeet' && !calendarConnected && !checkingCalendar && formData.meeting_type === 'online' && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  background: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#856404'
                }}>
                  ⚠️ Google Calendar not connected. 
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleConnectCalendar();
                    }}
                    style={{
                      marginLeft: '8px',
                      background: '#ffc107',
                      color: '#000',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '12px'
                    }}
                  >
                    Connect Now
                  </button>
                </div>
              )}
            </div>
            {formData.meeting_type === 'online' && (
              <div className="form-group">
                <label className="form-label">Meeting Link {formData.platform !== 'gmeet' ? '*' : '(auto-created)'}</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  placeholder={formData.platform === 'gmeet' ? 'Auto-generated Google Meet link' : 'https://...'}
                  disabled={formData.platform === 'gmeet'}
                  required={formData.platform !== 'gmeet'}
                />
              </div>
            )}
            {formData.meeting_type === 'offline' && (
              <div className="form-group">
                <label className="form-label">Meeting Location / Area *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Enter meeting location / area"
                  required
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Participants</label>
            <div className="participants-selector">
              {employees.map((emp) => (
                <div 
                  key={emp.empid} 
                  className={`participant-chip ${formData.participants.some(p => p.empid === emp.empid) ? 'selected' : ''}`}
                  onClick={() => toggleParticipant(emp)}
                >
                  <div className="avatar avatar-sm">
                    {emp.image_base64 ? (
                      <img src={emp.image_base64} alt={emp.name} />
                    ) : (
                      emp.name?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span>{emp.name}</span>
                </div>
              ))}
            </div>
          </div>

          {editingMeeting && (
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="scheduled">Scheduled</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => {
              setShowModal(false);
              resetForm();
            }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="spinner-small"></span> {editingMeeting ? 'Updating...' : 'Scheduling...'}
                </>
              ) : (
                <>
                  {editingMeeting ? 'Update' : 'Schedule'} Meeting
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Meeting Notes Popup */}
      {selectedMeeting && (
        <div className="meeting-notes-overlay">
          <div className="meeting-notes-popup" ref={notesPopupRef}>
            <div className="meeting-notes-header">
              <div>
                <h3>Meeting Notes</h3>
                <p className="meeting-notes-title">{selectedMeeting.title}</p>
              </div>
              <button className="btn-icon" onClick={handleCloseNotesPopup}>
                <FiX />
              </button>
            </div>
            
            <div className="meeting-notes-body">
              {notesLoading ? (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <p>Loading notes...</p>
                </div>
              ) : (
                <textarea
                  className="meeting-notes-textarea"
                  placeholder="Write your meeting points/notes here..."
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  rows={12}
                />
              )}
            </div>
            
            <div className="meeting-notes-footer">
              <button className="btn btn-secondary" onClick={handleCloseNotesPopup}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveNotes} disabled={notesLoading}>
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Meetings;






