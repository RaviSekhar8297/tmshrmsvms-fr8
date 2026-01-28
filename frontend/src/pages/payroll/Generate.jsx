import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiEye, FiEyeOff, FiCalendar, FiChevronDown } from 'react-icons/fi';
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
  const [togglingCard, setTogglingCard] = useState(null); // Track which card is being toggled
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  // Calculate previous month
  const getPreviousMonth = () => {
    // IMPORTANT: don't use toISOString() here (UTC conversion can shift month backward)
    // Build YYYY-MM in local time.
    const d = new Date();
    d.setDate(1); // normalize to avoid end-of-month rollover issues
    d.setMonth(d.getMonth() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const [formData, setFormData] = useState({
    company_id: '',
    branch_id: '',
    department_id: '',
    employee_id: 'all',
    month: getPreviousMonth()
  });

  // Filter branches by selected company
  const filteredBranches = formData.company_id
    ? branches.filter((b) => b.company_id === Number(formData.company_id))
    : [];

  // Filter departments by selected branch
  const filteredDepartments = formData.branch_id
    ? departments.filter((d) => d.branch_id === Number(formData.branch_id))
    : [];

  // Filter employees by selected branch and optionally by department
  const filteredEmployees = formData.branch_id
    ? employees.filter((emp) => {
        const matchesBranch = emp.branch_id === Number(formData.branch_id);
        // If department is selected, also filter by department
        if (formData.department_id) {
          return matchesBranch && emp.department_id === Number(formData.department_id);
        }
        return matchesBranch;
      })
    : [];

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
    
    // Start from previous month (not current month)
    let month = currentMonth === 0 ? 11 : currentMonth - 1; // Previous month
    let year = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    // Generate 7 months (only previous months, excluding current month)
    for (let i = 0; i < 7; i++) {
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
    const cardKey = `${year}-${month}`;
    setTogglingCard(cardKey); // Set the card as being toggled
    
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
      
      // Keep highlight for a moment after successful toggle
      setTimeout(() => {
        setTogglingCard(null);
      }, 600);
      
      toast.success(
        response.data.freaze_status
          ? 'Payslips viewed (visible to employees)'
          : 'Payslips hidden (not visible to employees)'
      );
    } catch (error) {
      console.error('Error toggling freeze status:', error);
      setTogglingCard(null); // Remove highlight on error
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMonthPicker && !event.target.closest('.month-picker-wrapper')) {
        setShowMonthPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMonthPicker]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.month) {
      toast.error('Please select a month');
      return;
    }
    
    if (!formData.company_id) {
      toast.error('Please select a company');
      return;
    }
    
    setLoading(true);
    try {
      // Build request based on cascading logic:
      // 1. If specific employee selected, use that (with branch/company context)
      // 2. Else if department selected, use department (with branch/company context)
      // 3. Else if branch selected, use branch (with company context)
      // 4. Else use company
      const requestData = {
        month: formData.month,
        company_id: formData.company_id || null,
        branch_id: null,
        department_id: null,
        employee_id: null
      };
      
      if (formData.employee_id && formData.employee_id !== 'all') {
        // Specific employee selected - include branch and company for context
        requestData.employee_id = formData.employee_id;
        if (formData.branch_id) {
          requestData.branch_id = formData.branch_id;
        }
      } else if (formData.department_id) {
        // Department selected - include branch and company for context
        requestData.department_id = formData.department_id;
        if (formData.branch_id) {
          requestData.branch_id = formData.branch_id;
        }
      } else if (formData.branch_id) {
        // Branch selected - include company for context
        requestData.branch_id = formData.branch_id;
      }
      // else: only company selected, which is already set above
      
      await api.post('/payroll/generate', requestData);
      toast.success('Payroll generated successfully');
      setFormData({
        company_id: '',
        branch_id: '',
        department_id: '',
        employee_id: 'all',
        month: getPreviousMonth()
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
      department_id: '', // Clear department when branch changes
      employee_id: 'all' // Reset employee when branch changes
    });
  };

  const handleDepartmentChange = (value) => {
    setFormData({
      ...formData,
      department_id: value,
      employee_id: 'all' // Reset employee when department changes to allow selection from filtered list
    });
  };

  const handleEmployeeChange = (value) => {
    // Keep department when employee is selected so dropdown remains visible
    setFormData({
      ...formData,
      employee_id: value
      // Keep department_id so dropdown remains visible to show selected employee
    });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>GENERATE PAYROLL!</h1>
      </div>

      {/* Month Cards Section */}
      <div className="month-cards-section">
        <h2 className="section-title">MONTHS</h2>
        <div className="month-cards-grid">
          {monthCards.map((card) => {
            const cardKey = `${card.year}-${card.month}`;
            const isToggling = togglingCard === cardKey;
            return (
            <div
              key={cardKey}
              className={`month-card ${card.freaze_status ? 'frozen' : 'unfrozen'} ${isToggling ? 'toggling' : ''}`}
              onClick={() => handleToggleFreeze(card.month, card.year)}
            >
              <div className="month-card-header">
                {card.freaze_status ? (
                  <FiEye className="freeze-icon" />
                ) : (
                  <FiEyeOff className="freeze-icon" />
                )}
                <span className="freeze-status">
                  {card.freaze_status ? 'Viewed' : 'Hidden'}
                </span>
              </div>
              <div className="month-card-body">
                <div className="month-name">{card.monthName}</div>
                <div className="month-year">{card.year}</div>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      <div className="form-container" style={{ maxWidth: '100%' }}>
        <form onSubmit={handleSubmit} className="payroll-form generate-grid">
          {/* Company Dropdown - Always visible */}
          <div className="form-group">
            <label>Company *</label>
            <select
              name="company_id"
              value={formData.company_id}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="form-input"
              required
            >
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Branch Dropdown - Visible only when company is selected */}
          {formData.company_id && (
            <div className="form-group">
              <label>Branch</label>
              <select
                name="branch_id"
                value={formData.branch_id}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="form-input"
              >
                <option value="">All branches in company</option>
                {filteredBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Department Dropdown - Visible only when branch is selected */}
          {formData.branch_id && (
            <div className="form-group">
              <label>Department</label>
              <select
                name="department_id"
                value={formData.department_id}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                className="form-input"
              >
                <option value="">All departments in branch</option>
                {filteredDepartments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Employee Dropdown - Visible only when department is selected */}
          {formData.department_id && (
            <div className="form-group">
              <label>Employee</label>
              <select
                name="employee_id"
                value={formData.employee_id}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                className="form-input"
              >
                <option value="all">All employees in department</option>
                {filteredEmployees.map((emp) => (
                  <option key={emp.id} value={emp.empid}>
                    {emp.name} ({emp.empid})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Month Input */}
          <div className="form-group">
            <label>Month *</label>
            <div className="month-picker-wrapper">
              <div 
                className="month-picker-input"
                onClick={() => setShowMonthPicker(!showMonthPicker)}
              >
                <FiCalendar size={18} />
                <span>
                  {formData.month 
                    ? new Date(formData.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    : 'Select month'}
                </span>
                <FiChevronDown size={18} className={showMonthPicker ? 'rotate' : ''} />
              </div>
              {showMonthPicker && (
                <div className="month-picker-dropdown">
                  <div className="month-picker-header">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const [year, month] = formData.month ? formData.month.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
                        const currentYear = year || new Date().getFullYear();
                        const newYear = currentYear - 1;
                        setFormData(prev => ({ ...prev, month: `${newYear}-${String(month || new Date().getMonth() + 1).padStart(2, '0')}` }));
                      }}
                      className="month-picker-nav"
                    >
                      ←
                    </button>
                    <span className="month-picker-year">
                      {formData.month ? formData.month.split('-')[0] : new Date().getFullYear()}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const [year, month] = formData.month ? formData.month.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
                        const currentYear = year || new Date().getFullYear();
                        const currentDate = new Date();
                        const maxYear = currentDate.getFullYear();
                        // Only allow going forward if the year is less than current year
                        if (currentYear < maxYear) {
                          const newYear = currentYear + 1;
                          setFormData(prev => ({ ...prev, month: `${newYear}-${String(month || new Date().getMonth() + 1).padStart(2, '0')}` }));
                        }
                      }}
                      className="month-picker-nav"
                      disabled={formData.month ? parseInt(formData.month.split('-')[0]) >= new Date().getFullYear() : true}
                    >
                      →
                    </button>
                  </div>
                  <div className="month-picker-grid">
                    {['December', 'November', 'October', 'September', 'August', 'July', 'June', 'May', 'April', 'March', 'February', 'January'].map((month, index) => {
                      const monthNum = 12 - index; // Reverse order: Dec=12, Nov=11, etc.
                      const year = formData.month ? parseInt(formData.month.split('-')[0]) : new Date().getFullYear();
                      const currentDate = new Date();
                      const currentYear = currentDate.getFullYear();
                      const currentMonth = currentDate.getMonth() + 1;
                      const isCurrentMonth = year === currentYear && monthNum === currentMonth;
                      const isPastMonth = year < currentYear || (year === currentYear && monthNum < currentMonth);
                      
                      // Only show past months (not current or future)
                      if (!isPastMonth) {
                        return null;
                      }
                      
                      return (
                        <button
                          key={month}
                          type="button"
                          className={`month-picker-option ${isCurrentMonth ? 'current' : ''} ${formData.month === `${year}-${String(monthNum).padStart(2, '0')}` ? 'selected' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const monthValue = `${year}-${String(monthNum).padStart(2, '0')}`;
                            setFormData(prev => ({ ...prev, month: monthValue }));
                            setShowMonthPicker(false);
                          }}
                        >
                          {month.substring(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="form-group form-group--submit">
            <button type="submit" className="btn-primary btn-submit" disabled={loading}>
              {loading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Generate;

