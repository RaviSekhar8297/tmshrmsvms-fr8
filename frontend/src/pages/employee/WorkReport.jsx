import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './Employee.css';

const WorkReport = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchReports();
  }, [month]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/work-reports/self?month=${month}`);
      setReports(response.data);
    } catch (error) {
      console.error('Error fetching work reports:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header stacked">
        <div>
          <h1>Work Report</h1>
          <p className="page-subtitle">Search your daily submissions and filter by month.</p>
        </div>
        <div className="header-actions filters-row toolbar">
          <div className="toolbar-left">
            <div className="filter-field">
              <span className="filter-label">Search</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks, remarks..."
                className="form-input search-input"
              />
            </div>
            <div className="filter-field">
              <span className="filter-label">Month</span>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="form-input"
              />
            </div>
          </div>
          <div className="toolbar-right">
            <button className="btn-secondary" onClick={fetchReports}>
              Refresh
            </button>
            <button className="btn-primary" onClick={() => toast('Excel export coming soon')}>
              Excel
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading work reports...</p>
        </div>
      ) : (
        (() => {
          const filteredReports = reports.filter((report) => {
            const term = search.toLowerCase();
            return (
              !term ||
              report.remarks?.toLowerCase().includes(term) ||
              String(report.tasks_completed || '').includes(term) ||
              String(report.hours_worked || '').includes(term)
            );
          });
          return (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Tasks Completed</th>
                    <th>Hours Worked</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center">No work reports found</td>
                    </tr>
                  ) : (
                    filteredReports.map((report) => (
                      <tr key={report.id}>
                        <td>{new Date(report.date).toLocaleDateString()}</td>
                        <td>{report.tasks_completed || 0}</td>
                        <td>{report.hours_worked || 0}</td>
                        <td><span className={`badge badge-${report.status === 'completed' ? 'success' : 'warning'}`}>{report.status}</span></td>
                        <td>{report.remarks || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          );
        })()
      )}
    </div>
  );
};

export default WorkReport;

