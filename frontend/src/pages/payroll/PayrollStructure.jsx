import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { 
  FiDollarSign, FiUser, FiCalendar, FiSearch, FiDownload, 
  FiUpload, FiGrid, FiList, FiChevronLeft, FiChevronRight 
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
      console.error('Error fetching salary structures:', error);
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
  const recordsPerPage = 20;
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
      console.error('Error downloading Excel:', error);
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
        console.warn('Upload errors:', response.data.errors);
        toast.error(`${response.data.errors.length} errors occurred during upload`);
      }

      fetchSalaryStructures();
      e.target.value = ''; // Reset file input
    } catch (error) {
      console.error('Error uploading Excel:', error);
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
          <h1>Salary Structure</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            {user?.role === 'Employee' || user?.role === 'Manager' 
              ? `View your salary structure${filteredData.length > 0 ? ` (${filteredData.length} record${filteredData.length > 1 ? 's' : ''})` : ''}`
              : `View and manage employee salary structures (${filteredData.length} records)`
            }
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {(user?.role === 'Admin' || user?.role === 'HR') && (
            <label className="btn-secondary" style={{ cursor: 'pointer', margin: 0 }}>
              <FiUpload style={{ marginRight: '8px' }} />
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
          <button className="btn-primary" onClick={handleDownloadExcel}>
            <FiDownload style={{ marginRight: '8px' }} />
            Download Excel
          </button>
        </div>
      </div>

      {/* Search and View Toggle */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '300px' }}>
          <FiSearch style={{ 
            position: 'absolute', 
            left: '12px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            color: 'var(--text-secondary)'
          }} />
          <input
            type="text"
            placeholder="Search by employee name, ID, or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            style={{
              width: '100%',
              padding: '12px 12px 12px 40px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className={`btn-secondary ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            style={{ padding: '10px 16px' }}
          >
            <FiList style={{ marginRight: '6px' }} />
            Table
          </button>
          <button
            className={`btn-secondary ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            style={{ padding: '10px 16px' }}
          >
            <FiGrid style={{ marginRight: '6px' }} />
            Grid
          </button>
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
          <div className="table-container">
            <table className="data-table salary-structure-table">
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
          <div className="structures-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', 
            gap: '20px' 
          }}>
            {paginatedData.map((structure) => (
              <div key={structure.id} className="structure-card">
                <div className="structure-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="avatar" style={{ 
                      width: '50px', 
                      height: '50px', 
                      borderRadius: '50%', 
                      overflow: 'hidden',
                      flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '1.1rem'
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
                      <h3>{structure.employee_name || 'N/A'}</h3>
                      {structure.employee_email && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {structure.employee_email}
                        </p>
                      )}
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {structure.empid || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="structure-details">
                  <div className="detail-row">
                    <span>ID:</span>
                    <span>{structure.id}</span>
                  </div>
                  <div className="detail-row">
                    <span>DOJ:</span>
                    <span>{formatDate(structure.doj)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Salary/Annum:</span>
                    <span>{formatCurrency(structure.salary_per_annum)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Salary/Month:</span>
                    <span>{formatCurrency(structure.salary_per_month)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Basic:</span>
                    <span>{formatCurrency(structure.basic)}</span>
                  </div>
                  <div className="detail-row">
                    <span>HRA:</span>
                    <span>{formatCurrency(structure.hra)}</span>
                  </div>
                  <div className="detail-row">
                    <span>CA:</span>
                    <span>{formatCurrency(structure.ca)}</span>
                  </div>
                  <div className="detail-row">
                    <span>MA:</span>
                    <span>{formatCurrency(structure.ma)}</span>
                  </div>
                  <div className="detail-row">
                    <span>SA:</span>
                    <span>{formatCurrency(structure.sa)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Employee PF:</span>
                    <span>{formatCurrency(structure.employee_pf)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Employee ESI:</span>
                    <span>{formatCurrency(structure.employee_esi)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Professional Tax:</span>
                    <span>{formatCurrency(structure.professional_tax)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Employer PF:</span>
                    <span>{formatCurrency(structure.employer_pf)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Employer ESI:</span>
                    <span>{formatCurrency(structure.employer_esi)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Variable Pay:</span>
                    <span>{formatCurrency(structure.variable_pay)}</span>
                  </div>
                  <div className="detail-row">
                    <span>Retention Bonus:</span>
                    <span>{formatCurrency(structure.retension_bonus)}</span>
                  </div>
                  <div className="detail-row" style={{ borderTop: '2px solid var(--border-color)', paddingTop: '12px', marginTop: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Net Salary:</span>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--success)' }}>
                      {formatCurrency(structure.net_salary)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span style={{ fontWeight: 600 }}>Monthly CTC:</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(structure.monthly_ctc)}</span>
                  </div>
                  <div className="detail-row">
                    <span>PF Check:</span>
                    <span>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={structure.pf_check}
                          onChange={() => handleTogglePF(structure.id, structure.pf_check)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>ESI Check:</span>
                    <span>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={structure.esi_check}
                          onChange={() => handleToggleESI(structure.id, structure.esi_check)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </span>
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
