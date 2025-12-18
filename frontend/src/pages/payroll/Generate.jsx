import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiLock, FiUnlock } from 'react-icons/fi';
import './Payroll.css';

const Generate = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [monthCards, setMonthCards] = useState([]);
  const [loadingMonths, setLoadingMonths] = useState(false);
  const [formData, setFormData] = useState({
    company_id: '',
    branch_id: '',
    department_id: '',
    employee_id: 'all',
    month: new Date().toISOString().slice(0, 7)
  });

  const filteredBranches = formData.company_id
    ? branches.filter((b) => b.company_id === Number(formData.company_id))
    : [];

  const filteredDepartments = formData.branch_id
    ? departments.filter((d) => d.branch_id === Number(formData.branch_id))
    : [];

  const filteredEmployees = employees.filter((emp) => {
    const matchesCompany = !formData.company_id || emp.company_id === Number(formData.company_id);
    const matchesBranch = !formData.branch_id || emp.branch_id === Number(formData.branch_id);
    const matchesDept = !formData.department_id || emp.department_id === Number(formData.department_id);
    return matchesCompany && matchesBranch && matchesDept;
  });

  useEffect(() => {
    fetchEmployees();
    fetchOrgData();
    generateMonthCards();
  }, []);

  const generateMonthCards = () => {
    const cards = [];
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();
    
    // Start from previous month
    let month = currentMonth === 0 ? 11 : currentMonth - 1;
    let year = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    // Generate 12 months going back
    for (let i = 0; i < 8; i++) {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      cards.push({
        month: month + 1, // 1-12 for display
        year: year,
        monthName: monthNames[month],
        freaze_status: false // Will be updated from API
      });
      
      // Go to previous month
      month = month === 0 ? 11 : month - 1;
      if (month === 11) {
        year = year - 1;
      }
    }
    
    setMonthCards(cards);
    fetchMonthFreezeStatus(cards);
  };

  const fetchMonthFreezeStatus = async (cards) => {
    try {
      setLoadingMonths(true);
      const response = await api.get('/payslip/months');
      const monthData = response.data || [];
      
      // Update cards with freeze status
      const updatedCards = cards.map(card => {
        const found = monthData.find(
          m => m.month === card.month && m.year === card.year
        );
        return {
          ...card,
          freaze_status: found ? found.freaze_status : false
        };
      });
      
      setMonthCards(updatedCards);
    } catch (error) {
      console.error('Error fetching month freeze status:', error);
    } finally {
      setLoadingMonths(false);
    }
  };

  const handleToggleFreeze = async (month, year) => {
    try {
      const response = await api.post('/payslip/toggle-freeze', null, {
        params: { month, year }
      });
      
      // Update the card's freeze status
      setMonthCards(prevCards =>
        prevCards.map(card =>
          card.month === month && card.year === year
            ? { ...card, freaze_status: response.data.freaze_status }
            : card
        )
      );
      
      toast.success(
        response.data.freaze_status
          ? 'Payslips frozen (visible to employees)'
          : 'Payslips unfrozen (not visible to employees)'
      );
    } catch (error) {
      console.error('Error toggling freeze status:', error);
      toast.error(error.response?.data?.detail || 'Failed to toggle freeze status');
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/users/contacts');
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.month) {
      toast.error('Please select a month');
      return;
    }
    setLoading(true);
    try {
      await api.post('/payroll/generate', {
        employee_id: formData.employee_id === 'all' ? null : formData.employee_id,
        month: formData.month,
        company_id: formData.company_id || null,
        branch_id: formData.branch_id || null,
        department_id: formData.department_id || null
      });
      toast.success('Payroll generated successfully');
      setFormData({
        company_id: '',
        branch_id: '',
        department_id: '',
        employee_id: 'all',
        month: new Date().toISOString().slice(0, 7)
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate payroll');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCompanyChange = (value) => {
    setFormData({
      ...formData,
      company_id: value,
      branch_id: '',
      department_id: '',
      employee_id: 'all'
    });
  };

  const handleBranchChange = (value) => {
    setFormData({
      ...formData,
      branch_id: value,
      department_id: '',
      employee_id: 'all'
    });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>GENERATE PAYROLL</h1>
      </div>

      {/* Month Cards Section */}
      <div className="month-cards-section">
        <h2 className="section-title">MONTHS</h2>
        <div className="month-cards-grid">
          {monthCards.map((card) => (
            <div
              key={`${card.year}-${card.month}`}
              className={`month-card ${card.freaze_status ? 'frozen' : 'unfrozen'}`}
              onClick={() => handleToggleFreeze(card.month, card.year)}
            >
              <div className="month-card-header">
                {card.freaze_status ? (
                  <FiLock className="freeze-icon" />
                ) : (
                  <FiUnlock className="freeze-icon" />
                )}
                <span className="freeze-status">
                  {card.freaze_status ? 'Frozen' : 'Unfrozen'}
                </span>
              </div>
              <div className="month-card-body">
                <div className="month-name">{card.monthName}</div>
                <div className="month-year">{card.year}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="form-container" style={{ maxWidth: '100%' }}>
        <form onSubmit={handleSubmit} className="payroll-form generate-grid">
          <div className="form-group">
            <label>Company</label>
            <select
              name="company_id"
              value={formData.company_id}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="form-input"
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Branch</label>
            <select
              name="branch_id"
              value={formData.branch_id}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="form-input"
              disabled={!formData.company_id}
            >
              <option value="">{formData.company_id ? 'All branches' : 'Select company first'}</option>
              {filteredBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Department</label>
            <select
              name="department_id"
              value={formData.department_id}
              onChange={handleChange}
              className="form-input"
              disabled={!formData.branch_id}
            >
              <option value="">{formData.branch_id ? 'All departments' : 'Select branch first'}</option>
              {filteredDepartments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Employees</label>
            <select
              name="employee_id"
              value={formData.employee_id}
              onChange={handleChange}
              required
              className="form-input"
            >
              <option value="all">All</option>
              {filteredEmployees.map((emp) => (
                <option key={emp.id} value={emp.empid}>
                  {emp.name} ({emp.empid})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Month *</label>
            <input
              type="month"
              name="month"
              value={formData.month}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          <div className="form-group form-group--submit">
            <button type="submit" className="btn-primary btn-submit" disabled={loading}>
              {loading ? 'Generating...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Generate;

