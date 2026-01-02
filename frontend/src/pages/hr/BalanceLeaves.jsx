import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiChevronLeft, FiChevronRight, FiSearch } from 'react-icons/fi';
import './HR.css';

const BalanceLeaves = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [filteredBalances, setFilteredBalances] = useState([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 25;

  useEffect(() => {
    // Fetch when component mounts or year changes
    fetchLeaveBalances();
  }, [year]);

  // Debounce search query (like History.jsx)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Filter balances based on search query (client-side filtering like History.jsx)
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setFilteredBalances(leaveBalances);
    } else {
      const term = debouncedSearch.toLowerCase().trim();
      const filtered = leaveBalances.filter(balance => {
        const name = String(balance.name || '').toLowerCase();
        const empid = String(balance.empid || '').toLowerCase();
        return name.includes(term) || empid.includes(term);
      });
      setFilteredBalances(filtered);
    }
    setCurrentPage(1); // Reset to page 1 when search changes
  }, [debouncedSearch, leaveBalances]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  const fetchLeaveBalances = async () => {
    setLoading(true);
    try {
      const response = await api.get('/hr/leave-balance', {
        params: { year }
      });
      setLeaveBalances(response.data || []);
      setFilteredBalances(response.data || []);
    } catch (error) {
      console.error('Error fetching leave balances:', error);
      toast.error(error.response?.data?.detail || 'Failed to fetch leave balances');
      setLeaveBalances([]);
      setFilteredBalances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!confirm(`Are you sure you want to generate leave balances for year ${year}? This will create/update records for all employees.`)) {
      return;
    }

    setGenerating(true);
    try {
      const response = await api.post('/hr/leave-balance/generate', null, {
        params: { year }
      });
      toast.success(response.data.message || 'Leave balances generated successfully');
      fetchLeaveBalances();
    } catch (error) {
      console.error('Error generating leave balances:', error);
      toast.error(error.response?.data?.detail || 'Failed to generate leave balances');
    } finally {
      setGenerating(false);
    }
  };

  // Pagination logic (using filteredBalances)
  const totalPages = Math.ceil(filteredBalances.length / recordsPerPage);
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredBalances.slice(indexOfFirstRecord, indexOfLastRecord);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when year changes
  }, [year]);

  // Generate year options (current year and previous/future years)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let i = currentYear - 2; i <= currentYear + 2; i++) {
    yearOptions.push(i);
  }

  return (
    <div className="page-container">
      <div className="page-header stacked">
        <div>
          <h1>LEAVE ANALYSIS</h1>
          <p className="page-subtitle">View and manage employee leave balances.</p>
        </div>
        <div className="header-actions filters-row toolbar" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="filter-field" style={{ flex: 1, maxWidth: '400px', minWidth: '250px' }}>
            <label className="filter-label">Search</label>
            <div className="search-box" style={{ position: 'relative', height: '45px', display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box' }}>
              <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', zIndex: 1, fontSize: '1rem' }} />
              <input
                type="text"
                placeholder="Search by name or employee ID..."
                value={search}
                onChange={handleSearchChange}
                style={{ 
                  marginBottom: 0, 
                  paddingLeft: '40px', 
                  paddingRight: '12px',
                  height: '45px',
                  boxSizing: 'border-box',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  width: '100%',
                  lineHeight: '45px'
                }}
              />
            </div>
          </div>
          <div className="filter-field">
            <label className="filter-label">Year</label>
            <select
              className="form-input"
              value={year}
              onChange={(e) => {
                setYear(parseInt(e.target.value));
                setSearch(''); // Clear search when year changes
              }}
              style={{ marginBottom: 0, minWidth: '120px', height: '45px', boxSizing: 'border-box', lineHeight: '45px' }}
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <button
              className="btn-primary"
              onClick={handleGenerate}
              disabled={generating}
              style={{ marginBottom: 0, height: '45px', padding: '0 20px', boxSizing: 'border-box', lineHeight: '45px' }}
            >
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading leave balances...</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Empid</th>
                  <th>Name</th>
                  <th>Total CL</th>
                  <th>Used CL</th>
                  <th>Bls CL</th>
                  <th>Total SL</th>
                  <th>Used SL</th>
                  <th>Bls SL</th>
                  <th>Total Cmp</th>
                  <th>Used Cmp</th>
                  <th>Bls Cmp</th>
                  <th>Year</th>
                </tr>
              </thead>
              <tbody>
                {currentRecords.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="text-center">No leave balance records found</td>
                  </tr>
                ) : (
                  currentRecords.map((balance) => (
                    <tr key={balance.id}>
                      <td>{balance.empid}</td>
                      <td>{balance.name}</td>
                      <td className="text-center">{balance.total_casual_leaves}</td>
                      <td className="text-center">{balance.used_casual_leaves}</td>
                      <td className="text-center"><strong>{balance.balance_casual_leaves}</strong></td>
                      <td className="text-center">{balance.total_sick_leaves}</td>
                      <td className="text-center">{balance.used_sick_leaves}</td>
                      <td className="text-center"><strong>{balance.balance_sick_leaves}</strong></td>
                      <td className="text-center">{balance.total_comp_off_leaves}</td>
                      <td className="text-center">{balance.used_comp_off_leaves}</td>
                      <td className="text-center"><strong>{balance.balance_comp_off_leaves}</strong></td>
                      <td className="text-center">{balance.year}</td>
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
                Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredBalances.length)} of {filteredBalances.length} records
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

export default BalanceLeaves;

