import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiPhone, FiMail, FiGrid, FiList, FiChevronLeft, FiChevronRight, FiBriefcase, FiMapPin } from 'react-icons/fi';
import './Employee.css';

const ContactDetails = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    fetchContacts();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, contacts]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users/contacts');
      setContacts(response.data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(search.toLowerCase()) ||
    contact.empid.toLowerCase().includes(search.toLowerCase()) ||
    contact.email.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / pageSize));
  const paginatedContacts = filteredContacts.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="page-container">
      <div className="page-header stacked">
        <div>
          <h1>CONTACT - DETAILS</h1>
          <p className="page-subtitle">Find teammates quickly, switch grid or table, and export.</p>
        </div>
        <div className="header-actions filters-row toolbar">
          <div className="toolbar-left">
            <div className="filter-field">
              
              <input
                type="text"
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input search-input"
              />
            </div>
          </div>
          <div className="toolbar-right">
            <div className="view-toggle">
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
              >
                <FiGrid />
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Table view"
              >
                <FiList />
              </button>
            </div>
            <button className="btn-primary" onClick={() => toast('Excel export coming soon')}>
              Excel
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading contacts...</p>
        </div>
      ) : (
        <>
          {filteredContacts.length === 0 ? (
            <div className="empty-state">
              <p>No contacts found</p>
            </div>
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="contact-grid">
                  {paginatedContacts.map((contact) => {
                    const initials = contact.name?.slice(0, 2).toUpperCase() || 'NA';
                    const roleTone =
                      contact.role === 'Admin'
                        ? 'danger'
                        : contact.role === 'HR'
                        ? 'warning'
                        : contact.role === 'Manager'
                        ? 'info'
                        : 'success';

                    return (
                      <div className="contact-card" key={contact.id}>
                        <div className="contact-card-header">
                          <div className="contact-avatar">
                            {contact.image_base64 ? (
                              <img src={contact.image_base64} alt={contact.name} />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>
                          <div>
                            <div className="contact-name">{contact.name}</div>
                            <div className="contact-meta">ID: {contact.empid}</div>
                          </div>
                          <span className={`badge badge-${roleTone}`}>{contact.role}</span>
                        </div>
                        <div className="contact-info">
                          <div className="contact-row">
                            <FiMail size={14} />
                            <span>{contact.email}</span>
                          </div>
                          <div className="contact-row">
                            <FiPhone size={14} />
                            <span>{contact.phone || 'Not provided'}</span>
                          </div>
                          <div className="contact-row">
                            <FiBriefcase size={14} />
                            <span style={{ fontWeight: '500' }}>Designation:</span>
                            <span>{contact.designation || 'Pending'}</span>
                          </div>
                          <div className="contact-row">
                            <FiMapPin size={14} />
                            <span style={{ fontWeight: '500' }}>Branch:</span>
                            <span>{contact.branch_name || 'Pending'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Employee ID</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Designation</th>
                        <th>Branch</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedContacts.map((contact) => {
                        const roleTone =
                          contact.role === 'Admin'
                            ? 'danger'
                            : contact.role === 'HR'
                            ? 'warning'
                            : contact.role === 'Manager'
                            ? 'info'
                            : 'success';
                        const initials = contact.name?.slice(0, 2).toUpperCase() || 'NA';
                        return (
                          <tr key={contact.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="contact-avatar contact-avatar-small">
                                  {contact.image_base64 ? (
                                    <img src={contact.image_base64} alt={contact.name} />
                                  ) : (
                                    <span>{initials}</span>
                                  )}
                                </div>
                                <div>
                                  <div className="contact-name">{contact.name}</div>
                                  <div className="contact-meta">ID: {contact.empid}</div>
                                </div>
                              </div>
                            </td>
                            <td>{contact.empid}</td>
                            <td>{contact.email}</td>
                            <td>{contact.phone || 'Not provided'}</td>
                            <td>{contact.designation || '-'}</td>
                            <td>{contact.branch_name || '-'}</td>
                            <td><span className={`badge badge-${roleTone}`}>{contact.role}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {totalPages > 1 && (
                <div className="pagination">
                  <div className="pagination-info">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredContacts.length)} of {filteredContacts.length} contacts
                  </div>
                  <div className="pagination-controls">
                    <button 
                      className="pagination-btn"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <FiChevronLeft />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        className={`pagination-btn ${page === pageNum ? 'active' : ''}`}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    ))}
                    <button 
                      className="pagination-btn"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
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
  );
};

export default ContactDetails;

