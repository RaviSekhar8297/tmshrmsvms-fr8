import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { 
  FiDollarSign, FiUser, FiCalendar, FiSearch, FiDownload, 
  FiUpload, FiGrid, FiList, FiChevronLeft, FiChevronRight, FiMail
} from 'react-icons/fi';
import './Payroll.css';

const PayrollStructure = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [salaryStructures, setSalaryStructures] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchSalaryStructures();
  }, []);

  const fetchSalaryStructures = async () => {
    setLoading(true);
    try {
      const response = await api.get('/payroll/salary-structure');
      // Backend already filters by role, so we just use the response directly
      setSalaryStructures(response.data);
    } catch (error) {
      toast.error('Failed to load salary structures');
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on search term only (backend handles role-based filtering)
  const filteredData = useMemo(() => {
    let data = salaryStructures;
    
    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      data = data.filter(item => 
        (item.employee_name && item.employee_name.toLowerCase().includes(search)) ||
        (item.empid && item.empid.toString().toLowerCase().includes(search)) ||
        (item.name && item.name.toLowerCase().includes(search)) ||
        (item.employee_email && item.employee_email.toLowerCase().includes(search))
      );
    }
    
    return data;
  }, [salaryStructures, searchTerm]);

  // Pagination - 20 records per page (matching Users page)
  const recordsPerPage = 50;
  const totalPages = Math.ceil(filteredData.length / recordsPerPage) || 1;
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const paginatedData = filteredData.slice(indexOfFirstRecord, indexOfLastRecord);
  
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const formatCurrency = (amount) => {
    const num = amount || 0;
    // Remove .00 if it's a whole number
    if (num % 1 === 0) {
      return `₹${num.toLocaleString('en-IN')}`;
    }
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleDownloadExcel = async () => {
    try {
      const response = await api.get('/payroll/salary-structure/export-excel', {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `salary_structure_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      toast.error('Failed to download Excel file');
    }
  };

  const handleUploadExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload a valid Excel file (.xlsx or .xls)');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/payroll/salary-structure/upload-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success(`Excel uploaded successfully! Updated: ${response.data.updated}, Created: ${response.data.created}`);
      
      if (response.data.errors && response.data.errors.length > 0) {
        toast.error(`${response.data.errors.length} errors occurred during upload`);
      }

      fetchSalaryStructures();
      e.target.value = ''; // Reset file input
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload Excel file');
    } finally {
      setUploading(false);
    }
  };

  const handleTogglePF = async (structureId, currentValue) => {
    try {
      const response = await api.patch(`/payroll/salary-structure/${structureId}/toggle-pf`);
      toast.success('PF check updated successfully');
      
      // Update local state
      setSalaryStructures(prev => 
        prev.map(item => 
          item.id === structureId 
            ? { ...item, pf_check: response.data.pf_check }
            : item
        )
      );
    } catch (error) {
      console.error('Error toggling PF:', error);
      toast.error(error.response?.data?.detail || 'Failed to update PF check');
    }
  };

  const handleToggleESI = async (structureId, currentValue) => {
    try {
      const response = await api.patch(`/payroll/salary-structure/${structureId}/toggle-esi`);
      toast.success('ESI check updated successfully');
      
      // Update local state
      setSalaryStructures(prev => 
        prev.map(item => 
          item.id === structureId 
            ? { ...item, esi_check: response.data.esi_check }
            : item
        )
      );
    } catch (error) {
      console.error('Error toggling ESI:', error);
      toast.error(error.response?.data?.detail || 'Failed to update ESI check');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">SALARY STRUCTURE</h1>
          <p className="page-subtitle">
            {user?.role === 'Employee' || user?.role === 'Manager' 
              ? `View your salary structure${filteredData.length > 0 ? ` (${filteredData.length} record${filteredData.length > 1 ? 's' : ''})` : ''}`
              : `View and manage employee salary structures (${filteredData.length} records)`
            }
          </p>
        </div>
      </div>

      {/* Filters - Search, Upload/Download, View Toggle - Single Row */}
      <div className="header-buttons" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', width: '100%' }}>
        {/* Search - Flex grow */}
        <div className="search-box" style={{ flex: '1 1 220px', minWidth: '220px' }}>
          <FiSearch className="search-box-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Search by employee name, ID, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Actions - Right aligned */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {user?.role === 'HR' && (
            <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiUpload />
              Upload Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUploadExcel}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
          )}
          {(user?.role === 'HR' || user?.role === 'Admin') && (
            <button className="btn btn-secondary" onClick={handleDownloadExcel} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiDownload />
              Download Excel
            </button>
          )}

          {/* View Toggle */}
          <div className="view-toggle">
            <button 
              className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              <FiList />
            </button>
            <button 
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Card View"
            >
              <FiGrid />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading salary structures...</p>
        </div>
      ) : paginatedData.length === 0 ? (
        <div className="empty-state">
          <FiDollarSign style={{ fontSize: '3rem', marginBottom: '16px', opacity: 0.5 }} />
          <p>{searchTerm ? 'No results found' : 'No salary structures found'}</p>
        </div>
      ) : viewMode === 'table' ? (
        <>
          <div className="card">
            <div className="users-table-container">
              <table className="users-table">
              <thead className="sticky-header">
                <tr>
                  <th>Employee</th>
                  <th>Emp ID</th>
                  <th>DOJ</th>
                  <th>Salary/Annum</th>
                  <th>Salary/Month</th>
                  <th>Basic</th>
                  <th>HRA</th>
                  <th>CA</th>
                  <th>MA</th>
                  <th>SA</th>
                  <th>Emp PF</th>
                  <th>Emp ESI</th>
                  <th>Prof Tax</th>
                  <th>Employer PF</th>
                  <th>Employer ESI</th>
                  <th>Variable Pay</th>
                  <th>Retention Bonus</th>
                  <th>Net Salary</th>
                  <th>Monthly CTC</th>
                  <th>PF Check</th>
                  <th>ESI Check</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((structure) => (
                  <tr key={structure.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="avatar" style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '50%', 
                          overflow: 'hidden',
                          flexShrink: 0,
                          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.9rem'
                        }}>
                          {structure.employee_image ? (
                            <img 
                              src={structure.employee_image} 
                              alt={structure.employee_name || 'Employee'}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            (structure.employee_name || 'E').charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="employee-name">{structure.employee_name || 'N/A'}</div>
                          {structure.employee_email && (
                            <div className="employee-id" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {structure.employee_email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{structure.empid || 'N/A'}</td>
                    <td>{formatDate(structure.doj)}</td>
                    <td className="text-center">{formatCurrency(structure.salary_per_annum)}</td>
                    <td className="text-center">{formatCurrency(structure.salary_per_month)}</td>
                    <td className="text-center">{formatCurrency(structure.basic)}</td>
                    <td className="text-center">{formatCurrency(structure.hra)}</td>
                    <td className="text-center">{formatCurrency(structure.ca)}</td>
                    <td className="text-center">{formatCurrency(structure.ma)}</td>
                    <td className="text-center">{formatCurrency(structure.sa)}</td>
                    <td className="text-center">{formatCurrency(structure.employee_pf)}</td>
                    <td className="text-center">{formatCurrency(structure.employee_esi)}</td>
                    <td className="text-center">{formatCurrency(structure.professional_tax)}</td>
                    <td className="text-center">{formatCurrency(structure.employer_pf)}</td>
                    <td className="text-center">{formatCurrency(structure.employer_esi)}</td>
                    <td className="text-center">{formatCurrency(structure.variable_pay)}</td>
                    <td className="text-center">{formatCurrency(structure.retension_bonus)}</td>
                    <td className="text-center" style={{ fontWeight: 700, color: 'var(--success)' }}>
                      {formatCurrency(structure.net_salary)}
                    </td>
                    <td className="text-center" style={{ fontWeight: 600 }}>
                      {formatCurrency(structure.monthly_ctc)}
                    </td>
                    <td className="text-center">
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={structure.pf_check}
                          onChange={() => handleTogglePF(structure.id, structure.pf_check)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </td>
                    <td className="text-center">
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={structure.esi_check}
                          onChange={() => handleToggleESI(structure.id, structure.esi_check)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>

          {/* Pagination - Matching Users page style */}
          {totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info">
                Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredData.length)} of {filteredData.length} records
              </div>
              <div className="pagination-controls">
                <button 
                  className="pagination-btn"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <FiChevronLeft />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                    onClick={() => goToPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button 
                  className="pagination-btn"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <FiChevronRight />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="users-grid" style={{ 
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))'
          }}>
            {paginatedData.map((structure) => (
              <div key={structure.id} className="user-card">
                <div className="user-card-header" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '20px' }}>
                  {/* Avatar */}
                  <div className="avatar avatar-lg" style={{ flexShrink: 0 }}>
                    {structure.employee_image ? (
                      <img 
                        src={structure.employee_image} 
                        alt={structure.employee_name || 'Employee'}
                      />
                    ) : (
                      (structure.employee_name || 'E').charAt(0).toUpperCase()
                    )}
                  </div>
                  
                  {/* Name, Designation, EmpID */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, marginBottom: '8px' }}>{structure.employee_name?.toUpperCase() || 'N/A'}</h3>
                    <p className="user-empid" style={{ margin: 0, marginBottom: '8px' }}>
                      {structure.employee_designation || 'Update name'}
                    </p>
                    {structure.empid && (
                      <p className="user-empid" style={{ margin: 0 }}>
                        {structure.empid}
                      </p>
                    )}
                  </div>
                </div>
                <div className="user-card-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>DOJ</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{formatDate(structure.doj)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Salary/Annum</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{formatCurrency(structure.salary_per_annum)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Salary/Month</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{formatCurrency(structure.salary_per_month)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>Basic</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{formatCurrency(structure.basic)}</span>
                    </div>
                    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>HRA</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{formatCurrency(structure.hra)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '12px', marginTop: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 400 }}>CA</span>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{formatCurrency(structure.ca)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '12px', marginTop: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 400 }}>MA</span>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{formatCurrency(structure.ma)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: '12px', marginTop: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 400 }}>SA</span>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{formatCurrency(structure.sa)}</span>
                      </div>
                    </div>
                    <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Net Salary</span>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--success)' }}>
                          {formatCurrency(structure.net_salary)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>PF Check</span>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={structure.pf_check}
                            onChange={() => handleTogglePF(structure.id, structure.pf_check)}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>ESI Check</span>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={structure.esi_check}
                            onChange={() => handleToggleESI(structure.id, structure.esi_check)}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination for Grid View - Matching Users page style */}
          {totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info">
                Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredData.length)} of {filteredData.length} records
              </div>
              <div className="pagination-controls">
                <button 
                  className="pagination-btn"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <FiChevronLeft />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                    onClick={() => goToPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button 
                  className="pagination-btn"
                  onClick={() => goToPage(currentPage + 1)}
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

export default PayrollStructure;
