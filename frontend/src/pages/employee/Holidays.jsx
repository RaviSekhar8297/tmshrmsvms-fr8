import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import './Employee.css';

const Holidays = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', description: '' });

  useEffect(() => {
    fetchHolidays();
  }, [year]);

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

  const upcomingHolidays = holidays.filter(h => new Date(h.date) >= new Date()).sort((a, b) => new Date(a.date) - new Date(b.date));
  const pastHolidays = holidays.filter(h => new Date(h.date) < new Date()).sort((a, b) => new Date(b.date) - new Date(a.date));
  const isAdminOrHR = user?.role === 'Admin' || user?.role === 'HR';

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newHoliday.name || !newHoliday.date) {
      toast.error('Please fill name and date');
      return;
    }
    try {
      if (editingHoliday) {
        await api.put(`/holidays/${editingHoliday.id}`, newHoliday);
        toast.success('Holiday updated');
      } else {
        await api.post('/holidays', newHoliday);
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

  return (
    <div className="page-container employee-holidays-page">
      <div className="page-header">
        <h1>Holidays</h1>
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
            <h2 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>All Holidays ({year})</h2>
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
                  {holidays.length === 0 ? (
                    <tr>
                      <td colSpan={isAdminOrHR ? 5 : 4} className="text-center">No holidays found</td>
                    </tr>
                  ) : (
                    holidays.sort((a, b) => new Date(a.date) - new Date(b.date)).map((holiday, idx) => {
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
                    <input
                      type="date"
                      className="form-input"
                      value={newHoliday.date}
                      onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                      required
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

