import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './Payroll.css';

const Payslip = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [payslips, setPayslips] = useState([]);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    fetchPayslips();
  }, [month, year]);

  const fetchPayslips = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/payroll/payslips?month=${month}&year=${year}`);
      setPayslips(response.data);
    } catch (error) {
      console.error('Error fetching payslips:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Payslip</h1>
        <div className="header-actions">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="year-input"
            placeholder="Year"
            min="2020"
            max="2100"
          />
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="month-input"
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading payslips...</p>
        </div>
      ) : (
        <>
          <div className="payslips-list">
            {payslips.length === 0 ? (
              <div className="empty-state">
                <p>No payslips found for the selected period</p>
              </div>
            ) : (
              payslips.map((payslip) => (
                <div
                  key={payslip.id}
                  className="payslip-card"
                  onClick={() => setSelectedPayslip(payslip)}
                >
                  <div className="payslip-header">
                    <div>
                      <h3>{payslip.employee_name}</h3>
                      <p className="employee-id">{payslip.employee_id}</p>
                    </div>
                    <div className="payslip-amount">
                      <span className="amount-label">Net Salary</span>
                      <span className="amount-value">
                        ₹{parseFloat(payslip.net_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="payslip-details">
                    <div className="detail-item">
                      <span>Period:</span>
                      <span>{payslip.month}/{payslip.year}</span>
                    </div>
                    <div className="detail-item">
                      <span>Status:</span>
                      <span className={`status-${payslip.status}`}>{payslip.status}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedPayslip && (
            <div className="payslip-modal-overlay" onClick={() => setSelectedPayslip(null)}>
              <div className="payslip-modal" onClick={(e) => e.stopPropagation()}>
                <div className="payslip-print-header">
                  <button className="btn-primary" onClick={handlePrint}>Print</button>
                  <button className="btn-secondary" onClick={() => setSelectedPayslip(null)}>Close</button>
                </div>
                <div className="payslip-document">
                  <div className="payslip-doc-header">
                    <h2>PAYSLIP</h2>
                    <div className="company-info">
                      <p>Company Name</p>
                      <p>Company Address</p>
                    </div>
                  </div>
                  <div className="payslip-doc-body">
                    <div className="employee-info">
                      <div>
                        <p><strong>Employee Name:</strong> {selectedPayslip.employee_name}</p>
                        <p><strong>Employee ID:</strong> {selectedPayslip.employee_id}</p>
                      </div>
                      <div>
                        <p><strong>Pay Period:</strong> {selectedPayslip.month}/{selectedPayslip.year}</p>
                        <p><strong>Pay Date:</strong> {new Date().toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="salary-breakdown">
                      <h3>Earnings</h3>
                      <div className="breakdown-row">
                        <span>Basic Salary</span>
                        <span>₹{parseFloat(selectedPayslip.basic_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {selectedPayslip.hra > 0 && (
                        <div className="breakdown-row">
                          <span>HRA</span>
                          <span>₹{parseFloat(selectedPayslip.hra || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {selectedPayslip.da > 0 && (
                        <div className="breakdown-row">
                          <span>DA</span>
                          <span>₹{parseFloat(selectedPayslip.da || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {selectedPayslip.allowances > 0 && (
                        <div className="breakdown-row">
                          <span>Allowances</span>
                          <span>₹{parseFloat(selectedPayslip.allowances || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {selectedPayslip.bonus > 0 && (
                        <div className="breakdown-row">
                          <span>Bonus</span>
                          <span>₹{parseFloat(selectedPayslip.bonus || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="breakdown-total">
                        <span><strong>Gross Salary</strong></span>
                        <span><strong>₹{parseFloat(selectedPayslip.gross_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                      </div>
                    </div>
                    <div className="salary-breakdown">
                      <h3>Deductions</h3>
                      {selectedPayslip.tax > 0 && (
                        <div className="breakdown-row">
                          <span>Tax</span>
                          <span>-₹{parseFloat(selectedPayslip.tax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {selectedPayslip.deductions > 0 && (
                        <div className="breakdown-row">
                          <span>Other Deductions</span>
                          <span>-₹{parseFloat(selectedPayslip.deductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="breakdown-total">
                        <span><strong>Total Deductions</strong></span>
                        <span><strong>-₹{parseFloat((selectedPayslip.tax || 0) + (selectedPayslip.deductions || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                      </div>
                    </div>
                    <div className="net-salary">
                      <span><strong>Net Salary</strong></span>
                      <span><strong>₹{parseFloat(selectedPayslip.net_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Payslip;

