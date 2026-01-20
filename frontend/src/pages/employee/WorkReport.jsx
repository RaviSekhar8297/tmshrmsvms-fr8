import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiCalendar, FiChevronDown } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import './Employee.css';

const WorkReport = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  // Calculate previous month
  const getPreviousMonth = () => {
    const today = new Date();
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return prevMonth.toISOString().slice(0, 7);
  };
  const [month, setMonth] = useState(getPreviousMonth());
  const [search, setSearch] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);

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

  const exportToExcel = () => {
    const filteredReports = reports.filter((report) => {
      const term = search.toLowerCase();
      return (
        !term ||
        report.remarks?.toLowerCase().includes(term) ||
        String(report.tasks_completed || '').includes(term) ||
        String(report.hours_worked || '').includes(term)
      );
    });

    if (filteredReports.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      // Prepare data for Excel
      const data = [];
      
      // Header row
      const headerRow = ['Date', 'Tasks Completed', 'Hours Worked', 'Status', 'Remarks'];
      data.push(headerRow);
      
      // Data rows
      filteredReports.forEach((report) => {
        const row = [
          new Date(report.date).toLocaleDateString(),
          report.tasks_completed || 0,
          report.hours_worked || 0,
          report.status || '',
          report.remarks || '-'
        ];
        data.push(row);
      });
      
      // Create workbook and worksheet
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Work Reports');
      
      // Set column widths
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 15 }, // Tasks Completed
        { wch: 15 }, // Hours Worked
        { wch: 12 }, // Status
        { wch: 40 }  // Remarks
      ];
      ws['!cols'] = colWidths;
      
      // Generate filename with month
      const filename = `work_reports_${month || 'all'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Download
      XLSX.writeFile(wb, filename);
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export Excel file');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header stacked">
        <div>
          <h1>WORK REPORT</h1>
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
              <div className="month-picker-wrapper" style={{ position: 'relative' }}>
                <div 
                  className="month-picker-input"
                  onClick={() => setShowMonthPicker(!showMonthPicker)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    cursor: 'pointer',
                    minWidth: '150px'
                  }}
                >
                  <FiCalendar size={18} />
                  <span style={{ flex: 1 }}>
                    {month 
                      ? new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                      : 'Select month'}
                  </span>
                  <FiChevronDown size={18} className={showMonthPicker ? 'rotate' : ''} />
                </div>
                {showMonthPicker && (
                  <div className="month-picker-dropdown" style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    padding: '16px'
                  }}>
                    <div className="month-picker-header" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '16px'
                    }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const [year] = month ? month.split('-').map(Number) : [new Date().getFullYear()];
                          const currentYear = year || new Date().getFullYear();
                          const minYear = new Date().getFullYear();
                          if (currentYear > minYear) {
                            const newYear = currentYear - 1;
                            const [_, monthNum] = month ? month.split('-') : [null, String(new Date().getMonth() + 1).padStart(2, '0')];
                            setMonth(`${newYear}-${monthNum}`);
                          }
                        }}
                        className="month-picker-nav"
                        disabled={month ? parseInt(month.split('-')[0]) <= new Date().getFullYear() : false}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          fontSize: '1.2rem',
                          padding: '4px 8px'
                        }}
                      >
                        ←
                      </button>
                      <span className="month-picker-year" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {month ? month.split('-')[0] : new Date().getFullYear()}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const [year] = month ? month.split('-').map(Number) : [new Date().getFullYear()];
                          const currentYear = year || new Date().getFullYear();
                          const newYear = currentYear + 1;
                          const [_, monthNum] = month ? month.split('-') : [null, String(new Date().getMonth() + 1).padStart(2, '0')];
                          setMonth(`${newYear}-${monthNum}`);
                        }}
                        className="month-picker-nav"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          fontSize: '1.2rem',
                          padding: '4px 8px'
                        }}
                      >
                        →
                      </button>
                    </div>
                    <div className="month-picker-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px'
                    }}>
                      {['December', 'November', 'October', 'September', 'August', 'July', 'June', 'May', 'April', 'March', 'February', 'January'].map((monthName, index) => {
                        const monthNum = 12 - index; // Reverse order: Dec=12, Nov=11, etc.
                        const year = month ? parseInt(month.split('-')[0]) : new Date().getFullYear();
                        const currentDate = new Date();
                        const currentYear = currentDate.getFullYear();
                        const currentMonth = currentDate.getMonth() + 1;
                        const isCurrentMonth = year === currentYear && monthNum === currentMonth;
                        const isPastMonth = year < currentYear || (year === currentYear && monthNum < currentMonth);
                        
                        // Only show past months (not current or future)
                        if (!isPastMonth) {
                          return null;
                        }
                        
                        return (
                          <button
                            key={monthName}
                            type="button"
                            className={`month-picker-option ${isCurrentMonth ? 'current' : ''} ${month === `${year}-${String(monthNum).padStart(2, '0')}` ? 'selected' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const monthValue = `${year}-${String(monthNum).padStart(2, '0')}`;
                              setMonth(monthValue);
                              setShowMonthPicker(false);
                            }}
                            style={{
                              padding: '10px',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              background: month === `${year}-${String(monthNum).padStart(2, '0')}` ? 'var(--primary)' : 'var(--bg-card)',
                              color: month === `${year}-${String(monthNum).padStart(2, '0')}` ? 'white' : 'var(--text-primary)',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: month === `${year}-${String(monthNum).padStart(2, '0')}` ? 600 : 400,
                              transition: 'all 0.2s'
                            }}
                          >
                            {monthName.substring(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="toolbar-right">
            <button className="btn-primary" onClick={exportToExcel}>
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
                    filteredReports.map((report, index) => (
                      <tr key={report.id || `report-${index}`}>
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

