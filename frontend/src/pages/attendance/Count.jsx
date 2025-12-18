import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiFilter, FiDownload, FiUpload, FiRefreshCw, FiFileText } from 'react-icons/fi';
import '../employee/Employee.css';
import './Attendance.css';

const AttendanceCount = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState([]);
  const [filters, setFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    employee_id: '',
    search: ''
  });
  const [employees, setEmployees] = useState([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);

  useEffect(() => {
    fetchAttendanceData();
    fetchEmployees();
  }, [filters.month, filters.year]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/users/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/attendance/count-details', {
        params: {
          month: filters.month,
          year: filters.year,
          employee_id: filters.employee_id || undefined
        }
      });
      setAttendanceData(response.data || []);
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await api.get('/attendance/export-excel', {
        params: {
          month: filters.month,
          year: filters.year,
          employee_id: filters.employee_id || undefined
        },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_${filters.month}_${filters.year}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      toast.error('Failed to export Excel');
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please choose a file');
      return;
    }
    const formData = new FormData();
    formData.append('file', uploadFile);
    try {
      await api.post('/attendance/upload-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Upload successful');
      setShowUploadModal(false);
      setUploadFile(null);
      fetchAttendanceData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload');
    }
  };

  const handleUpload = () => {
    setShowUploadModal(true);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      await api.post('/attendance/generate', {
        month: filters.month,
        year: filters.year
      });
      toast.success('Attendance generated successfully');
      fetchAttendanceData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate attendance');
    } finally {
      setLoading(false);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>ATTENDANCE COUNT</h1>
        <div className="header-buttons" style={{ flexWrap: 'wrap', gap: '2px', alignItems: 'center', width: '100%' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search employee name or ID"
            style={{ minWidth: '220px', flex: '1 1 220px' }}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <div className="month-year" style={{ display: 'flex', gap: '8px', flex: '0 0 auto' }}>
            <select
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value) })}
              className="form-select"
            >
              {monthNames.map((month, index) => (
                <option key={index + 1} value={index + 1}>{month}</option>
              ))}
            </select>
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
              className="form-select"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="header-buttons" style={{ marginLeft: 'auto' }}>
            <button 
              className="btn-primary" 
              onClick={() => setShowFilterModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiFilter /> Filter
            </button>
            <button 
              className="btn-primary" 
              onClick={handleExportExcel}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiDownload /> Excel
            </button>
            <button 
              className="btn-primary" 
              onClick={handleUpload}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiUpload /> Upload
            </button>
            <button 
              className="btn-primary" 
              onClick={handleGenerate}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiRefreshCw /> Generate
            </button>
          </div>
        </div>
      </div>

      {showFilterModal && (
        <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Filter Attendance</h3>
              <button className="modal-close" onClick={() => setShowFilterModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Employee</label>
                <select
                  value={filters.employee_id}
                  onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}
                  className="form-select"
                >
                  <option value="">All Employees</option>
                  {employees
                    .filter(emp => {
                      const term = filters.search.toLowerCase();
                      if (!term) return true;
                      return emp.name.toLowerCase().includes(term) || emp.empid.toLowerCase().includes(term);
                    })
                    .map((emp) => (
                      <option key={emp.id} value={emp.empid}>
                        {emp.name} ({emp.empid})
                      </option>
                  ))}
                </select>
              </div>
              <button className="btn-primary" onClick={() => {
                setShowFilterModal(false);
                fetchAttendanceData();
              }}>
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading attendance data...</p>
        </div>
      ) : (
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>EMPLOYEE-NAME</th>
                <th>EMP-ID</th>
                <th>TOTAL</th>
                <th>WORK</th>
                <th>W.O</th>
                <th>HOLIDAYS</th>
                <th>PRESENT</th>
                <th>ABSENT</th>
                <th>HALFDAYS</th>
                <th>LATE</th>
                <th>LOPs</th>
                <th>CL</th>
                <th>SL</th>
                <th>COMP</th>
                <th>PAYBLE</th>
                <th>MONTH</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.length === 0 ? (
                <tr>
                  <td colSpan="16" className="text-center">No attendance data found</td>
                </tr>
              ) : (
                attendanceData.map((record) => (
                  <tr key={record.id || record.employee_id}>
                    <td>{record.employee_name || '-'}</td>
                    <td>{record.employee_id || '-'}</td>
                    <td>{record.total_days || 0}</td>
                    <td>{record.working_days || 0}</td>
                    <td>{record.week_offs || 0}</td>
                    <td>{record.holidays || 0}</td>
                    <td>{record.presents || 0}</td>
                    <td>{record.absents || 0}</td>
                    <td>{record.half_days || 0}</td>
                    <td>{record.late_logs || 0}</td>
                    <td>{record.lops || 0}</td>
                    <td>{record.cl || 0}</td>
                    <td>{record.sl || 0}</td>
                    <td>{record.comp_offs || 0}</td>
                    <td>{record.payble_days || 0}</td>
                    <td>{monthNames[filters.month - 1]} {filters.year}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Attendance Excel</h3>
              <button className="modal-close" onClick={() => setShowUploadModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUploadSubmit}>
                <div className="form-group">
                  <label>Select Excel File</label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="form-input"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Uploading...' : 'Submit'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCount;
