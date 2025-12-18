import { useState, useEffect } from 'react';
import { FiUser, FiMail, FiPhone, FiEdit2, FiSave, FiLock, FiPlus, FiTrash2, FiX, FiDownload } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { usersAPI, authAPI } from '../services/api';
import toast from 'react-hot-toast';
import './Profile.css';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Modal states for each detail type
  const [showModal, setShowModal] = useState(null); // 'bank', 'nominee', 'family', 'education', 'experience', 'documents'
  const [editingIndex, setEditingIndex] = useState(null);
  const [detailFormData, setDetailFormData] = useState({});
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    sms_consent: user?.sms_consent || false,
    whatsapp_consent: user?.whatsapp_consent || false,
    email_consent: user?.email_consent || false,
    image_base64: user?.image_base64 || ''
  });

  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await usersAPI.update(user.id, formData);
      updateUser(response.data);
      toast.success('Profile updated successfully');
      setEditing(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      await authAPI.changePassword({
        old_password: passwordData.old_password,
        new_password: passwordData.new_password
      });
      toast.success('Password changed successfully');
      setChangingPassword(false);
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image_base64: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        sms_consent: user?.sms_consent || false,
        whatsapp_consent: user?.whatsapp_consent || false,
        email_consent: user?.email_consent || false,
        image_base64: user?.image_base64 || ''
      });
    }
  }, [user]);

  // Handle detail update
  const handleDetailUpdate = async (detailType, data, action = 'add', index = null) => {
    setLoading(true);
    try {
      let payload;
      if (detailType === 'bank_details' || detailType === 'nominee_details') {
        // Single object types
        payload = data;
      } else {
        // Array types - ensure index is a number
        const indexValue = index !== null ? parseInt(index) : null;
        payload = { 
          action, 
          data: data || {}, 
          index: indexValue 
        };
      }
      
      console.log('Updating detail:', { detailType, payload }); // Debug log
      
      const response = await usersAPI.updateDetail(user.id, detailType, payload);
      // Force refresh user data
      const updatedUser = await usersAPI.getById(user.id);
      updateUser(updatedUser.data);
      toast.success(`${detailType.replace(/_/g, ' ')} ${action === 'add' ? 'added' : action === 'edit' ? 'updated' : 'deleted'} successfully`);
      setShowModal(null);
      setEditingIndex(null);
      setDetailFormData({});
    } catch (error) {
      console.error('Error updating detail:', error); // Debug log
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to update details';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Handle detail delete
  const handleDetailDelete = async (detailType, index) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    
    setLoading(true);
    try {
      const indexValue = parseInt(index);
      console.log('Deleting detail:', { detailType, index: indexValue }); // Debug log
      
      await usersAPI.updateDetail(user.id, detailType, {
        action: 'delete',
        index: indexValue
      });
      // Force refresh user data
      const updatedUser = await usersAPI.getById(user.id);
      updateUser(updatedUser.data);
      toast.success('Item deleted successfully');
    } catch (error) {
      console.error('Error deleting detail:', error); // Debug log
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to delete item';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Open modal for add/edit
  const openModal = (type, index = null) => {
    setShowModal(type);
    setEditingIndex(index);
    
    if (index !== null) {
      // Edit mode - populate form with existing data
      if (type === 'bank_details') {
        setDetailFormData(user?.bank_details ? {...user.bank_details} : {});
      } else if (type === 'nominee_details') {
        setDetailFormData(user?.nominee_details ? {...user.nominee_details} : {});
      } else if (type === 'family_details') {
        const familyData = user?.family_details;
        if (Array.isArray(familyData) && familyData[index]) {
          setDetailFormData({...familyData[index]});
        } else {
          setDetailFormData({});
        }
      } else if (type === 'education_details') {
        const eduData = user?.education_details;
        if (Array.isArray(eduData) && eduData[index]) {
          setDetailFormData({...eduData[index]});
        } else {
          setDetailFormData({});
        }
      } else if (type === 'experience_details') {
        const expData = user?.experience_details;
        if (Array.isArray(expData) && expData[index]) {
          setDetailFormData({...expData[index]});
        } else {
          setDetailFormData({});
        }
      } else if (type === 'documents') {
        const docData = user?.documents;
        if (Array.isArray(docData) && docData[index]) {
          setDetailFormData({...docData[index]});
        } else {
          setDetailFormData({});
        }
      }
    } else {
      // Add mode - reset form
      setDetailFormData({});
    }
  };

  // Handle document image upload
  const handleDocumentImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDetailFormData({ ...detailFormData, image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle document download
  const handleDocumentDownload = (doc, index) => {
    if (!doc.image) {
      toast.error('No image available for download');
      return;
    }

    try {
      // Convert base64 to blob
      const base64Data = doc.image.split(',')[1] || doc.image;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = doc.name || `document-${index + 1}`;
      link.download = `${fileName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Document downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download document');
    }
  };

  return (
    <div className="profile-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">PROFILE</h1>
          <p className="page-subtitle">Manage your personal information</p>
        </div>
      </div>

      <div className="profile-layout">
        {/* Profile Card */}
        <div className="card profile-card">
          <div className="profile-header">
            <div className="profile-avatar">
              {formData.image_base64 ? (
                <img src={formData.image_base64} alt={user?.name} />
              ) : (
                <span>{user?.name?.charAt(0).toUpperCase()}</span>
              )}
              {editing && (
                <label className="avatar-upload">
                  <input type="file" accept="image/*" onChange={handleImageChange} />
                  <FiEdit2 />
                </label>
              )}
            </div>
            <div className="profile-info">
              <h2>{user?.name}</h2>
              <span className="badge badge-primary">{user?.role}</span>
              <p className="profile-empid">{user?.empid}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="profile-details">
              <div className="form-group">
                <label className="form-label"><FiUser /> Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!editing}
                />
              </div>

              <div className="form-group">
                <label className="form-label"><FiMail /> Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!editing}
                />
              </div>

              <div className="form-group">
                <label className="form-label"><FiPhone /> Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!editing}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notification Preferences</label>
                <div className="consent-toggles-horizontal">
                  <div className="toggle-column">
                    <span className="toggle-title">Email</span>
                    <label className={`toggle-switch ${!editing ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={formData.email_consent}
                        onChange={(e) => setFormData({ ...formData, email_consent: e.target.checked })}
                        disabled={!editing}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className={`toggle-status ${formData.email_consent ? 'yes' : 'no'}`}>
                      {formData.email_consent ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="toggle-column">
                    <span className="toggle-title">WhatsApp</span>
                    <label className={`toggle-switch ${!editing ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={formData.whatsapp_consent}
                        onChange={(e) => setFormData({ ...formData, whatsapp_consent: e.target.checked })}
                        disabled={!editing}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className={`toggle-status ${formData.whatsapp_consent ? 'yes' : 'no'}`}>
                      {formData.whatsapp_consent ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="toggle-column">
                    <span className="toggle-title">SMS</span>
                    <label className={`toggle-switch ${!editing ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={formData.sms_consent}
                        onChange={(e) => setFormData({ ...formData, sms_consent: e.target.checked })}
                        disabled={!editing}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className={`toggle-status ${formData.sms_consent ? 'yes' : 'no'}`}>
                      {formData.sms_consent ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="profile-actions">
              {editing ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    <FiSave /> Save Changes
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
                  <FiEdit2 /> Edit Profile
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Security Card */}
        <div className="card security-card">
          <div className="card-header">
            <h3 className="card-title"><FiLock /> Security</h3>
          </div>

          {changingPassword ? (
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordData.old_password}
                  onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  required
                />
              </div>
              <div className="profile-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setChangingPassword(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Change Password
                </button>
              </div>
            </form>
          ) : (
            <div className="security-info">
              <p>Keep your account secure by using a strong password.</p>
              <button className="btn btn-secondary" onClick={() => setChangingPassword(true)}>
                <FiLock /> Change Password
              </button>
            </div>
          )}
        </div>

        {/* Account Info */}
        <div className="card account-card">
          <div className="card-header">
            <h3 className="card-title">Account Information</h3>
          </div>
          <div className="account-info-table">
            <table className="info-table">
              <tbody>
                <tr>
                  <td className="info-label">Username</td>
                  <td className="info-value">{user?.username}</td>
                </tr>
                <tr>
                  <td className="info-label">Employee ID</td>
                  <td className="info-value">{user?.empid}</td>
                </tr>
                <tr>
                  <td className="info-label">Role</td>
                  <td className="info-value">
                    <span className="badge badge-info">{user?.role}</span>
                  </td>
                </tr>
                <tr>
                  <td className="info-label">Designation</td>
                  <td className="info-value">
                    {user?.designation && user.designation.trim() ? user.designation : 'Pending'}
                  </td>
                </tr>
                <tr>
                  <td className="info-label">Account Status</td>
                  <td className="info-value">
                    <span className={`badge badge-${user?.is_active ? 'success' : 'danger'}`}>
                      {user?.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="info-label">Member Since</td>
                  <td className="info-value">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Additional Details Section */}
      <div className="profile-details-section">
        <h2 className="section-title">Additional Details</h2>
        
        {/* Row 1: Family Details, Nominee Details */}
        <div className="details-row">
          {/* Family Details */}
          <div className="detail-card">
            <div className="detail-card-header">
              <h3 className="detail-card-title">Family Details</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`detail-status ${user?.family_details && user.family_details.length > 0 ? 'completed' : 'pending'}`}>
                  {user?.family_details && user.family_details.length > 0 ? 'Completed' : 'Pending'}
                </span>
                <button className="detail-action-btn" onClick={() => openModal('family_details')}>
                  <FiPlus />
                </button>
              </div>
            </div>
            <div className="detail-card-body">
              {user?.family_details && Array.isArray(user.family_details) && user.family_details.length > 0 ? (
                <table className="detail-members-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Relation</th>
                      <th>Phone</th>
                      <th>Aadhar</th>
                      <th className="action-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.family_details.map((member, index) => (
                      <tr key={`family-${index}`}>
                        <td>{member?.name || '-'}</td>
                        <td>{member?.relation || '-'}</td>
                        <td>{member?.phone || '-'}</td>
                        <td>{member?.aadhar || '-'}</td>
                        <td className="action-cell">
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button 
                              className="detail-edit-btn" 
                              onClick={() => {
                                console.log('Editing family member at index:', index);
                                openModal('family_details', index);
                              }}
                              title="Edit"
                            >
                              <FiEdit2 />
                            </button>
                            <button 
                              className="detail-delete-btn" 
                              onClick={() => {
                                console.log('Deleting family member at index:', index);
                                handleDetailDelete('family_details', index);
                              }}
                              title="Delete"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="detail-pending">Pending</div>
              )}
            </div>
          </div>

          {/* Nominee Details */}
          <div className="detail-card">
            <div className="detail-card-header">
              <h3 className="detail-card-title">Nominee Details</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`detail-status ${user?.nominee_details ? 'completed' : 'pending'}`}>
                  {user?.nominee_details ? 'Completed' : 'Pending'}
                </span>
                <button className="detail-action-btn" onClick={() => openModal('nominee_details', user?.nominee_details ? 0 : null)}>
                  {user?.nominee_details ? <FiEdit2 /> : <FiPlus />}
                </button>
              </div>
            </div>
            <div className="detail-card-body">
              {user?.nominee_details ? (
                <table className="detail-members-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Relation</th>
                      <th>Phone</th>
                      <th>Aadhar</th>
                      <th className="action-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{user.nominee_details?.name || '-'}</td>
                      <td>{user.nominee_details?.relation || '-'}</td>
                      <td>{user.nominee_details?.phone || '-'}</td>
                      <td>{user.nominee_details?.aadhar || '-'}</td>
                      <td className="action-cell">
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            className="detail-edit-btn" 
                            onClick={() => openModal('nominee_details', 0)}
                            title="Edit"
                          >
                            <FiEdit2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="detail-pending">Pending</div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Bank Details, Education Details */}
        <div className="details-row">
          {/* Bank Details */}
          <div className="detail-card">
            <div className="detail-card-header">
              <h3 className="detail-card-title">Bank Details</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`detail-status ${user?.bank_details ? 'completed' : 'pending'}`}>
                  {user?.bank_details ? 'Completed' : 'Pending'}
                </span>
                <button className="detail-action-btn" onClick={() => openModal('bank_details', user?.bank_details ? 0 : null)}>
                  {user?.bank_details ? <FiEdit2 /> : <FiPlus />}
                </button>
              </div>
            </div>
            <div className="detail-card-body">
              {user?.bank_details ? (
                <table className="detail-members-table">
                  <thead>
                    <tr>
                      <th>Bank Name</th>
                      <th>Account Number</th>
                      <th>IFSC</th>
                      <th>PAN</th>
                      <th>Aadhar</th>
                      <th className="action-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{user.bank_details?.bank_name || '-'}</td>
                      <td>{user.bank_details?.account_number || '-'}</td>
                      <td>{user.bank_details?.ifsc || '-'}</td>
                      <td>{user.bank_details?.pan || '-'}</td>
                      <td>{user.bank_details?.aadhar || '-'}</td>
                      <td className="action-cell">
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            className="detail-edit-btn" 
                            onClick={() => openModal('bank_details', 0)}
                            title="Edit"
                          >
                            <FiEdit2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="detail-pending">Pending</div>
              )}
            </div>
          </div>

          {/* Education Details */}
          <div className="detail-card">
            <div className="detail-card-header">
              <h3 className="detail-card-title">Education Details</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`detail-status ${user?.education_details && user.education_details.length > 0 ? 'completed' : 'pending'}`}>
                  {user?.education_details && user.education_details.length > 0 ? 'Completed' : 'Pending'}
                </span>
                <button className="detail-action-btn" onClick={() => openModal('education_details')}>
                  <FiPlus />
                </button>
              </div>
            </div>
            <div className="detail-card-body">
              {user?.education_details && Array.isArray(user.education_details) && user.education_details.length > 0 ? (
                <table className="detail-members-table">
                  <thead>
                    <tr>
                      <th>Education</th>
                      <th>Pass Out Year</th>
                      <th>Percentage</th>
                      <th className="action-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.education_details.map((edu, index) => (
                      <tr key={index}>
                        <td>{edu.education_name || '-'}</td>
                        <td>{edu.pass_out_year || '-'}</td>
                        <td>{edu.percentage ? `${edu.percentage}%` : '-'}</td>
                        <td className="action-cell">
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button className="detail-edit-btn" onClick={() => openModal('education_details', index)}>
                              <FiEdit2 />
                            </button>
                            <button className="detail-delete-btn" onClick={() => handleDetailDelete('education_details', index)}>
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="detail-pending">Pending</div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Experience Details, Documents */}
        <div className="details-row">
          {/* Experience Details */}
          <div className="detail-card">
            <div className="detail-card-header">
              <h3 className="detail-card-title">Experience Details</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`detail-status ${user?.experience_details && user.experience_details.length > 0 ? 'completed' : 'pending'}`}>
                  {user?.experience_details && user.experience_details.length > 0 ? 'Completed' : 'Pending'}
                </span>
                <button className="detail-action-btn" onClick={() => openModal('experience_details')}>
                  <FiPlus />
                </button>
              </div>
            </div>
            <div className="detail-card-body">
              {user?.experience_details && Array.isArray(user.experience_details) && user.experience_details.length > 0 ? (
                <table className="detail-members-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Year</th>
                      <th>Designation</th>
                      <th>Salary (PA)</th>
                      <th className="action-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.experience_details.map((exp, index) => (
                      <tr key={index}>
                        <td>{exp.prev_company_name || '-'}</td>
                        <td>{exp.year || '-'}</td>
                        <td>{exp.designation || '-'}</td>
                        <td>{exp.salary_per_annum ? `₹${exp.salary_per_annum}` : '-'}</td>
                        <td className="action-cell">
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button className="detail-edit-btn" onClick={() => openModal('experience_details', index)}>
                              <FiEdit2 />
                            </button>
                            <button className="detail-delete-btn" onClick={() => handleDetailDelete('experience_details', index)}>
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="detail-pending">Pending</div>
              )}
            </div>
          </div>

        </div>

        {/* Documents Section - Full Width */}
        <div className="documents-section">
          <div className="detail-card documents-card">
            <div className="detail-card-header">
              <h3 className="detail-card-title">Documents</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`detail-status ${user?.documents && user.documents.length > 0 ? 'completed' : 'pending'}`}>
                  {user?.documents && user.documents.length > 0 ? 'Completed' : 'Pending'}
                </span>
                <button className="detail-action-btn" onClick={() => openModal('documents')}>
                  <FiPlus />
                </button>
              </div>
            </div>
            <div className="detail-card-body">
              {user?.documents && Array.isArray(user.documents) && user.documents.length > 0 ? (
                <div className="detail-items documents-grid">
                  {user.documents.map((doc, index) => (
                    <div key={`doc-${index}`} className="document-item">
                      {doc?.image && (
                        <img src={doc.image} alt={doc?.name || 'Document'} className="document-image" />
                      )}
                      <div className="document-name">{doc?.name || 'Document'}</div>
                      <div className="document-actions">
                        <button className="detail-download-btn" onClick={() => handleDocumentDownload(doc, index)} title="Download">
                          <FiDownload />
                        </button>
                        <button 
                          className="detail-edit-btn" 
                          onClick={() => {
                            console.log('Editing document at index:', index);
                            openModal('documents', index);
                          }} 
                          title="Edit"
                        >
                          <FiEdit2 />
                        </button>
                        <button 
                          className="detail-delete-btn" 
                          onClick={() => {
                            console.log('Deleting document at index:', index);
                            handleDetailDelete('documents', index);
                          }} 
                          title="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="detail-pending">Pending</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modals */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(null); setEditingIndex(null); setDetailFormData({}); }}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {editingIndex !== null ? 'Edit' : 'Add'} {
                  showModal === 'bank_details' ? 'Bank Details' :
                  showModal === 'nominee_details' ? 'Nominee Details' :
                  showModal === 'family_details' ? 'Family Member' :
                  showModal === 'education_details' ? 'Education' :
                  showModal === 'experience_details' ? 'Experience' :
                  'Document'
                }
              </h3>
              <button className="modal-close" onClick={() => { setShowModal(null); setEditingIndex(null); setDetailFormData({}); }}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={(e) => {
                e.preventDefault();
                const action = editingIndex !== null ? 'edit' : 'add';
                handleDetailUpdate(showModal, detailFormData, action, editingIndex);
              }}>
                {showModal === 'bank_details' && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Bank Name *</label>
                        <input type="text" className="form-input" value={detailFormData.bank_name || ''} onChange={(e) => setDetailFormData({...detailFormData, bank_name: e.target.value})} required />
                      </div>
                      <div className="form-group">
                        <label>Account Number *</label>
                        <input type="text" className="form-input" value={detailFormData.account_number || ''} onChange={(e) => setDetailFormData({...detailFormData, account_number: e.target.value})} required />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>IFSC *</label>
                        <input type="text" className="form-input" value={detailFormData.ifsc || ''} onChange={(e) => setDetailFormData({...detailFormData, ifsc: e.target.value})} required />
                      </div>
                      <div className="form-group">
                        <label>PAN</label>
                        <input type="text" className="form-input" value={detailFormData.pan || ''} onChange={(e) => setDetailFormData({...detailFormData, pan: e.target.value})} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Aadhar</label>
                      <input type="text" className="form-input" value={detailFormData.aadhar || ''} onChange={(e) => setDetailFormData({...detailFormData, aadhar: e.target.value})} />
                    </div>
                  </>
                )}

                {showModal === 'nominee_details' && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Name *</label>
                        <input type="text" className="form-input" value={detailFormData.name || ''} onChange={(e) => setDetailFormData({...detailFormData, name: e.target.value})} required />
                      </div>
                      <div className="form-group">
                        <label>Relation *</label>
                        <input type="text" className="form-input" value={detailFormData.relation || ''} onChange={(e) => setDetailFormData({...detailFormData, relation: e.target.value})} required />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Phone *</label>
                        <input type="text" className="form-input" value={detailFormData.phone || ''} onChange={(e) => setDetailFormData({...detailFormData, phone: e.target.value})} required />
                      </div>
                      <div className="form-group">
                        <label>Aadhar</label>
                        <input type="text" className="form-input" value={detailFormData.aadhar || ''} onChange={(e) => setDetailFormData({...detailFormData, aadhar: e.target.value})} />
                      </div>
                    </div>
                  </>
                )}

                {showModal === 'family_details' && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Name *</label>
                        <input type="text" className="form-input" value={detailFormData.name || ''} onChange={(e) => setDetailFormData({...detailFormData, name: e.target.value})} required />
                      </div>
                      <div className="form-group">
                        <label>Relation *</label>
                        <input type="text" className="form-input" value={detailFormData.relation || ''} onChange={(e) => setDetailFormData({...detailFormData, relation: e.target.value})} required />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Phone</label>
                        <input type="text" className="form-input" value={detailFormData.phone || ''} onChange={(e) => setDetailFormData({...detailFormData, phone: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label>Aadhar</label>
                        <input type="text" className="form-input" value={detailFormData.aadhar || ''} onChange={(e) => setDetailFormData({...detailFormData, aadhar: e.target.value})} />
                      </div>
                    </div>
                  </>
                )}

                {showModal === 'education_details' && (
                  <>
                    <div className="form-group">
                      <label>Education Name *</label>
                      <input type="text" className="form-input" value={detailFormData.education_name || ''} onChange={(e) => setDetailFormData({...detailFormData, education_name: e.target.value})} required />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Pass Out Year</label>
                        <input type="number" className="form-input" value={detailFormData.pass_out_year || ''} onChange={(e) => setDetailFormData({...detailFormData, pass_out_year: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label>Percentage</label>
                        <input type="number" step="0.01" className="form-input" value={detailFormData.percentage || ''} onChange={(e) => setDetailFormData({...detailFormData, percentage: e.target.value})} />
                      </div>
                    </div>
                  </>
                )}

                {showModal === 'experience_details' && (
                  <>
                    <div className="form-group">
                      <label>Previous Company Name *</label>
                      <input type="text" className="form-input" value={detailFormData.prev_company_name || ''} onChange={(e) => setDetailFormData({...detailFormData, prev_company_name: e.target.value})} required />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Year</label>
                        <input type="text" className="form-input" value={detailFormData.year || ''} onChange={(e) => setDetailFormData({...detailFormData, year: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label>Designation</label>
                        <input type="text" className="form-input" value={detailFormData.designation || ''} onChange={(e) => setDetailFormData({...detailFormData, designation: e.target.value})} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Salary Per Annum</label>
                      <input type="number" step="0.01" className="form-input" value={detailFormData.salary_per_annum || ''} onChange={(e) => setDetailFormData({...detailFormData, salary_per_annum: e.target.value})} />
                    </div>
                  </>
                )}

                {showModal === 'documents' && (
                  <>
                    <div className="form-group">
                      <label>Document Name *</label>
                      <input type="text" className="form-input" value={detailFormData.name || ''} onChange={(e) => setDetailFormData({...detailFormData, name: e.target.value})} required />
                    </div>
                    <div className="form-group">
                      <label>Document Image</label>
                      <input type="file" accept="image/*" className="form-input" onChange={handleDocumentImageChange} />
                      {detailFormData.image && (
                        <img src={detailFormData.image} alt="Preview" style={{ marginTop: '8px', maxWidth: '200px', borderRadius: '8px' }} />
                      )}
                    </div>
                  </>
                )}

                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(null); setEditingIndex(null); setDetailFormData({}); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : editingIndex !== null ? 'Update' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;





