import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import './Payroll.css';

const Payroll = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [structures, setStructures] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: '',
    structure_id: '',
    month: new Date().toISOString().slice(0, 7),
    year: new Date().getFullYear().toString(),
    bonus: '',
    overtime_hours: '',
    deductions: '',
    remarks: ''
  });

  useEffect(() => {
    fetchPayrolls();
    fetchEmployees();
    fetchStructures();
  }, []);

  const fetchPayrolls = async () => {
    setLoading(true);
    try {
      const response = await api.get('/payroll/list');
      setPayrolls(response.data);
    } catch (error) {
      console.error('Error fetching payrolls:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/users');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchStructures = async () => {
    try {
      const response = await api.get('/payroll/structures');
      setStructures(response.data);
    } catch (error) {
      console.error('Error fetching structures:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/payroll/create', formData);
      toast.success('Payroll created successfully');
      setShowForm(false);
      setFormData({
        employee_id: '',
        structure_id: '',
        month: new Date().toISOString().slice(0, 7),
        year: new Date().getFullYear().toString(),
        bonus: '',
        overtime_hours: '',
        deductions: '',
        remarks: ''
      });
      fetchPayrolls();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create payroll');
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

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: 'badge-warning', text: 'Pending' },
      approved: { class: 'badge-success', text: 'Approved' },
      paid: { class: 'badge-info', text: 'Paid' },
      rejected: { class: 'badge-danger', text: 'Rejected' },
    };
    const badge = badges[status] || badges.pending;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Payroll</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Create Payroll'}
        </button>
      </div>

      {showForm && (
        <div className="form-container">
          <form onSubmit={handleSubmit} className="payroll-form">
            <div className="form-group">
              <label>Employee *</label>
              <select
                name="employee_id"
                value={formData.employee_id}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.empid}>
                    {emp.name} ({emp.empid})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Payroll Structure *</label>
                <select
                  name="structure_id"
                  value={formData.structure_id}
                  onChange={handleChange}
                  required
                  className="form-input"
                >
                  <option value="">Select Structure</option>
                  {structures.map((struct) => (
                    <option key={struct.id} value={struct.id}>
                      {struct.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Year *</label>
                <input
                  type="number"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  required
                  min="2020"
                  max="2100"
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-row">
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

              <div className="form-group">
                <label>Bonus</label>
                <input
                  type="number"
                  name="bonus"
                  value={formData.bonus}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Overtime Hours</label>
                <input
                  type="number"
                  name="overtime_hours"
                  value={formData.overtime_hours}
                  onChange={handleChange}
                  min="0"
                  step="0.1"
                  className="form-input"
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label>Additional Deductions</label>
                <input
                  type="number"
                  name="deductions"
                  value={formData.deductions}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="form-input"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Remarks</label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                rows="3"
                className="form-input"
                placeholder="Enter remarks..."
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Payroll'}
            </button>
          </form>
        </div>
      )}

      {loading && !showForm ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading payrolls...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Period</th>
                <th>Structure</th>
                <th>Gross Salary</th>
                <th>Net Salary</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrolls.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">No payroll records found</td>
                </tr>
              ) : (
                payrolls.map((payroll) => (
                  <tr key={payroll.id}>
                    <td>
                      <div className="employee-name">{payroll.employee_name}</div>
                      <div className="employee-id">{payroll.employee_id}</div>
                    </td>
                    <td>{payroll.month}/{payroll.year}</td>
                    <td>{payroll.structure_name}</td>
                    <td>₹{parseFloat(payroll.gross_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>₹{parseFloat(payroll.net_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>{getStatusBadge(payroll.status)}</td>
                    <td>
                      <button className="btn-sm btn-primary">View</button>
                    </td>
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

export default Payroll;

