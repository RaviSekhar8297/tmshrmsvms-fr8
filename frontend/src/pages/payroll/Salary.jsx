import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { FiChevronLeft, FiChevronRight, FiSearch, FiDownload, FiUpload, FiChevronDown } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './Payroll.css';

const Salary = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [salaries, setSalaries] = useState([]);
  // Calculate previous month
  const getPreviousMonth = () => {
    const today = new Date();
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return prevMonth.toISOString().slice(0, 7);
  };

  const [monthYear, setMonthYear] = useState(getPreviousMonth());
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    total_pages: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMonthPicker && !event.target.closest('.month-picker-wrapper')) {
        setShowMonthPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMonthPicker]);

  useEffect(() => {
    fetchSalaries(1);
  }, [monthYear, searchTerm]);

  const fetchSalaries = async (pageNum = pagination.page) => {
    setLoading(true);
    try {
      const params = {
        page: pageNum,
        limit: pagination.limit
      };
      
      // Parse month-year if provided
      if (monthYear && monthYear.includes('-')) {
        const parts = monthYear.split('-');
        if (parts.length === 2) {
          params.year = parseInt(parts[0]);
          params.month = parseInt(parts[1]);
        }
      }
      
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      const response = await api.get('/payslip/list', { params });
      setSalaries(response.data.data || []);
      setPagination({
        page: pageNum,
        limit: pagination.limit,
        total: response.data.total || 0,
        total_pages: response.data.total_pages || 1
      });
    } catch (error) {
      console.error('Error fetching salaries:', error);
      setSalaries([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    if (num % 1 === 0) {
      return `₹${num.toLocaleString('en-IN')}`;
    }
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleExportExcel = async () => {
    try {
      const params = {};
      
      if (monthYear && monthYear.includes('-')) {
        const parts = monthYear.split('-');
        if (parts.length === 2) {
          params.year = parseInt(parts[0]);
          params.month = parseInt(parts[1]);
        }
      }
      
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      const response = await api.get('/payslip/export-excel', {
        params,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip_data_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Failed to export Excel file');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/payslip/upload-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      toast.success(`Upload successful! Inserted: ${response.data.inserted}, Updated: ${response.data.updated}`);
      
      // Refresh data on current page
      fetchSalaries(pagination.page);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };


  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>SALARY MANAGEMENT</h1>
        {user?.role !== 'Admin' && (
          <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleExportExcel}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <FiDownload /> Excel
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary"
              disabled={uploading}
              style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <FiUpload /> {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
        )}
      </div>

      {/* Search Bar with Month/Year */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div style={{ position: 'relative', maxWidth: '400px', flex: 1 }}>
          <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or employee ID..."
            className="form-input"
            style={{ paddingLeft: '40px', width: '100%' }}
          />
        </div>
        <div className="month-picker-wrapper" style={{ width: '180px' }}>
          <div 
            className="month-picker-input"
            onClick={() => setShowMonthPicker(!showMonthPicker)}
          >
            <span>
              {monthYear 
                ? new Date(monthYear + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : 'Select month'}
            </span>
            <FiChevronDown size={18} className={showMonthPicker ? 'rotate' : ''} />
          </div>
          {showMonthPicker && (
            <div className="month-picker-dropdown">
              <div className="month-picker-header">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const [year] = monthYear ? monthYear.split('-').map(Number) : [new Date().getFullYear()];
                    const currentYear = year || new Date().getFullYear();
                    const newYear = currentYear - 1;
                    const [_, month] = monthYear ? monthYear.split('-') : [null, String(new Date().getMonth() + 1).padStart(2, '0')];
                    setMonthYear(`${newYear}-${month}`);
                  }}
                  className="month-picker-nav"
                >
                  ←
                </button>
                <span className="month-picker-year">
                  {monthYear ? monthYear.split('-')[0] : new Date().getFullYear()}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const [year] = monthYear ? monthYear.split('-').map(Number) : [new Date().getFullYear()];
                    const currentYear = year || new Date().getFullYear();
                    const currentDate = new Date();
                    const maxYear = currentDate.getFullYear();
                    // Only allow going forward if the year is less than current year
                    if (currentYear < maxYear) {
                      const newYear = currentYear + 1;
                      const [_, month] = monthYear ? monthYear.split('-') : [null, String(new Date().getMonth() + 1).padStart(2, '0')];
                      setMonthYear(`${newYear}-${month}`);
                    }
                  }}
                  className="month-picker-nav"
                  disabled={monthYear ? parseInt(monthYear.split('-')[0]) >= new Date().getFullYear() : true}
                >
                  →
                </button>
              </div>
              <div className="month-picker-grid">
                {['December', 'November', 'October', 'September', 'August', 'July', 'June', 'May', 'April', 'March', 'February', 'January'].map((month, index) => {
                  const monthNum = 12 - index; // Reverse order: Dec=12, Nov=11, etc.
                  const year = monthYear ? parseInt(monthYear.split('-')[0]) : new Date().getFullYear();
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
                      key={month}
                      type="button"
                      className={`month-picker-option ${isCurrentMonth ? 'current' : ''} ${monthYear === `${year}-${String(monthNum).padStart(2, '0')}` ? 'selected' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const monthValue = `${year}-${String(monthNum).padStart(2, '0')}`;
                        setMonthYear(monthValue);
                        setShowMonthPicker(false);
                      }}
                    >
                      {month.substring(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading salary data...</p>
        </div>
      ) : (
        <>
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Emp ID</th>
                  <th>Designation</th>
                  <th>Salary Per Month</th>
                  <th>Salary Per Day</th>
                  <th>Basic</th>
                  <th>HRA</th>
                  <th>CA</th>
                  <th>MA</th>
                  <th>SA</th>
                  <th>Gross Salary</th>
                  <th>PF</th>
                  <th>ESI</th>
                  <th>PT</th>
                  <th>LOP</th>
                  <th>TDS</th>
                  <th>LWF</th>
                  <th>Late Logins</th>
                  <th>L.L.Deductions</th>
                  <th>Earned Gross</th>
                  <th>Net Salary</th>
                  <th>Presents</th>
                  <th>Absents</th>
                  <th>Half Days</th>
                  <th>Holidays</th>
                  <th>WO</th>
                  <th>Leaves</th>
                  <th>Payable Days</th>
                  <th>Arrear Salary</th>
                  <th>Loan Amount</th>
                  <th>Other Deductions</th>
                  <th>Month</th>
                  <th>Year</th>
                </tr>
              </thead>
              <tbody>
                {salaries.length === 0 ? (
                  <tr>
                    <td colSpan="34" className="text-center">HERE NO SALARY RECORDS </td>
                  </tr>
                ) : (
                  salaries.map((salary) => (
                    <tr key={salary.payslip_id}>
                      <td>{salary.full_name}</td>
                      <td>{salary.emp_id}</td>
                      <td>{salary.designation || '-'}</td>
                      <td>{formatCurrency(salary.salary_per_month)}</td>
                      <td>{formatCurrency(salary.salary_per_day || 0)}</td>
                      <td>{formatCurrency(salary.basic)}</td>
                      <td>{formatCurrency(salary.hra)}</td>
                      <td>{formatCurrency(salary.ca)}</td>
                      <td>{formatCurrency(salary.ma)}</td>
                      <td>{formatCurrency(salary.sa)}</td>
                      <td>{formatCurrency(salary.gross_salary)}</td>
                      <td>{formatCurrency(salary.pf)}</td>
                      <td>{formatCurrency(salary.esi)}</td>
                      <td>{formatCurrency(salary.pt || 0)}</td>
                      <td>{formatCurrency(salary.lop || 0)}</td>
                      <td>{formatCurrency(salary.tds || 0)}</td>
                      <td>{formatCurrency(salary.lwf || 0)}</td>
                      <td>{salary.late_logins || 0}</td>
                      <td>{formatCurrency(salary.late_login_deductions || 0)}</td>
                      <td>{formatCurrency(salary.earned_gross)}</td>
                      <td><strong>{formatCurrency(salary.net_salary)}</strong></td>
                      <td>{salary.present}</td>
                      <td>{salary.absent}</td>
                      <td>{salary.half_days || 0}</td>
                      <td>{salary.holidays || 0}</td>
                      <td>{salary.wo || 0}</td>
                      <td>{salary.leaves || 0}</td>
                      <td>{salary.payable_days}</td>
                      <td>{formatCurrency(salary.arrear_salary || 0)}</td>
                      <td>{formatCurrency(salary.loan_amount || 0)}</td>
                      <td>{formatCurrency(salary.other_deduction || 0)}</td>
                      <td>{monthNames[salary.month]}</td>
                      <td>{salary.year}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.total > 0 && (
            <div className="pagination">
              <div className="pagination-info">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
              </div>
              {pagination.total_pages > 1 && (
                <div className="pagination-controls">
                  <button 
                    className="pagination-btn"
                    onClick={() => fetchSalaries(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    <FiChevronLeft />
                  </button>
                  {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      className={`pagination-btn ${pagination.page === page ? 'active' : ''}`}
                      onClick={() => fetchSalaries(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button 
                    className="pagination-btn"
                    onClick={() => fetchSalaries(pagination.page + 1)}
                    disabled={pagination.page >= pagination.total_pages}
                  >
                    <FiChevronRight />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Salary;
