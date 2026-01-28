import { useState, useEffect, useRef } from 'react';
import { FiDownload, FiFileText, FiFilter, FiPieChart, FiSearch } from 'react-icons/fi';
import { reportsAPI } from '../services/api';
import DatePicker from '../components/DatePicker';
import toast from 'react-hot-toast';
import './Reports.css';

const Reports = () => {
  const [filters, setFilters] = useState({
    project_id: '',
    employee_id: '',
    start_date: '',
    end_date: ''
  });
  const [filterOptions, setFilterOptions] = useState({ projects: [], employees: [] });
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const employeeDropdownRef = useRef(null);
  const employeeInputRef = useRef(null);
  const employeeDropdownMenuRef = useRef(null);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Handle click outside to close employee dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        employeeDropdownRef.current && 
        !employeeDropdownRef.current.contains(event.target) &&
        employeeDropdownMenuRef.current &&
        !employeeDropdownMenuRef.current.contains(event.target)
      ) {
        setShowEmployeeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchFilterOptions = async () => {
    try {
      const response = await reportsAPI.getFilters();
      setFilterOptions(response.data);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const filterData = {
        project_id: filters.project_id ? parseInt(filters.project_id) : null,
        employee_id: filters.employee_id ? parseInt(filters.employee_id) : null,
        start_date: filters.start_date || null,
        end_date: filters.end_date || null
      };
      
      const response = await reportsAPI.generate(filterData);
      setReportData(response.data);
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format) => {
    setDownloading(true);
    try {
      const filterData = {
        project_id: filters.project_id ? parseInt(filters.project_id) : null,
        employee_id: filters.employee_id ? parseInt(filters.employee_id) : null,
        start_date: filters.start_date || null,
        end_date: filters.end_date || null
      };

      let response;
      if (format === 'excel') {
        response = await reportsAPI.downloadExcel(filterData);
      } else {
        response = await reportsAPI.downloadPdf(filterData);
      }

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report.${format === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success(`${format.toUpperCase()} downloaded successfully`);
    } catch (error) {
      toast.error(`Failed to download ${format}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">REPORTS</h1>
          <p className="page-subtitle">Generate and download reports</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card filters-card">
        <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 className="card-title" style={{ fontSize: '1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiFilter size={18} /> Filters
          </h3>
        </div>
        <div className="filters-container" style={{ padding: '16px' }}>
          <div className="filters-grid">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500 }}>Project</label>
              <select
                className="form-select"
                value={filters.project_id}
                onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
                style={{ padding: '8px 12px', fontSize: '0.9rem', width: '100%' }}
              >
                <option value="">All Projects</option>
                {filterOptions.projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" ref={employeeDropdownRef} style={{ position: 'relative', marginBottom: 0, zIndex: 10 }}>
              <label className="form-label" style={{ marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500 }}>Employee</label>
              <div style={{ position: 'relative', zIndex: 1001 }}>
                <FiSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', zIndex: 1, fontSize: '16px' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search employee by name or ID..."
                  value={filters.employee_id && !employeeSearch ? (filterOptions.employees.find(e => e.id === parseInt(filters.employee_id))?.name || '') : employeeSearch}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEmployeeSearch(value);
                    setShowEmployeeDropdown(true);
                    // Calculate dropdown position
                    if (employeeInputRef.current) {
                      const rect = employeeInputRef.current.getBoundingClientRect();
                      setDropdownPosition({
                        top: rect.bottom + window.scrollY + 4,
                        left: rect.left + window.scrollX,
                        width: rect.width
                      });
                    }
                    // Clear employee selection when user starts typing or changes the value
                    if (filters.employee_id) {
                      const selectedEmployee = filterOptions.employees.find(e => e.id === parseInt(filters.employee_id));
                      const selectedName = selectedEmployee?.name || '';
                      // If user is typing something different from selected name, clear selection
                      if (value !== selectedName) {
                        setFilters({ ...filters, employee_id: '' });
                      }
                    }
                    if (!value) {
                      setFilters({ ...filters, employee_id: '' });
                    }
                  }}
                  ref={employeeInputRef}
                  onFocus={() => {
                    setShowEmployeeDropdown(true);
                    // Calculate dropdown position
                    if (employeeInputRef.current) {
                      const rect = employeeInputRef.current.getBoundingClientRect();
                      setDropdownPosition({
                        top: rect.bottom + window.scrollY + 4,
                        left: rect.left + window.scrollX,
                        width: rect.width
                      });
                    }
                    // When focusing, if employee is selected, populate search field with name for editing
                    if (filters.employee_id && !employeeSearch) {
                      const selectedEmployee = filterOptions.employees.find(e => e.id === parseInt(filters.employee_id));
                      if (selectedEmployee) {
                        setEmployeeSearch(selectedEmployee.name || '');
                      }
                    }
                  }}
                  style={{ paddingLeft: '36px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', fontSize: '0.9rem', width: '100%' }}
                />
                {showEmployeeDropdown && (
                  <div 
                    ref={employeeDropdownMenuRef}
                    style={{
                      position: 'fixed',
                      top: `${dropdownPosition.top}px`,
                      left: `${dropdownPosition.left}px`,
                      width: `${dropdownPosition.width || 300}px`,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      maxHeight: '250px',
                      overflowY: 'auto',
                      zIndex: 10000,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                  >
                    {filterOptions.employees
                      .filter(emp => {
                        if (!employeeSearch.trim() && !filters.employee_id) return true;
                        const search = employeeSearch.toLowerCase();
                        const name = (emp.name || '').toLowerCase();
                        const empid = (emp.empid || '').toLowerCase();
                        const email = (emp.email || '').toLowerCase();
                        return name.includes(search) || empid.includes(search) || email.includes(search);
                      })
                      .map((emp) => (
                        <div
                          key={emp.id}
                          onClick={() => {
                            setFilters({ ...filters, employee_id: emp.id.toString() });
                            setEmployeeSearch('');
                            setShowEmployeeDropdown(false);
                          }}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border-color)',
                            background: filters.employee_id === emp.id.toString() ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                            fontWeight: filters.employee_id === emp.id.toString() ? 600 : 400,
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                          }}
                          onMouseEnter={(e) => {
                            if (filters.employee_id !== emp.id.toString()) e.currentTarget.style.background = 'var(--bg-hover)';
                          }}
                          onMouseLeave={(e) => {
                            if (filters.employee_id !== emp.id.toString()) e.currentTarget.style.background = filters.employee_id === emp.id.toString() ? 'rgba(99, 102, 241, 0.1)' : 'transparent';
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {emp.empid} {emp.email ? `• ${emp.email}` : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    {filterOptions.employees.filter(emp => {
                      if (!employeeSearch.trim() && !filters.employee_id) return false;
                      const search = employeeSearch.toLowerCase();
                      const name = (emp.name || '').toLowerCase();
                      const empid = (emp.empid || '').toLowerCase();
                      const email = (emp.email || '').toLowerCase();
                      return name.includes(search) || empid.includes(search) || email.includes(search);
                    }).length === 0 && (employeeSearch || filters.employee_id) && (
                      <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        No employees found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500 }}>Start Date</label>
              <DatePicker
                value={filters.start_date}
                onChange={(date) => setFilters({ ...filters, start_date: date || '' })}
                placeholder="Select start date"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ marginBottom: '6px', fontSize: '0.875rem', fontWeight: 500 }}>End Date</label>
              <DatePicker
                value={filters.end_date}
                onChange={(date) => setFilters({ ...filters, end_date: date || '' })}
                placeholder="Select end date"
                min={filters.start_date || ''}
              />
            </div>
          </div>

          <div className="filters-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleGenerateReport}
              disabled={loading}
              style={{ 
                padding: '8px 20px', 
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap'
              }}
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      {/* Report Results */}
      {reportData && (
        <div className="report-results">
          {/* Download Buttons */}
          <div className="report-actions">
            <button 
              className="btn btn-success" 
              onClick={() => handleDownload('excel')}
              disabled={downloading || !reportData || (reportData.summary?.total_tasks === 0 && reportData.summary?.completed === 0)}
            >
              <FiDownload /> {downloading ? 'Downloading...' : 'Download Excel'}
            </button>
            <button 
              className="btn btn-danger" 
              onClick={() => handleDownload('pdf')}
              disabled={downloading || !reportData || (reportData.summary?.total_tasks === 0 && reportData.summary?.completed === 0)}
            >
              <FiFileText /> {downloading ? 'Downloading...' : 'Download PDF'}
            </button>
          </div>
          {/* Summary Cards */}
          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-icon primary">
                <FiPieChart />
              </div>
              <div className="summary-content">
                <h4>{reportData.summary.total_tasks}</h4>
                <p>Total Tasks</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon success">
                <FiPieChart />
              </div>
              <div className="summary-content">
                <h4>{reportData.summary.completed}</h4>
                <p>Completed</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon warning">
                <FiPieChart />
              </div>
              <div className="summary-content">
                <h4>{reportData.summary.pending}</h4>
                <p>Pending</p>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon danger">
                <FiPieChart />
              </div>
              <div className="summary-content">
                <h4>{reportData.summary.delayed}</h4>
                <p>Delayed</p>
              </div>
            </div>
            <div className="summary-card full-width">
              <div className="summary-content">
                <h4>{reportData.summary.completion_rate}%</h4>
                <p>Completion Rate</p>
                <div className="progress-bar" style={{ marginTop: 10 }}>
                  <div 
                    className="progress-bar-fill success" 
                    style={{ width: `${reportData.summary.completion_rate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>


          {/* Tasks Table */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Task Details ({reportData.tasks.length})</h3>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Assigned To</th>
                    <th>Due Date</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.tasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.id}</td>
                      <td>{task.title}</td>
                      <td>
                        <span className={`badge badge-${task.status === 'done' ? 'success' : 'warning'}`}>
                          {task.status}
                        </span>
                      </td>
                      <td>{task.priority}</td>
                      <td>{task.assigned_to || '-'}</td>
                      <td>{task.due_date || '-'}</td>
                      <td>
                        <div className="progress-bar" style={{ width: 80 }}>
                          <div 
                            className="progress-bar-fill primary" 
                            style={{ width: `${task.percent_complete}%` }}
                          ></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;






