import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiDollarSign, FiTrendingUp, FiTrendingDown, FiPercent } from 'react-icons/fi';
import './Tax.css';

const Tax = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('tax');
  const [loading, setLoading] = useState(false);

  // Tax Tab States
  const [taxData, setTaxData] = useState({
    financialYear: '2025-26',
    age: 'below-60',
    status: 'resident',
    taxpayer: 'individual',
    totalIncome: '',
    containsSalary: false,
    totalDeductions: ''
  });
  const [taxResults, setTaxResults] = useState(null);

  // Salary Tab States
  const [salaryData, setSalaryData] = useState({
    salary: '',
    totalDays: '',
    payableDays: '',
    basic: ''
  });
  const [salaryBreakdown, setSalaryBreakdown] = useState(null);

  useEffect(() => {
    // Set default financial year
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 3) {
      setTaxData(prev => ({ ...prev, financialYear: `${currentYear}-${String(currentYear + 1).slice(-2)}` }));
    } else {
      setTaxData(prev => ({ ...prev, financialYear: `${currentYear - 1}-${String(currentYear).slice(-2)}` }));
    }
  }, []);

  const calculateTax = () => {
    if (!taxData.totalIncome || parseFloat(taxData.totalIncome) <= 0) {
      toast.error('Please enter valid total annual income');
      return;
    }

    const income = parseFloat(taxData.totalIncome);
    const deductions = parseFloat(taxData.totalDeductions) || 0;
    
    // Standard deduction for salaried employees (FY 2024-25 onwards: Rs. 75,000)
    const standardDeduction = taxData.containsSalary ? 75000 : 0;
    
    // Old Tax Regime Calculation
    let oldTaxableIncome = Math.max(0, income - deductions - standardDeduction);
    let oldTax = calculateOldRegimeTax(oldTaxableIncome, taxData.age);
    
    // New Tax Regime Calculation (Budget 2025)
    let newTaxableIncome = Math.max(0, income - standardDeduction);
    let newTax = calculateNewRegimeTax(newTaxableIncome, taxData.age);
    
    // Apply rebate u/s 87A if applicable
    const oldRebate = calculateRebate(oldTax, oldTaxableIncome);
    const newRebate = calculateRebate(newTax, newTaxableIncome);
    
    oldTax = Math.max(0, oldTax - oldRebate);
    newTax = Math.max(0, newTax - newRebate);
    
    // Apply surcharge and cess
    const oldFinalTax = applySurchargeAndCess(oldTax, oldTaxableIncome);
    const newFinalTax = applySurchargeAndCess(newTax, newTaxableIncome);
    
    setTaxResults({
      old: {
        netTaxableIncome: oldTaxableIncome,
        tax: oldTax,
        rebate: oldRebate,
        taxAfterRebate: oldTax,
        surcharge: oldFinalTax.surcharge,
        cess: oldFinalTax.cess,
        totalTax: oldFinalTax.total
      },
      new: {
        netTaxableIncome: newTaxableIncome,
        tax: newTax,
        rebate: newRebate,
        taxAfterRebate: newTax,
        surcharge: newFinalTax.surcharge,
        cess: newFinalTax.cess,
        totalTax: newFinalTax.total
      }
    });
  };

  const calculateOldRegimeTax = (taxableIncome, age) => {
    if (taxableIncome <= 0) return 0;
    
    let tax = 0;
    
    // Tax slabs for FY 2024-25 (Old Regime)
    if (age === 'below-60') {
      if (taxableIncome <= 250000) {
        tax = 0;
      } else if (taxableIncome <= 500000) {
        tax = (taxableIncome - 250000) * 0.05;
      } else if (taxableIncome <= 1000000) {
        tax = 12500 + (taxableIncome - 500000) * 0.20;
      } else {
        tax = 112500 + (taxableIncome - 1000000) * 0.30;
      }
    } else if (age === '60-80') {
      if (taxableIncome <= 300000) {
        tax = 0;
      } else if (taxableIncome <= 500000) {
        tax = (taxableIncome - 300000) * 0.05;
      } else if (taxableIncome <= 1000000) {
        tax = 10000 + (taxableIncome - 500000) * 0.20;
      } else {
        tax = 110000 + (taxableIncome - 1000000) * 0.30;
      }
    } else { // above-80
      if (taxableIncome <= 500000) {
        tax = 0;
      } else if (taxableIncome <= 1000000) {
        tax = (taxableIncome - 500000) * 0.20;
      } else {
        tax = 100000 + (taxableIncome - 1000000) * 0.30;
      }
    }
    
    return Math.round(tax);
  };

  const calculateNewRegimeTax = (taxableIncome, age) => {
    if (taxableIncome <= 0) return 0;
    
    let tax = 0;
    
    // Tax slabs for FY 2025-26 (New Regime - Budget 2025)
    if (taxableIncome <= 300000) {
      tax = 0;
    } else if (taxableIncome <= 700000) {
      tax = (taxableIncome - 300000) * 0.05;
    } else if (taxableIncome <= 1000000) {
      tax = 20000 + (taxableIncome - 700000) * 0.10;
    } else if (taxableIncome <= 1200000) {
      tax = 50000 + (taxableIncome - 1000000) * 0.15;
    } else if (taxableIncome <= 1500000) {
      tax = 80000 + (taxableIncome - 1200000) * 0.20;
    } else {
      tax = 140000 + (taxableIncome - 1500000) * 0.30;
    }
    
    // Apply marginal relief if applicable (for FY 2025-26: up to Rs. 12,70,500)
    if (taxableIncome > 700000 && taxableIncome <= 1270500) {
      const excessIncome = taxableIncome - 700000;
      if (tax > excessIncome) {
        tax = excessIncome;
      }
    }
    
    return Math.round(tax);
  };

  const calculateRebate = (tax, taxableIncome) => {
    // Rebate u/s 87A: Up to Rs. 25,000 for taxable income up to Rs. 7,00,000
    if (taxableIncome <= 700000) {
      return Math.min(25000, tax);
    }
    return 0;
  };

  const applySurchargeAndCess = (tax, taxableIncome) => {
    let surcharge = 0;
    
    // Surcharge rates
    if (taxableIncome > 5000000 && taxableIncome <= 10000000) {
      surcharge = tax * 0.10;
    } else if (taxableIncome > 10000000 && taxableIncome <= 20000000) {
      surcharge = tax * 0.15;
    } else if (taxableIncome > 20000000 && taxableIncome <= 50000000) {
      surcharge = tax * 0.25;
    } else if (taxableIncome > 50000000) {
      surcharge = tax * 0.37;
    }
    
    const taxWithSurcharge = tax + surcharge;
    const cess = taxWithSurcharge * 0.04; // 4% Health & Education Cess
    
    return {
      surcharge: Math.round(surcharge),
      cess: Math.round(cess),
      total: Math.round(taxWithSurcharge + cess)
    };
  };

  const calculateProfessionalTax = (grossEarningMonth) => {
    if (grossEarningMonth <= 15000) return 0;
    if (grossEarningMonth <= 20000) return 150;
    return 200;
  };

  const calculateSalaryBreakdown = () => {
    if (!salaryData.salary || parseFloat(salaryData.salary) <= 0) {
      toast.error('Please enter valid monthly salary');
      return;
    }

    const MonthlyGrossSalary = parseFloat(salaryData.salary);
    const TotalDays = parseFloat(salaryData.totalDays) || 30;
    const PayableDays = parseFloat(salaryData.payableDays) || TotalDays;
    const Basic = parseFloat(salaryData.basic) || 0;

    // Safety guards
    const safeTotalDays = TotalDays <= 0 ? 1 : TotalDays;
    const safePayableDays = PayableDays < 0 ? 0 : PayableDays;

    // 1) Gross & EarnedGross
    const PerDayGrossSalary = safeTotalDays > 0 ? Math.round((MonthlyGrossSalary / safeTotalDays) * 100) / 100 : 0;
    const GrossSalary = MonthlyGrossSalary;
    const EarnedGross = Math.round((GrossSalary / safeTotalDays) * safePayableDays);

    // 2) Monthly Basic Base (DB override if Basic > 0 else branch rules)
    let MonthlyBasicBase = 0;
    if (Basic > 0) {
      MonthlyBasicBase = Basic; // use DB value if present
    } else {
      // Remaining people splits (removed special groups)
      if (GrossSalary < 20000) {
        MonthlyBasicBase = 13500; // below 20k
      } else if (GrossSalary >= 20000 && GrossSalary <= 30000) {
        MonthlyBasicBase = 15000; // 20k..30k
      } else {
        MonthlyBasicBase = GrossSalary * 0.50; // >30k
      }
    }

    // 3) final/prorated Basic
    const finalBasic = Math.round((MonthlyBasicBase / safeTotalDays) * safePayableDays);

    // 4) HRA selection and computation
    let hraPercent = 0;

    // REMAINING PEOPLE: use updated HRA logic
    if (GrossSalary <= 20000) {
      // revised rule inside below-20k slab
      if (GrossSalary <= 21001) {
        hraPercent = 0.15; // 15%
      } else {
        hraPercent = 0.10; // 10%
      }
    } else {
      // above 20k slab
      if (GrossSalary > 30001) {
        hraPercent = 0.50;
      } else if (GrossSalary <= 21001) {
        hraPercent = 0.40;
      } else {
        hraPercent = 0.30;
      }
    }

    // Compute finalHRA — double-prorate on finalBasic
    const finalHRA = Math.round(((finalBasic * hraPercent) / safeTotalDays) * safePayableDays);

    // 5) MA & CA
    const monthlyMA = GrossSalary > 25001 ? 1250 : 0;
    const monthlyCA = GrossSalary > 25001 ? 1600 : 0;
    const finalMA = Math.round((monthlyMA / safeTotalDays) * safePayableDays);
    const finalCA = Math.round((monthlyCA / safeTotalDays) * safePayableDays);

    // 6) SA
    const finalSA = Math.round(EarnedGross - (finalBasic + finalHRA + finalMA + finalCA));

    // 7) PF (automatic based on salary condition)
    let finalpf = 0;
    // All employees automatically deduct PF
    if (finalBasic >= 15000) {
      finalpf = 1800;
    } else {
      finalpf = Math.round(finalBasic * 0.12);
    }

    // 8) ESI (automatic based on salary condition)
    let finalesi = 0;
    // All employees automatically deduct ESI if GrossSalary <= 21000
    if (GrossSalary > 21000) {
      finalesi = 0;
    } else {
      finalesi = Math.round(EarnedGross * 0.0075);
    }

    // 9) Professional Tax
    const finalpt = calculateProfessionalTax(EarnedGross);

    const totalDeductions = finalpf + finalesi + finalpt;
    const net = EarnedGross - totalDeductions;

    setSalaryBreakdown({
      basic: finalBasic,
      hra: finalHRA,
      ma: finalMA,
      ca: finalCA,
      sa: finalSA,
      gross: EarnedGross,
      pf: finalpf,
      esi: finalesi,
      pt: finalpt,
      totalDeductions: totalDeductions,
      net: net
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="page-container tax-page">
      <div className="page-header">
        <div>
          <h1>Tax & Salary Calculator</h1>
          <p className="page-subtitle">Calculate income tax and salary breakdown</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tax-tabs">
        <button
          className={`tax-tab ${activeTab === 'tax' ? 'active' : ''}`}
          onClick={() => setActiveTab('tax')}
        >
          <FiPercent /> TAX
        </button>
        {user?.role === 'HR' && (
          <button
            className={`tax-tab ${activeTab === 'salary' ? 'active' : ''}`}
            onClick={() => setActiveTab('salary')}
          >
            <FiDollarSign /> Salary
          </button>
        )}
      </div>

      {/* Tax Tab */}
      {activeTab === 'tax' && (
        <div className="tax-tab-content">
          <div className="form-container">
            <h3 style={{ marginBottom: '24px', color: 'var(--text-primary)' }}>Income Tax Calculator</h3>
            
            <div className="form-group">
              <label>Financial Year *</label>
              <select
                value={taxData.financialYear}
                onChange={(e) => setTaxData(prev => ({ ...prev, financialYear: e.target.value }))}
                className="form-select"
              >
                <option value="2025-26">2025-26</option>
                <option value="2024-25">2024-25</option>
                <option value="2023-24">2023-24</option>
                <option value="2022-23">2022-23</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Age *</label>
                <select
                  value={taxData.age}
                  onChange={(e) => setTaxData(prev => ({ ...prev, age: e.target.value }))}
                  className="form-select"
                >
                  <option value="below-60">Below 60</option>
                  <option value="60-80">60-80</option>
                  <option value="above-80">Above 80</option>
                </select>
              </div>

              <div className="form-group">
                <label>Status *</label>
                <select
                  value={taxData.status}
                  onChange={(e) => setTaxData(prev => ({ ...prev, status: e.target.value }))}
                  className="form-select"
                >
                  <option value="resident">Resident Indian (ROR / RNOR)</option>
                  <option value="nri">Non-Resident Indian (NRI)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Taxpayer *</label>
              <select
                value={taxData.taxpayer}
                onChange={(e) => setTaxData(prev => ({ ...prev, taxpayer: e.target.value }))}
                className="form-select"
              >
                <option value="individual">Individual</option>
                <option value="huf">HUF</option>
              </select>
            </div>

            <div className="form-group">
              <label>Total Annual Income (₹) *</label>
              <input
                type="number"
                value={taxData.totalIncome}
                onChange={(e) => setTaxData(prev => ({ ...prev, totalIncome: e.target.value }))}
                className="form-input"
                placeholder="Enter total annual income"
                min="0"
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={taxData.containsSalary}
                  onChange={(e) => setTaxData(prev => ({ ...prev, containsSalary: e.target.checked }))}
                  style={{ width: 'auto' }}
                />
                Does above income contain Salary?
              </label>
            </div>

            <div className="form-group">
              <label>Total Deductions (₹) *</label>
              <input
                type="number"
                value={taxData.totalDeductions}
                onChange={(e) => setTaxData(prev => ({ ...prev, totalDeductions: e.target.value }))}
                className="form-input"
                placeholder="Enter total deductions"
                min="0"
              />
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Applicable for Old Tax Regime only
                <span style={{ cursor: 'help' }} title="Deductions like 80C, 80D, etc.">?</span>
              </small>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button className="btn-primary" onClick={calculateTax} style={{ flex: 1 }}>
                Calculate
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => {
                  setTaxData({
                    financialYear: '2025-26',
                    age: 'below-60',
                    status: 'resident',
                    taxpayer: 'individual',
                    totalIncome: '',
                    containsSalary: false,
                    totalDeductions: ''
                  });
                  setTaxResults(null);
                }}
                style={{ flex: 1 }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Tax Results */}
          {taxResults && (
            <div className="tax-results">
              <div className="tax-comparison">
                <div className="tax-regime-card old-regime">
                  <h4>Old Regime</h4>
                  <div className="tax-details">
                    <div className="tax-row">
                      <span>Net Taxable Income</span>
                      <strong>{formatCurrency(taxResults.old.netTaxableIncome)}</strong>
                    </div>
                    <div className="tax-row">
                      <span>Tax on Net Income</span>
                      <strong>{formatCurrency(taxResults.old.tax)}</strong>
                    </div>
                    <div className="tax-row">
                      <span>Rebate u/s 87A</span>
                      <strong>-{formatCurrency(taxResults.old.rebate)}</strong>
                    </div>
                    <div className="tax-row">
                      <span>Tax After Rebate</span>
                      <strong>{formatCurrency(taxResults.old.taxAfterRebate)}</strong>
                    </div>
                    <div className="tax-row">
                      <span>Surcharge</span>
                      <strong>{formatCurrency(taxResults.old.surcharge)}</strong>
                    </div>
                    <div className="tax-row">
                      <span>Health & Education Cess</span>
                      <strong>{formatCurrency(taxResults.old.cess)}</strong>
                    </div>
                    <div className="tax-row total">
                      <span>Total Tax</span>
                      <strong>{formatCurrency(taxResults.old.totalTax)}</strong>
                    </div>
                  </div>
                </div>

                <div className="tax-regime-card new-regime">
                  <h4>New Regime</h4>
                  <div className="tax-details">
                    <div className="tax-row">
                      <span>Net Taxable Income</span>
                      <strong>{formatCurrency(taxResults.new.netTaxableIncome)}</strong>
                    </div>
                    <div className="tax-row">
                      <span>Tax on Net Income</span>
                      <strong>{formatCurrency(taxResults.new.tax)}</strong>
                    </div>
                    <div className="tax-row">
                      <span>Rebate u/s 87A</span>
                      <strong>-{formatCurrency(taxResults.new.rebate)}</strong>
                    </div>
                    <div className="tax-row">
                      <span>Tax After Rebate</span>
                      <strong>{formatCurrency(taxResults.new.taxAfterRebate)}</strong>
                    </div>
                    <div className="tax-row">
                      <span>Surcharge</span>
                      <strong>{formatCurrency(taxResults.new.surcharge)}</strong>
                    </div>
                    <div className="tax-row">
                      <span>Health & Education Cess</span>
                      <strong>{formatCurrency(taxResults.new.cess)}</strong>
                    </div>
                    <div className="tax-row total">
                      <span>Total Tax</span>
                      <strong>{formatCurrency(taxResults.new.totalTax)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="tax-savings">
                <h4>Savings Comparison</h4>
                <div className="savings-amount">
                  {taxResults.old.totalTax > taxResults.new.totalTax ? (
                    <>
                      <FiTrendingDown style={{ color: '#10b981' }} />
                      <span>You save <strong>{formatCurrency(taxResults.old.totalTax - taxResults.new.totalTax)}</strong> with New Regime</span>
                    </>
                  ) : (
                    <>
                      <FiTrendingUp style={{ color: '#ef4444' }} />
                      <span>You save <strong>{formatCurrency(taxResults.new.totalTax - taxResults.old.totalTax)}</strong> with Old Regime</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Salary Tab - HR Only */}
      {activeTab === 'salary' && user?.role === 'HR' && (
        <div className="tax-tab-content">
          <div className="form-container">
            <h3 style={{ marginBottom: '24px', color: 'var(--text-primary)' }}>Salary Breakdown Calculator</h3>
            
            <div className="form-group">
              <label>Enter Monthly Salary (₹) *</label>
              <input
                type="number"
                value={salaryData.salary}
                onChange={(e) => setSalaryData(prev => ({ ...prev, salary: e.target.value }))}
                className="form-input"
                placeholder="Enter monthly salary"
                min="0"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Total Days *</label>
                <input
                  type="number"
                  value={salaryData.totalDays}
                  onChange={(e) => setSalaryData(prev => ({ ...prev, totalDays: e.target.value }))}
                  className="form-input"
                  placeholder="e.g., 30"
                  min="1"
                />
              </div>

              <div className="form-group">
                <label>Payable Days *</label>
                <input
                  type="number"
                  value={salaryData.payableDays}
                  onChange={(e) => setSalaryData(prev => ({ ...prev, payableDays: e.target.value }))}
                  className="form-input"
                  placeholder="e.g., 30"
                  min="0"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Basic (Optional - Override)</label>
              <input
                type="number"
                value={salaryData.basic}
                onChange={(e) => setSalaryData(prev => ({ ...prev, basic: e.target.value }))}
                className="form-input"
                placeholder="Leave empty for auto calculation"
                min="0"
              />
              <small style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                If provided, this value will override the automatic basic calculation
              </small>
            </div>

            <button className="btn-primary" onClick={calculateSalaryBreakdown} style={{ width: '100%', marginTop: '20px' }}>
              Calculate Breakdown
            </button>
          </div>

          {/* Salary Breakdown Results */}
          {salaryBreakdown && (
            <div className="salary-breakdown">
              <div className="breakdown-section">
                <h4>Earnings</h4>
                <div className="breakdown-details">
                  <div className="breakdown-row">
                    <span>Basic</span>
                    <strong>{formatCurrency(salaryBreakdown.basic)}</strong>
                  </div>
                  <div className="breakdown-row">
                    <span>HRA</span>
                    <strong>{formatCurrency(salaryBreakdown.hra)}</strong>
                  </div>
                  <div className="breakdown-row">
                    <span>MA</span>
                    <strong>{formatCurrency(salaryBreakdown.ma || 0)}</strong>
                  </div>
                  <div className="breakdown-row">
                    <span>CA</span>
                    <strong>{formatCurrency(salaryBreakdown.ca || 0)}</strong>
                  </div>
                  <div className="breakdown-row">
                    <span>SA</span>
                    <strong>{formatCurrency(salaryBreakdown.sa || 0)}</strong>
                  </div>
                  <div className="breakdown-row total">
                    <span>Gross Salary</span>
                    <strong>{formatCurrency(salaryBreakdown.gross)}</strong>
                  </div>
                </div>
              </div>

              <div className="breakdown-section">
                <h4>Deductions</h4>
                <div className="breakdown-details">
                  <div className="breakdown-row">
                    <span>PF</span>
                    <strong>{formatCurrency(salaryBreakdown.pf)}</strong>
                  </div>
                  <div className="breakdown-row">
                    <span>ESI</span>
                    <strong>{formatCurrency(salaryBreakdown.esi)}</strong>
                  </div>
                  <div className="breakdown-row">
                    <span>Professional Tax</span>
                    <strong>{formatCurrency(salaryBreakdown.pt)}</strong>
                  </div>
                  <div className="breakdown-row total">
                    <span>Total Deductions</span>
                    <strong>{formatCurrency(salaryBreakdown.totalDeductions)}</strong>
                  </div>
                </div>
              </div>

              <div className="breakdown-section net-salary">
                <h4>Net Salary</h4>
                <div className="net-amount">
                  <strong>{formatCurrency(salaryBreakdown.net)}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Tax;

