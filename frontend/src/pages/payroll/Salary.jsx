import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './Payroll.css';

const Salary = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [salaries, setSalaries] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    fetchSalaries();
  }, [month, year]);

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/payroll/salary?month=${month}&year=${year}`);
      setSalaries(response.data);
    } catch (error) {
      console.error('Error fetching salaries:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Salary Management</h1>
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
          <p>Loading salary data...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Employee ID</th>
                <th>Period</th>
                <th>Basic Salary</th>
                <th>Allowances</th>
                <th>Deductions</th>
                <th>Gross Salary</th>
                <th>Net Salary</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {salaries.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center">No salary records found</td>
                </tr>
              ) : (
                salaries.map((salary) => (
                  <tr key={salary.id}>
                    <td>{salary.employee_name}</td>
                    <td>{salary.employee_id}</td>
                    <td>{salary.month}/{salary.year}</td>
                    <td>₹{parseFloat(salary.basic_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>₹{parseFloat(salary.allowances || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>₹{parseFloat(salary.deductions || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>₹{parseFloat(salary.gross_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td><strong>₹{parseFloat(salary.net_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                    <td><span className={`badge badge-${salary.status === 'paid' ? 'success' : salary.status === 'approved' ? 'info' : 'warning'}`}>{salary.status}</span></td>
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

export default Salary;

