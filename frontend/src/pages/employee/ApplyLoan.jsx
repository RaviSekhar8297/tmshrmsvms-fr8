import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiDollarSign, FiInfo, FiCheckCircle, FiUser, FiList, FiCalendar, FiAlertCircle, FiX, FiChevronDown } from 'react-icons/fi';
import api, { usersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import './ApplyLoan.css';

const ApplyLoan = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('apply');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [managerName, setManagerName] = useState('');
  const [appliedLoans, setAppliedLoans] = useState([]);
  const [loanInstallments, setLoanInstallments] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [eligibilityData, setEligibilityData] = useState({
    isEligible: false,
    maxLoanAmount: 0,
    canApply: true,
    reason: '',
    remainingDays: 0,
    last3MonthsGross: [],
    averageEarnedGross: 0,
    conditions: {
      oneYearService: { eligible: false, message: '' },
      averageSalary: { eligible: false, message: '' },
      noActiveLoan: { eligible: false, message: '' },
      sixMonthsAfterClearance: { eligible: false, message: '' }
    }
  });
  const [formData, setFormData] = useState({
    loan_type: '',
    loan_amount: '',
    tenure_months: '',
    approval_remarks: '',
    from_month: '',
    from_year: ''
  });
  const [includeInterest, setIncludeInterest] = useState(false);

  useEffect(() => {
    fetchEligibilityData();
    fetchManagerName();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'applied') {
      fetchAppliedLoans();
    } else if (activeTab === 'installments') {
      fetchLoanInstallments();
    }
  }, [activeTab, selectedLoanId]);

  // Close month picker when clicking outside
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

  const fetchManagerName = async () => {
    if (!user?.report_to_id) {
      setManagerName('Not Assigned');
      return;
    }

    try {
      // Use /users/contacts endpoint which is accessible to all authenticated users
      const response = await api.get('/users/contacts');
      const manager = response.data?.find(u => u.empid === user.report_to_id);
      if (manager) {
        setManagerName(manager.name || 'Unknown');
      } else {
        setManagerName('Not Found');
      }
    } catch (error) {
      console.error('Error fetching manager name:', error);
      setManagerName('Not Found');
    }
  };

  const calculateDaysDifference = (date1, date2) => {
    const diffTime = Math.abs(date2 - date1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const fetchEligibilityData = async () => {
    if (!user?.empid) {
      setFetching(false);
      return;
    }

    setFetching(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let isEligible = true;
      let reason = '';
      let remainingDays = 0;

      // Initialize conditions object
      const conditions = {
        oneYearService: { eligible: false, message: '' },
        averageSalary: { eligible: false, message: '' },
        noActiveLoan: { eligible: false, message: '' },
        sixMonthsAfterClearance: { eligible: false, message: '' }
      };

      // Check DOJ (must be 1 year old) - Condition a
      const doj = user.doj ? new Date(user.doj) : null;
      if (doj) {
        doj.setHours(0, 0, 0, 0);
        const oneYearFromDOJ = new Date(doj);
        oneYearFromDOJ.setFullYear(oneYearFromDOJ.getFullYear() + 1);
        
        if (today >= oneYearFromDOJ) {
          conditions.oneYearService.eligible = true;
          conditions.oneYearService.message = 'Completed 1 year of service';
        } else {
          conditions.oneYearService.eligible = false;
          remainingDays = calculateDaysDifference(today, oneYearFromDOJ);
          const daysFromDOJ = calculateDaysDifference(doj, today);
          conditions.oneYearService.message = `Wait for ${remainingDays} days (Current date - DOJ date = ${daysFromDOJ} days, need 365 days total)`;
          isEligible = false;
          reason = `You are not eligible for loan. ${conditions.oneYearService.message}`;
        }
      } else {
        conditions.oneYearService.eligible = false;
        conditions.oneYearService.message = 'Date of joining not found';
        isEligible = false;
        reason = 'Date of joining not found';
      }

      // Fetch last 3 months earned_gross from payslip_data
      let last3MonthsGross = 0;
      let last3MonthsData = [];
      let averageEarnedGross = 0;
      
      try {
        const empIdInt = parseInt(user.empid);
        if (!isNaN(empIdInt)) {
          // Get current month and year
          const currentMonth = today.getMonth() + 1;
          const currentYear = today.getFullYear();
          
          // Calculate last 3 months
          const monthsToFetch = [];
          for (let i = 0; i < 3; i++) {
            let month = currentMonth - i;
            let year = currentYear;
            if (month <= 0) {
              month += 12;
              year -= 1;
            }
            monthsToFetch.push({ month, year });
          }

          // Fetch payslip data for last 3 months
          const payslipPromises = monthsToFetch.map(({ month, year }) =>
            api.get('/payslip/list', {
              params: {
                month,
                year,
                search: empIdInt.toString(),
                limit: 100
              }
            })
          );

          const payslipResponses = await Promise.all(payslipPromises);
          
          payslipResponses.forEach((response, index) => {
            const payslips = response.data?.data || [];
            const empPayslips = payslips.filter(p => p.emp_id === empIdInt);
            if (empPayslips.length > 0) {
              const payslip = empPayslips[0];
              const earnedGross = payslip.earned_gross || 0;
              last3MonthsGross += earnedGross;
              last3MonthsData.push({
                month: monthsToFetch[index].month,
                year: monthsToFetch[index].year,
                earned_gross: earnedGross
              });
            }
          });

          // Calculate total earned gross (for eligibility - Condition b)
          const totalEarnedGross = last3MonthsGross;

          // Check Condition b: Total salary eligibility
          if (totalEarnedGross > 0 && last3MonthsData.length >= 3) {
            conditions.averageSalary.eligible = true;
            conditions.averageSalary.message = `Eligible loan amount: ₹${totalEarnedGross.toLocaleString('en-IN')} (Total of last 3 months earned gross)`;
          } else if (last3MonthsData.length < 3 && last3MonthsData.length > 0) {
            conditions.averageSalary.eligible = false;
            conditions.averageSalary.message = `Insufficient payslip data. Need 3 months of payslip data (Found: ${last3MonthsData.length} months)`;
          } else {
            conditions.averageSalary.eligible = false;
            conditions.averageSalary.message = 'No payslip data found for last 3 months';
          }
        } else {
          conditions.averageSalary.eligible = false;
          conditions.averageSalary.message = 'Invalid employee ID';
        }
      } catch (error) {
        console.error('Error fetching payslip data:', error);
        conditions.averageSalary.eligible = false;
        conditions.averageSalary.message = 'Error fetching payslip data';
      }

      // Check if already has active loan - Condition c
      let hasActiveLoan = false;
      try {
        const loansResponse = await api.get('/loans/active');
        hasActiveLoan = loansResponse.data?.has_active_loan || false;
      } catch (error) {
        console.error('Error checking active loans:', error);
      }

      if (hasActiveLoan) {
        conditions.noActiveLoan.eligible = false;
        conditions.noActiveLoan.message = 'You have an active loan. Please clear it before applying for a new one.';
        isEligible = false;
        if (!reason) reason = 'An employee cannot apply for a new loan if there is an existing active loan.';
      } else {
        conditions.noActiveLoan.eligible = true;
        conditions.noActiveLoan.message = 'No active loan found';
      }

      // Check if cleared loan within last 6 months - Condition d
      let recentClearedLoan = null;
      let clearedLoanDate = null;
      try {
        const clearedLoansResponse = await api.get('/loans/cleared-recent');
        if (clearedLoansResponse.data?.has_recent_cleared_loan && clearedLoansResponse.data?.loan) {
          recentClearedLoan = clearedLoansResponse.data.loan;
          clearedLoanDate = new Date(recentClearedLoan.created_at);
        }
      } catch (error) {
        console.error('Error checking cleared loans:', error);
      }

      if (recentClearedLoan && clearedLoanDate) {
        const sixMonthsAfterClearance = new Date(clearedLoanDate);
        sixMonthsAfterClearance.setMonth(sixMonthsAfterClearance.getMonth() + 6);
        sixMonthsAfterClearance.setHours(0, 0, 0, 0);
        
        if (today >= sixMonthsAfterClearance) {
          conditions.sixMonthsAfterClearance.eligible = true;
          conditions.sixMonthsAfterClearance.message = '6 months have passed since last loan clearance';
        } else {
          conditions.sixMonthsAfterClearance.eligible = false;
          remainingDays = calculateDaysDifference(today, sixMonthsAfterClearance);
          const daysSinceClearance = calculateDaysDifference(clearedLoanDate, today);
          conditions.sixMonthsAfterClearance.message = `Wait for ${remainingDays} days (Days since clearance: ${daysSinceClearance} days, need 180 days total)`;
          isEligible = false;
          if (!reason) reason = `After fully clearing the loan, the employee becomes eligible to apply for a new loan only after 6 months. ${conditions.sixMonthsAfterClearance.message}`;
        }
      } else {
        conditions.sixMonthsAfterClearance.eligible = true;
        conditions.sixMonthsAfterClearance.message = 'No recent loan clearance found';
      }

      // Calculate total if not already calculated
      const finalTotalEarnedGross = last3MonthsData.length > 0 
        ? last3MonthsData.reduce((sum, p) => sum + p.earned_gross, 0)
        : 0;

      setEligibilityData({
        isEligible,
        maxLoanAmount: finalTotalEarnedGross, // Use total instead of average
        canApply: isEligible && !hasActiveLoan && !recentClearedLoan,
        reason,
        remainingDays,
        last3MonthsGross: last3MonthsData,
        averageEarnedGross: finalTotalEarnedGross, // Keep for backward compatibility but store total
        conditions
      });
    } catch (error) {
      console.error('Error fetching eligibility data:', error);
      toast.error('Failed to fetch eligibility information');
    } finally {
      setFetching(false);
    }
  };

  const loanTypes = [
    { value: 'personal', label: 'Personal Loan' },
    { value: 'medical', label: 'Medical Loan' },
    { value: 'education', label: 'Education Loan' },
    { value: 'home', label: 'Home Loan' },
    { value: 'vehicle', label: 'Vehicle Loan' },
    { value: 'emergency', label: 'Emergency Loan' },
    { value: 'other', label: 'Other' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      
      // Auto-calculate to_month when tenure_months or from_month changes
      if (name === 'tenure_months' && prev.from_month) {
        const [year, month] = prev.from_month.split('-').map(Number);
        const tenureMonths = parseInt(value) || 0;
        if (tenureMonths > 0) {
          const toDate = new Date(year, month - 1 + tenureMonths, 1);
          const toMonth = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}`;
          updated.to_month = toMonth;
        }
      }
      
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation with toast
    if (!formData.loan_type) {
      toast.error('Please select a loan type');
      return;
    }
    
    if (!formData.loan_amount || parseFloat(formData.loan_amount) <= 0) {
      toast.error('Please enter a valid loan amount');
      return;
    }

    // Check if loan amount exceeds maximum (total of last 3 months earned_gross)
    const loanAmount = parseFloat(formData.loan_amount);
    if (eligibilityData.maxLoanAmount > 0 && loanAmount > eligibilityData.maxLoanAmount) {
      const totalGross = eligibilityData.last3MonthsGross.reduce((sum, p) => sum + p.earned_gross, 0);
      toast.error(`Loan amount cannot exceed ₹${eligibilityData.maxLoanAmount.toLocaleString('en-IN')} (Total of last 3 months earned gross: ${eligibilityData.last3MonthsGross.map(p => `₹${p.earned_gross.toLocaleString('en-IN')}`).join(' + ')} = ₹${totalGross.toLocaleString('en-IN')})`);
      return;
    }
    
    if (!formData.tenure_months) {
      toast.error('Please enter tenure in months');
      return;
    }

    const tenureMonths = parseInt(formData.tenure_months);
    if (isNaN(tenureMonths) || tenureMonths < 5 || tenureMonths > 24) {
      toast.error('Tenure must be between 5 and 24 months');
      return;
    }

    // Check eligibility
    if (!eligibilityData.canApply) {
      toast.error(eligibilityData.reason || 'You are not eligible to apply for a loan at this time');
      return;
    }

    setLoading(true);
    
    try {
      // Extract month and year from from_month if provided
      let fromMonth = null;
      let fromYear = null;
      if (formData.from_month) {
        const [year, month] = formData.from_month.split('-').map(Number);
        fromMonth = month;
        fromYear = year;
      }

      const response = await api.post('/loans/apply', {
        loan_type: formData.loan_type,
        loan_amount: parseFloat(formData.loan_amount),
        tenure_months: parseInt(formData.tenure_months),
        approval_remarks: formData.approval_remarks || null,
        from_month: fromMonth,
        from_year: fromYear
      });
      
      toast.success('Loan application submitted successfully!');
      
      // Reset form
      setFormData({
        loan_type: '',
        loan_amount: '',
        tenure_months: '',
        approval_remarks: '',
        from_month: '',
        from_year: '',
        to_month: ''
      });
      
      // Refresh eligibility data
      await fetchEligibilityData();
      
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Error submitting loan application:', error);
      toast.error(error.response?.data?.detail || 'Failed to submit loan application');
    } finally {
      setLoading(false);
    }
  };

  const fetchAppliedLoans = async () => {
    if (!user?.empid) return;
    
    setLoadingLoans(true);
    try {
      const response = await api.get('/loans/applied');
      setAppliedLoans(response.data || []);
    } catch (error) {
      console.error('Error fetching applied loans:', error);
      toast.error('Failed to fetch applied loans');
      setAppliedLoans([]);
    } finally {
      setLoadingLoans(false);
    }
  };

  const fetchLoanInstallments = async () => {
    if (!user?.empid) return;
    
    setLoadingLoans(true);
    try {
      const params = selectedLoanId ? { loan_id: selectedLoanId } : {};
      const response = await api.get('/loans/installments', { params });
      setLoanInstallments(response.data || []);
    } catch (error) {
      console.error('Error fetching loan installments:', error);
      toast.error('Failed to fetch loan installments');
      setLoanInstallments([]);
    } finally {
      setLoadingLoans(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'approved' || statusLower === 'active') {
      return <span className="badge badge-success">{status}</span>;
    } else if (statusLower === 'pending' || statusLower === 'applied') {
      return <span className="badge badge-warning">{status}</span>;
    } else if (statusLower === 'rejected') {
      return <span className="badge badge-danger">{status}</span>;
    } else if (statusLower === 'cleared' || statusLower === 'completed') {
      return <span className="badge badge-info">{status}</span>;
    }
    return <span className="badge">{status}</span>;
  };

  const calculateEMI = () => {
    if (!formData.loan_amount || !formData.tenure_months) return 0;
    
    const principal = parseFloat(formData.loan_amount);
    const months = parseInt(formData.tenure_months);
    
    // If interest is not included, simple division
    if (!includeInterest) {
      return (principal / months).toFixed(2);
    }
    
    // If interest is included, use compound interest formula
    const annualRate = 12; // 12% annual interest rate
    const monthlyRate = annualRate / 12 / 100;
    
    if (months === 0 || monthlyRate === 0) return principal / months;
    
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                (Math.pow(1 + monthlyRate, months) - 1);
    
    return emi.toFixed(2);
  };

  return (
    <div className="apply-loan-page">
      <div className="apply-loan-container-full">
        {/* Header */}
        <div className="apply-loan-header">
          <div className="apply-loan-header-content">
            <div className="apply-loan-header-icon">
              <FiDollarSign size={32} />
            </div>
            <div>
              <h1 className="apply-loan-title">APPLY FOR LOAN!</h1>
              <p className="apply-loan-subtitle">Fill in the details to apply for a loan</p>
            </div>
          </div>
        </div>

        {/* Loan Eligibility */}
        <div className="loan-eligibility-section">
          <h3 className="eligibility-title">
            <FiInfo size={24} />
            Loan Eligibility Criteria
          </h3>
          <div className="eligibility-points">
            <div className={`eligibility-point ${eligibilityData.conditions.oneYearService.eligible ? 'eligible' : 'not-eligible'}`}>
              <div className="eligibility-point-content">
                <span>The employee must have completed at least one year of service from the Date of Joining (DOJ) as recorded in the Users table.</span>
                {eligibilityData.conditions.oneYearService.message && (
                  <small className="eligibility-message">{eligibilityData.conditions.oneYearService.message}</small>
                )}
              </div>
              {eligibilityData.conditions.oneYearService.eligible ? (
                <FiCheckCircle className="eligibility-icon eligibility-icon-success" />
              ) : (
                <FiX className="eligibility-icon eligibility-icon-error" />
              )}
            </div>
            <div className={`eligibility-point ${eligibilityData.conditions.averageSalary.eligible ? 'eligible' : 'not-eligible'}`}>
              <div className="eligibility-point-content">
                <span>The eligible loan amount will be calculated based on the total earned gross salary of the last three months.</span>
                {eligibilityData.conditions.averageSalary.message && (
                  <small className="eligibility-message">{eligibilityData.conditions.averageSalary.message}</small>
                )}
              </div>
              {eligibilityData.conditions.averageSalary.eligible ? (
                <FiCheckCircle className="eligibility-icon eligibility-icon-success" />
              ) : (
                <FiX className="eligibility-icon eligibility-icon-error" />
              )}
            </div>
            <div className={`eligibility-point ${eligibilityData.conditions.noActiveLoan.eligible ? 'eligible' : 'not-eligible'}`}>
              <div className="eligibility-point-content">
                <span>An employee cannot apply for a new loan if there is an existing active loan.</span>
                {eligibilityData.conditions.noActiveLoan.message && (
                  <small className="eligibility-message">{eligibilityData.conditions.noActiveLoan.message}</small>
                )}
              </div>
              {eligibilityData.conditions.noActiveLoan.eligible ? (
                <FiCheckCircle className="eligibility-icon eligibility-icon-success" />
              ) : (
                <FiX className="eligibility-icon eligibility-icon-error" />
              )}
            </div>
            <div className={`eligibility-point ${eligibilityData.conditions.sixMonthsAfterClearance.eligible ? 'eligible' : 'not-eligible'}`}>
              <div className="eligibility-point-content">
                <span>After fully clearing the loan, the employee becomes eligible to apply for a new loan only after 6 months.</span>
                {eligibilityData.conditions.sixMonthsAfterClearance.message && (
                  <small className="eligibility-message">{eligibilityData.conditions.sixMonthsAfterClearance.message}</small>
                )}
              </div>
              {eligibilityData.conditions.sixMonthsAfterClearance.eligible ? (
                <FiCheckCircle className="eligibility-icon eligibility-icon-success" />
              ) : (
                <FiX className="eligibility-icon eligibility-icon-error" />
              )}
            </div>
          </div>
          {eligibilityData.averageEarnedGross > 0 && (
            <div className="eligibility-max-amount">
              <strong>Maximum Loan Amount: ₹{eligibilityData.averageEarnedGross.toLocaleString('en-IN')}</strong>
              <small>
                {eligibilityData.last3MonthsGross.length > 0 ? (
                  <>
                    Total of last 3 months earned gross: ({eligibilityData.last3MonthsGross.map((p, idx) => (
                      <span key={idx}>
                        ₹{p.earned_gross.toLocaleString('en-IN')} (Month {p.month}/{p.year})
                        {idx < eligibilityData.last3MonthsGross.length - 1 ? ' + ' : ''}
                      </span>
                    )).reverse()}
                    ) = ₹{eligibilityData.averageEarnedGross.toLocaleString('en-IN')}
                  </>
                ) : (
                  '(Based on total of last 3 months earned gross)'
                )}
              </small>
            </div>
          )}
          {!eligibilityData.canApply && eligibilityData.reason && (
            <div className="eligibility-warning">
              <FiAlertCircle size={18} />
              <span>{eligibilityData.reason}</span>
            </div>
          )}
        </div>

        {/* Manager Info Card */}
        <div className="manager-info-card">
          <div className="manager-info-header">
            <FiUser size={20} />
            <span>Reporting Manager</span>
          </div>
          <div className="manager-info-content">
            <div className="manager-name">{managerName}</div>
            <small>This information is read-only</small>
          </div>
        </div>

        {/* Tabs */}
        <div className="loan-tabs-container">
          <div className="loan-tabs">
            <button
              className={`loan-tab ${activeTab === 'apply' ? 'active' : ''}`}
              onClick={() => setActiveTab('apply')}
            >
              <FiDollarSign size={18} />
              Apply Loan
            </button>
            <button
              className={`loan-tab ${activeTab === 'applied' ? 'active' : ''}`}
              onClick={() => setActiveTab('applied')}
            >
              <FiList size={18} />
              Applied Loans Data
            </button>
            <button
              className={`loan-tab ${activeTab === 'installments' ? 'active' : ''}`}
              onClick={() => setActiveTab('installments')}
            >
              <FiCalendar size={18} />
              Loan Installments
            </button>
          </div>
        </div>

        {/* Apply Loan Tab */}
        {activeTab === 'apply' && (
          <div className="apply-loan-form-container">
          <form onSubmit={handleSubmit} className="apply-loan-form">
            {/* Employee Info */}
            <div className="form-section">
              <h3 className="form-section-title">Employee Information</h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Employee ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={user?.empid || ''}
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Employee Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={user?.name || ''}
                    disabled
                  />
                </div>
              </div>
            </div>

            {/* Loan Details */}
            <div className="form-section">
              <h3 className="form-section-title">Loan Details</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Loan Type</label>
                  <select
                    name="loan_type"
                    value={formData.loan_type}
                    onChange={handleChange}
                    className="form-input"
                  >
                    <option value="">Select Loan Type</option>
                    {loanTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Include Interest in EMI</label>
                  <div className="interest-toggle-container">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={includeInterest}
                        onChange={(e) => setIncludeInterest(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className="toggle-label">
                      {includeInterest ? 'Yes (Interest Applicable)' : 'No (No Interest)'}
                    </span>
                  </div>
                  <small className="form-hint">
                    {includeInterest 
                      ? 'EMI includes 12% annual interest rate' 
                      : 'EMI is calculated as simple division (Loan Amount / Tenure)'}
                  </small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Loan Amount (₹)</label>
                  <input
                    type="number"
                    name="loan_amount"
                    value={formData.loan_amount}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Enter loan amount"
                    min="1"
                    step="0.01"
                    max={eligibilityData.maxLoanAmount > 0 ? eligibilityData.maxLoanAmount : undefined}
                  />
                  {eligibilityData.averageEarnedGross > 0 ? (
                    <small className="form-hint">
                      Maximum: ₹{eligibilityData.averageEarnedGross.toLocaleString('en-IN')} (Total of last 3 months earned gross)
                    </small>
                  ) : (
                    <small className="form-hint">
                      Maximum loan amount will be calculated based on total of last 3 months earned gross
                    </small>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Tenure (Months)</label>
                  <input
                    type="number"
                    name="tenure_months"
                    value={formData.tenure_months}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Enter tenure in months (5-24)"
                    min="5"
                    max="24"
                  />
                  <small className="form-hint">Minimum: 5 months, Maximum: 24 months</small>
                </div>
              </div>

              {/* EMI Calculation */}
              {formData.loan_amount && formData.tenure_months && (
                <div className="emi-calculator">
                  <div className="emi-info">
                    <FiInfo size={18} />
                    <div>
                      <span className="emi-label">Estimated Monthly EMI:</span>
                      <span className="emi-value">₹{calculateEMI()}</span>
                    </div>
                  </div>
                  <small className="emi-note">
                    {includeInterest 
                      ? '* EMI calculation includes 12% annual interest rate. Actual EMI may vary based on terms.'
                      : '* EMI is calculated as simple division (Loan Amount ÷ Tenure). No interest applied.'}
                  </small>
                </div>
              )}

              {/* Loan Deduction Period (Optional) */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">From Month (Optional)</label>
                  <div className="month-picker-wrapper">
                    <div 
                      className="month-picker-input"
                      onClick={() => setShowMonthPicker(!showMonthPicker)}
                    >
                      <FiCalendar size={18} />
                      <span>
                        {formData.from_month 
                          ? new Date(formData.from_month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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
                              const currentYear = formData.from_year || new Date().getFullYear();
                              const minYear = new Date().getFullYear();
                              if (currentYear > minYear) {
                                setFormData(prev => ({ ...prev, from_year: currentYear - 1 }));
                              }
                            }}
                            className="month-picker-nav"
                            disabled={(formData.from_year || new Date().getFullYear()) <= new Date().getFullYear()}
                          >
                            ←
                          </button>
                          <span className="month-picker-year">
                            {formData.from_year || new Date().getFullYear()}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentYear = formData.from_year || new Date().getFullYear();
                              setFormData(prev => ({ ...prev, from_year: currentYear + 1 }));
                            }}
                            className="month-picker-nav"
                          >
                            →
                          </button>
                        </div>
                        <div className="month-picker-grid">
                          {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => {
                            const monthNum = index + 1;
                            const year = formData.from_year || new Date().getFullYear();
                            const currentDate = new Date();
                            const currentYear = currentDate.getFullYear();
                            const currentMonth = currentDate.getMonth() + 1;
                            const isCurrentMonth = year === currentYear && monthNum === currentMonth;
                            const isPastMonth = year < currentYear || (year === currentYear && monthNum < currentMonth);
                            
                            // Hide past months, show current and future months
                            if (isPastMonth) {
                              return null;
                            }
                            
                            return (
                              <button
                                key={month}
                                type="button"
                                className={`month-picker-option ${isCurrentMonth ? 'current' : ''} ${formData.from_month === `${year}-${String(monthNum).padStart(2, '0')}` ? 'selected' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const monthValue = `${year}-${String(monthNum).padStart(2, '0')}`;
                                  setFormData(prev => ({ ...prev, from_month: monthValue, from_year: year }));
                                  // Auto-calculate to_month
                                  if (formData.tenure_months) {
                                    const tenureMonths = parseInt(formData.tenure_months);
                                    const toDate = new Date(year, monthNum - 1 + tenureMonths, 1);
                                    const toMonth = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}`;
                                    setFormData(prev => ({ ...prev, to_month: toMonth }));
                                  }
                                  setShowMonthPicker(false);
                                }}
                              >
                                {month.substring(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                        <div className="month-picker-footer">
                          <button
                            type="button"
                            className="month-picker-clear"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData(prev => ({ ...prev, from_month: '', from_year: '', to_month: '' }));
                              setShowMonthPicker(false);
                            }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <small className="form-hint">Select current month to start deduction</small>
                </div>
                <div className="form-group">
                  <label className="form-label">To Month (Auto-calculated)</label>
                  <div className="month-display">
                    <FiCalendar size={18} />
                    <span>
                      {formData.to_month 
                        ? new Date(formData.to_month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                        : 'Not calculated'}
                    </span>
                  </div>
                  <small className="form-hint">Automatically calculated based on from month and tenure</small>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Remarks / Purpose</label>
                <textarea
                  name="approval_remarks"
                  value={formData.approval_remarks}
                  onChange={handleChange}
                  className="form-textarea"
                  placeholder="Enter the purpose or any additional remarks for the loan application"
                  rows="4"
                />
              </div>
            </div>

            {/* Approval Flow Info */}
            <div className="form-section">
              <h3 className="form-section-title">Approval Process</h3>
              <div className="approval-flow">
                <div className="approval-step">
                  <div className="approval-step-number">1</div>
                  <div className="approval-step-content">
                    <div className="approval-step-title">Manager Approval</div>
                    <div className="approval-step-desc">Your manager will review and approve the loan application</div>
                  </div>
                </div>
                <div className="approval-step">
                  <div className="approval-step-number">2</div>
                  <div className="approval-step-content">
                    <div className="approval-step-title">HR Approval</div>
                    <div className="approval-step-desc">HR department will verify and process the application</div>
                  </div>
                </div>
                <div className="approval-step">
                  <div className="approval-step-number">3</div>
                  <div className="approval-step-content">
                    <div className="approval-step-title">Accounts Approval</div>
                    <div className="approval-step-desc">Accounts team will finalize and disburse the loan</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/employee/data', { state: { activeTab: 'loans' } })}
                disabled={loading || fetching}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || fetching || !eligibilityData.canApply}
              >
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
          </div>
        )}

        {/* Applied Loans Data Tab */}
        {activeTab === 'applied' && (
          <div className="loans-data-container">
            <div className="loans-data-header">
              <h3>Applied Loans</h3>
            </div>
            {loadingLoans ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading loans...</p>
              </div>
            ) : (
              <div className="loans-table-wrapper">
                <table className="loans-data-table">
                  <thead>
                    <tr>
                      <th>Loan ID</th>
                      <th>Loan Type</th>
                      <th>Loan Amount</th>
                      <th>Tenure (Months)</th>
                      <th>Manager Status</th>
                      <th>HR Status</th>
                      <th>Accounts Status</th>
                      <th>Status</th>
                      <th>Applied Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appliedLoans.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="loans-empty-state">
                          <div className="loans-empty-content">
                            <FiDollarSign size={48} style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
                            <p>No loan applications found</p>
                            <small>You haven't applied for any loans yet</small>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      appliedLoans.map((loan) => (
                        <tr key={loan.loan_id}>
                          <td>{loan.loan_id}</td>
                          <td>{loan.loan_type || '-'}</td>
                          <td>₹{loan.loan_amount?.toLocaleString('en-IN') || '0'}</td>
                          <td>{loan.tenure_months || '-'}</td>
                          <td>
                            {loan.manager_status?.status ? (
                              <span className={`badge ${loan.manager_status.status === 'APPROVED' ? 'badge-success' : loan.manager_status.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                                {loan.manager_status.status}
                              </span>
                            ) : (
                              <span className="badge badge-warning">PENDING</span>
                            )}
                          </td>
                          <td>
                            {loan.hr_status?.status ? (
                              <span className={`badge ${loan.hr_status.status === 'APPROVED' ? 'badge-success' : loan.hr_status.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                                {loan.hr_status.status}
                              </span>
                            ) : (
                              <span className="badge badge-warning">PENDING</span>
                            )}
                          </td>
                          <td>
                            {loan.accounts_status?.status ? (
                              <span className={`badge ${loan.accounts_status.status === 'APPROVED' ? 'badge-success' : loan.accounts_status.status === 'REJECTED' ? 'badge-danger' : 'badge-warning'}`}>
                                {loan.accounts_status.status}
                              </span>
                            ) : (
                              <span className="badge badge-warning">PENDING</span>
                            )}
                          </td>
                          <td>{getStatusBadge(loan.status)}</td>
                          <td>{loan.created_at ? new Date(loan.created_at).toLocaleDateString() : '-'}</td>
                          <td>
                            <button
                              className="btn-view-installments"
                              onClick={() => {
                                setSelectedLoanId(loan.loan_id);
                                setActiveTab('installments');
                              }}
                            >
                              View Installments
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Loan Installments Tab */}
        {activeTab === 'installments' && (
          <div className="loans-installments-container">
            <div className="loans-installments-header">
              <h3>Loan Installments</h3>
              {selectedLoanId && (
                <div className="selected-loan-info">
                  <span>Showing installments for Loan ID: {selectedLoanId}</span>
                  <button
                    className="btn-clear-filter"
                    onClick={() => setSelectedLoanId(null)}
                  >
                    Show All
                  </button>
                </div>
              )}
            </div>
            {loadingLoans ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading installments...</p>
              </div>
            ) : (
              <>
                {loanInstallments.length === 0 ? (
                  <div className="loans-empty-state">
                    <div className="loans-empty-content">
                      <FiCalendar size={48} style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
                      <p>No loan installments found</p>
                      <small>Installments will appear here once a loan is approved</small>
                    </div>
                  </div>
                ) : (
                  <div className="installments-table-wrapper">
                    <table className="installments-table">
                      <thead>
                        <tr>
                          <th>Details</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Paid Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loanInstallments
                          .filter(inst => !selectedLoanId || inst.loan_id === selectedLoanId)
                          .flatMap((installmentData) => {
                            const installmentsList = Array.isArray(installmentData.installments) 
                              ? installmentData.installments 
                              : [];
                            
                            if (installmentsList.length === 0) {
                              return (
                                <tr key={installmentData.loan_id}>
                                  <td colSpan="4" className="no-installments">
                                    No installments available for this loan
                                  </td>
                                </tr>
                              );
                            }
                            
                            return installmentsList.map((inst, idx) => (
                              <tr key={`${installmentData.loan_id}-${idx}`}>
                                {idx === 0 && (
                                  <td rowSpan={installmentsList.length} className="installment-details-cell">
                                    <div className="installment-details-vertical">
                                      <div className="installment-avatar-small">
                                        {installmentData.user_image ? (
                                          <img 
                                            src={installmentData.user_image.startsWith('data:image') 
                                              ? installmentData.user_image 
                                              : `data:image/jpeg;base64,${installmentData.user_image}`} 
                                            alt={installmentData.user_name || 'Employee'} 
                                            onError={(e) => {
                                              e.target.style.display = 'none';
                                              e.target.nextSibling.style.display = 'flex';
                                            }}
                                          />
                                        ) : null}
                                        <div className="avatar-fallback-small" style={{ display: installmentData.user_image ? 'none' : 'flex' }}>
                                          {installmentData.user_name?.charAt(0).toUpperCase() || 'E'}
                                        </div>
                                      </div>
                                      <div className="installment-name">{installmentData.user_name || 'Unknown Employee'}</div>
                                      <div className="installment-loan-amount">₹{installmentData.loan_amount?.toLocaleString('en-IN') || '0'}</div>
                                    </div>
                                  </td>
                                )}
                                <td className="installment-amount">
                                  ₹{inst.amount?.toLocaleString('en-IN') || '0'}
                                </td>
                                <td>
                                  {inst.status === 'paid' || inst.status === 'PAID' || inst.status === 'Success' || inst.status === 'SUCCESS' ? (
                                    <span className="badge badge-success">Paid</span>
                                  ) : inst.status === 'overdue' || inst.status === 'OVERDUE' ? (
                                    <span className="badge badge-danger">Overdue</span>
                                  ) : (
                                    <span className="badge badge-warning">Pending</span>
                                  )}
                                </td>
                                <td className="installment-paid-date">
                                  {inst.paid_date ? new Date(inst.paid_date).toLocaleDateString('en-IN') : 'Pending'}
                                </td>
                              </tr>
                            ));
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ApplyLoan;

