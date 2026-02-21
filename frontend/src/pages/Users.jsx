import { useState, useEffect, useRef } from 'react';
import { 
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiMail, 
  FiPhone, FiUser, FiEye, FiEyeOff, FiGrid, FiList,
  FiChevronLeft, FiChevronRight, FiUpload, FiX, FiImage,
  FiBriefcase, FiMapPin, FiCalendar, FiHash,
  FiBell, FiCheckCircle, FiChevronDown
} from 'react-icons/fi';
import api, { usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import DatePicker from '../components/DatePicker';
import toast from 'react-hot-toast';
import './Users.css';

// Searchable Select Component for Reports To
const SearchableSelect = ({ value, onChange, options, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const filteredOptions = options.filter(opt => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (opt.label || '').toLowerCase().includes(search);
  });

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className="searchable-select" ref={dropdownRef}>
      <div
        className={`searchable-select-trigger ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <input
          type="text"
          readOnly
          value={selectedOption?.label || placeholder || 'Select...'}
          placeholder={placeholder}
          disabled={disabled}
          className="searchable-select-input"
          style={{ color: 'var(--text-primary)' }}
        />
        <FiChevronDown className={`searchable-select-arrow ${isOpen ? 'open' : ''}`} />
      </div>
      {isOpen && (
        <div className="searchable-select-dropdown">
          <div className="searchable-select-search">
            <FiSearch />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              autoFocus
              className="searchable-select-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="searchable-select-clear"
              >
                <FiX size={14} />
              </button>
            )}
          </div>
          <div className="searchable-select-options">
            {filteredOptions.length === 0 ? (
              <div className="searchable-select-no-results">No results found</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`searchable-select-option ${value === option.value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'grid'
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 48;
  const { isAdmin, isHR, user } = useAuth();
  const canManageUsers = isAdmin || isHR;
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    empid: '',
    name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    role: 'Employee',
    report_to_id: '',
    sms_consent: false,
    whatsapp_consent: false,
    email_consent: false,
    image_base64: '',
    dob: '',
    doj: '',
    designation: '',
    company_id: '',
    branch_id: '',
    department_id: ''
  });
  const [empidValidation, setEmpidValidation] = useState({ exists: false, name: '' });

  const filteredBranches = formData.company_id
    ? branches.filter((b) => b.company_id === Number(formData.company_id))
    : [];

  const filteredDepartments = formData.branch_id
    ? departments.filter((d) => d.branch_id === Number(formData.branch_id))
    : [];

  useEffect(() => {
    fetchData();
  }, [filter, user?.id, user?.role]);

  useEffect(() => {
    fetchOrgData();
  }, []);

  const fetchData = async () => {
    try {
      // Manager: show self + all subordinates (under of under); others: use getAll with role filter
      if (user?.role === 'Manager') {
        const [subordinatesRes, managersRes] = await Promise.all([
          usersAPI.getSubordinates().catch(() => ({ data: [] })),
          usersAPI.getManagers()
        ]);
        const subs = subordinatesRes?.data || [];
        const byId = new Map();
        if (user) byId.set(user.id, user);
        subs.forEach(u => byId.set(u.id, u));
        setUsers(Array.from(byId.values()));
        setManagers(managersRes.data || []);
        setAdmins([]);
      } else {
        const params = filter !== 'all' ? { role: filter } : {};
        const promises = [
          usersAPI.getAll(params),
          usersAPI.getManagers()
        ];
        if (isHR) {
          promises.push(usersAPI.getAll({ role: 'Admin' }));
        }
        const results = await Promise.all(promises);
        setUsers(results[0].data);
        setManagers(results[1].data);
        if (isHR && results[2]) {
          setAdmins(results[2].data || []);
        } else {
          setAdmins([]);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgData = async () => {
    try {
      const [companyRes, branchRes, deptRes] = await Promise.all([
        api.get('/company/list'),
        api.get('/branch/list'),
        api.get('/department/list')
      ]);
      setCompanies(companyRes.data || []);
      setBranches(branchRes.data || []);
      setDepartments(deptRes.data || []);
    } catch (error) {
      console.error('Error fetching org data:', error);
      toast.error('Failed to load company data');
    }
  };

  const handleCompanyChange = (value) => {
    setFormData({
      ...formData,
      company_id: value,
      branch_id: '',
      department_id: ''
    });
  };

  const handleBranchChange = (value) => {
    setFormData({
      ...formData,
      branch_id: value,
      department_id: ''
    });
  };

  const validateForm = () => {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return false;
    }

    // Validate phone (if provided, must be 10 digits)
    if (formData.phone && formData.phone.trim() !== '') {
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(formData.phone.replace(/\D/g, ''))) {
        toast.error('Phone number must be exactly 10 digits');
        return false;
      }
    }

    // Validate name (only letters, max 40 characters)
    if (!formData.name || formData.name.trim() === '') {
      toast.error('Full Name is required');
      return false;
    }
    
    // Check if name contains only letters and spaces
    const nameRegex = /^[A-Za-z\s]+$/;
    if (!nameRegex.test(formData.name.trim())) {
      toast.error('Full Name must contain only letters and spaces');
      return false;
    }
    
    if (formData.name.length > 40) {
      toast.error('Full Name must be 40 characters or less');
      return false;
    }

    // Validate designation (max 40 characters if provided)
    if (formData.designation && formData.designation.length > 40) {
      toast.error('Designation must be 40 characters or less');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields with toast notifications
    if (!formData.empid || formData.empid.trim() === '') {
      toast.error('Employee ID is required');
      return;
    }
    
    if (!formData.username || formData.username.trim() === '') {
      toast.error('Username is required');
      return;
    }
    
    if (!formData.email || formData.email.trim() === '') {
      toast.error('Email is required');
      return;
    }
    
    if (!editingUser && (!formData.password || formData.password.trim() === '')) {
      toast.error('Password is required');
      return;
    }
    
    // Validate form before submission
    if (!validateForm()) {
      return;
    }
    
    try {
      const data = {
        ...formData,
        name: formData.name.toUpperCase(),
        phone: formData.phone ? formData.phone.replace(/\D/g, '') : null,
        report_to_id: formData.report_to_id || null,
        company_id: formData.company_id ? Number(formData.company_id) : null,
        branch_id: formData.branch_id ? Number(formData.branch_id) : null,
        department_id: formData.department_id ? Number(formData.department_id) : null,
        dob: formData.dob || null,
        doj: formData.doj || null,
        designation: formData.designation || null
      };

      if (editingUser) {
        if (!data.password) delete data.password;
        await usersAPI.update(editingUser.id, data);
        toast.success('User updated successfully');
      } else {
        await usersAPI.create(data);
        toast.success('User created successfully');
      }
      
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save user');
    }
  };

  const handleEmpidChange = async (e) => {
    const empid = e.target.value;
    
    // Auto-populate username with empid when adding new user
    if (!editingUser) {
      setFormData({ ...formData, empid, username: empid });
    } else {
      setFormData({ ...formData, empid });
    }
    
    // Only validate if not editing and empid is not empty
    if (!editingUser && empid.trim()) {
      try {
        // Check if empid exists in users list
        const existingUser = users.find(u => u.empid === empid || u.empid === `BT-${empid}`);
        if (existingUser) {
          setEmpidValidation({ exists: true, name: existingUser.name });
        } else {
          setEmpidValidation({ exists: false, name: '' });
        }
      } catch (error) {
        setEmpidValidation({ exists: false, name: '' });
      }
    } else {
      setEmpidValidation({ exists: false, name: '' });
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      empid: user.empid,
      name: user.name?.toUpperCase() || user.name,
      email: user.email,
      phone: user.phone || '',
      username: user.username,
      password: '',
      role: user.role,
      report_to_id: user.report_to_id || '',
      sms_consent: user.sms_consent,
      whatsapp_consent: user.whatsapp_consent,
      email_consent: user.email_consent,
      image_base64: user.image_base64 || '',
      dob: user.dob || '',
      doj: user.doj || '',
      designation: user.designation || '',
      company_id: user.company_id || '',
      branch_id: user.branch_id || '',
      department_id: user.department_id || ''
    });
    setEmpidValidation({ exists: false, name: '' });
    setShowModal(true);
  };

  const handleView = (user) => {
    setViewingUser(user);
    setShowViewModal(true);
  };

  const handleDelete = async (id) => {
    // Show toast confirmation instead of window.confirm
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '250px' }}>
        <span style={{ marginBottom: '4px' }}>Are you sure you want to delete this user?</span>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await usersAPI.delete(id);
                toast.success('User deactivated successfully');
                fetchData();
              } catch (error) {
                toast.error(error.response?.data?.detail || 'Failed to deactivate user');
              }
            }}
            style={{
              padding: '6px 16px',
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            Delete
          </button>
          <button
            onClick={() => {
              toast.dismiss(t.id);
            }}
            style={{
              padding: '6px 16px',
              background: 'var(--bg-hover)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    ), {
      duration: 10000,
      id: `delete-user-${id}`,
      position: 'top-center'
    });
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      empid: '',
      name: '',
      email: '',
      phone: '',
      username: '',
      password: '',
      role: 'Employee',
      report_to_id: user?.empid || '',
      sms_consent: false,
      whatsapp_consent: false,
      email_consent: false,
      image_base64: '',
      dob: '',
      doj: '',
      designation: '',
      company_id: '',
      branch_id: '',
      department_id: ''
    });
    setEmpidValidation({ exists: false, name: '' });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image_base64: reader.result });
      };
      reader.onerror = () => {
        toast.error('Error reading image file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please drop an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image_base64: reader.result });
      };
      reader.onerror = () => {
        toast.error('Error reading image file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setFormData({ ...formData, image_base64: '' });
    // Reset file input
    const fileInput = document.getElementById('profile-image-input');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'Admin': return 'danger';
      case 'HR': return 'warning';
      case 'Manager': return 'primary';
      case 'Employee': return 'success';
      default: return 'primary';
    }
  };

  const filteredUsers = users.filter(u => {
    const matchRole = filter === 'all' || u.role === filter;
    const matchSearch = !search.trim() || [
      u.name,
      u.email,
      u.empid
    ].some(f => (f || '').toLowerCase().includes(search.toLowerCase()));
    return matchRole && matchSearch;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredUsers.length / recordsPerPage);
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredUsers.slice(indexOfFirstRecord, indexOfLastRecord);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter]);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">USERS</h1>
          <p className="page-subtitle">Manage all users in the system</p>
        </div>
        {canManageUsers && !isAdmin && (
          <button className="btn btn-primary" onClick={() => {
            resetForm();
            setShowModal(true);
          }}>
            <FiPlus /> Add User
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="users-filters">
        <div className="search-box" style={{ flex: 1, maxWidth: 300 }}>
          <FiSearch className="search-box-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          {['all', 'Admin', 'HR', 'Manager', 'Employee']
            .filter(role => isAdmin || isHR || role !== 'Admin')
            .map((role) => (
              <button
                key={role}
                className={`filter-tab ${filter === role ? 'active' : ''}`}
                onClick={() => setFilter(role)}
              >
                {role === 'all' ? 'All' : role + 's'}
              </button>
            ))}
        </div>

        <div className="view-toggle">
          <button 
            className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
            onClick={() => setViewMode('card')}
            title="Card View"
          >
            <FiGrid />
          </button>
          <button 
            className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Table View"
          >
            <FiList />
          </button>
        </div>
      </div>

      {/* Users Card View */}
      {viewMode === 'card' && (
        <div className="users-grid">
          {currentRecords.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <FiUser className="empty-state-icon" />
              <h3>No users found</h3>
            </div>
          ) : (
            currentRecords.map((user) => (
              <div key={user.id} className="user-card">
                <div className="user-card-header">
                  <div className="avatar avatar-lg">
                    {user.image_base64 ? (
                      <img src={user.image_base64} alt={user.name} />
                    ) : (
                      user.name?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className={`badge badge-${getRoleBadgeColor(user.role)}`}>
                    {user.role}
                  </span>
                </div>

                <div className="user-card-body">
                  <h3>{user.name?.toUpperCase()}</h3>
                  {user.designation && <p className="user-designation">{user.designation}</p>}
                  <p className="user-empid">{user.empid}</p>

                  <div className="user-contact">
                    <div className="contact-item">
                      <FiMail />
                      <span>{user.email}</span>
                    </div>
                    {user.phone && (
                      <div className="contact-item">
                        <FiPhone />
                        <span>{user.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="user-status">
                    <span className={`status-dot ${user.is_active ? 'active' : 'inactive'}`}></span>
                    <span>{user.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>

                <div className="user-card-footer">
                  <button className="btn-icon" onClick={() => handleView(user)}>
                    <FiEye />
                  </button>
                  {canManageUsers && !isAdmin && (
                    <>
                      <button className="btn-icon" onClick={() => handleEdit(user)}>
                        <FiEdit2 />
                      </button>
                      <button className="btn-icon" onClick={() => handleDelete(user.id)}>
                        <FiTrash2 />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Users Table View */}
      {viewMode === 'grid' && (
        <div className="card">
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Employee ID</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Designation</th>
                  <th>DOJ</th>
                  <th>DOB</th>
                  <th>Company</th>
                  <th>Branch</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-table">
                      <FiUser className="empty-state-icon" />
                      <p>No users found</p>
                    </td>
                  </tr>
                ) : (
                  currentRecords.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="user-cell">
                          <div className="avatar">
                            {user.image_base64 ? (
                              <img src={user.image_base64} alt={user.name} />
                            ) : (
                              user.name?.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="user-name">{user.name?.toUpperCase()}</span>
                        </div>
                      </td>
                      <td><span className="empid-badge">{user.empid}</span></td>
                      <td>{user.email}</td>
                      <td>{user.phone || '-'}</td>
                      <td>{user.designation || '-'}</td>
                      <td>{user.doj ? new Date(user.doj).toLocaleDateString() : '-'}</td>
                      <td>{user.dob ? new Date(user.dob).toLocaleDateString() : '-'}</td>
                      <td>{user.company_name || '-'}</td>
                      <td>{user.branch_name || '-'}</td>
                      <td>{user.department_name || '-'}</td>
                      <td>
                        <span className={`badge badge-${getRoleBadgeColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${user.is_active ? 'success' : 'danger'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="btn-icon btn-sm" onClick={() => handleView(user)}>
                            <FiEye />
                          </button>
                          {canManageUsers && !isAdmin && (
                            <>
                              <button className="btn-icon btn-sm" onClick={() => handleEdit(user)}>
                                <FiEdit2 />
                              </button>
                              <button className="btn-icon btn-sm" onClick={() => handleDelete(user.id)}>
                                <FiTrash2 />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-info">
            Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredUsers.length)} of {filteredUsers.length} users
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

      {/* Create/Edit Modal - close only via close icon or Cancel, not overlay */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          resetForm();
        }}
        title={editingUser ? 'Edit User' : 'Add User'}
        size="large"
        allowClose={false}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Employee ID *</label>
              <input
                type="text"
                className="form-input"
                value={formData.empid}
                onChange={handleEmpidChange}
                placeholder="EMP001"
                disabled={!!editingUser}
                style={{ color: 'var(--text-primary)' }}
              />
              {!editingUser && empidValidation.exists && (
                <div style={{ 
                  marginTop: '6px', 
                  fontSize: '0.85rem', 
                  color: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <FiCheckCircle size={14} />
                  <span>This empid already assigned to <strong>{empidValidation.name}</strong></span>
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Username *</label>
              <input
                type="text"
                className="form-input"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="username"
                disabled={true}
                style={{ color: 'var(--text-primary)', cursor: 'not-allowed' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => {
                const value = e.target.value;
                // Only allow letters and spaces
                if (value === '' || /^[A-Za-z\s]+$/.test(value)) {
                  setFormData({ ...formData, name: value.toUpperCase() });
                }
              }}
              placeholder="Enter full name (letters only)"
              maxLength={40}
              style={{ color: 'var(--text-primary)' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="text"
                className="form-input"
                value={formData.phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData({ ...formData, phone: value });
                }}
                placeholder="10 digits only"
                maxLength={10}
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <DatePicker
                value={formData.dob}
                onChange={(date) => {
                  setFormData({ ...formData, dob: date });
                  // If DOJ is before DOB, clear DOJ
                  if (formData.doj && date && formData.doj < date) {
                    setFormData(prev => ({ ...prev, dob: date, doj: '' }));
                  } else {
                    setFormData(prev => ({ ...prev, dob: date }));
                  }
                }}
                placeholder="Select date of birth"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Date of Joining</label>
              <DatePicker
                value={formData.doj}
                onChange={(date) => setFormData({ ...formData, doj: date })}
                placeholder="Select date of joining"
                min={formData.dob || undefined}
                disabled={!formData.dob}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input
                type="text"
                className="form-input"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="Enter designation"
                maxLength={40}
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Role *</label>
              <select
                className="form-select"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                style={{ color: 'var(--text-primary)' }}
              >
                <option value="Employee">Employee</option>
                <option value="Manager">Manager</option>
                <option value="HR">HR</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Company</label>
              <select
                className="form-select"
                value={formData.company_id}
                onChange={(e) => handleCompanyChange(e.target.value)}
                style={{ color: 'var(--text-primary)' }}
              >
                <option value="">Select company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id} style={{ color: 'var(--text-primary)' }}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Branch</label>
              <select
                className="form-select"
                value={formData.branch_id}
                onChange={(e) => handleBranchChange(e.target.value)}
                disabled={!formData.company_id}
                style={{ color: 'var(--text-primary)' }}
              >
                <option value="">{formData.company_id ? 'Select branch' : 'Select company first'}</option>
                {filteredBranches.map((b) => (
                  <option key={b.id} value={b.id} style={{ color: 'var(--text-primary)' }}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Department</label>
              <select
                className="form-select"
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                disabled={!formData.branch_id}
                style={{ color: 'var(--text-primary)' }}
              >
                <option value="">{formData.branch_id ? 'Select department' : 'Select branch first'}</option>
                {filteredDepartments.map((d) => (
                  <option key={d.id} value={d.id} style={{ color: 'var(--text-primary)' }}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Reports To</label>
              <SearchableSelect
                value={formData.report_to_id}
                onChange={(value) => setFormData({ ...formData, report_to_id: value })}
                placeholder="Select manager..."
                options={[
                  { value: '', label: 'No one' },
                  ...(user ? [{ value: user.empid, label: `${user.name} ${user.role === 'Manager' ? '(You)' : ''}` }] : []),
                  ...(isHR ? admins.filter(a => !user || a.empid !== user.empid).map(a => ({ value: a.empid, label: `${a.name} (Admin)` })) : []),
                  ...managers.filter(m => !user || m.empid !== user.empid).map(m => ({ value: m.empid, label: m.name }))
                ]}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password {editingUser ? '(leave blank to keep current)' : '*'}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Password"
                style={{ 
                  color: 'var(--text-primary)',
                  paddingRight: '40px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notification Preferences</label>
            <div className="consent-toggles-horizontal">
              <div className="toggle-column">
                <span className="toggle-title">Email</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={formData.email_consent}
                    onChange={(e) => setFormData({ ...formData, email_consent: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className={`toggle-status ${formData.email_consent ? 'yes' : 'no'}`}>
                  {formData.email_consent ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="toggle-column">
                <span className="toggle-title">WhatsApp</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={formData.whatsapp_consent}
                    onChange={(e) => setFormData({ ...formData, whatsapp_consent: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className={`toggle-status ${formData.whatsapp_consent ? 'yes' : 'no'}`}>
                  {formData.whatsapp_consent ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="toggle-column">
                <span className="toggle-title">SMS</span>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={formData.sms_consent}
                    onChange={(e) => setFormData({ ...formData, sms_consent: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className={`toggle-status ${formData.sms_consent ? 'yes' : 'no'}`}>
                  {formData.sms_consent ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Profile Image</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {formData.image_base64 && (
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <img
                    src={formData.image_base64}
                    alt="Profile preview"
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid var(--primary)',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: '#F44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                      transition: 'all 0.2s ease',
                      padding: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#D32F2F';
                      e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#F44336';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <FiX size={12} />
                  </button>
                </div>
              )}
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  id="profile-image-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="form-input"
                  style={{
                    paddingRight: '40px',
                    cursor: 'pointer'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  color: 'var(--text-secondary)'
                }}>
                  <FiUpload size={18} />
                </div>
              </div>
            </div>
            {formData.image_base64 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Image selected. Click to change.
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => {
              setShowModal(false);
              resetForm();
            }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {editingUser ? 'Update' : 'Create'} User
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setViewingUser(null);
        }}
        title="User Details"
        size="full"
      >
        {viewingUser ? (
          <div className="user-view" style={{ maxHeight: '80vh', overflowY: 'auto', paddingRight: '4px' }}>
            {/* Header Section */}
            <div className="user-view-header" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              marginBottom: '32px',
              paddingBottom: '28px',
              borderBottom: '2px solid var(--border-color)',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(14, 165, 233, 0.02) 100%)',
              margin: '-24px -24px 32px -24px',
              padding: '24px 24px 28px 24px',
              borderRadius: '12px 12px 0 0'
            }}>
              <div className="avatar avatar-lg" style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: viewingUser.image_base64 ? 'transparent' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                fontWeight: 700,
                color: 'white',
                border: '3px solid var(--border-color)',
                flexShrink: 0
              }}>
                {viewingUser.image_base64 ? (
                  <img src={viewingUser.image_base64} alt={viewingUser.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  viewingUser.name?.charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ 
                  marginBottom: '12px', 
                  fontSize: '1.75rem', 
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  lineHeight: '1.2',
                  wordBreak: 'break-word'
                }}>
                  {viewingUser.name?.toUpperCase()}
                </h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`badge badge-${getRoleBadgeColor(viewingUser.role)}`} style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                    {viewingUser.role}
                  </span>
                  <span className={`badge badge-${viewingUser.is_active ? 'success' : 'danger'}`} style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                    {viewingUser.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            {/* Details Sections */}
            <div className="user-view-details">
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '20px'
              }}>
                {/* Personal Information */}
                <div className="detail-section" style={{
                  padding: '20px',
                  background: 'var(--bg-hover)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)'
                }}>
                  <h4 style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-secondary)', 
                    marginBottom: '16px', 
                    textTransform: 'uppercase', 
                    letterSpacing: '1px', 
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <FiUser size={14} />
                    Personal Information
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <span className="label" style={{ 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <FiHash size={14} />
                        Employee ID
                      </span>
                  <span className="value" style={{ 
                    fontWeight: 600, 
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    fontFamily: 'monospace',
                    background: 'var(--bg-card)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)'
                  }}>
                    {viewingUser.empid}
                  </span>
                    </div>
                    <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <span className="label" style={{ 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <FiBriefcase size={14} />
                        Designation
                      </span>
                      <span className="value" style={{ 
                        fontWeight: 600, 
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem'
                      }}>
                        {viewingUser.designation || '-'}
                      </span>
                    </div>
                    <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <span className="label" style={{ 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <FiCalendar size={14} />
                        Date of Joining
                      </span>
                      <span className="value" style={{ 
                        fontWeight: 600, 
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem'
                      }}>
                        {viewingUser.doj ? new Date(viewingUser.doj).toLocaleDateString() : '-'}
                      </span>
                    </div>
                    <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <span className="label" style={{ 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <FiCalendar size={14} />
                        Date of Birth
                      </span>
                      <span className="value" style={{ 
                        fontWeight: 600, 
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem'
                      }}>
                        {viewingUser.dob ? new Date(viewingUser.dob).toLocaleDateString() : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Organization */}
                <div className="detail-section" style={{
                  padding: '20px',
                  background: 'var(--bg-hover)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)'
                }}>
                  <h4 style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-secondary)', 
                    marginBottom: '16px', 
                    textTransform: 'uppercase', 
                    letterSpacing: '1px', 
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <FiBriefcase size={14} />
                    Organization
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <span className="label" style={{ 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <FiBriefcase size={14} />
                        Company
                      </span>
                      <span className="value" style={{ 
                        fontWeight: 600, 
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        textAlign: 'right',
                        maxWidth: '60%',
                        wordBreak: 'break-word'
                      }}>
                        {viewingUser.company_name || '-'}
                      </span>
                    </div>
                    <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <span className="label" style={{ 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <FiMapPin size={14} />
                        Branch
                      </span>
                      <span className="value" style={{ 
                        fontWeight: 600, 
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        textAlign: 'right',
                        maxWidth: '60%',
                        wordBreak: 'break-word'
                      }}>
                        {viewingUser.branch_name || '-'}
                      </span>
                    </div>
                    <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <span className="label" style={{ 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <FiBriefcase size={14} />
                        Department
                      </span>
                      <span className="value" style={{ 
                        fontWeight: 600, 
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        textAlign: 'right',
                        maxWidth: '60%',
                        wordBreak: 'break-word'
                      }}>
                        {viewingUser.department_name || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="detail-section" style={{
                  padding: '20px',
                  background: 'var(--bg-hover)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)'
                }}>
                  <h4 style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-secondary)', 
                    marginBottom: '16px', 
                    textTransform: 'uppercase', 
                    letterSpacing: '1px', 
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <FiMail size={14} />
                    Contact Information
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <span className="label" style={{ 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <FiMail size={14} />
                        Email
                      </span>
                      <span className="value" style={{ 
                        fontWeight: 600, 
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem',
                        textAlign: 'right',
                        maxWidth: '60%',
                        wordBreak: 'break-word'
                      }}>
                        {viewingUser.email}
                      </span>
                    </div>
                    <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <span className="label" style={{ 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <FiPhone size={14} />
                        Phone
                      </span>
                      <span className="value" style={{ 
                        fontWeight: 600, 
                        color: 'var(--text-primary)',
                        fontSize: '0.95rem'
                      }}>
                        {viewingUser.phone || '-'}
                      </span>
                    </div>
                    <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <span className="label" style={{ 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.9rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <FiUser size={14} />
                        Username
                      </span>
                  <span className="value" style={{ 
                    fontWeight: 600, 
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    fontFamily: 'monospace',
                    background: 'var(--bg-card)',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)'
                  }}>
                    {viewingUser.username}
                  </span>
                    </div>
                  </div>
                </div>

                {/* Notification Preferences */}
                <div style={{ 
                  padding: '20px', 
                  background: 'var(--bg-hover)', 
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)'
                }}>
                  <h4 style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-secondary)', 
                    marginBottom: '16px', 
                    textTransform: 'uppercase', 
                    letterSpacing: '1px', 
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <FiBell size={14} />
                    Notification Preferences
                  </h4>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {viewingUser.email_consent && (
                      <span className="badge badge-info" style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}>
                        <FiCheckCircle size={14} />
                        Email
                      </span>
                    )}
                    {viewingUser.sms_consent && (
                      <span className="badge badge-info" style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}>
                        <FiCheckCircle size={14} />
                        SMS
                      </span>
                    )}
                    {viewingUser.whatsapp_consent && (
                      <span className="badge badge-info" style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}>
                        <FiCheckCircle size={14} />
                        WhatsApp
                      </span>
                    )}
                    {!viewingUser.email_consent && !viewingUser.sms_consent && !viewingUser.whatsapp_consent && (
                      <span style={{ 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.9rem', 
                        fontStyle: 'italic',
                        padding: '8px 14px',
                        background: 'var(--bg-card)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)'
                      }}>
                        No notifications enabled
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>Loading user details...</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Users;
