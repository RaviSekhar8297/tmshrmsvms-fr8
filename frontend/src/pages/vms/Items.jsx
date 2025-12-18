import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './VMS.css';

const Items = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [view, setView] = useState('grid'); // grid or list

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await api.get('/vms/items');
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      available: { class: 'badge-success', text: 'Available' },
      'in-use': { class: 'badge-info', text: 'In Use' },
      maintenance: { class: 'badge-warning', text: 'Maintenance' },
      reserved: { class: 'badge-secondary', text: 'Reserved' },
    };
    const badge = badges[status] || badges.available;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      vehicle: '🚗',
      equipment: '⚙️',
      tool: '🔧',
      material: '📦',
      other: '📋'
    };
    return icons[category] || '📋';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Items</h1>
        <div className="header-actions">
          <div className="view-toggle">
            <button
              className={view === 'grid' ? 'active' : ''}
              onClick={() => setView('grid')}
            >
              Grid
            </button>
            <button
              className={view === 'list' ? 'active' : ''}
              onClick={() => setView('list')}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading items...</p>
        </div>
      ) : view === 'grid' ? (
        <div className="items-grid">
          {items.map((item) => (
            <div
              key={item.id}
              className="item-card"
              onClick={() => setSelectedItem(item)}
            >
              <div className="item-card-header">
                <div className="item-icon">{getCategoryIcon(item.category)}</div>
                {getStatusBadge(item.status)}
              </div>
              <div className="item-card-body">
                <h3 className="item-title">{item.name}</h3>
                <p className="item-category">{item.category}</p>
                <div className="item-details">
                  <div className="item-detail">
                    <span className="detail-label">Quantity:</span>
                    <span className="detail-value">{item.quantity} {item.unit || ''}</span>
                  </div>
                  {item.location && (
                    <div className="item-detail">
                      <span className="detail-label">Location:</span>
                      <span className="detail-value">{item.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center">No items found</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="item-name">{item.name}</div>
                      {item.description && (
                        <div className="item-desc">{item.description}</div>
                      )}
                    </td>
                    <td>{item.category}</td>
                    <td>{item.quantity} {item.unit || ''}</td>
                    <td>{item.location || '-'}</td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td>
                      <button
                        className="btn-sm btn-primary"
                        onClick={() => setSelectedItem(item)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedItem.name}</h2>
              <button className="modal-close" onClick={() => setSelectedItem(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h3>Details</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Category:</span>
                    <span className="detail-value">{selectedItem.category}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Quantity:</span>
                    <span className="detail-value">{selectedItem.quantity} {selectedItem.unit || ''}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status:</span>
                    <span className="detail-value">{getStatusBadge(selectedItem.status)}</span>
                  </div>
                  {selectedItem.location && (
                    <div className="detail-item">
                      <span className="detail-label">Location:</span>
                      <span className="detail-value">{selectedItem.location}</span>
                    </div>
                  )}
                </div>
              </div>
              {selectedItem.description && (
                <div className="detail-section">
                  <h3>Description</h3>
                  <p>{selectedItem.description}</p>
                </div>
              )}
              {selectedItem.notes && (
                <div className="detail-section">
                  <h3>Notes</h3>
                  <p>{selectedItem.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Items;

