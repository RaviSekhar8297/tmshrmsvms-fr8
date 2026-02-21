import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiX, FiTrash2, FiEdit2 } from 'react-icons/fi';
import DatePicker from '../../components/DatePicker';
import Modal from '../../components/Modal';
import * as XLSX from 'xlsx';
import './Employee.css';

const WorkReport = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [formData, setFormData] = useState({
    work_date: new Date().toISOString().split('T')[0],
    works: [{ work_name: '', description: '', hours_spent: '', status: 'PENDING' }],
    status: 'PENDING',
    employee_remarks: ''
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await api.get('/work-reports/self');
      setReports(response.data || []);
    } catch (error) {
      console.error('Error fetching work reports:', error);
      toast.error('Failed to load work reports');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWork = () => {
    setFormData({
      ...formData,
      works: [...formData.works, { work_name: '', description: '', hours_spent: '', status: 'PENDING' }]
    });
  };

  const handleRemoveWork = (index) => {
    if (formData.works.length > 1) {
      const newWorks = formData.works.filter((_, i) => i !== index);
      setFormData({ ...formData, works: newWorks });
    } else {
      toast.error('At least one work item is required');
    }
  };

  const handleWorkChange = (index, field, value) => {
    const newWorks = [...formData.works];
    newWorks[index][field] = value;
    setFormData({ ...formData, works: newWorks });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate work date
    if (!formData.work_date || !formData.work_date.trim()) {
      toast.error('Work date is required');
      return;
    }

    // Validate status
    if (!formData.status || !formData.status.trim()) {
      toast.error('Status is required');
      return;
    }
    
    // Validate works array
    if (!formData.works || formData.works.length === 0) {
      toast.error('Please add at least one work item');
      return;
    }

    // Validate each work item
    for (let i = 0; i < formData.works.length; i++) {
      const work = formData.works[i];
      if (!work.work_name || !work.work_name.trim()) {
        toast.error(`Work item ${i + 1}: Work name is required`);
        return;
      }
      if (!work.hours_spent || work.hours_spent === '') {
        toast.error(`Work item ${i + 1}: Hours spent is required`);
        return;
      }
      const hours = parseFloat(work.hours_spent);
      if (isNaN(hours) || hours < 0 || hours > 16) {
        toast.error(`Work item ${i + 1}: Hours spent must be between 0 and 16`);
        return;
      }
    }

    // Check for duplicate report (same work_date) - only for new reports
    if (!editingReport) {
      const workDate = new Date(formData.work_date);
      const existingReport = reports.find(r => {
        const reportDate = new Date(r.work_date);
        return reportDate.toDateString() === workDate.toDateString();
      });
      if (existingReport) {
        toast.error('A work report already exists for this date. Please edit the existing report or choose a different date.');
        return;
      }
    }

    // Get current date and time
    const now = new Date();
    const currentDateTime = now.toISOString();

    // Format works array with current date and time
    const formattedWorks = formData.works.map(work => ({
      work_name: work.work_name.trim(),
      description: work.description?.trim() || '',
      hours_spent: parseFloat(work.hours_spent),
      status: work.status || 'PENDING',
      date: currentDateTime
    }));

    const payload = {
      work_date: formData.work_date,
      works: formattedWorks,
      status: formData.status,
      employee_remarks: formData.employee_remarks?.trim() || null
    };

    setLoading(true);
    try {
      if (editingReport) {
        await api.put(`/work-reports/${editingReport.report_id}`, payload);
        toast.success('Work report updated successfully');
      } else {
        await api.post('/work-reports/', payload);
        toast.success('Work report created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchReports();
    } catch (error) {
      console.error('Error saving work report:', error);
      toast.error(error.response?.data?.detail || 'Failed to save work report');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      work_date: new Date().toISOString().split('T')[0],
      works: [{ work_name: '', description: '', hours_spent: '', status: 'PENDING' }],
      status: 'PENDING',
      employee_remarks: ''
    });
    setEditingReport(null);
  };

  const handleEdit = (report) => {
    setEditingReport(report);
    setFormData({
      work_date: report.work_date || new Date().toISOString().split('T')[0],
      works: report.works && report.works.length > 0 
        ? report.works.map(w => ({
            work_name: w.work_name || '',
            description: w.description || '',
            hours_spent: w.hours_spent?.toString() || '',
            status: w.status || 'PENDING'
          }))
        : [{ work_name: '', description: '', hours_spent: '', status: 'PENDING' }],
      status: report.status || 'PENDING',
      employee_remarks: report.employee_remarks || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (reportId) => {
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '300px' }}>
        <div style={{ fontWeight: '600', fontSize: '1rem' }}>
          Delete Work Report?
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Are you sure you want to delete this work report? This action cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => {
              toast.dismiss(t.id);
            }}
            style={{
              padding: '6px 16px',
              background: 'var(--bg-hover)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await api.delete(`/work-reports/${reportId}`);
                toast.success('Work report deleted successfully');
                fetchReports();
              } catch (error) {
                console.error('Error deleting work report:', error);
                toast.error(error.response?.data?.detail || 'Failed to delete work report');
              }
            }}
            style={{
              padding: '6px 16px',
              background: 'var(--danger)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}
          >
            Delete
          </button>
        </div>
      </div>
    ), {
      duration: Infinity,
      style: {
        minWidth: '350px'
      }
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      PENDING: { class: 'badge-warning', text: 'Pending' },
      COMPLETED: { class: 'badge-success', text: 'Completed' },
      INPROGRESS: { class: 'badge-info', text: 'In Progress' }
    };
    const badge = badges[status] || badges.PENDING;
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  const calculateTotalHours = (works) => {
    if (!works || !Array.isArray(works)) return 0;
    return works.reduce((total, work) => total + (parseFloat(work.hours_spent) || 0), 0).toFixed(2);
  };

  const filteredReports = reports.filter(report => {
    if (fromDate) {
      const reportDate = new Date(report.work_date);
      const from = new Date(fromDate);
      if (reportDate < from) return false;
    }
    if (toDate) {
      const reportDate = new Date(report.work_date);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999); // Include entire end date
      if (reportDate > to) return false;
    }
    return true;
  });

  const exportToExcel = () => {
    if (filteredReports.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      const data = [];
      
      // Header row
      const headerRow = ['Sl.No', 'Work Date', 'Work Items', 'Total Hours', 'Status', 'Employee Remarks'];
      data.push(headerRow);
      
      // Data rows
      filteredReports.forEach((report, index) => {
        const workItems = report.works && Array.isArray(report.works) 
          ? report.works.map(w => `${w.work_name} (${w.hours_spent} hrs)`).join('; ')
          : '-';
        
        const row = [
          index + 1,
          new Date(report.work_date).toLocaleDateString(),
          workItems,
          calculateTotalHours(report.works),
          report.status || '',
          report.employee_remarks || '-'
        ];
        data.push(row);
      });
      
      // Create workbook and worksheet
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Work Reports');
      
      // Set column widths
      const colWidths = [
        { wch: 8 },  // Sl.No
        { wch: 12 }, // Work Date
        { wch: 50 }, // Work Items
        { wch: 12 }, // Total Hours
        { wch: 12 }, // Status
        { wch: 40 }  // Employee Remarks
      ];
      ws['!cols'] = colWidths;
      
      // Generate filename with date range if filters are applied
      let filename = 'work_reports';
      if (fromDate || toDate) {
        const from = fromDate ? new Date(fromDate).toISOString().split('T')[0] : 'all';
        const to = toDate ? new Date(toDate).toISOString().split('T')[0] : 'all';
        filename += `_${from}_to_${to}`;
      } else {
        filename += `_${new Date().toISOString().split('T')[0]}`;
      }
      
      // Download
      XLSX.writeFile(wb, `${filename}.xlsx`);
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export Excel file');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header stacked">
        <div>
          <h1>WORK REPORT</h1>
          <p className="page-subtitle">Submit and manage your daily work reports</p>
        </div>
        <div className="header-actions filters-row toolbar">
          <div className="toolbar-left" style={{ flex: 1, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div className="filter-field" style={{ minWidth: '150px' }}>
              <label className="filter-label">From Date</label>
              <DatePicker
                value={fromDate}
                onChange={(date) => setFromDate(date)}
                placeholder="Select from date"
              />
            </div>
            <div className="filter-field" style={{ minWidth: '150px' }}>
              <label className="filter-label">To Date</label>
              <DatePicker
                value={toDate}
                onChange={(date) => setToDate(date)}
                min={fromDate || undefined}
                placeholder="Select to date"
              />
            </div>
          </div>
          <div className="toolbar-right" style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-primary" onClick={exportToExcel} disabled={filteredReports.length === 0}>
              Excel
            </button>
            <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
              <FiPlus /> Add Report
            </button>
          </div>
        </div>
      </div>

      {loading && !showModal ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading work reports...</p>
        </div>
      ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                <th>Sl.No</th>
                <th>Work Date</th>
                <th>Work Items</th>
                <th>Total Hours</th>
                    <th>Status</th>
                <th>Employee Remarks</th>
                <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.length === 0 ? (
                    <tr>
                  <td colSpan="7" className="text-center">No work reports found</td>
                </tr>
              ) : (
                filteredReports.map((report, index) => {
                  return (
                    <tr key={report.report_id}>
                      <td>{index + 1}</td>
                      <td>{new Date(report.work_date).toLocaleDateString()}</td>
                      <td>
                        <div style={{ maxWidth: '300px' }}>
                          {report.works && Array.isArray(report.works) && report.works.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {report.works.map((work, idx) => (
                                <div key={idx} style={{ fontSize: '0.85rem', padding: '4px 8px', background: 'var(--bg-hover)', borderRadius: '4px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                    <strong>{work.work_name}</strong>
                                    {work.status && getStatusBadge(work.status)}
                                  </div>
                                  {work.description && <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{work.description}</div>}
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                                    {work.hours_spent} hrs
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>-</span>
                          )}
                        </div>
                      </td>
                      <td>{calculateTotalHours(report.works)} hrs</td>
                      <td>{getStatusBadge(report.status)}</td>
                      <td>
                        <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {report.employee_remarks || '-'}
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-action-edit"
                            onClick={() => handleEdit(report)}
                            title="Edit Work Report"
                          >
                            <FiEdit2 size={16} />
                            <span>Edit</span>
                          </button>
                          <button
                            className="btn-action-delete"
                            onClick={() => handleDelete(report.report_id)}
                            title="Delete Work Report"
                          >
                            <FiTrash2 size={16} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
                  )}
                </tbody>
              </table>
        </div>
      )}

      {showModal && (
        <Modal
          isOpen={showModal}
          onClose={() => { setShowModal(false); resetForm(); }}
          title={editingReport ? 'Edit Work Report' : 'Add Work Report'}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label>Work Date *</label>
              <DatePicker
                value={formData.work_date}
                onChange={(date) => setFormData({ ...formData, work_date: date })}
                placeholder="Select work date"
                max={new Date().toISOString().split('T')[0]}
                style={{ width: '100%' }}
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label>Work Items *</label>
                <button
                  type="button"
                  onClick={handleAddWork}
                  className="btn-sm btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <FiPlus size={14} /> Add Work
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', padding: '8px' }}>
                {formData.works.map((work, index) => (
                  <div key={index} style={{ 
                    padding: '12px', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px',
                    background: 'var(--bg-hover)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Work Item {index + 1}</strong>
                      {formData.works.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWork(index)}
                          style={{
                            padding: '4px 8px',
                            border: 'none',
                            background: 'transparent',
                            color: '#ef4444',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <FiX size={16} />
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.85rem', marginBottom: '4px', display: 'block' }}>Work Name *</label>
                        <input
                          type="text"
                          value={work.work_name}
                          onChange={(e) => handleWorkChange(index, 'work_name', e.target.value)}
                          placeholder="e.g., API Development"
                          className="form-input"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.85rem', marginBottom: '4px', display: 'block' }}>Description</label>
                        <textarea
                          value={work.description}
                          onChange={(e) => handleWorkChange(index, 'description', e.target.value)}
                          placeholder="Describe the work done..."
                          className="form-input"
                          rows="2"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.85rem', marginBottom: '4px', display: 'block' }}>Hours Spent * (0-16 hours)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="16"
                          value={work.hours_spent}
                          onChange={(e) => handleWorkChange(index, 'hours_spent', e.target.value)}
                          placeholder="3.5"
                          className="form-input"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.85rem', marginBottom: '4px', display: 'block' }}>Status *</label>
                        <select
                          value={work.status || 'PENDING'}
                          onChange={(e) => handleWorkChange(index, 'status', e.target.value)}
                          className="form-select"
                          style={{ width: '100%' }}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="INPROGRESS">In Progress</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Status *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="form-select"
                style={{ width: '100%' }}
              >
                <option value="PENDING">Pending</option>
                <option value="INPROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            <div className="form-group">
              <label>Employee Remarks</label>
              <textarea
                value={formData.employee_remarks}
                onChange={(e) => setFormData({ ...formData, employee_remarks: e.target.value })}
                placeholder="Add any additional remarks..."
                className="form-input"
                rows="3"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => { setShowModal(false); resetForm(); }}
                className="btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Saving...' : editingReport ? 'Update' : 'Submit'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default WorkReport;
