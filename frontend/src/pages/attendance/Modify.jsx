import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiSearch, FiFilter, FiSave, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import DatePicker from '../../components/DatePicker';
import './Attendance.css';

const ModifyAttendance = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Initialize with previous date (yesterday)
  const getPreviousDate = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  };
  
  const [selectedDate, setSelectedDate] = useState(getPreviousDate());
  const [editingRows, setEditingRows] = useState({});
  const [savingRows, setSavingRows] = useState({});
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 50;

  // Fetch data on mount with initial date
  useEffect(() => {
    if (selectedDate) {
      fetchAttendanceByDate();
    }
  }, []);

  useEffect(() => {
    filterRecords();
  }, [searchQuery, attendanceRecords]);

  const fetchAttendanceByDate = async () => {
    if (!selectedDate) {
      toast.error('Please select a date');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.get(`/attendance/history?date=${selectedDate}`);
      const records = response.data || [];
      // Initialize editing state for all records
      const editingState = {};
      records.forEach((record, index) => {
        editingState[`${record.employee_id}_${selectedDate}`] = {
          in_time: record.in_time || '00:00',
          out_time: record.out_time || '00:00'
        };
      });
      setEditingRows(editingState);
      setAttendanceRecords(records);
      setFilteredRecords(records);
      setCurrentPage(1); // Reset to first page
    } catch (error) {
      console.error('Error fetching attendance by date:', error);
      toast.error(error.response?.data?.detail || 'Failed to fetch attendance records');
      setAttendanceRecords([]);
      setFilteredRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const filterRecords = () => {
    if (!searchQuery.trim()) {
      setFilteredRecords(attendanceRecords);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = attendanceRecords.filter(record => 
      record.employee_name?.toLowerCase().includes(query) ||
      record.employee_id?.toLowerCase().includes(query)
    );
    setFilteredRecords(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleFilter = () => {
    fetchAttendanceByDate();
  };

  const handleTimeChange = (employeeId, field, value) => {
    const key = `${employeeId}_${selectedDate}`;
    setEditingRows(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const handleSave = async (record) => {
    const key = `${record.employee_id}_${selectedDate}`;
    const editedData = editingRows[key];
    
    if (!editedData) {
      toast.error('No changes to save');
      return;
    }

    setSavingRows(prev => ({ ...prev, [key]: true }));
    
    try {
      await api.post('/attendance/modify', {
        employee_id: record.employee_id,
        date: selectedDate || record.date,
        check_in: editedData.in_time ? `${selectedDate || record.date}T${editedData.in_time}:00` : null,
        check_out: editedData.out_time ? `${selectedDate || record.date}T${editedData.out_time}:00` : null,
        status: 'present',
        remarks: ''
      });
      
      toast.success(`Attendance updated for ${record.employee_name}`);
      
      // Update the record in state
      setAttendanceRecords(prev => prev.map(r => 
        r.employee_id === record.employee_id && r.date === (selectedDate || record.date)
          ? { ...r, in_time: editedData.in_time, out_time: editedData.out_time }
          : r
      ));
      
      // Refresh data
      await fetchAttendanceByDate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save attendance');
    } finally {
      setSavingRows(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredRecords.slice(indexOfFirstRecord, indexOfLastRecord);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Modify Attendance!!</h1>
      </div>

      {/* Search and Filter Section */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '20px', 
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <FiSearch style={{ 
            position: 'absolute', 
            left: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'var(--text-secondary)'
          }} />
          <input
            type="text"
            placeholder="Search by name or employee ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '0.9rem',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <DatePicker
            value={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            placeholder="Select date"
            max={new Date(Date.now() - 86400000).toISOString().split('T')[0]}
          />
          <button
            onClick={handleFilter}
            disabled={loading || !selectedDate}
            style={{
              padding: '10px 20px',
              background: selectedDate ? 'var(--primary)' : 'var(--bg-hover)',
              color: selectedDate ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '8px',
              cursor: selectedDate ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.9rem',
              fontWeight: 600,
              opacity: selectedDate ? 1 : 0.6
            }}
          >
            <FiFilter /> Filter
          </button>
          {selectedDate && (
            <button
              onClick={() => {
                setSelectedDate('');
                setAttendanceRecords([]);
                setFilteredRecords([]);
                setEditingRows({});
                setCurrentPage(1);
              }}
              style={{
                padding: '10px 20px',
                background: 'var(--bg-hover)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading attendance records...</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Image</th>
                  <th>Employee ID</th>
                  <th>Employee Name</th>
                  <th>Date</th>
                  <th>In Time</th>
                  <th>Out Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center">
                      {selectedDate ? 'No attendance records found for selected date' : 'Please select a date and click Filter'}
                    </td>
                  </tr>
                ) : (
                  currentRecords.map((record, index) => {
                    const key = `${record.employee_id}_${selectedDate}`;
                    const editedData = editingRows[key] || { 
                      in_time: record.in_time || '00:00', 
                      out_time: record.out_time || '00:00' 
                    };
                    const isSaving = savingRows[key];
                    const rowIndex = indexOfFirstRecord + index;
                    
                    return (
                      <tr key={`${record.employee_id}_${selectedDate}_${rowIndex}`}>
                        <td>{rowIndex + 1}</td>
                        <td>
                          {record.image_base64 ? (
                            <img 
                              src={record.image_base64} 
                              alt={record.employee_name}
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '2px solid var(--border-color)'
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              background: 'var(--bg-hover)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-secondary)',
                              fontWeight: 600
                            }}>
                              {record.employee_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                        </td>
                        <td>{record.employee_id}</td>
                        <td>{record.employee_name}</td>
                        <td>{selectedDate || record.date}</td>
                        <td>
                          <input
                            type="time"
                            value={editedData.in_time}
                            onChange={(e) => handleTimeChange(record.employee_id, 'in_time', e.target.value)}
                            style={{
                              padding: '6px 8px',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              fontSize: '0.9rem',
                              background: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              width: '100px'
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            value={editedData.out_time}
                            onChange={(e) => handleTimeChange(record.employee_id, 'out_time', e.target.value)}
                            style={{
                              padding: '6px 8px',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              fontSize: '0.9rem',
                              background: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              width: '100px'
                            }}
                          />
                        </td>
                        <td>
                          <button
                            onClick={() => handleSave(record)}
                            disabled={isSaving}
                            style={{
                              padding: '6px 12px',
                              background: 'var(--primary)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: isSaving ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              opacity: isSaving ? 0.6 : 1
                            }}
                          >
                            <FiSave /> {isSaving ? 'Saving...' : 'Save'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination - Matching History page style */}
          {totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info">
                Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredRecords.length)} of {filteredRecords.length} records
              </div>
              <div className="pagination-controls">
                <button 
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <FiChevronLeft />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button 
                  className="pagination-btn"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <FiChevronRight />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ModifyAttendance;
