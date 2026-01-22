import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { usersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiBriefcase, FiMapPin, FiLayers, FiSearch, FiChevronLeft, FiChevronRight, FiUser } from 'react-icons/fi';
import './Company.css';

const Company = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('company'); // 'company', 'branch', 'department', 'transfer'
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;
  
  // Data states
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  
  // Modal states
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingType, setEditingType] = useState(null); // 'company', 'branch', 'department'
  
  // Form states
  const [companyForm, setCompanyForm] = useState({
    name: '',
    email: '',
    phone: '',
    website: ''
  });
  
  const [branchForm, setBranchForm] = useState({
    name: '',
    company_id: ''
  });
  
  const [departmentForm, setDepartmentForm] = useState({
    name: '',
    company_id: '',
    branch_id: ''
  });
  
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    website: ''
  });

  // Transfer form states
  const [transferForm, setTransferForm] = useState({
    employee_id: '',
    company_id: '',
    branch_id: '',
    department_id: ''
  });
  const [employees, setEmployees] = useState([]);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [transferCompanies, setTransferCompanies] = useState([]);
  const [transferBranches, setTransferBranches] = useState([]);
  const [transferDepartments, setTransferDepartments] = useState([]);

  useEffect(() => {
    if (activeTab !== 'transfer') {
      fetchData();
    } else {
      // Fetch employees and companies for transfer tab
      fetchEmployeesForTransfer();
      fetchCompaniesForTransfer();
    }
  }, [activeTab]);

  useEffect(() => {
    // Fetch branches when company is selected in transfer form
    if (activeTab === 'transfer' && transferForm.company_id) {
      fetchBranchesForTransfer(transferForm.company_id);
    } else {
      setTransferBranches([]);
      setTransferDepartments([]);
      if (!transferForm.company_id) {
        setTransferForm(prev => ({ ...prev, branch_id: '', department_id: '' }));
      }
    }
  }, [transferForm.company_id, activeTab]);

  useEffect(() => {
    // Fetch departments when branch is selected in transfer form
    if (activeTab === 'transfer' && transferForm.branch_id) {
      fetchDepartmentsForTransfer(transferForm.branch_id);
    } else {
      if (!transferForm.branch_id) {
        setTransferForm(prev => ({ ...prev, department_id: '' }));
      }
    }
  }, [transferForm.branch_id, activeTab]);

  useEffect(() => {
    // Close employee dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (showEmployeeDropdown && !event.target.closest('.form-group')) {
        setShowEmployeeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmployeeDropdown]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'company') {
        const response = await api.get('/company/list');
        setCompanies(response.data || []);
      } else if (activeTab === 'branch') {
        const response = await api.get('/branch/list');
        setBranches(response.data || []);
      } else if (activeTab === 'department') {
        const response = await api.get('/department/list');
        setDepartments(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/company/list');
      return response.data || [];
    } catch (error) {
      console.error('Error fetching companies:', error);
      return [];
    }
  };

  const fetchBranchesByCompany = async (companyId) => {
    try {
      const response = await api.get(`/department/branches/${companyId}`);
      return response.data || [];
    } catch (error) {
      console.error('Error fetching branches:', error);
      return [];
    }
  };

  const fetchEmployeesForTransfer = async () => {
    try {
      const response = await usersAPI.getEmployees();
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    }
  };

  const fetchCompaniesForTransfer = async () => {
    try {
      const response = await api.get('/company/list');
      setTransferCompanies(response.data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to load companies');
    }
  };

  const fetchBranchesForTransfer = async (companyId) => {
    try {
      const response = await api.get(`/department/branches/${companyId}`);
      setTransferBranches(response.data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error('Failed to load branches');
      setTransferBranches([]);
    }
  };

  const fetchDepartmentsForTransfer = async (branchId) => {
    try {
      const response = await api.get(`/department/list`);
      const allDepartments = response.data || [];
      // Filter departments by branch_id
      const filtered = allDepartments.filter(dept => dept.branch_id === parseInt(branchId));
      setTransferDepartments(filtered);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
      setTransferDepartments([]);
    }
  };

  // Validation function for name (letters only, max 50 characters)
  const validateName = (name) => {
    if (!name || name.trim() === '') {
      return { valid: false, message: 'Name is required' };
    }
    if (name.length > 50) {
      return { valid: false, message: 'Name must be below 50 characters' };
    }
    // Only letters and spaces allowed
    const lettersOnlyRegex = /^[A-Za-z\s]+$/;
    if (!lettersOnlyRegex.test(name.trim())) {
      return { valid: false, message: 'Name must contain only letters' };
    }
    return { valid: true };
  };

  const handleCompanySubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!companyForm.name || companyForm.name.trim() === '') {
      toast.error('Name is required');
      return;
    }
    
    // Validate name format and length
    const nameValidation = validateName(companyForm.name);
    if (!nameValidation.valid) {
      toast.error(nameValidation.message);
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/company', companyForm);
      toast.success('Company created successfully');
      setShowCompanyModal(false);
      setCompanyForm({ name: '', email: '', phone: '', website: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create company');
    } finally {
      setLoading(false);
    }
  };

  const handleBranchSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!branchForm.company_id) {
      toast.error('Company is required');
      return;
    }
    if (!branchForm.name || branchForm.name.trim() === '') {
      toast.error('Branch name is required');
      return;
    }
    
    // Validate name format and length
    const nameValidation = validateName(branchForm.name);
    if (!nameValidation.valid) {
      toast.error(nameValidation.message);
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/branch', branchForm);
      toast.success('Branch created successfully');
      setShowBranchModal(false);
      setBranchForm({ name: '', company_id: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create branch');
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!departmentForm.company_id) {
      toast.error('Company is required');
      return;
    }
    if (!departmentForm.branch_id) {
      toast.error('Branch is required');
      return;
    }
    if (!departmentForm.name || departmentForm.name.trim() === '') {
      toast.error('Department name is required');
      return;
    }
    
    // Validate name format and length
    const nameValidation = validateName(departmentForm.name);
    if (!nameValidation.valid) {
      toast.error(nameValidation.message);
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/department', departmentForm);
      toast.success('Department created successfully');
      setShowDepartmentModal(false);
      setDepartmentForm({ name: '', company_id: '', branch_id: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create department');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!editForm.name || editForm.name.trim() === '') {
      toast.error('Name is required');
      return;
    }
    
    // Validate name format and length
    const nameValidation = validateName(editForm.name);
    if (!nameValidation.valid) {
      toast.error(nameValidation.message);
      return;
    }
    
    setLoading(true);
    try {
      if (editingType === 'company') {
        await api.put(`/company/${editingItem.id}`, editForm);
      } else if (editingType === 'branch') {
        await api.put(`/branch/${editingItem.id}`, { name: editForm.name });
      } else if (editingType === 'department') {
        await api.put(`/department/${editingItem.id}`, { name: editForm.name });
      }
      toast.success('Updated successfully');
      setShowEditModal(false);
      setEditingItem(null);
      setEditingType(null);
      setEditForm({ name: '', email: '', phone: '', website: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
    
    setLoading(true);
    try {
      await api.delete(`/${type}/${id}`);
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to delete ${type}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item, type) => {
    setEditingItem(item);
    setEditingType(type);
    if (type === 'company') {
      setEditForm({ 
        name: item.name || '', 
        email: item.email || '', 
        phone: item.phone || '', 
        website: item.website || '' 
      });
    } else {
      setEditForm({ name: item.name || '' });
    }
    setShowEditModal(true);
  };

  // Filter data based on search
  const filteredCompanies = companies.filter(item =>
    item.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.email?.toLowerCase().includes(search.toLowerCase()) ||
    item.phone?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBranches = branches.filter(item =>
    item.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.company_name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredDepartments = departments.filter(item =>
    item.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    item.branch_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Pagination calculations
  const getTotalPages = (data) => Math.ceil(data.length / recordsPerPage);
  const getPaginatedData = (data) => {
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    return data.slice(startIndex, endIndex);
  };

  // Get current data based on active tab
  const getCurrentData = () => {
    if (activeTab === 'company') return filteredCompanies;
    if (activeTab === 'branch') return filteredBranches;
    return filteredDepartments;
  };

  const currentData = getCurrentData();
  const totalPages = getTotalPages(currentData);
  const paginatedData = getPaginatedData(currentData);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const canEdit = user?.role === 'Admin' || user?.role === 'HR';

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!transferForm.employee_id) {
      toast.error('Employee is required');
      return;
    }
    if (!transferForm.company_id) {
      toast.error('Company is required');
      return;
    }
    if (!transferForm.branch_id) {
      toast.error('Branch is required');
      return;
    }
    if (!transferForm.department_id) {
      toast.error('Department is required');
      return;
    }
    
    setLoading(true);
    try {
      await usersAPI.update(parseInt(transferForm.employee_id), {
        company_id: parseInt(transferForm.company_id),
        branch_id: parseInt(transferForm.branch_id),
        department_id: parseInt(transferForm.department_id)
      });
      toast.success('Employee transferred successfully');
      setTransferForm({
        employee_id: '',
        company_id: '',
        branch_id: '',
        department_id: ''
      });
      setEmployeeSearchQuery('');
      setShowEmployeeDropdown(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to transfer employee');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name?.toLowerCase().includes(employeeSearchQuery.toLowerCase()) ||
    emp.empid?.toLowerCase().includes(employeeSearchQuery.toLowerCase()) ||
    (emp.email && emp.email.toLowerCase().includes(employeeSearchQuery.toLowerCase()))
  );

  const handleEmployeeSelect = (selectedEmployee) => {
    setTransferForm({
      ...transferForm,
      employee_id: selectedEmployee.id.toString()
    });
    setEmployeeSearchQuery(selectedEmployee.name || '');
    setShowEmployeeDropdown(false);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>COMPANY  MANAGEMENT</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Manage companies, branches, and departments
          </p>
        </div>
        {canEdit && activeTab !== 'transfer' && (
          <button className="btn-primary" onClick={() => {
            if (activeTab === 'company') setShowCompanyModal(true);
            else if (activeTab === 'branch') setShowBranchModal(true);
            else if (activeTab === 'department') setShowDepartmentModal(true);
          }}>
            <FiPlus style={{ marginRight: '8px' }} />
            Add {activeTab === 'company' ? 'Company' : activeTab === 'branch' ? 'Branch' : 'Department'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="company-tabs-container">
        <div className="filter-tabs">
          <button
            className={`filter-tab ${activeTab === 'company' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('company');
              setSearch('');
              setCurrentPage(1);
            }}
          >
          <FiBriefcase style={{ marginRight: '8px' }} />
          Company
          </button>
          <button
            className={`filter-tab ${activeTab === 'branch' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('branch');
              setSearch('');
              setCurrentPage(1);
            }}
          >
            <FiMapPin style={{ marginRight: '8px' }} />
            Branch
          </button>
          <button
            className={`filter-tab ${activeTab === 'department' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('department');
              setSearch('');
              setCurrentPage(1);
            }}
          >
            <FiLayers style={{ marginRight: '8px' }} />
            Department
          </button>
          <button
            className={`filter-tab ${activeTab === 'transfer' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('transfer');
              setSearch('');
              setCurrentPage(1);
            }}
          >
            <FiUser style={{ marginRight: '8px' }} />
            Transfer
          </button>
        </div>

        {/* Search Bar - Hidden for Transfer tab */}
        {activeTab !== 'transfer' && (
          <div className="search-container">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="company-content">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {/* Company Table */}
            {activeTab === 'company' && (
              <>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Sl. No</th>
                        <th>Company Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Website</th>
                        {canEdit && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {currentData.length === 0 ? (
                        <tr>
                          <td colSpan={canEdit ? 6 : 5} className="empty-state-cell">
                            <div className="empty-state">
                              <p>{search ? 'No results found' : 'No companies added'}</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedData.map((company, index) => {
                          const serialNumber = (currentPage - 1) * recordsPerPage + index + 1;
                          return (
                            <tr key={company.id}>
                              <td>{serialNumber}</td>
                              <td className="text-primary">{company.name}</td>
                              <td>{company.email || 'N/A'}</td>
                              <td>{company.phone || 'N/A'}</td>
                              <td>
                                {company.website ? (
                                  <a href={company.website} target="_blank" rel="noopener noreferrer">
                                    {company.website}
                                  </a>
                                ) : (
                                  'N/A'
                                )}
                              </td>
                              {canEdit && (
                                <td>
                                  <div className="action-buttons">
                                    <button className="btn-icon" onClick={() => handleEdit(company, 'company')} title="Edit">
                                      <FiEdit2 />
                                    </button>
                                    <button className="btn-icon btn-danger" onClick={() => handleDelete(company.id, 'company')} title="Delete">
                                      <FiTrash2 />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {currentData.length > 0 && totalPages > 1 && (
                  <div className="pagination-container">
                    <div className="pagination-info">
                      Showing {(currentPage - 1) * recordsPerPage + 1} to {Math.min(currentPage * recordsPerPage, currentData.length)} of {currentData.length} entries
                    </div>
                    <div className="pagination-controls">
                      <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <FiChevronLeft />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Show first page, last page, current page, and pages around current
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </button>
                          );
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return <span key={page} className="pagination-ellipsis">...</span>;
                        }
                        return null;
                      })}
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

            {/* Branch Table */}
            {activeTab === 'branch' && (
              <>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Sl. No</th>
                        <th>Name</th>
                        <th>Company</th>
                        {canEdit && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {currentData.length === 0 ? (
                        <tr>
                          <td colSpan={canEdit ? 4 : 3} className="empty-state-cell">
                            <div className="empty-state">
                              <p>{search ? 'No results found' : 'No branch added'}</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedData.map((branch, index) => {
                          const serialNumber = (currentPage - 1) * recordsPerPage + index + 1;
                          return (
                            <tr key={branch.id}>
                              <td>{serialNumber}</td>
                              <td className="text-primary">{branch.name}</td>
                              <td>{branch.company_name}</td>
                              {canEdit && (
                                <td>
                                  <div className="action-buttons">
                                    <button className="btn-icon" onClick={() => handleEdit(branch, 'branch')} title="Edit">
                                      <FiEdit2 />
                                    </button>
                                    <button className="btn-icon btn-danger" onClick={() => handleDelete(branch.id, 'branch')} title="Delete">
                                      <FiTrash2 />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {currentData.length > 0 && totalPages > 1 && (
                  <div className="pagination-container">
                    <div className="pagination-info">
                      Showing {(currentPage - 1) * recordsPerPage + 1} to {Math.min(currentPage * recordsPerPage, currentData.length)} of {currentData.length} entries
                    </div>
                    <div className="pagination-controls">
                      <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <FiChevronLeft />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Show first page, last page, current page, and pages around current
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </button>
                          );
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return <span key={page} className="pagination-ellipsis">...</span>;
                        }
                        return null;
                      })}
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

            {/* Transfer Tab */}
            {activeTab === 'transfer' && (
              <div className="card" style={{ padding: '24px' }}>
                <h2 style={{ marginBottom: '24px' }}>Transfer Employee</h2>
                <form onSubmit={handleTransferSubmit}>
                  <div className="form-row">
                    <div className="form-group" style={{ position: 'relative' }}>
                      <label>Employee *</label>
                      <div style={{ position: 'relative' }}>
                        <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', zIndex: 1 }} />
                        <input
                          type="text"
                          value={employeeSearchQuery}
                          onChange={(e) => {
                            setEmployeeSearchQuery(e.target.value);
                            setShowEmployeeDropdown(true);
                            if (!e.target.value) {
                              setTransferForm({ ...transferForm, employee_id: '' });
                            }
                          }}
                          onFocus={() => setShowEmployeeDropdown(true)}
                          placeholder="Search employee by name, ID or email..."
                          className="form-input"
                          style={{ paddingLeft: '40px' }}
                          autoComplete="off"
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
                                  transition: 'background 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px'
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'var(--bg-hover)'}
                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                              >
                                <div style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '50%',
                                  overflow: 'hidden',
                                  background: 'var(--bg-hover)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  border: '2px solid var(--border-color)'
                                }}>
                                  {emp.image_base64 ? (
                                    <img 
                                      src={emp.image_base64} 
                                      alt={emp.name}
                                      style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                      }}
                                    />
                                  ) : (
                                    <span style={{
                                      fontSize: '1.2rem',
                                      fontWeight: 600,
                                      color: 'var(--primary)'
                                    }}>
                                      {emp.name?.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{emp.name}</div>
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{emp.empid} {emp.email ? `• ${emp.email}` : ''}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Company *</label>
                      <select
                        className="form-select"
                        value={transferForm.company_id}
                        onChange={(e) => {
                          setTransferForm({
                            ...transferForm,
                            company_id: e.target.value,
                            branch_id: '',
                            department_id: ''
                          });
                        }}
                      >
                        <option value="">Select Company</option>
                        {transferCompanies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Branch *</label>
                      <select
                        className="form-select"
                        value={transferForm.branch_id}
                        onChange={(e) => {
                          setTransferForm({
                            ...transferForm,
                            branch_id: e.target.value,
                            department_id: ''
                          });
                        }}
                        disabled={!transferForm.company_id}
                      >
                        <option value="">Select Branch</option>
                        {transferBranches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Department *</label>
                      <select
                        className="form-select"
                        value={transferForm.department_id}
                        onChange={(e) => {
                          setTransferForm({
                            ...transferForm,
                            department_id: e.target.value
                          });
                        }}
                        disabled={!transferForm.branch_id}
                      >
                        <option value="">Select Department</option>
                        {transferDepartments.map((dept) => (
                          <option key={dept.id} value={dept.id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="modal-actions" style={{ marginTop: '24px' }}>
                    <button type="button" className="btn-secondary" onClick={() => {
                      setTransferForm({
                        employee_id: '',
                        company_id: '',
                        branch_id: '',
                        department_id: ''
                      });
                      setEmployeeSearchQuery('');
                      setShowEmployeeDropdown(false);
                    }}>
                      Clear
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? 'Transferring...' : 'Transfer Employee'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Department Table */}
            {activeTab === 'department' && (
              <>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Sl. No</th>
                        <th>Name</th>
                        <th>Company</th>
                        <th>Branch</th>
                        {canEdit && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {currentData.length === 0 ? (
                        <tr>
                          <td colSpan={canEdit ? 5 : 4} className="empty-state-cell">
                            <div className="empty-state">
                              <p>{search ? 'No results found' : 'No department added'}</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedData.map((department, index) => {
                          const serialNumber = (currentPage - 1) * recordsPerPage + index + 1;
                          return (
                            <tr key={department.id}>
                              <td>{serialNumber}</td>
                              <td className="text-primary">{department.name}</td>
                              <td>{department.company_name}</td>
                              <td>{department.branch_name}</td>
                              {canEdit && (
                                <td>
                                  <div className="action-buttons">
                                    <button className="btn-icon" onClick={() => handleEdit(department, 'department')} title="Edit">
                                      <FiEdit2 />
                                    </button>
                                    <button className="btn-icon btn-danger" onClick={() => handleDelete(department.id, 'department')} title="Delete">
                                      <FiTrash2 />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {currentData.length > 0 && totalPages > 1 && (
                  <div className="pagination-container">
                    <div className="pagination-info">
                      Showing {(currentPage - 1) * recordsPerPage + 1} to {Math.min(currentPage * recordsPerPage, currentData.length)} of {currentData.length} entries
                    </div>
                    <div className="pagination-controls">
                      <button
                        className="pagination-btn"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <FiChevronLeft />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Show first page, last page, current page, and pages around current
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </button>
                          );
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return <span key={page} className="pagination-ellipsis">...</span>;
                        }
                        return null;
                      })}
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
          </>
        )}
      </div>

      {/* Add Company Modal */}
      {showCompanyModal && (
        <div className="modal-overlay" onClick={() => setShowCompanyModal(false)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Company</h3>
              <button className="modal-close" onClick={() => setShowCompanyModal(false)}>×</button>
            </div>
            <form onSubmit={handleCompanySubmit} className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={companyForm.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow letters and spaces
                      if (value === '' || /^[A-Za-z\s]*$/.test(value)) {
                        if (value.length <= 50) {
                          setCompanyForm({ ...companyForm, name: value });
                        }
                      }
                    }}
                    placeholder="Enter company name (letters only, max 50 characters)"
                    maxLength={50}
                  />
                </div>
                <div className="form-group">
                  <label>Email <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 'normal' }}>(Optional)</span></label>
                  <input
                    type="email"
                    className="form-input"
                    value={companyForm.email}
                    onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                    placeholder="Enter email"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 'normal' }}>(Optional)</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={companyForm.phone}
                    onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="form-group">
                  <label>Website <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 'normal' }}>(Optional)</span></label>
                  <input
                    type="url"
                    className="form-input"
                    value={companyForm.website}
                    onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                    placeholder="https://www.example.com"
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCompanyModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Add Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {showBranchModal && (
        <BranchModal
          isOpen={showBranchModal}
          onClose={() => {
            setShowBranchModal(false);
            setBranchForm({ name: '', company_id: '' });
          }}
          onSubmit={handleBranchSubmit}
          formData={branchForm}
          setFormData={setBranchForm}
          loading={loading}
          fetchCompanies={fetchCompanies}
        />
      )}

      {/* Add Department Modal */}
      {showDepartmentModal && (
        <DepartmentModal
          isOpen={showDepartmentModal}
          onClose={() => {
            setShowDepartmentModal(false);
            setDepartmentForm({ name: '', company_id: '', branch_id: '' });
          }}
          onSubmit={handleDepartmentSubmit}
          formData={departmentForm}
          setFormData={setDepartmentForm}
          loading={loading}
          fetchCompanies={fetchCompanies}
          fetchBranchesByCompany={fetchBranchesByCompany}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && editingItem && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit {editingType === 'company' ? 'Company' : editingType === 'branch' ? 'Branch' : 'Department'}</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-body">
              {editingType === 'company' ? (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.name}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Only allow letters and spaces
                          if (value === '' || /^[A-Za-z\s]*$/.test(value)) {
                            if (value.length <= 50) {
                              setEditForm({ ...editForm, name: value });
                            }
                          }
                        }}
                        placeholder="Enter company name (letters only, max 50 characters)"
                        maxLength={50}
                      />
                    </div>
                    <div className="form-group">
                      <label>Email <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 'normal' }}>(Optional)</span></label>
                      <input
                        type="email"
                        className="form-input"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        placeholder="Enter email"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Phone <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 'normal' }}>(Optional)</span></label>
                      <input
                        type="text"
                        className="form-input"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="Enter phone number"
                      />
                    </div>
                    <div className="form-group">
                      <label>Website <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 'normal' }}>(Optional)</span></label>
                      <input
                        type="url"
                        className="form-input"
                        value={editForm.website}
                        onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                        placeholder="https://www.example.com"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.name}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow letters and spaces
                      if (value === '' || /^[A-Za-z\s]*$/.test(value)) {
                        if (value.length <= 50) {
                          setEditForm({ name: value });
                        }
                      }
                    }}
                    placeholder="Enter name (letters only, max 50 characters)"
                    maxLength={50}
                  />
                </div>
              )}
              <div className="modal-actions">
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

// Branch Modal Component
const BranchModal = ({ isOpen, onClose, onSubmit, formData, setFormData, loading, fetchCompanies }) => {
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchCompanies().then(setCompanies);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Branch</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={onSubmit} className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Company *</label>
              <select
                className="form-select"
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              >
                <option value="">Select Company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Branch Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => {
                  const value = e.target.value;
                  // Only allow letters and spaces
                  if (value === '' || /^[A-Za-z\s]*$/.test(value)) {
                    if (value.length <= 50) {
                      setFormData({ ...formData, name: value });
                    }
                  }
                }}
                placeholder="Enter branch name (letters only, max 50 characters)"
                maxLength={50}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Add Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Department Modal Component
const DepartmentModal = ({ isOpen, onClose, onSubmit, formData, setFormData, loading, fetchCompanies, fetchBranchesByCompany }) => {
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchCompanies().then(setCompanies);
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.company_id) {
      fetchBranchesByCompany(formData.company_id).then(setBranches);
    } else {
      setBranches([]);
    }
  }, [formData.company_id]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Department</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={onSubmit} className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Company *</label>
              <select
                className="form-select" 
                value={formData.company_id}
                onChange={(e) => {
                  setFormData({ ...formData, company_id: e.target.value, branch_id: '' });
                }}
              >
                <option value="">Select Company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Branch *</label>
              <select
                className="form-select"
                value={formData.branch_id}
                onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                disabled={!formData.company_id}
              >
                <option value="">Select Branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Department Name *</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => {
                  const value = e.target.value;
                  // Only allow letters and spaces
                  if (value === '' || /^[A-Za-z\s]*$/.test(value)) {
                    if (value.length <= 50) {
                      setFormData({ ...formData, name: value });
                    }
                  }
                }}
                placeholder="Enter department name (letters only, max 50 characters)"
                maxLength={50}
              />
            </div>
            <div className="form-group">
              {/* Empty div to maintain 2-column layout */}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !formData.branch_id}>
              {loading ? 'Creating...' : 'Add Department'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Company;
