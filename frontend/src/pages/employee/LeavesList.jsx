import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './Employee.css';

const LeavesList = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [filter, setFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');

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
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="filter-field">
            <span className="filter-label">To date</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="form-input"
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

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading leaves...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Applied Date</th>
                <th>From Date</th>
                <th>To Date</th>
                <th>Duration</th>
                <th>Leave Type</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">No leaves found</td>
                </tr>
              ) : (
                filteredLeaves.map((leave) => (
                  <tr key={leave.id}>
                    <td>{new Date(leave.applied_date).toLocaleDateString()}</td>
                    <td>{new Date(leave.from_date).toLocaleDateString()}</td>
                    <td>{new Date(leave.to_date).toLocaleDateString()}</td>
                    <td>{leave.duration} days</td>
                    <td>{leave.leave_type}</td>
                    <td>{getStatusBadge(leave.status)}</td>
                    <td>{leave.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeavesList;

