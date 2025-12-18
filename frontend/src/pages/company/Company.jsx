import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiBriefcase, FiMapPin, FiLayers, FiSearch } from 'react-icons/fi';
import './Company.css';

const Company = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('company'); // 'company', 'branch', 'department'
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
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

  useEffect(() => {
    fetchData();
  }, [activeTab]);

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

  const handleCompanySubmit = async (e) => {
    e.preventDefault();
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

  const canEdit = user?.role === 'Admin' || user?.role === 'HR';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Company Management</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Manage companies, branches, and departments
          </p>
        </div>
        {canEdit && (
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
            }}
          >
            <FiLayers style={{ marginRight: '8px' }} />
            Department
          </button>
        </div>

        {/* Search Bar */}
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
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Website</th>
                      {canEdit && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.length === 0 ? (
                      <tr>
                        <td colSpan={canEdit ? 5 : 4} className="empty-state-cell">
                          <div className="empty-state">
                            <p>{search ? 'No results found' : 'No companies added'}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredCompanies.map((company) => (
                        <tr key={company.id}>
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Branch Table */}
            {activeTab === 'branch' && (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Company</th>
                      {canEdit && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBranches.length === 0 ? (
                      <tr>
                        <td colSpan={canEdit ? 3 : 2} className="empty-state-cell">
                          <div className="empty-state">
                            <p>{search ? 'No results found' : 'No branch added'}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredBranches.map((branch) => (
                        <tr key={branch.id}>
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Department Table */}
            {activeTab === 'department' && (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Company</th>
                      <th>Branch</th>
                      {canEdit && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDepartments.length === 0 ? (
                      <tr>
                        <td colSpan={canEdit ? 4 : 3} className="empty-state-cell">
                          <div className="empty-state">
                            <p>{search ? 'No results found' : 'No department added'}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredDepartments.map((department) => (
                        <tr key={department.id}>
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
                    onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                    required
                    placeholder="Enter company name"
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
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        required
                        placeholder="Enter company name"
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
                    onChange={(e) => setEditForm({ name: e.target.value })}
                    required
                    placeholder="Enter name"
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
                required
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
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter branch name"
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
                required
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
                required
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
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter department name"
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
