import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiChevronLeft, FiChevronRight, FiRefreshCw } from 'react-icons/fi';
import DatePicker from '../../components/DatePicker';
import './Employee.css';
import '../hr/HR.css';

const LeavesList = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [filter, setFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 25;

  useEffect(() => {
    fetchLeaves();
  }, [filter, fromDate, toDate]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/leaves/self`, {
        params: {
          filter,
          start_date: fromDate || undefined,
          end_date: toDate || undefined,
        }
      });
      setLeaves(response.data);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      toast.error('Failed to load leaves');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeaves = leaves.filter((leave) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      leave.leave_type?.toLowerCase().includes(term) ||
      leave.reason?.toLowerCase().includes(term) ||
      leave.status?.toLowerCase().includes(term)
    );
  });

  // Calculate statistics
  const totalLeaves = filteredLeaves.length;
  const pendingLeaves = filteredLeaves.filter(l => l.status === 'pending').length;
  const approvedLeaves = filteredLeaves.filter(l => l.status === 'approved').length;
  const rejectedLeaves = filteredLeaves.filter(l => l.status === 'rejected').length;

  // Pagination logic
  const totalPages = Math.ceil(filteredLeaves.length / recordsPerPage);
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredLeaves.slice(indexOfFirstRecord, indexOfLastRecord);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when search/filter changes
  }, [search, filter, fromDate, toDate]);

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'badge-warning', text: 'Pending' },
      approved: { class: 'badge-success', text: 'Approved' },
      rejected: { class: 'badge-danger', text: 'Rejected' },
    };
    const badge = badges[status] || badges.pending;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  return (
    <div className="page-container">
      <div className="page-header stacked">
        <div>
          <h1>MY LEAVES</h1>
          <p className="page-subtitle">Track your leave history with quick filters and export.</p>
        </div>
        <div
          className="header-actions filters-row"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignItems: 'flex-end'
          }}
        >
          <div className="filter-field" style={{ minWidth: '220px' }}>
            <span className="filter-label">Search</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              placeholder="Type, status or reason"
            />
          </div>
          <div className="filter-field">
            <span className="filter-label">From date</span>
            <DatePicker
              value={fromDate}
              onChange={(date) => setFromDate(date)}
              placeholder="Select from date"
            />
          </div>
          <div className="filter-field">
            <span className="filter-label">To date</span>
            <DatePicker
              value={toDate}
              onChange={(date) => setToDate(date)}
              placeholder="Select to date"
              min={fromDate || undefined}
            />
          </div>
          <div className="filter-field" style={{ minWidth: '160px' }}>
            <span className="filter-label">Status</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="form-select"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={fetchLeaves}>
            Refresh
          </button>
          <button className="btn-primary" onClick={() => toast('Excel export coming soon')}>
            Excel
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card stat-blue">
          <div className="stat-value">{totalLeaves}</div>
          <div className="stat-label">Total Leaves</div>
        </div>
        <div className="stat-card stat-orange">
          <div className="stat-value">{pendingLeaves}</div>
          <div className="stat-label">Pending Leaves</div>
        </div>
        <div className="stat-card stat-green">
          <div className="stat-value">{approvedLeaves}</div>
          <div className="stat-label">Approved Leaves</div>
        </div>
        <div className="stat-card stat-red">
          <div className="stat-value">{rejectedLeaves}</div>
          <div className="stat-label">Rejected Leaves</div>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading leaves...</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Emp ID</th>
                  <th>Name</th>
                  <th>Applied Date</th>
                  <th>From Date</th>
                  <th>To Date</th>
                  <th>Duration</th>
                  <th>Leave Type</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center">No leaves found</td>
                  </tr>
                ) : (
                  currentRecords.map((leave) => (
                    <tr key={leave.id}>
                      <td>{leave.employee_id || leave.empid || '-'}</td>
                      <td>{leave.employee_name || leave.name || '-'}</td>
                      <td>{new Date(leave.applied_date).toLocaleDateString()}</td>
                      <td>{new Date(leave.from_date).toLocaleDateString()}</td>
                      <td>{new Date(leave.to_date).toLocaleDateString()}</td>
                      <td>{leave.duration} days</td>
                      <td>{leave.leave_type}</td>
                      <td>{getStatusBadge(leave.status)}</td>
                      <td>{leave.reason}</td>
                      <td>
                        {leave.status === 'pending' ? (
                          <button
                            className="btn-sm btn-danger"
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this leave request?')) {
                                try {
                                  await api.delete(`/leaves/${leave.id}`);
                                  toast.success('Leave request deleted successfully');
                                  fetchLeaves();
                                } catch (error) {
                                  toast.error(error.response?.data?.detail || 'Failed to delete leave request');
                                }
                              }
                            }}
                          >
                            Delete
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            Cannot delete
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="pagination-info" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredLeaves.length)} of {filteredLeaves.length} leaves
              </div>
              <div className="pagination-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  className="pagination-btn"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1
                  }}
                >
                  <FiChevronLeft />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      background: currentPage === page ? 'var(--primary)' : 'var(--bg-card)',
                      color: currentPage === page ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontWeight: currentPage === page ? 600 : 400
                    }}
                  >
                    {page}
                  </button>
                ))}
                <button 
                  className="pagination-btn"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1
                  }}
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

export default LeavesList;

