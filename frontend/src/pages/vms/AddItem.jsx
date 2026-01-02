import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import { visitorsAPI, usersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiCamera, FiX, FiUser, FiMail, FiPhone, FiClock, FiSearch } from 'react-icons/fi';
import './VMS.css';
import '../Users.css';

const AddItem = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [visitors, setVisitors] = useState([]);
  // Set default tab based on route and role - Employee always sees 'list', others see 'add' or 'list' based on route
  const [activeTab, setActiveTab] = useState(
    user?.role === 'Employee' 
      ? 'list' 
      : (location.pathname.includes('/vms/list') ? 'list' : 'add')
  );
  
  // Ensure Employee always sees list view
  useEffect(() => {
    if (user?.role === 'Employee' && activeTab !== 'list') {
      setActiveTab('list');
    }
  }, [user?.role, activeTab]);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  const [formData, setFormData] = useState({
    fullname: '',
    email: '',
    phone: '',
    address: '',
    purpose: '',
    whometomeet: '',
    whometomeet_id: '',
    selfie: ''
  });

  useEffect(() => {
    if (activeTab === 'list') {
      fetchVisitors();
    }
    if (activeTab === 'add') {
      fetchUsers();
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserDropdown && !event.target.closest('.form-group')) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserDropdown]);

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getAll();
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchVisitors = async () => {
    try {
      const response = await visitorsAPI.getAll();
      setVisitors(response.data);
    } catch (error) {
      console.error('Error fetching visitors:', error);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      toast.error('Failed to access camera');
      console.error('Camera error:', error);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);
      setFormData({ ...formData, selfie: imageData });
      stopCamera();
      setShowCameraModal(false);
    }
  };

  const handleOpenCamera = () => {
    setShowCameraModal(true);
    setCapturedImage(null);
    // Start camera immediately when modal opens
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  const handleCloseCamera = () => {
    stopCamera();
    setShowCameraModal(false);
    setCapturedImage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.fullname) {
      toast.error('Full Name is required', { position: 'top-center' });
      return;
    }
    if (!formData.purpose) {
      toast.error('Purpose is required', { position: 'top-center' });
      return;
    }
    if (!formData.selfie) {
      toast.error('Selfie is required', { position: 'top-center' });
      return;
    }
    
    setLoading(true);
    try {
      await visitorsAPI.add(formData);
      toast.success('Visitor added successfully', { position: 'top-center' });
      setFormData({
        fullname: '',
        email: '',
        phone: '',
        address: '',
        purpose: '',
        whometomeet: '',
        whometomeet_id: '',
        selfie: ''
      });
      setCapturedImage(null);
      setSearchQuery('');
      setActiveTab('list');
      fetchVisitors();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add visitor', { position: 'top-center' });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.empid.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleUserSelect = (selectedUser) => {
    setFormData({
      ...formData,
      whometomeet: selectedUser.name,
      whometomeet_id: selectedUser.empid
    });
    setSearchQuery('');
    setShowUserDropdown(false);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const handleCheckout = async (visitorId) => {
    try {
      await visitorsAPI.checkout(visitorId);
      toast.success('Visitor checked out successfully');
      fetchVisitors();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to checkout visitor');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Visitor Management</h1>
      </div>

      {/* Tabs - Like Users page - Hide Add Visitor tab for Employee role */}
      {(user?.role !== 'Employee') && (
        <div className="filter-tabs" style={{ marginBottom: '24px' }}>
          <button
            className={`filter-tab ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            Add Visitor
          </button>
          <button
            className={`filter-tab ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            Visitors List
          </button>
        </div>
      )}

      {/* Add Visitor Tab */}
      {activeTab === 'add' && (
        <div className="card" style={{ width: '100%', maxWidth: '100%' }}>
          <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  name="fullname"
                  value={formData.fullname}
                  onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                  required
                  className="form-input"
                  placeholder="Enter full name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Purpose *</label>
                <select
                  name="purpose"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="form-input"
                  required
                >
                  <option value="">Select Purpose</option>
                  <option value="Business">Business</option>
                  <option value="Vendor">Vendor</option>
                  <option value="Client">Client</option>
                  <option value="Interview">Interview</option>
                  <option value="Family">Family</option>
                  <option value="Friend">Friend</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="form-input"
                  placeholder="Enter email"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="form-input"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows="3"
                  className="form-input"
                  placeholder="Enter address"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Whom to Meet</label>
                <div style={{ position: 'relative' }}>
                  <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', zIndex: 1 }} />
                  <input
                    type="text"
                    value={formData.whometomeet || searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowUserDropdown(true);
                      if (!e.target.value) {
                        setFormData({ ...formData, whometomeet: '', whometomeet_id: '' });
                      }
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                    placeholder="Search employee by name, ID or email..."
                    className="form-input"
                    style={{ paddingLeft: '40px' }}
                  />
                  {showUserDropdown && filteredUsers.length > 0 && (
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
                      {filteredUsers.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => handleUserSelect(u)}
                          style={{
                            padding: '12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.background = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{u.empid} {u.email ? `• ${u.email}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Selfie *</label>
                <div className="image-upload-container">
                  {capturedImage ? (
                    <div className="image-preview-wrapper">
                      <img src={capturedImage} alt="Selfie preview" className="image-preview" />
                      <button
                        type="button"
                        onClick={() => {
                          setCapturedImage(null);
                          setFormData({ ...formData, selfie: '' });
                        }}
                        className="remove-image-btn"
                      >
                        <FiX /> Remove
                      </button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative', width: '100%' }}>
                      {showCameraModal && videoRef.current && (
                        <div style={{
                          width: '100%',
                          maxWidth: '500px',
                          margin: '0 auto',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          border: '2px solid rgba(99, 102, 241, 0.3)',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                        }}>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            style={{ 
                              width: '100%', 
                              display: 'block',
                              background: '#000'
                            }}
                          />
                        </div>
                      )}
                      {!showCameraModal && (
                        <button
                          type="button"
                          onClick={handleOpenCamera}
                          className="image-upload-box"
                          style={{ 
                            cursor: 'pointer', 
                            border: '2px dashed var(--border-color)', 
                            borderRadius: '8px', 
                            padding: '32px', 
                            textAlign: 'center', 
                            background: 'var(--bg-primary)', 
                            width: '100%',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--primary)';
                            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.background = 'var(--bg-primary)';
                          }}
                        >
                          <FiCamera className="camera-icon" style={{ fontSize: '2rem', marginBottom: '8px', color: 'var(--primary)' }} />
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                            Click to open webcam
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Live webcam preview will be displayed here
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => {
                setFormData({
                  fullname: '',
                  email: '',
                  phone: '',
                  address: '',
                  purpose: '',
                  whometomeet: '',
                  whometomeet_id: '',
                  selfie: ''
                });
                setCapturedImage(null);
                setSearchQuery('');
              }}>
                Clear
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Submitting...' : 'Add Visitor'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Visitors List Tab - Card View like Users */}
      {activeTab === 'list' && (
        <div>
          {visitors.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <FiUser className="empty-state-icon" style={{ fontSize: '3rem', marginBottom: '16px', color: 'var(--text-secondary)' }} />
              <h3>No visitors found</h3>
            </div>
          ) : (
            <div className="users-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
              {visitors.map((visitor) => (
                <div 
                  key={visitor.id} 
                  className="user-card"
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                >
                  <div 
                    className="user-card-header"
                    style={{
                      padding: '24px 20px 20px 20px',
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(14, 165, 233, 0.05) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      position: 'relative'
                    }}
                  >
                    {/* Image on left */}
                    <div 
                      className="avatar avatar-lg"
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        border: '3px solid var(--bg-card)',
                        overflow: 'hidden',
                        background: 'var(--bg-hover)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        flexShrink: 0
                      }}
                    >
                      {visitor.selfie ? (
                        <img 
                          src={visitor.selfie} 
                          alt={visitor.fullname}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      ) : (
                        <FiUser size={32} style={{ color: 'var(--text-secondary)' }} />
                      )}
                    </div>
                    
                    {/* Status and VTID on right in column */}
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px',
                      flex: 1,
                      alignItems: 'flex-start'
                    }}>
                      <span 
                        className={`badge ${visitor.status === 'IN' ? 'badge-success' : 'badge-danger'}`}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}
                      >
                        {visitor.status}
                      </span>
                      <p style={{ 
                        fontSize: '0.85rem', 
                        color: 'var(--text-secondary)',
                        margin: 0
                      }}>
                        VT ID: <strong style={{ color: 'var(--text-primary)' }}>{visitor.vtid}</strong>
                      </p>
                    </div>
                  </div>

                  <div 
                    className="user-card-body"
                    style={{
                      padding: '20px',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    {/* Name and Purpose in row */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}>
                      <h3 style={{ 
                        fontSize: '1.2rem', 
                        fontWeight: 700, 
                        margin: 0,
                        color: 'var(--text-primary)',
                        lineHeight: '1.3',
                        flex: 1,
                        minWidth: '120px'
                      }}>
                        {visitor.fullname}
                      </h3>
                      {visitor.purpose && (
                        <span style={{ 
                          fontSize: '0.9rem', 
                          color: 'var(--primary)',
                          fontWeight: 500,
                          padding: '4px 12px',
                          background: 'rgba(99, 102, 241, 0.1)',
                          borderRadius: '12px',
                          whiteSpace: 'nowrap'
                        }}>
                          {visitor.purpose}
                        </span>
                      )}
                    </div>

                    <div 
                      className="user-contact"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        marginTop: '8px',
                        paddingTop: '16px',
                        borderTop: '1px solid var(--border-color)'
                      }}
                    >
                      {visitor.email && (
                        <div 
                          className="contact-item"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <FiMail size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span style={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {visitor.email}
                          </span>
                        </div>
                      )}
                      {visitor.phone && (
                        <div 
                          className="contact-item"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <FiPhone size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span>{visitor.phone}</span>
                        </div>
                      )}
                      {visitor.whometomeet && (
                        <div 
                          className="contact-item"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          <FiUser size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span style={{ 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            Meeting: <strong style={{ color: 'var(--text-primary)' }}>{visitor.whometomeet}</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    <div 
                      className="user-status"
                      style={{
                        marginTop: 'auto',
                        paddingTop: '16px',
                        borderTop: '1px solid var(--border-color)',
                        width: '100%'
                      }}
                    >
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        fontSize: '0.85rem',
                        width: '100%'
                      }}>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          alignItems: 'center',
                          padding: '12px',
                          background: 'var(--bg-hover)',
                          borderRadius: '8px'
                        }}>
                          <div style={{
                            fontWeight: 600,
                            color: 'var(--primary)',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                          }}>
                            IN
                          </div>
                          <div style={{
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            textAlign: 'center',
                            wordBreak: 'break-word',
                            fontWeight: 500
                          }}>
                            {formatDateTime(visitor.checkintime)}
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          alignItems: 'center',
                          padding: '12px',
                          background: 'var(--bg-hover)',
                          borderRadius: '8px'
                        }}>
                          <div style={{
                            fontWeight: 600,
                            color: visitor.checkouttime ? 'var(--primary)' : 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            marginBottom: '4px'
                          }}>
                            OUT
                          </div>
                          <div style={{
                            color: visitor.checkouttime ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontSize: '0.85rem',
                            textAlign: 'center',
                            wordBreak: 'break-word',
                            fontWeight: 500
                          }}>
                            {visitor.checkouttime ? formatDateTime(visitor.checkouttime) : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {visitor.status === 'IN' && (
                    <div 
                      className="user-card-footer"
                      style={{
                        padding: '16px 20px',
                        borderTop: '1px solid var(--border-color)',
                        background: 'var(--bg-hover)'
                      }}
                    >
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={() => handleCheckout(visitor.id)}
                        style={{ 
                          width: '100%',
                          padding: '10px 16px',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                          color: 'white',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'translateY(-2px)';
                          e.target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        Check Out
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Camera Modal - Only show when modal is explicitly opened */}
      {showCameraModal && (
        <div className="modal-overlay" onClick={handleCloseCamera}>
          <div className="modal-content camera-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Capture Selfie - Live Webcam</h3>
              <button className="modal-close" onClick={handleCloseCamera}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              {!capturedImage ? (
                <>
                  <div style={{
                    width: '100%',
                    maxWidth: '500px',
                    margin: '0 auto',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '3px solid rgba(99, 102, 241, 0.3)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                    background: '#000',
                    position: 'relative'
                  }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      style={{ 
                        width: '100%', 
                        display: 'block',
                        maxHeight: '400px'
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '12px',
                      left: '12px',
                      background: 'rgba(0, 0, 0, 0.7)',
                      color: '#fff',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}>
                      🔴 LIVE
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
                    <button 
                      className="btn-primary" 
                      onClick={captureImage}
                      style={{ 
                        padding: '12px 24px',
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <FiCamera size={20} /> Capture Photo
                    </button>
                    <button 
                      className="btn-secondary" 
                      onClick={handleCloseCamera}
                      style={{ padding: '12px 24px' }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    width: '100%',
                    maxWidth: '500px',
                    margin: '0 auto',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '3px solid rgba(16, 185, 129, 0.3)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
                  }}>
                    <img 
                      src={capturedImage} 
                      alt="Captured" 
                      style={{ 
                        width: '100%', 
                        display: 'block'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
                    <button 
                      className="btn-primary" 
                      onClick={() => {
                        setShowCameraModal(false);
                      }}
                      style={{ 
                        padding: '12px 24px',
                        fontSize: '1rem'
                      }}
                    >
                      Use This Photo
                    </button>
                    <button 
                      className="btn-secondary" 
                      onClick={() => {
                        setCapturedImage(null);
                        setTimeout(() => startCamera(), 100);
                      }}
                      style={{ padding: '12px 24px' }}
                    >
                      Retake
                    </button>
                    <button 
                      className="btn-secondary" 
                      onClick={handleCloseCamera}
                      style={{ padding: '12px 24px' }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddItem;
