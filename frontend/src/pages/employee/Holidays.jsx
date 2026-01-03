import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import DatePicker from '../../components/DatePicker';
import './Employee.css';

const Holidays = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [branches, setBranches] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', description: '' });
  const [updatingPermission, setUpdatingPermission] = useState(null);
  const updateQueueRef = useRef(new Map());
  const processingRef = useRef(false);

  const isAdminOrHR = user?.role === 'Admin' || user?.role === 'HR';

  useEffect(() => {
    fetchHolidays();
    if (isAdminOrHR) {
      fetchBranches();
    }
  }, [year, isAdminOrHR]);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/holidays?year=${year}`);
      setHolidays(response.data);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await api.get('/branch/list');
      setBranches(response.data || []);
    } catch (error) {
      console.error('Error fetching branches:', error);
      toast.error('Failed to load branches');
    }
  };

  // For delete operations, use all holidays (Admin/HR only)
  const upcomingHolidays = holidays.filter(h => new Date(h.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
  const pastHolidays = holidays.filter(h => new Date(h.date) < new Date()).sort((a, b) => new Date(b.date) - new Date(a.date));

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newHoliday.name || !newHoliday.date) {
      toast.error('Please fill name and date');
      return;
    }
    try {
      const holidayData = {
        ...newHoliday,
        holiday_permissions: []
      };
      if (editingHoliday) {
        await api.put(`/holidays/${editingHoliday.id}`, holidayData);
        toast.success('Holiday updated');
      } else {
        await api.post('/holidays', holidayData);
        toast.success('Holiday added');
      }
      setShowModal(false);
      setEditingHoliday(null);
      setNewHoliday({ name: '', date: '', description: '' });
      fetchHolidays();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save holiday');
    }
  };

  const handleEdit = (holiday) => {
    setEditingHoliday(holiday);
    setNewHoliday({
      name: holiday.name,
      date: holiday.date,
      description: holiday.description || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (holidayId) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    try {
      await api.delete(`/holidays/${holidayId}`);
      toast.success('Holiday deleted');
      fetchHolidays();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete holiday');
    }
  };

  const handleDeleteUpcomingByYear = async () => {
    if (!window.confirm(`Are you sure you want to delete all upcoming holidays for ${year}?`)) return;
    try {
      const upcoming = holidays.filter(h => {
        const holidayDate = new Date(h.date);
        return holidayDate >= new Date() && holidayDate.getFullYear() === year;
      });
      
      for (const holiday of upcoming) {
        await api.delete(`/holidays/${holiday.id}`);
      }
      toast.success(`Deleted ${upcoming.length} upcoming holiday(s) for ${year}`);
      fetchHolidays();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete holidays');
    }
  };

  const isBranchChecked = (holiday, branchId) => {
    if (!holiday.holiday_permissions || holiday.holiday_permissions.length === 0) {
      return false;
    }
    return holiday.holiday_permissions.some(p => p.branch_id === branchId);
  };

  // Process update queue sequentially
  const processQueue = async () => {
    if (processingRef.current || updateQueueRef.current.size === 0) return;
    
    processingRef.current = true;
    const queueEntries = Array.from(updateQueueRef.current.entries());
    
    // Clear the queue before processing to prevent duplicates
    updateQueueRef.current.clear();
    
    for (const [key, { holiday, branch, isChecked }] of queueEntries) {
      setUpdatingPermission(key);
      
      try {
        await api.put(`/holidays/${holiday.id}/permissions`, {
          branch_id: branch.id,
          branch_name: branch.name,
          is_checked: isChecked
        });
      } catch (error) {
        console.error('Error updating permission:', error);
        toast.error(error.response?.data?.detail || `Failed to update permission for ${branch.name}`);
      } finally {
        setUpdatingPermission(null);
        // Small delay between requests to ensure DB consistency
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
    
    // Refresh holidays after all updates complete
    fetchHolidays();
    processingRef.current = false;
    
    // Check if more items were added while processing
    if (updateQueueRef.current.size > 0) {
      setTimeout(processQueue, 100);
    }
  };

  const handlePermissionToggle = async (holiday, branch) => {
    const isChecked = isBranchChecked(holiday, branch.id);
    const newCheckedState = !isChecked;
    const key = `${holiday.id}-${branch.id}`;
    
    // Optimistic update - update local state immediately
    const updatedHolidays = holidays.map(h => {
      if (h.id === holiday.id) {
        const currentPermissions = h.holiday_permissions || [];
        let updatedPermissions;
        
        if (newCheckedState) {
          // Add branch if not exists
          if (!currentPermissions.some(p => p.branch_id === branch.id)) {
            updatedPermissions = [...currentPermissions, { branch_id: branch.id, branch_name: branch.name }];
          } else {
            updatedPermissions = currentPermissions;
          }
        } else {
          // Remove branch
          updatedPermissions = currentPermissions.filter(p => p.branch_id !== branch.id);
        }
        
        return { ...h, holiday_permissions: updatedPermissions };
      }
      return h;
    });
    setHolidays(updatedHolidays);
    
    // Add to queue for sequential processing
    updateQueueRef.current.set(key, { holiday, branch, isChecked: newCheckedState });
    
    // Trigger queue processing if not already processing
    if (!processingRef.current) {
      setTimeout(processQueue, 50);
    }
  };

  // Filter holidays based on user's branch_id for Employee/Manager roles
  // Admin/HR see all holidays to manage permissions
  const getFilteredHolidays = () => {
    // Admin/HR see all holidays (no filtering) so they can manage permissions
    if (isAdminOrHR) {
      return holidays;
    }
    
    // For Employee and Manager: only show holidays where their branch_id matches
    if (user?.branch_id) {
      return holidays.filter(holiday => {
        // If holiday has no permissions, don't show it
        if (!holiday.holiday_permissions || holiday.holiday_permissions.length === 0) {
          return false;
        }
        // Check if user's branch_id exists in the holiday's holiday_permissions array
        // Logic: If logged user's branch_id matches any branch_id in holiday_permissions → Show holiday
        // Example: 
        //   - User branch_id = 1
        //   - holiday_permissions = [{"branch_id": 1, "branch_name": "CORPORATE OFFICE"}, {"branch_id": 2, "branch_name": "MUMBAI"}]
        //   - Since branch_id 1 exists in the array → Show holiday ✓
        //   - If holiday_permissions = [{"branch_id": 2, "branch_name": "MUMBAI"}] → Don't show holiday ✗
        return holiday.holiday_permissions.some(
          perm => perm.branch_id === user.branch_id
        );
      });
    }
    
    // If user has no branch_id, show no holidays
    return [];
  };

  const filteredHolidays = getFilteredHolidays();
  const sortedHolidays = [...filteredHolidays].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="page-container employee-holidays-page">
      <div className="page-header">
        <h1>HOLIDAYS LIST</h1>
        <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="form-input"
            style={{ width: '100px' }}
            min="2020"
            max="2100"
          />
          {isAdminOrHR && (
            <>
              <button className="btn-primary" onClick={() => { setEditingHoliday(null); setNewHoliday({ name: '', date: '', description: '' }); setShowModal(true); }}>
                <FiPlus /> Add Holiday
              </button>
              {upcomingHolidays.length > 0 && (
                <button className="btn-secondary" onClick={handleDeleteUpcomingByYear} style={{ background: '#ef4444', color: 'white' }}>
                  Delete Upcoming ({year})
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading holidays...</p>
        </div>
      ) : (
        <div>
          {isAdminOrHR && branches.length > 0 && sortedHolidays.length > 0 ? (
            <>
              <h2 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>HOLIDAY PERMISSIONS ({year})</h2>
              <div className="table-container holiday-permissions-matrix">
                <table className="data-table" style={{ minWidth: '600px' }}>
                  <thead>
                    <tr>
                      <th style={{ position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-card)', minWidth: '200px' }}>
                        Branch Name / ID
                      </th>
                      {sortedHolidays.map((holiday) => (
                        <th key={holiday.id} style={{ minWidth: '120px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <strong>{holiday.name}</strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                              {new Date(holiday.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((branch) => (
                      <tr key={branch.id}>
                        <td style={{ position: 'sticky', left: 0, zIndex: 9, background: 'var(--bg-card)', fontWeight: 600 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span>{branch.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                              ID: {branch.id}
                            </span>
                          </div>
                        </td>
                        {sortedHolidays.map((holiday) => {
                          const checked = isBranchChecked(holiday, branch.id);
                          const key = `${holiday.id}-${branch.id}`;
                          const isUpdating = updatingPermission === key;
                          return (
                            <td key={holiday.id} style={{ textAlign: 'center', padding: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <label className="holiday-toggle-switch" style={{ opacity: isUpdating ? 0.6 : 1, cursor: isUpdating ? 'not-allowed' : 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => !isUpdating && handlePermissionToggle(holiday, branch)}
                                    disabled={isUpdating}
                                  />
                                  <span className="holiday-toggle-slider"></span>
                                </label>
                                <span className={`holiday-toggle-status ${checked ? 'yes' : 'no'}`} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                  {checked ? 'Yes' : 'No'}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <h2 style={{ marginBottom: '16px', color: 'var(--text-primary)', marginTop: isAdminOrHR && branches.length > 0 && sortedHolidays.length > 0 ? '32px' : '0' }}>
            ALL HOLIDAYS OF ({year})
          </h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Description</th>
                  {isAdminOrHR && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {sortedHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={isAdminOrHR ? 5 : 4} className="text-center">
                      {isAdminOrHR ? 'No holidays found' : 'No holidays available for your branch'}
                    </td>
                  </tr>
                ) : (
                  sortedHolidays.map((holiday, idx) => {
                    const holidayDate = new Date(holiday.date);
                    const isPast = holidayDate < new Date();
                    return (
                      <tr key={holiday.id} style={{ backgroundColor: isPast ? 'rgba(107, 114, 128, 0.1)' : 'transparent' }}>
                        <td>{idx + 1}</td>
                        <td style={{ color: isPast ? '#6b7280' : 'inherit' }}>
                          {holidayDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </td>
                        <td><strong style={{ color: isPast ? '#6b7280' : 'inherit' }}>{holiday.name}</strong></td>
                        <td style={{ color: isPast ? '#6b7280' : 'inherit' }}>{holiday.description || '-'}</td>
                        {isAdminOrHR && (
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="btn-sm btn-secondary" onClick={() => handleEdit(holiday)}>
                                <FiEdit2 />
                              </button>
                              <button className="btn-sm btn-secondary" onClick={() => handleDelete(holiday.id)} style={{ background: '#ef4444', color: 'white' }}>
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
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</h3>
              <button className="modal-close" onClick={() => { setShowModal(false); setEditingHoliday(null); setNewHoliday({ name: '', date: '', description: '' }); }}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddHoliday}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={newHoliday.name}
                      onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                      required
                      placeholder="Holiday name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Date *</label>
                    <DatePicker
                      value={newHoliday.date}
                      onChange={(date) => setNewHoliday({ ...newHoliday, date: date })}
                      placeholder="Select holiday date"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="form-input"
                    value={newHoliday.description}
                    onChange={(e) => setNewHoliday({ ...newHoliday, description: e.target.value })}
                    rows="5"
                    placeholder="Optional: Add a short note for this holiday"
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : editingHoliday ? 'Update Holiday' : 'Add Holiday'}
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

export default Holidays;
