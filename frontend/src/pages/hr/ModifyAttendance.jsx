import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { attendanceAPI, usersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiEdit2, FiX, FiPlus } from 'react-icons/fi';
import './HR.css';

const ModifyAttendance = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [markFormData, setMarkFormData] = useState({
    employee_id: '',
    employee_name: '',
    date: new Date().toISOString().split('T')[0],
    check_in: '',
    check_out: '',
    remarks: ''
  });
  const [editFormData, setEditFormData] = useState({
    employee_id: '',
    employee_name: '',
    date: '',
    check_in: '',
    check_out: '',
    remarks: ''
  });

  useEffect(() => {
    fetchEmployees();
    fetchPreviousRecords();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showEmployeeDropdown && !event.target.closest('.form-group')) {
        setShowEmployeeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmployeeDropdown]);

  const fetchEmployees = async () => {
    try {
      const response = await usersAPI.getAll();
      setEmployees(response.data.filter(u => u.role === 'Employee' || u.role === 'Manager'));
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchPreviousRecords = async () => {
    setRecordsLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
      
      const response = await attendanceAPI.getPrevious(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      setAttendanceRecords(response.data || []);
    } catch (error) {
      console.error('Error fetching previous records:', error);
      setAttendanceRecords([]);
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleMarkSubmit = async (e) => {
    e.preventDefault();
    if (!markFormData.employee_id) {
      toast.error('Please select an employee');
      return;
    }
    setLoading(true);
    try {
      await attendanceAPI.modify({
        employee_id: markFormData.employee_id,
        date: markFormData.date,
        check_in: markFormData.check_in,
        check_out: markFormData.check_out,
        status: 'present', // Will be auto-calculated by backend
        remarks: markFormData.remarks
      });
      toast.success('Attendance marked successfully');
      setShowMarkModal(false);
      resetMarkForm();
      fetchPreviousRecords();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await attendanceAPI.modify({
        employee_id: editFormData.employee_id,
        date: editFormData.date,
        check_in: editFormData.check_in,
        check_out: editFormData.check_out,
        status: 'present', // Will be auto-calculated by backend based on duration
        remarks: editFormData.remarks || ''
      });
      toast.success('Attendance updated successfully');
      setShowEditModal(false);
      setEditingRecord(null);
      resetEditForm();
      await fetchPreviousRecords(); // Wait for refresh
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    const checkIn = record.check_in ? new Date(record.check_in).toTimeString().slice(0, 5) : '';
    const checkOut = record.check_out ? new Date(record.check_out).toTimeString().slice(0, 5) : '';
    
    setEditFormData({
      employee_id: record.employee_id,
      employee_name: record.employee_name,
      date: record.date.split('T')[0],
      check_in: checkIn,
      check_out: checkOut,
      remarks: record.remarks || ''
    });
    setShowEditModal(true);
  };

  const resetMarkForm = () => {
    setMarkFormData({
      employee_id: '',
      employee_name: '',
      date: new Date().toISOString().split('T')[0],
      check_in: '',
      check_out: '',
      remarks: ''
    });
    setSearchQuery('');
    setShowEmployeeDropdown(false);
  };

  const resetEditForm = () => {
    setEditFormData({
      employee_id: '',
      employee_name: '',
      date: '',
      check_in: '',
      check_out: '',
      remarks: ''
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (hours) => {
    if (!hours) return '00:00';
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const getStatusBadge = (status, hours) => {
    // Auto-calculate status if not present
    let finalStatus = status;
    if (hours !== null && hours !== undefined) {
      if (hours >= 9) {
        finalStatus = 'present';
      } else if (hours >= 4.5) {
        finalStatus = 'half_day';
      } else if (hours > 0) {
        finalStatus = 'absent';
      } else {
        finalStatus = 'absent';
      }
    }
    
    const badges = {
      present: { class: 'badge-success', text: 'P' },
      absent: { class: 'badge-danger', text: 'Abs' },
      half_day: { class: 'badge-warning', text: 'H/D' },
      leave: { class: 'badge-warning', text: 'L' },
      late: { class: 'badge-info', text: 'L' },
    };
    const badge = badges[finalStatus] || badges.absent;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.empid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEmployeeSelect = (emp) => {
    setMarkFormData({
      ...markFormData,
      employee_id: emp.empid,
      employee_name: emp.name
    });
    setSearchQuery('');
    setShowEmployeeDropdown(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Modify Attendance</h1>
        <button className="btn-primary" onClick={() => setShowMarkModal(true)}>
          <FiPlus /> Mark Attendance
        </button>
      </div>

      {recordsLoading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading attendance records...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Employee ID</th>
                <th>Date</th>
                <th>In</th>
                <th>Out</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRecords.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center">No attendance records found</td>
                </tr>
              ) : (
                attendanceRecords.map((record) => {
                  const inTime = record.check_in ? new Date(record.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '00:00';
                  const outTime = record.check_out ? new Date(record.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '00:00';
                  const duration = formatDuration(record.hours || 0);
                  
                  return (
                    <tr key={record.id}>
                      <td>{record.employee_name}</td>
                      <td>{record.employee_id}</td>
                      <td>{record.date ? new Date(record.date).toLocaleDateString('en-IN') : '-'}</td>
                      <td>{inTime}</td>
                      <td>{outTime}</td>
                      <td>{duration}</td>
                      <td>{getStatusBadge(record.status, record.hours)}</td>
                      <td>
                        <button
                          className="btn-success"
                          onClick={() => handleEdit(record)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <FiEdit2 /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Mark Attendance Modal */}
      {showMarkModal && (
        <div className="modal-overlay" onClick={() => setShowMarkModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Mark Attendance</h2>
              <button className="modal-close-btn" onClick={() => setShowMarkModal(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleMarkSubmit} className="attendance-form">
              <div className="form-group" style={{ position: 'relative' }}>
                <label>Employee *</label>
                <input
                  type="text"
                  value={markFormData.employee_name || searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowEmployeeDropdown(true);
                    if (!e.target.value) {
                      setMarkFormData({ ...markFormData, employee_id: '', employee_name: '' });
                    }
                  }}
                  onFocus={() => setShowEmployeeDropdown(true)}
                  placeholder="Search employee by name or ID..."
                  className="form-input"
                  required
                  style={{ width: '100%' }}
                />
                {showEmployeeDropdown && filteredEmployees.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    marginTop: '4px'
                  }}>
                    {filteredEmployees.map((emp) => (
                      <div
                        key={emp.id}
                        onClick={() => handleEmployeeSelect(emp)}
                        style={{
                          padding: '12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'var(--bg-hover)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{emp.empid}</div>
                      </div>
                    ))}
                  </div>
                )}
                {markFormData.employee_id && (
                  <input type="hidden" name="employee_id" value={markFormData.employee_id} />
                )}
              </div>

              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  name="date"
                  value={markFormData.date}
                  onChange={(e) => setMarkFormData({ ...markFormData, date: e.target.value })}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>In Time *</label>
                  <input
                    type="time"
                    name="check_in"
                    value={markFormData.check_in}
                    onChange={(e) => setMarkFormData({ ...markFormData, check_in: e.target.value })}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Out Time *</label>
                  <input
                    type="time"
                    name="check_out"
                    value={markFormData.check_out}
                    onChange={(e) => setMarkFormData({ ...markFormData, check_out: e.target.value })}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Remarks (Optional)</label>
                <textarea
                  name="remarks"
                  value={markFormData.remarks}
                  onChange={(e) => setMarkFormData({ ...markFormData, remarks: e.target.value })}
                  rows="3"
                  className="form-input"
                  placeholder="Enter remarks if any..."
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowMarkModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Attendance Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Attendance</h2>
              <button className="modal-close-btn" onClick={() => setShowEditModal(false)}>
                <FiX />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="attendance-form">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={editFormData.employee_name}
                  disabled
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Employee ID</label>
                <input
                  type="text"
                  value={editFormData.employee_id}
                  disabled
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  name="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Check In *</label>
                  <input
                    type="time"
                    name="check_in"
                    value={editFormData.check_in}
                    onChange={(e) => setEditFormData({ ...editFormData, check_in: e.target.value })}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Check Out *</label>
                  <input
                    type="time"
                    name="check_out"
                    value={editFormData.check_out}
                    onChange={(e) => setEditFormData({ ...editFormData, check_out: e.target.value })}
                    required
                    className="form-input"
                  />
                </div>
              </div>


              <div className="form-group">
                <label>Remarks</label>
                <textarea
                  name="remarks"
                  value={editFormData.remarks}
                  onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
                  rows="3"
                  className="form-input"
                  placeholder="Enter remarks if any..."
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModifyAttendance;
