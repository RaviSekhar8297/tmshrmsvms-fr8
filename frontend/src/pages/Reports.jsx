import { useState, useEffect } from 'react';
import { FiDownload, FiFileText, FiFilter, FiPieChart } from 'react-icons/fi';
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

  useEffect(() => {
    fetchFilterOptions();
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
        <div className="card-header">
          <h3 className="card-title"><FiFilter /> Filters</h3>
        </div>
        <div className="filters-grid">
          <div className="form-group">
            <label className="form-label">Project</label>
            <select
              className="form-select"
              value={filters.project_id}
              onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
            >
              <option value="">All Projects</option>
              {filterOptions.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Employee</label>
            <select
              className="form-select"
              value={filters.employee_id}
              onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}
            >
              <option value="">All Employees</option>
              {filterOptions.employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.empid})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Start Date</label>
            <DatePicker
              value={filters.start_date}
              onChange={(date) => setFilters({ ...filters, start_date: date || '' })}
              placeholder="Select start date"
            />
          </div>

          <div className="form-group">
            <label className="form-label">End Date</label>
            <DatePicker
              value={filters.end_date}
              onChange={(date) => setFilters({ ...filters, end_date: date || '' })}
              placeholder="Select end date"
              min={filters.start_date || ''}
            />
          </div>
        </div>

        <div className="filters-actions">
          <button 
            className="btn btn-primary" 
            onClick={handleGenerateReport}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
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






