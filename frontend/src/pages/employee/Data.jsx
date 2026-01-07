import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FiDownload, FiUpload, FiFileText, FiUser, FiCreditCard, 
  FiUsers, FiAward, FiCalendar, FiImage, FiAlertCircle, FiClock, FiSearch, FiChevronLeft, FiChevronRight, FiDollarSign, FiPlus, FiList, FiCheck, FiX, FiEdit, FiSave
} from 'react-icons/fi';
import api, { usersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import './Data.css';

const Data = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    // Set default tab based on role
    if (user?.role === 'Manager') {
      return 'alerts'; // Manager starts with Alerts tab
    }
    return 'excel'; // HR and others start with Excel tab
  });

  // Handle activeTab from navigation state and set default for Manager
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      // Clear the state to prevent it from persisting
      window.history.replaceState({}, document.title);
    } else if (user?.role === 'Manager' && (activeTab === 'excel' || activeTab === 'upload')) {
      // If Manager and on Excel/Upload tab, switch to alerts
      setActiveTab('alerts');
    }
  }, [location.state, user, activeTab]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [folderName, setFolderName] = useState('');
  const fileInputRef = useRef(null);
  const [alertsData, setAlertsData] = useState([]);
  const [overtimeData, setOvertimeData] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingOvertime, setLoadingOvertime] = useState(false);
  const [alertsSearch, setAlertsSearch] = useState('');
  const [overtimeSearch, setOvertimeSearch] = useState('');
  const [alertsCurrentPage, setAlertsCurrentPage] = useState(1);
  const [overtimeCurrentPage, setOvertimeCurrentPage] = useState(1);
  const [overtimeYear, setOvertimeYear] = useState(new Date().getFullYear());
  const recordsPerPage = 50;
  const [loanInstallments, setLoanInstallments] = useState([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [appliedLoans, setAppliedLoans] = useState([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [approvalAction, setApprovalAction] = useState(''); // 'APPROVE' or 'REJECT'
  const [loansSearch, setLoansSearch] = useState('');
  const [installmentsSearch, setInstallmentsSearch] = useState('');

  // Upload Documents Folder - Employee Selection & Form
  const [uploadEmployees, setUploadEmployees] = useState([]);
  const [selectedUploadEmployee, setSelectedUploadEmployee] = useState(null);
  const [uploadEmployeeSearch, setUploadEmployeeSearch] = useState('');
  const [showUploadEmployeeDropdown, setShowUploadEmployeeDropdown] = useState(false);
  const [uploadEmployeeFormData, setUploadEmployeeFormData] = useState({
    empid: '',
    name: '',
    doj: '',
    email: '',
    phone: '',
    role: '',
    sms_consent: false,
    email_consent: false,
    whatsapp_consent: false,
    report_to_id: '',
    pan: '',
    pf_no: '',
    aadhar: '',
    esi_no: '',
    designation: '',
    company_id: '',
    company_name: '',
    branch_id: '',
    branch_name: '',
    department_id: '',
    department_name: '',
    salaryper_annum: '',
    emp_inactive_date: null,
    is_late: false
  });
  const [uploadReportToSearch, setUploadReportToSearch] = useState('');
  const [showReportToDropdown, setShowReportToDropdown] = useState(false);
  const [loadingEmployeeData, setLoadingEmployeeData] = useState(false);
  const [updatingEmployee, setUpdatingEmployee] = useState(false);
  const [editingInactiveDate, setEditingInactiveDate] = useState(false);
  const [updatingInactiveDate, setUpdatingInactiveDate] = useState(false);
  const [tempInactiveDate, setTempInactiveDate] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const uploadEmployeeDropdownRef = useRef(null);
  const uploadReportToDropdownRef = useRef(null);

  // Format date as DD-MM-YYYY HH:mm:ss
  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  };

  const handleDownload = async (type) => {
    try {
      setLoading(true);
      const response = await api.get(`/employee-data/export/excel/${type}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${type.replace('-', ' ')} downloaded successfully`);
    } catch (error) {
      toast.error(`Failed to download ${type.replace('-', ' ')}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.zip')) {
      toast.error('Please upload a ZIP file containing the folder');
      return;
    }
    
    if (!folderName.trim()) {
      toast.error('Please enter a folder name (e.g., "PAN", "Health Cards")');
      event.target.value = '';
      return;
    }
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder_name', folderName.trim());
      
      const response = await api.post('/employee-data/upload/documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      toast.success(
        `Upload successful! Updated: ${response.data.updated}, ` +
        `Skipped: ${response.data.skipped}, Errors: ${response.data.errors}`
      );
      
      // Reset form
      setFolderName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload folder');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'alerts') {
      fetchAlertsData();
    } else if (activeTab === 'overtime') {
      fetchOvertimeData();
    } else if (activeTab === 'loan-installments') {
      fetchLoanInstallments();
    } else if (activeTab === 'loans') {
      fetchAppliedLoans();
    } else if (activeTab === 'upload' && user?.role === 'HR') {
      fetchUploadEmployees();
      fetchCompanies();
    }
  }, [activeTab, overtimeYear]);

  // Handle click outside for upload employee dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (uploadEmployeeDropdownRef.current && !uploadEmployeeDropdownRef.current.contains(event.target)) {
        setShowUploadEmployeeDropdown(false);
      }
      if (uploadReportToDropdownRef.current && !uploadReportToDropdownRef.current.contains(event.target)) {
        setShowReportToDropdown(false);
      }
    };
    if (showUploadEmployeeDropdown || showReportToDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUploadEmployeeDropdown, showReportToDropdown]);

  const fetchUploadEmployees = async () => {
    try {
      const response = await usersAPI.getEmployees();
      setUploadEmployees(response.data || []);
    } catch (error) {
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/company/list');
      setCompanies(response.data || []);
    } catch (error) {
    }
  };

  const fetchBranchesByCompany = async (companyId) => {
    if (!companyId) {
      setBranches([]);
      return;
    }
    try {
      const response = await api.get(`/department/branches/${companyId}`);
      setBranches(response.data || []);
    } catch (error) {
      setBranches([]);
    }
  };

  const fetchDepartmentsByBranch = async (branchId) => {
    if (!branchId) {
      setDepartments([]);
      return;
    }
    try {
      const response = await api.get('/department/list');
      const allDepts = response.data || [];
      const filtered = allDepts.filter(dept => dept.branch_id === branchId);
      setDepartments(filtered);
    } catch (error) {
      setDepartments([]);
    }
  };

  const fetchEmployeeData = async (employeeId) => {
    if (!employeeId) return;
    setLoadingEmployeeData(true);
    try {
      const response = await usersAPI.getAll({ empid: employeeId });
      
      // Filter to find the exact employee by empid (in case API returns multiple)
      const employee = Array.isArray(response.data) 
        ? response.data.find(emp => String(emp.empid) === String(employeeId))
        : response.data?.[0];
      
      if (employee) {
        // Parse bank_details - handle both string and object formats
        let bankDetails = {};
        if (employee.bank_details) {
          if (typeof employee.bank_details === 'string') {
            try {
              bankDetails = JSON.parse(employee.bank_details);
            } catch (e) {
              bankDetails = {};
            }
          } else if (typeof employee.bank_details === 'object' && employee.bank_details !== null) {
            bankDetails = employee.bank_details;
          }
        }
        
        // Extract bank details - handle null values properly
        const extractedPan = bankDetails.pan !== null && bankDetails.pan !== undefined ? String(bankDetails.pan) : '';
        const extractedPfNo = bankDetails.pf_no !== null && bankDetails.pf_no !== undefined ? String(bankDetails.pf_no) : '';
        const extractedAadhar = bankDetails.aadhar !== null && bankDetails.aadhar !== undefined ? String(bankDetails.aadhar) : '';
        const extractedEsiNo = bankDetails.esi_no !== null && bankDetails.esi_no !== undefined ? String(bankDetails.esi_no) : '';
        
        // Initialize IDs - prioritize IDs from database, then match by names
        let companyId = employee.company_id || '';
        let branchId = employee.branch_id || '';
        let departmentId = employee.department_id || '';
        
        // If we have company_name but no company_id, try to find it
        if (employee.company_name && !companyId && companies.length > 0) {
          const company = companies.find(c => c.name === employee.company_name);
          if (company) {
            companyId = company.id;
          }
        }
        
        // If we have company_id or found company, fetch branches
        if (companyId) {
          const branchesResponse = await api.get(`/department/branches/${companyId}`).catch(() => ({ data: [] }));
          const fetchedBranches = branchesResponse.data || [];
          setBranches(fetchedBranches);
          
          // If we have branch_name but no branch_id, try to find it
          if (employee.branch_name && !branchId && fetchedBranches.length > 0) {
            const branch = fetchedBranches.find(b => b.name === employee.branch_name);
            if (branch) {
              branchId = branch.id;
            }
          }
          
          // If we have branch_id or found branch, fetch departments
          if (branchId) {
            const deptsResponse = await api.get('/department/list').catch(() => ({ data: [] }));
            const allDepts = deptsResponse.data || [];
            const fetchedDepts = allDepts.filter(dept => dept.branch_id === branchId);
            setDepartments(fetchedDepts);
            
            // If we have department_name but no department_id, try to find it
            if (employee.department_name && !departmentId && fetchedDepts.length > 0) {
              const dept = fetchedDepts.find(d => d.name === employee.department_name);
              if (dept) {
                departmentId = dept.id;
              }
            }
          }
        } else {
          // No company selected, clear branches and departments
          setBranches([]);
          setDepartments([]);
        }
        
        // Parse emp_inactive_date - if it exists, convert to date string (YYYY-MM-DD), otherwise null
        let empInactiveDate = null;
        if (employee.emp_inactive_date) {
          const inactiveDate = new Date(employee.emp_inactive_date);
          empInactiveDate = inactiveDate.toISOString().split('T')[0]; // Get date only (YYYY-MM-DD)
        }
        
        // Get salary_per_annum from users table (employee object)
        // Convert to string, handle null/undefined, but allow 0
        let salaryPerAnnum = '';
        if (employee.salary_per_annum !== null && 
            employee.salary_per_annum !== undefined && 
            employee.salary_per_annum !== '') {
          // Convert to number first to handle Decimal types, then to string
          const salaryNum = typeof employee.salary_per_annum === 'number' 
            ? employee.salary_per_annum 
            : parseFloat(employee.salary_per_annum);
          if (!isNaN(salaryNum)) {
            salaryPerAnnum = String(salaryNum);
          }
        }
        
        setUploadEmployeeFormData({
          empid: employee.empid || '',
          name: employee.name || '',
          doj: employee.doj ? new Date(employee.doj).toISOString().split('T')[0] : '',
          email: employee.email || '',
          phone: employee.phone || '',
          role: employee.role || '',
          is_late: employee.is_late || false,
          sms_consent: employee.sms_consent || false,
          email_consent: employee.email_consent || false,
          whatsapp_consent: employee.whatsapp_consent || false,
          report_to_id: employee.report_to_id || '',
          pan: extractedPan,
          pf_no: extractedPfNo,
          aadhar: extractedAadhar,
          esi_no: extractedEsiNo,
          designation: employee.designation || '',
          company_id: companyId || '',
          company_name: employee.company_name || '',
          branch_id: branchId || '',
          branch_name: employee.branch_name || '',
          department_id: departmentId || '',
          department_name: employee.department_name || '',
          salaryper_annum: salaryPerAnnum,
          emp_inactive_date: empInactiveDate,
          is_late: employee.is_late || false
        });
        
        // Initialize tempInactiveDate for editing
        setTempInactiveDate(empInactiveDate);
        setEditingInactiveDate(false);
      }
    } catch (error) {
      toast.error('Failed to load employee data');
    } finally {
      setLoadingEmployeeData(false);
    }
  };

  const handleUpdateEmployee = async () => {
    if (!selectedUploadEmployee) {
      toast.error('Please select an employee');
      return;
    }
    setUpdatingEmployee(true);
    try {
      // Find employee by ID
      const employee = uploadEmployees.find(emp => emp.empid === selectedUploadEmployee);
      if (!employee) {
        toast.error('Employee not found');
        return;
      }

      // Get company, branch, department names from IDs
      const selectedCompany = companies.find(c => c.id === uploadEmployeeFormData.company_id);
      const selectedBranch = branches.find(b => b.id === uploadEmployeeFormData.branch_id);
      const selectedDepartment = departments.find(d => d.id === uploadEmployeeFormData.department_id);
      
      // Update user data
      // Handle emp_inactive_date explicitly: if null or empty string, send null; otherwise send the date
      const empInactiveDateValue = (uploadEmployeeFormData.emp_inactive_date === null || 
                                     uploadEmployeeFormData.emp_inactive_date === '' || 
                                     uploadEmployeeFormData.emp_inactive_date === undefined) 
                                     ? null 
                                     : uploadEmployeeFormData.emp_inactive_date;
      
      // Determine is_active based on emp_inactive_date
      // If emp_inactive_date is null/empty, employee is active (is_active = true)
      // If emp_inactive_date has a date, employee is inactive (is_active = false)
      const isActive = empInactiveDateValue === null || empInactiveDateValue === '' || empInactiveDateValue === undefined;
      
      const userUpdateData = {
        name: uploadEmployeeFormData.name || null,
        doj: uploadEmployeeFormData.doj || null,
        email: uploadEmployeeFormData.email || null,
        phone: uploadEmployeeFormData.phone || null,
        role: uploadEmployeeFormData.role || null,
        sms_consent: uploadEmployeeFormData.sms_consent,
        email_consent: uploadEmployeeFormData.email_consent,
        whatsapp_consent: uploadEmployeeFormData.whatsapp_consent,
        report_to_id: uploadEmployeeFormData.report_to_id || null,
        designation: uploadEmployeeFormData.designation || null,
        company_id: uploadEmployeeFormData.company_id || null,
        company_name: selectedCompany?.name || null,
        branch_id: uploadEmployeeFormData.branch_id || null,
        branch_name: selectedBranch?.name || null,
        department_id: uploadEmployeeFormData.department_id || null,
        department_name: selectedDepartment?.name || null,
        emp_inactive_date: empInactiveDateValue,
        is_active: isActive,
        is_late: uploadEmployeeFormData.is_late || false
      };

      await usersAPI.update(employee.id, userUpdateData);

      // Update bank details - preserve existing fields and update only the changed ones
      // First, get current bank_details to preserve other fields
      const currentEmployee = await usersAPI.getAll({ empid: selectedUploadEmployee });
      let currentBankDetails = {};
      if (currentEmployee.data?.[0]?.bank_details) {
        if (typeof currentEmployee.data[0].bank_details === 'string') {
          try {
            currentBankDetails = JSON.parse(currentEmployee.data[0].bank_details);
          } catch (e) {
            currentBankDetails = {};
          }
        } else if (typeof currentEmployee.data[0].bank_details === 'object') {
          currentBankDetails = currentEmployee.data[0].bank_details;
        }
      }
      
      // Merge existing bank_details with updated fields
      const updatedBankDetails = {
        ...currentBankDetails,
        pan: uploadEmployeeFormData.pan || null,
        pf_no: uploadEmployeeFormData.pf_no || null,
        aadhar: uploadEmployeeFormData.aadhar || null,
        esi_no: uploadEmployeeFormData.esi_no || null
      };
      
      await usersAPI.updateDetail(employee.id, 'bank_details', updatedBankDetails);

      // Update salary structure - send salary_per_annum if there's a valid value
      let updatedSalaryValue = null;
      try {
        // Handle empty string, null, undefined, or 0
        let salaryValue = null;
        const salaryInput = uploadEmployeeFormData.salaryper_annum;
        
        if (salaryInput !== null && 
            salaryInput !== undefined && 
            salaryInput !== '') {
          const parsed = parseFloat(salaryInput);
          if (!isNaN(parsed) && parsed >= 0) {
            salaryValue = parsed;
          }
        }
        
        // Only send update if we have a valid value (including 0)
        if (salaryValue !== null) {
          const response = await api.put('/payroll/salary-structure', {
            empid: selectedUploadEmployee,
            salary_per_annum: salaryValue
          });
          
          // Get the updated salary value from response
          if (response.data && response.data.salary_per_annum !== undefined) {
            updatedSalaryValue = response.data.salary_per_annum;
          } else {
            updatedSalaryValue = salaryValue;
          }
        }
      } catch (error) {
        // Don't fail the whole update if salary update fails
        // Error is silently handled to avoid showing multiple toasts
      }

      // Update form data with the updated salary value
      // Convert to string for the input field
      if (updatedSalaryValue !== null) {
        setUploadEmployeeFormData(prev => ({
          ...prev,
          salaryper_annum: String(updatedSalaryValue)
        }));
      }

      toast.success('Employee data updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update employee data');
    } finally {
      setUpdatingEmployee(false);
    }
  };

  const handleUpdateInactiveDate = async () => {
    if (!selectedUploadEmployee) {
      toast.error('Please select an employee');
      return;
    }
    setUpdatingInactiveDate(true);
    try {
      // Find employee by ID
      const employee = uploadEmployees.find(emp => emp.empid === selectedUploadEmployee);
      if (!employee) {
        toast.error('Employee not found');
        return;
      }

      // Handle emp_inactive_date explicitly: if null or empty string, send null; otherwise send the date
      const empInactiveDateValue = (tempInactiveDate === null || 
                                     tempInactiveDate === '' || 
                                     tempInactiveDate === undefined) 
                                     ? null 
                                     : tempInactiveDate;

      const userUpdateData = {
        emp_inactive_date: empInactiveDateValue
      };

      await usersAPI.update(employee.id, userUpdateData);

      // Update local form data
      setUploadEmployeeFormData({
        ...uploadEmployeeFormData,
        emp_inactive_date: empInactiveDateValue
      });

      setEditingInactiveDate(false);
      toast.success('Inactive date updated successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update inactive date');
    } finally {
      setUpdatingInactiveDate(false);
    }
  };

  const fetchAlertsData = async () => {
    setLoadingAlerts(true);
    try {
      const response = await usersAPI.getAll();
      let users = response.data || [];
      
      // For Manager: Filter only employees under them
      if (user?.role === 'Manager') {
        users = users.filter(emp => emp.report_to_id === user.empid);
      }
      
      const alerts = users.map(user => {
        const bankDetails = user.bank_details || {};
        const familyDetails = user.family_details || {};
        const nomineeDetails = user.nominee_details || {};
        const educationDetails = user.education_details || {};
        
        const getStatus = (details, updatedAt, createdAt) => {
          if (!details || Object.keys(details).length === 0) {
            return { status: 'Pending', date: null, created_at: null };
          }
          return { 
            status: 'Updated', 
            date: updatedAt || user.updated_at || null,
            created_at: createdAt || user.created_at || null
          };
        };

        return {
          empid: user.empid,
          name: user.name,
          email: user.email || '-',
          phone: user.phone || '-',
          image_base64: user.image_base64 || null,
          bank_details: getStatus(bankDetails, user.bank_details_updated_at, user.bank_details_created_at),
          family_details: getStatus(familyDetails, user.family_details_updated_at, user.family_details_created_at),
          nominee_details: getStatus(nomineeDetails, user.nominee_details_updated_at, user.nominee_details_created_at),
          education_details: getStatus(educationDetails, user.education_details_updated_at, user.education_details_created_at)
        };
      });
      
      setAlertsData(alerts);
    } catch (error) {
      toast.error('Failed to load alerts data');
    } finally {
      setLoadingAlerts(false);
    }
  };

  const handleOvertimeExport = async () => {
    try {
      setLoading(true);
      // Export filtered overtime data
      const filteredOvertime = overtimeData.filter(record => {
        const searchLower = overtimeSearch.toLowerCase();
        return (
          record.empid?.toLowerCase().includes(searchLower) ||
          record.name?.toLowerCase().includes(searchLower) ||
          record.date?.toLowerCase().includes(searchLower)
        );
      });

      // Create Excel data
      const excelData = filteredOvertime.map(record => ({
        'Emp ID': record.empid,
        'Name': record.name,
        'Date': new Date(record.date).toLocaleDateString(),
        'In Time': record.intime || '-',
        'Out Time': record.outtime || '-',
        'Applied': record.applied
      }));

      // Use XLSX library to create and download
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Overtime Data');
      XLSX.writeFile(wb, `overtime_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Overtime data exported successfully');
    } catch (error) {
      toast.error('Failed to export overtime data');
    } finally {
      setLoading(false);
    }
  };

  const fetchOvertimeData = async () => {
    setLoadingOvertime(true);
    try {
      // Fetch week off dates, holidays, requests, and users
      const [weekOffsRes, holidaysRes, requestsRes, usersRes] = await Promise.all([
        api.get('/week-offs/dates'),
        api.get('/holidays'),
        api.get('/requests'),
        usersAPI.getAll()
      ]);

      // Fetch punch logs separately with date range based on selected year
      const startDate = new Date(overtimeYear, 0, 1); // January 1st of selected year
      const endDate = new Date(overtimeYear, 11, 31); // December 31st of selected year
      const punchLogsRes = await api.get('/attendance/punch-logs', {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        }
      });

      const weekOffDates = new Set((weekOffsRes.data || []).map(wo => {
        const date = wo.date ? (wo.date.split('T')[0] || wo.date) : wo.date;
        return date;
      }));
      const holidayDates = new Set((holidaysRes.data || []).map(h => {
        const date = h.date ? (h.date.split('T')[0] || h.date) : h.date;
        return date;
      }));
      const punchLogs = punchLogsRes.data || [];
      const requests = requestsRes.data || [];
      
      // For Manager: Filter only employees under them
      let users = usersRes.data || [];
      if (user?.role === 'Manager') {
        users = users.filter(emp => emp.report_to_id === user.empid);
      }
      
      // Create a map of users by empid for quick lookup
      const usersMap = {};
      users.forEach(emp => {
        if (emp.empid) {
          usersMap[String(emp.empid)] = {
            name: emp.name,
            image_base64: emp.image_base64
          };
        }
      });

      // For Manager: Filter punch logs to only employees under them
      let filteredPunchLogs = punchLogs;
      if (user?.role === 'Manager') {
        const teamEmpids = new Set(users.map(emp => String(emp.empid)));
        filteredPunchLogs = punchLogs.filter(log => {
          const empid = String(log.employee_id || '');
          return teamEmpids.has(empid);
        });
      }
      
      // For Manager: Filter requests to only employees under them
      let filteredRequests = requests;
      if (user?.role === 'Manager') {
        const teamEmpids = new Set(users.map(emp => String(emp.empid)));
        filteredRequests = requests.filter(req => {
          const empid = String(req.empid || req.employee_id || '');
          return teamEmpids.has(empid);
        });
      }

      // Create a map of overtime-comp-off requests by empid and intime date
      const requestsMap = {};
      filteredRequests.forEach(req => {
        // Only process overtime-comp-off requests
        if (req.type === 'overtime-comp-off' && req.intime) {
          const intimeDate = new Date(req.intime);
          const dateStr = intimeDate.toISOString().split('T')[0];
          const empid = String(req.empid || req.employee_id || '');
          const key = `${empid}_${dateStr}`;
          requestsMap[key] = req;
        }
      });

      // Group punch logs by employee and date
      const overtimeMap = {};
      
      filteredPunchLogs.forEach(log => {
        if (!log.punch_time) return;
        
        const punchDate = new Date(log.punch_time);
        const dateStr = punchDate.toISOString().split('T')[0];
        const empid = String(log.employee_id || '');
        
        // Check if this date is a week off or holiday
        if (!weekOffDates.has(dateStr) && !holidayDates.has(dateStr)) {
          return; // Not a week off or holiday, skip
        }

        const key = `${empid}_${dateStr}`;
        if (!overtimeMap[key]) {
          // Always get name and image from users table based on empid
          const userData = usersMap[empid];
          let employeeName = '-';
          let employeeImage = null;
          
          if (userData) {
            employeeName = userData.name || log.employee_name || '-';
            employeeImage = userData.image_base64 || null;
            } else {
            // Fallback to log data if user not found
            employeeName = log.employee_name || '-';
          }
          
          overtimeMap[key] = {
            empid: empid,
            name: employeeName,
            image_base64: employeeImage,
            date: dateStr,
            intime: null,
            outtime: null,
            applied: 'Not applied' // Default to "Not applied"
          };
        }

        const timeStr = punchDate.toTimeString().split(' ')[0].substring(0, 5);
        if (log.punch_type === 'in') {
          overtimeMap[key].intime = timeStr;
        } else if (log.punch_type === 'out') {
          overtimeMap[key].outtime = timeStr;
        } else {
          // Fallback: assign based on order
          if (!overtimeMap[key].intime) {
            overtimeMap[key].intime = timeStr;
          } else if (!overtimeMap[key].outtime) {
            overtimeMap[key].outtime = timeStr;
          }
        }
      });

      // Add records for requests that don't have punch logs yet
      Object.keys(requestsMap).forEach(key => {
        if (!overtimeMap[key]) {
          const request = requestsMap[key];
          const intimeDate = new Date(request.intime);
          const dateStr = intimeDate.toISOString().split('T')[0];
          const empid = String(request.empid || request.employee_id || '');
          
          // Only add if date is a week off or holiday
          if (weekOffDates.has(dateStr) || holidayDates.has(dateStr)) {
            const intimeTime = intimeDate.toTimeString().split(' ')[0].substring(0, 5);
            const outtimeTime = request.outtime ? new Date(request.outtime).toTimeString().split(' ')[0].substring(0, 5) : null;
            
            // Always get name and image from users table based on empid
              const user = usersMap[empid];
            let employeeName = '-';
            let employeeImage = null;
            
              if (user) {
              employeeName = user.name || request.name || '-';
                employeeImage = user.image_base64 || null;
              } else {
              // Fallback to request data if user not found
              employeeName = request.name || '-';
            }
            
            overtimeMap[key] = {
              empid: empid,
              name: employeeName,
              image_base64: employeeImage,
              date: dateStr,
              intime: intimeTime,
              outtime: outtimeTime,
              applied: 'Not applied'
            };
          }
        }
      });

      // Check requests for applied status
      Object.keys(overtimeMap).forEach(key => {
        const record = overtimeMap[key];
        const request = requestsMap[key];
        
        if (request) {
          if (request.status === 'approved') {
            record.applied = 'Approved';
          } else if (request.status === 'pending') {
            record.applied = 'Applied (status was pending)';
          }
        }
        // If no request found, keep as "Not applied" (already set as default)
      });

      setOvertimeData(Object.values(overtimeMap));
    } catch (error) {
      toast.error('Failed to load overtime data');
    } finally {
      setLoadingOvertime(false);
    }
  };

  const fetchLoanInstallments = async () => {
    setLoadingInstallments(true);
    try {
      if (user?.role === 'Manager') {
        // For Manager: Get employees under them first
        const usersResponse = await usersAPI.getAll();
        const allUsers = usersResponse.data || [];
        
        // Filter employees who report to this manager
        const teamEmployees = allUsers.filter(emp => 
          emp.report_to_id === user.empid
        );
        
        // Fetch installments for each team employee
        const installmentPromises = teamEmployees.map(emp => 
          api.get('/loans/installments', { params: { empid: emp.empid } })
            .catch(err => {
              return { data: [] };
            })
        );
        
        const installmentResponses = await Promise.all(installmentPromises);
        const allInstallments = installmentResponses.flatMap(res => res.data || []);
        setLoanInstallments(allInstallments);
      } else if (user?.role === 'HR') {
        // For HR: Get all employees first, then fetch installments for each
        const usersResponse = await usersAPI.getAll();
        const allUsers = usersResponse.data || [];
        
        // Filter only employees (not managers, HR, Admin)
        const employees = allUsers.filter(emp => 
          emp.role === 'Employee'
        );
        
        // Fetch installments for each employee
        const installmentPromises = employees.map(emp => 
          api.get('/loans/installments', { params: { empid: emp.empid } })
            .catch(err => {
              return { data: [] };
            })
        );
        
        const installmentResponses = await Promise.all(installmentPromises);
        const allInstallments = installmentResponses.flatMap(res => res.data || []);
        setLoanInstallments(allInstallments);
      } else {
        // For Employee role: Get own installments only
        const response = await api.get('/loans/installments');
        setLoanInstallments(response.data || []);
      }
    } catch (error) {
      toast.error('Failed to load loan installments');
      setLoanInstallments([]);
    } finally {
      setLoadingInstallments(false);
    }
  };

  const fetchAppliedLoans = async () => {
    setLoadingLoans(true);
    try {
      if (user?.role === 'Manager') {
        // For Manager: Get employees under them first
        const usersResponse = await usersAPI.getAll();
        const allUsers = usersResponse.data || [];
        
        // Filter employees who report to this manager
        const teamEmployees = allUsers.filter(emp => 
          emp.report_to_id === user.empid
        );
        
        // Fetch loans for each team employee
        const loanPromises = teamEmployees.map(emp => 
          api.get('/loans/applied', { params: { empid: emp.empid } })
            .catch(err => {
              return { data: [] };
            })
        );
        
        const loanResponses = await Promise.all(loanPromises);
        const allLoans = loanResponses.flatMap(res => res.data || []);
        
        // Add employee names to loans
        const loansWithNames = allLoans.map(loan => {
          const employee = allUsers.find(emp => emp.empid === loan.empid);
          return {
            ...loan,
            employee_name: employee?.name || 'Unknown',
            name: employee?.name || 'Unknown'
          };
        });
        
        setAppliedLoans(loansWithNames);
      } else if (user?.role === 'HR') {
        // For HR: Get all employees first, then fetch loans for each
        const usersResponse = await usersAPI.getAll();
        const allUsers = usersResponse.data || [];
        
        // Filter only employees
        const employees = allUsers.filter(emp => 
          emp.role === 'Employee'
        );
        
        // Fetch loans for each employee
        const loanPromises = employees.map(emp => 
          api.get('/loans/applied', { params: { empid: emp.empid } })
            .catch(err => {
              return { data: [] };
            })
        );
        
        const loanResponses = await Promise.all(loanPromises);
        const allLoans = loanResponses.flatMap(res => res.data || []);
        
        // Add employee names to loans
        const loansWithNames = allLoans.map(loan => {
          const employee = allUsers.find(emp => emp.empid === loan.empid);
          return {
            ...loan,
            employee_name: employee?.name || 'Unknown',
            name: employee?.name || 'Unknown'
          };
        });
        
        setAppliedLoans(loansWithNames);
      } else {
        // For Employee role: Get own loans
        const response = await api.get('/loans/applied');
        const loans = response.data || [];
        
        // Get user info for name
        const usersResponse = await usersAPI.getAll();
        const allUsers = usersResponse.data || [];
        
        const loansWithNames = loans.map(loan => {
          const employee = allUsers.find(emp => emp.empid === loan.empid);
          return {
            ...loan,
            employee_name: employee?.name || user?.name || 'Unknown',
            name: employee?.name || user?.name || 'Unknown'
          };
        });
        
        setAppliedLoans(loansWithNames);
      }
    } catch (error) {
      toast.error('Failed to load loans');
      setAppliedLoans([]);
    } finally {
      setLoadingLoans(false);
    }
  };

  const handleLoanApproval = async (loanId, status) => {
    try {
      const endpoint = user?.role === 'Manager' 
        ? `/loans/${loanId}/manager-approve`
        : `/loans/${loanId}/hr-approve`;
      
      await api.put(endpoint, {
        status: status,
        remarks: approvalRemarks || null
      });
      
      toast.success(`Loan ${status.toLowerCase()} successfully`);
      setShowApprovalModal(false);
      setSelectedLoan(null);
      setApprovalRemarks('');
      fetchAppliedLoans();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update loan status');
    }
  };

  const excelCards = [
    {
      id: 'employee-details',
      title: 'Employee Details',
      description: 'Export employee basic information including Emp ID, Name, Email, Phone, Role, DOJ, DOB',
      icon: FiUser,
      color: '#3b82f6'
    },
    {
      id: 'bank-details',
      title: 'Bank Details',
      description: 'Export bank details (JSONB) for all employees with Emp ID and Name',
      icon: FiCreditCard,
      color: '#10b981'
    },
    {
      id: 'family-details',
      title: 'Family Details',
      description: 'Export family details (JSONB) for all employees with Emp ID and Name',
      icon: FiUsers,
      color: '#f59e0b'
    },
    {
      id: 'nominee-details',
      title: 'Nominee Details',
      description: 'Export nominee details (JSONB) for all employees with Emp ID and Name',
      icon: FiAward,
      color: '#ef4444'
    },
    {
      id: 'birthdays',
      title: 'Birthdays',
      description: 'Export all employee birthdays ordered by month and date with Emp ID, Name, Month, Date',
      icon: FiCalendar,
      color: '#8b5cf6'
    },
    {
      id: 'anniversaries',
      title: 'Anniversaries',
      description: 'Export all work anniversaries (DOJ) ordered by month and date with Emp ID, Name, Month, Date',
      icon: FiCalendar,
      color: '#ec4899'
    }
  ];

  return (
    <div className="data-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">EMPLOYEE DATA</h1>
          <p className="page-subtitle">Manage employee data exports and document uploads</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="data-filters">
        <div className="filter-tabs">
          {(user?.role === 'HR' || user?.role === 'Admin' || user?.role === 'Employee') && (
          <button
            className={`filter-tab ${activeTab === 'excel' ? 'active' : ''}`}
            onClick={() => setActiveTab('excel')}
          >
            <FiDownload /> Excel
          </button>
          )}
          {(user?.role === 'HR' || user?.role === 'Admin' || user?.role === 'Employee') && (
          <button
            className={`filter-tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <FiUpload /> Upload
          </button>
          )}
          {(user?.role === 'HR' || user?.role === 'Manager' || user?.role === 'Admin') && (
          <button
            className={`filter-tab ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            <FiAlertCircle /> Alerts
          </button>
          )}
          {(user?.role === 'HR' || user?.role === 'Manager' || user?.role === 'Admin') && (
          <button
            className={`filter-tab ${activeTab === 'overtime' ? 'active' : ''}`}
            onClick={() => setActiveTab('overtime')}
          >
            <FiClock /> OverTime
          </button>
          )}
          {(user?.role === 'HR' || user?.role === 'Manager' || user?.role === 'Employee') && (
            <button
              className={`filter-tab ${activeTab === 'loans' ? 'active' : ''}`}
              onClick={() => setActiveTab('loans')}
            >
              <FiDollarSign /> Loans
            </button>
          )}
          {(user?.role === 'HR' || user?.role === 'Manager' || user?.role === 'Employee') && (
            <button
              className={`filter-tab ${activeTab === 'loan-installments' ? 'active' : ''}`}
              onClick={() => setActiveTab('loan-installments')}
            >
              <FiList /> Loan Installments
            </button>
          )}
        </div>
      </div>

      {/* Excel Tab */}
      {activeTab === 'excel' && (
        <div className="excel-section">
          <div className="excel-cards-grid">
            {excelCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.id} className="excel-card">
                  <div className="excel-card-header" style={{ borderTopColor: card.color }}>
                    <div className="excel-card-icon" style={{ background: `${card.color}15`, color: card.color }}>
                      <Icon size={28} />
                    </div>
                    <button
                      className="download-btn"
                      onClick={() => handleDownload(card.id)}
                      disabled={loading}
                      style={{ background: card.color }}
                    >
                      <FiDownload size={18} />
                      {loading ? 'Downloading...' : 'Download'}
                    </button>
                  </div>
                  <div className="excel-card-body">
                    <h3 className="excel-card-title">{card.title}</h3>
                    <p className="excel-card-description">{card.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="upload-section">
          {user?.role === 'HR' ? (
            <div className="upload-documents-card">
              <div className="upload-card-header">
                <h3>Upload Documents Folder emp</h3>
              </div>
              <div className="upload-card-body">
                <div className="upload-card-left">
                  <div className="form-group" style={{ position: 'relative', width: '100%' }}>
                    <label>Select Employee</label>
                    <div ref={uploadEmployeeDropdownRef} style={{ position: 'relative', width: '100%' }}>
                      <input
                        type="text"
                        value={
                          showUploadEmployeeDropdown 
                            ? uploadEmployeeSearch 
                            : (selectedUploadEmployee 
                                ? uploadEmployees.find(e => e.empid === selectedUploadEmployee)?.name || ''
                                : '')
                        }
                        onChange={(e) => {
                          const searchValue = e.target.value;
                          setUploadEmployeeSearch(searchValue);
                          setShowUploadEmployeeDropdown(true);
                        }}
                        onFocus={() => {
                          setShowUploadEmployeeDropdown(true);
                          setUploadEmployeeSearch('');
                        }}
                        onBlur={(e) => {
                          setTimeout(() => {
                            if (!uploadEmployeeDropdownRef.current?.contains(document.activeElement)) {
                              setShowUploadEmployeeDropdown(false);
                              setUploadEmployeeSearch('');
                            }
                          }, 200);
                        }}
                        placeholder="Search employee..."
                        className="form-input"
                        style={{ width: '100%', paddingRight: '40px' }}
                      />
                      <FiSearch style={{ 
                        position: 'absolute', 
                        right: '12px', 
                        top: '50%', 
                        transform: 'translateY(-50%)', 
                        color: 'var(--text-secondary)', 
                        pointerEvents: 'none',
                        fontSize: '18px'
                      }} />
                      {showUploadEmployeeDropdown && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'var(--bg-card)',
                          border: '2px solid var(--border-color)',
                          borderRadius: '8px',
                          maxHeight: '300px',
                          overflowY: 'auto',
                          zIndex: 1000,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                          marginTop: '4px'
                        }}>
                          {uploadEmployees
                            .filter(emp => {
                              if (!uploadEmployeeSearch) return true;
                              const search = uploadEmployeeSearch.toLowerCase();
                              return emp.name.toLowerCase().includes(search) || 
                                     emp.empid.toLowerCase().includes(search) ||
                                     (emp.email && emp.email.toLowerCase().includes(search));
                            })
                            .map((emp) => (
                              <div
                                key={emp.id}
                                onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setSelectedUploadEmployee(emp.empid);
                                setUploadEmployeeSearch('');
                                setShowUploadEmployeeDropdown(false);
                                // Clear form data first
                                setUploadEmployeeFormData({
                                  empid: '',
                                  name: '',
                                  doj: '',
                                  email: '',
                                  phone: '',
                                  role: '',
                                  sms_consent: false,
                                  email_consent: false,
                                  whatsapp_consent: false,
                                  report_to_id: '',
                                  pan: '',
                                  pf_no: '',
                                  aadhar: '',
                                  esi_no: '',
                                  designation: '',
                                  company_id: '',
                                  company_name: '',
                                  branch_id: '',
                                  branch_name: '',
                                  department_id: '',
                                  department_name: '',
                                  salaryper_annum: '',
                                  emp_inactive_date: null
                                });
                                fetchEmployeeData(emp.empid);
                              }}
                                style={{
                                  padding: '14px 16px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid var(--border-color)',
                                  background: selectedUploadEmployee === emp.empid ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                  fontWeight: selectedUploadEmployee === emp.empid ? 600 : 400,
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  if (selectedUploadEmployee !== emp.empid) e.currentTarget.style.background = 'var(--bg-hover)';
                                }}
                                onMouseLeave={(e) => {
                                  if (selectedUploadEmployee !== emp.empid) e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>{emp.name}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                  {emp.empid} {emp.email ? `• ${emp.email}` : ''}
            </div>
                  </div>
                            ))}
                          {uploadEmployees.filter(emp => {
                            if (!uploadEmployeeSearch) return false;
                            const search = uploadEmployeeSearch.toLowerCase();
                            return emp.name.toLowerCase().includes(search) || 
                                   emp.empid.toLowerCase().includes(search) ||
                                   (emp.email && emp.email.toLowerCase().includes(search));
                          }).length === 0 && uploadEmployeeSearch && (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                              No employees found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="upload-card-right">
                  {loadingEmployeeData ? (
                    <div className="loading-container">
                      <div className="spinner"></div>
                      <p>Loading employee data...</p>
                    </div>
                  ) : selectedUploadEmployee ? (
                    <div className="employee-form-container">
                      <div className="form-row">
                        <div className="form-group">
                          <label>Emp ID</label>
                  <input
                    type="text"
                            value={uploadEmployeeFormData.empid}
                            disabled
                    className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>Name</label>
                          <input
                            type="text"
                            value={uploadEmployeeFormData.name || ''}
                            onChange={(e) => setUploadEmployeeFormData({ ...uploadEmployeeFormData, name: e.target.value })}
                            placeholder="Pending"
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>DOJ</label>
                          <input
                            type="date"
                            value={uploadEmployeeFormData.doj || ''}
                            onChange={(e) => setUploadEmployeeFormData({ ...uploadEmployeeFormData, doj: e.target.value })}
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>Email</label>
                          <input
                            type="email"
                            value={uploadEmployeeFormData.email || ''}
                            onChange={(e) => setUploadEmployeeFormData({ ...uploadEmployeeFormData, email: e.target.value })}
                            placeholder="Pending"
                            className="form-input"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Phone</label>
                          <input
                            type="text"
                            value={uploadEmployeeFormData.phone || ''}
                            onChange={(e) => setUploadEmployeeFormData({ ...uploadEmployeeFormData, phone: e.target.value })}
                            placeholder="Pending"
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>Role</label>
                          <input
                            type="text"
                            value={uploadEmployeeFormData.role || ''}
                            onChange={(e) => setUploadEmployeeFormData({ ...uploadEmployeeFormData, role: e.target.value })}
                            placeholder="Pending"
                            className="form-input"
                          />
                        </div>
                        <div className="form-group" style={{ position: 'relative', width: '100%' }}>
                          <label>Report To</label>
                          <div ref={uploadReportToDropdownRef} style={{ position: 'relative', width: '100%' }}>
                            <input
                              type="text"
                              value={
                                showReportToDropdown 
                                  ? uploadReportToSearch 
                                  : (uploadEmployeeFormData.report_to_id 
                                      ? uploadEmployees.find(e => e.empid === uploadEmployeeFormData.report_to_id)?.name || ''
                                      : '')
                              }
                              onChange={(e) => {
                                const searchValue = e.target.value;
                                setUploadReportToSearch(searchValue);
                                setShowReportToDropdown(true);
                              }}
                              onFocus={() => {
                                setShowReportToDropdown(true);
                                setUploadReportToSearch('');
                              }}
                              onBlur={(e) => {
                                setTimeout(() => {
                                  if (!uploadReportToDropdownRef.current?.contains(document.activeElement)) {
                                    setShowReportToDropdown(false);
                                    setUploadReportToSearch('');
                                  }
                                }, 200);
                              }}
                              placeholder="Initially Select"
                              className="form-input"
                              style={{ width: '100%', paddingRight: '40px' }}
                            />
                            <FiSearch style={{ 
                              position: 'absolute', 
                              right: '12px', 
                              top: '50%', 
                              transform: 'translateY(-50%)', 
                              color: 'var(--text-secondary)', 
                              pointerEvents: 'none',
                              fontSize: '18px'
                            }} />
                            {showReportToDropdown && (
                              <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                background: 'var(--bg-card)',
                                border: '2px solid var(--border-color)',
                                borderRadius: '8px',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                zIndex: 1000,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                                marginTop: '4px'
                              }}>
                                {uploadEmployees
                                  .filter(emp => emp.empid !== selectedUploadEmployee)
                                  .filter(emp => {
                                    if (!uploadReportToSearch) return true;
                                    const search = uploadReportToSearch.toLowerCase();
                                    return emp.name.toLowerCase().includes(search) || 
                                           emp.empid.toLowerCase().includes(search) ||
                                           (emp.email && emp.email.toLowerCase().includes(search));
                                  })
                                  .map((emp) => (
                                    <div
                                      key={emp.id}
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        setUploadEmployeeFormData({ ...uploadEmployeeFormData, report_to_id: emp.empid });
                                        setUploadReportToSearch('');
                                        setShowReportToDropdown(false);
                                      }}
                                      style={{
                                        padding: '14px 16px',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid var(--border-color)',
                                        background: uploadEmployeeFormData.report_to_id === emp.empid ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                                        fontWeight: uploadEmployeeFormData.report_to_id === emp.empid ? 600 : 400,
                                        transition: 'all 0.2s'
                                      }}
                                      onMouseEnter={(e) => {
                                        if (uploadEmployeeFormData.report_to_id !== emp.empid) e.currentTarget.style.background = 'var(--bg-hover)';
                                      }}
                                      onMouseLeave={(e) => {
                                        if (uploadEmployeeFormData.report_to_id !== emp.empid) e.currentTarget.style.background = 'transparent';
                                      }}
                                    >
                                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>{emp.name}</div>
                                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                        {emp.empid} {emp.email ? `• ${emp.email}` : ''}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Designation</label>
                          <input
                            type="text"
                            value={uploadEmployeeFormData.designation || ''}
                            onChange={(e) => setUploadEmployeeFormData({ ...uploadEmployeeFormData, designation: e.target.value })}
                            placeholder="Pending"
                            className="form-input"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>PAN</label>
                          <input
                            type="text"
                            value={uploadEmployeeFormData.pan || ''}
                            onChange={(e) => setUploadEmployeeFormData({ ...uploadEmployeeFormData, pan: e.target.value })}
                            placeholder=""
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>PF No</label>
                          <input
                            type="text"
                            value={uploadEmployeeFormData.pf_no || ''}
                            onChange={(e) => setUploadEmployeeFormData({ ...uploadEmployeeFormData, pf_no: e.target.value })}
                            placeholder=""
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>Aadhar</label>
                          <input
                            type="text"
                            value={uploadEmployeeFormData.aadhar || ''}
                            onChange={(e) => setUploadEmployeeFormData({ ...uploadEmployeeFormData, aadhar: e.target.value })}
                            placeholder=""
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>ESI No</label>
                          <input
                            type="text"
                            value={uploadEmployeeFormData.esi_no || ''}
                            onChange={(e) => setUploadEmployeeFormData({ ...uploadEmployeeFormData, esi_no: e.target.value })}
                            placeholder=""
                            className="form-input"
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Company Name</label>
                          <select
                            value={uploadEmployeeFormData.company_id || ''}
                            onChange={async (e) => {
                              const companyId = e.target.value;
                              setUploadEmployeeFormData({ 
                                ...uploadEmployeeFormData, 
                                company_id: companyId,
                                branch_id: '',
                                branch_name: '',
                                department_id: '',
                                department_name: ''
                              });
                              if (companyId) {
                                await fetchBranchesByCompany(companyId);
                              } else {
                                setBranches([]);
                                setDepartments([]);
                              }
                            }}
                            className="form-input"
                          >
                            <option value="">Initially Select</option>
                            {companies.map(company => (
                              <option key={company.id} value={company.id}>
                                {company.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Branch Name</label>
                          <select
                            value={uploadEmployeeFormData.branch_id || ''}
                            onChange={async (e) => {
                              const branchId = e.target.value;
                              setUploadEmployeeFormData({ 
                                ...uploadEmployeeFormData, 
                                branch_id: branchId,
                                department_id: '',
                                department_name: ''
                              });
                              if (branchId) {
                                await fetchDepartmentsByBranch(branchId);
                              } else {
                                setDepartments([]);
                              }
                            }}
                            className="form-input"
                            disabled={!uploadEmployeeFormData.company_id}
                          >
                            <option value="">Initially Select</option>
                            {branches.map(branch => (
                              <option key={branch.id} value={branch.id}>
                                {branch.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Department Name</label>
                          <select
                            value={uploadEmployeeFormData.department_id || ''}
                            onChange={(e) => {
                              setUploadEmployeeFormData({ 
                                ...uploadEmployeeFormData, 
                                department_id: e.target.value
                              });
                            }}
                            className="form-input"
                            disabled={!uploadEmployeeFormData.branch_id}
                          >
                            <option value="">Initially Select</option>
                            {departments.map(dept => (
                              <option key={dept.id} value={dept.id}>
                                {dept.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Salary Per Annum</label>
                          <input
                            type="number"
                            value={uploadEmployeeFormData.salaryper_annum || ''}
                            onChange={(e) => setUploadEmployeeFormData({ ...uploadEmployeeFormData, salaryper_annum: e.target.value })}
                            placeholder={uploadEmployeeFormData.salaryper_annum ? '' : 'Pending'}
                            className="form-input"
                          />
                          {!uploadEmployeeFormData.salaryper_annum && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              Pending
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>SMS Consent</label>
                          <div className="toggle-switch">
                            <input
                              type="checkbox"
                              id="sms-consent-toggle"
                              checked={uploadEmployeeFormData.sms_consent}
                              onChange={(e) => setUploadEmployeeFormData({ ...uploadEmployeeFormData, sms_consent: e.target.checked })}
                              className="toggle-input"
                            />
                            <label htmlFor="sms-consent-toggle" className="toggle-label">
                              <span className="toggle-slider"></span>
                              <span className="toggle-text">{uploadEmployeeFormData.sms_consent ? 'Yes' : 'No'}</span>
                            </label>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Email Consent</label>
                          <div className="toggle-switch">
                            <input
                              type="checkbox"
                              id="email-consent-toggle"
                              checked={uploadEmployeeFormData.email_consent}
                              onChange={(e) => setUploadEmployeeFormData({ ...uploadEmployeeFormData, email_consent: e.target.checked })}
                              className="toggle-input"
                            />
                            <label htmlFor="email-consent-toggle" className="toggle-label">
                              <span className="toggle-slider"></span>
                              <span className="toggle-text">{uploadEmployeeFormData.email_consent ? 'Yes' : 'No'}</span>
                            </label>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>WhatsApp Consent</label>
                          <div className="toggle-switch">
                            <input
                              type="checkbox"
                              id="whatsapp-consent-toggle"
                              checked={uploadEmployeeFormData.whatsapp_consent}
                              onChange={(e) => setUploadEmployeeFormData({ ...uploadEmployeeFormData, whatsapp_consent: e.target.checked })}
                              className="toggle-input"
                            />
                            <label htmlFor="whatsapp-consent-toggle" className="toggle-label">
                              <span className="toggle-slider"></span>
                              <span className="toggle-text">{uploadEmployeeFormData.whatsapp_consent ? 'Yes' : 'No'}</span>
                            </label>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Employee Status</label>
                          <div className="toggle-switch">
                            <input
                              type="checkbox"
                              id="emp-status-toggle"
                              checked={uploadEmployeeFormData.emp_inactive_date !== null && uploadEmployeeFormData.emp_inactive_date !== ''}
                              onChange={(e) => {
                                // If checked (currently Active/null), set to current date (InActive)
                                // If unchecked (currently InActive/has date), set to null (Active)
                                const today = new Date();
                                const todayDateStr = today.toISOString().split('T')[0]; // Get date only (YYYY-MM-DD)
                                setUploadEmployeeFormData({ 
                                  ...uploadEmployeeFormData, 
                                  emp_inactive_date: e.target.checked ? todayDateStr : null 
                                });
                              }}
                              className="toggle-input"
                            />
                            <label htmlFor="emp-status-toggle" className="toggle-label">
                              <span className="toggle-slider"></span>
                              <span className="toggle-text">
                                {uploadEmployeeFormData.emp_inactive_date !== null && uploadEmployeeFormData.emp_inactive_date !== '' 
                                  ? 'InActive' 
                                  : 'Active'}
                              </span>
                            </label>
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Is Late</label>
                          <div className="toggle-switch">
                            <input
                              type="checkbox"
                              id="is-late-toggle"
                              checked={uploadEmployeeFormData.is_late || false}
                              onChange={(e) => {
                                setUploadEmployeeFormData({ 
                                  ...uploadEmployeeFormData, 
                                  is_late: e.target.checked 
                                });
                              }}
                              className="toggle-input"
                            />
                            <label htmlFor="is-late-toggle" className="toggle-label">
                              <span className="toggle-slider"></span>
                              <span className="toggle-text">
                                {uploadEmployeeFormData.is_late ? 'True' : 'False'}
                              </span>
                            </label>
                          </div>
                        </div>
                        {uploadEmployeeFormData.emp_inactive_date && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {editingInactiveDate ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                  <input
                                    type="date"
                                    value={tempInactiveDate || ''}
                                    onChange={(e) => setTempInactiveDate(e.target.value || null)}
                                    className="form-input"
                                    style={{ 
                                      padding: '6px 10px', 
                                      fontSize: '0.75rem',
                                      flex: 1,
                                      maxWidth: '200px'
                                    }}
                                    disabled={updatingInactiveDate}
                                  />
                                  <button
                                    type="button"
                                    onClick={handleUpdateInactiveDate}
                                    disabled={updatingInactiveDate}
                                    style={{
                                      padding: '6px 12px',
                                      background: 'var(--primary)',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '6px',
                                      cursor: updatingInactiveDate ? 'not-allowed' : 'pointer',
                                      fontSize: '0.75rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      opacity: updatingInactiveDate ? 0.6 : 1
                                    }}
                                  >
                                    {updatingInactiveDate ? (
                                      <>
                                        <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }}></div>
                                        Updating...
                                      </>
                                    ) : (
                                      <>
                                        <FiSave size={14} />
                                        Save
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingInactiveDate(false);
                                      setTempInactiveDate(uploadEmployeeFormData.emp_inactive_date);
                                    }}
                                    disabled={updatingInactiveDate}
                                    style={{
                                      padding: '6px 12px',
                                      background: 'var(--bg-hover)',
                                      color: 'var(--text-primary)',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: '6px',
                                      cursor: updatingInactiveDate ? 'not-allowed' : 'pointer',
                                      fontSize: '0.75rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      opacity: updatingInactiveDate ? 0.6 : 1
                                    }}
                                  >
                                    <FiX size={14} />
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span>Inactive Date: {new Date(uploadEmployeeFormData.emp_inactive_date).toLocaleDateString('en-IN')}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingInactiveDate(true);
                                      setTempInactiveDate(uploadEmployeeFormData.emp_inactive_date);
                                    }}
                                    style={{
                                      padding: '4px 8px',
                                      background: 'transparent',
                                      color: 'var(--primary)',
                                      border: '1px solid var(--primary)',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '0.7rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                    title="Edit inactive date"
                                  >
                                    <FiEdit size={12} />
                                    Edit
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                      </div>
                      <div className="form-actions">
                        <button
                          type="button"
                          onClick={handleUpdateEmployee}
                          disabled={updatingEmployee}
                          className="btn-primary"
                        >
                          {updatingEmployee ? 'Updating...' : 'Update'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="no-employee-selected">
                      <p>Please select an employee to view and edit their details</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
          
          {/* ZIP File Upload Table - Show for all roles including HR */}
          <div className="upload-section" style={{ marginTop: user?.role === 'HR' ? '24px' : '0' }}>
            <div className="upload-table-container">
              <table className="upload-table">
                <thead>
                  <tr>
                    <th>Upload Documents Folder</th>
                    <th>Name</th>
                    <th>Instruction</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="upload-folder-cell">
                        <div className="upload-icon-small">
                          <FiImage size={24} />
                        </div>
                        <div>
                          <div className="upload-folder-title">Upload Documents Folder</div>
                          <div className="upload-folder-subtitle">Upload a ZIP file containing images named by Employee ID</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="upload-name-cell">
                        <input
                          type="text"
                          className="form-input-table"
                    placeholder="e.g., PAN, Health Cards, Aadhar, etc."
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    disabled={uploading}
                  />
                        <div className="file-upload-area-table">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip"
                      onChange={handleFolderUpload}
                      disabled={uploading}
                      className="file-input"
                      id="zip-file-input"
                    />
                          <label htmlFor="zip-file-input" className="file-upload-label-table">
                            <FiUpload size={20} />
                      <span>{uploading ? 'Uploading...' : 'Choose ZIP File'}</span>
                    </label>
                  </div>
                </div>
                    </td>
                    <td>
                      <div className="upload-instructions-box-table">
                        <div className="instruction-item-table">
                          <span className="instruction-number-table">1</span>
                          <span className="instruction-text-table">Create a folder with all employee document images</span>
                  </div>
                        <div className="instruction-item-table">
                          <span className="instruction-number-table">2</span>
                          <span className="instruction-text-table">Name each image file with the Employee ID (e.g., "EMP001.jpg", "EMP002.png")</span>
                    </div>
                        <div className="instruction-item-table">
                          <span className="instruction-number-table">3</span>
                          <span className="instruction-text-table">Compress the folder into a ZIP file</span>
                    </div>
                        <div className="instruction-item-table">
                          <span className="instruction-number-table">4</span>
                          <span className="instruction-text-table">Enter the folder name above (this will be stored as the document name)</span>
                    </div>
                        <div className="instruction-item-table">
                          <span className="instruction-number-table">5</span>
                          <span className="instruction-text-table">Select and upload the ZIP file</span>
                    </div>
                        <div className="instruction-item-table">
                          <span className="instruction-number-table">6</span>
                          <span className="instruction-text-table">The system will automatically match images to employees by Employee ID</span>
                    </div>
                        <div className="instruction-item-table">
                          <span className="instruction-number-table">7</span>
                          <span className="instruction-text-table">Employees not found in the system will be skipped</span>
                    </div>
                    </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="alerts-section">
          {/* Search */}
          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search by Emp ID, Name, Email, Phone..."
                value={alertsSearch}
                onChange={(e) => {
                  setAlertsSearch(e.target.value);
                  setAlertsCurrentPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          {loadingAlerts ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading alerts...</p>
            </div>
          ) : (
            <>
              {(() => {
                const filteredAlerts = alertsData.filter(alert => {
                  const searchLower = alertsSearch.toLowerCase();
                  return (
                    alert.empid?.toLowerCase().includes(searchLower) ||
                    alert.name?.toLowerCase().includes(searchLower) ||
                    alert.email?.toLowerCase().includes(searchLower) ||
                    alert.phone?.toLowerCase().includes(searchLower)
                  );
                });

                const totalPages = Math.ceil(filteredAlerts.length / recordsPerPage);
                const indexOfLastRecord = alertsCurrentPage * recordsPerPage;
                const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
                const currentRecords = filteredAlerts.slice(indexOfFirstRecord, indexOfLastRecord);

                return (
                  <>
                    <div className="table-container" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table className="data-table" style={{ minWidth: '800px' }}>
                        <thead>
                          <tr>
                            <th>Image</th>
                            <th>Emp ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Bank Details</th>
                            <th>Family Details</th>
                            <th>Nominee Details</th>
                            <th>Education Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentRecords.length === 0 ? (
                            <tr>
                              <td colSpan="9" className="text-center">No data found</td>
                            </tr>
                          ) : (
                            currentRecords.map((alert, idx) => (
                              <tr key={idx}>
                                <td>
                                  {alert.image_base64 ? (
                                    <img 
                                      src={alert.image_base64} 
                                      alt={alert.name}
                                      style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '1px solid var(--border-color)'
                                      }}
                                    />
                                  ) : (
                                    <div style={{
                                      width: '40px',
                                      height: '40px',
                                      borderRadius: '50%',
                                      background: 'var(--bg-hover)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'var(--text-secondary)',
                                      fontSize: '0.8rem',
                                      fontWeight: 600
                                    }}>
                                      {alert.name?.charAt(0).toUpperCase() || 'N'}
                                    </div>
                                  )}
                                </td>
                                <td>{alert.empid}</td>
                                <td>{alert.name}</td>
                                <td>{alert.email}</td>
                                <td>{alert.phone}</td>
                        <td>
                          <div>
                            <span className={alert.bank_details.status === 'Pending' ? 'badge badge-warning' : 'badge badge-success'}>
                              {alert.bank_details.status}
                            </span>
                            {alert.bank_details.status === 'Updated' && alert.bank_details.date && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                Updated: {formatDateTime(alert.bank_details.date)}
                              </div>
                            )}
                            {alert.bank_details.status === 'Updated' && alert.bank_details.created_at && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                 {formatDateTime(alert.bank_details.created_at)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div>
                            <span className={alert.family_details.status === 'Pending' ? 'badge badge-warning' : 'badge badge-success'}>
                              {alert.family_details.status}
                            </span>
                            {alert.family_details.status === 'Updated' && alert.family_details.date && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                Updated: {formatDateTime(alert.family_details.date)}
                              </div>
                            )}
                            {alert.family_details.status === 'Updated' && alert.family_details.created_at && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                 {formatDateTime(alert.family_details.created_at)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div>
                            <span className={alert.nominee_details.status === 'Pending' ? 'badge badge-warning' : 'badge badge-success'}>
                              {alert.nominee_details.status}
                            </span>
                            {alert.nominee_details.status === 'Updated' && alert.nominee_details.date && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                Updated: {formatDateTime(alert.nominee_details.date)}
                              </div>
                            )}
                            {alert.nominee_details.status === 'Updated' && alert.nominee_details.created_at && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                 {formatDateTime(alert.nominee_details.created_at)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div>
                            <span className={alert.education_details.status === 'Pending' ? 'badge badge-warning' : 'badge badge-success'}>
                              {alert.education_details.status}
                            </span>
                            {alert.education_details.status === 'Updated' && alert.education_details.date && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                Updated: {formatDateTime(alert.education_details.date)}
                              </div>
                            )}
                            {alert.education_details.status === 'Updated' && alert.education_details.created_at && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                 {formatDateTime(alert.education_details.created_at)}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div className="pagination-info" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', flex: '1 1 100%', textAlign: 'center', order: 2 }}>
                  Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredAlerts.length)} of {filteredAlerts.length} records
                </div>
                <div className="pagination-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: '1 1 100%', justifyContent: 'center', order: 1 }}>
                  <button 
                    onClick={() => setAlertsCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={alertsCurrentPage === 1}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      cursor: alertsCurrentPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: alertsCurrentPage === 1 ? 0.5 : 1
                    }}
                  >
                    <FiChevronLeft />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setAlertsCurrentPage(page)}
                      style={{
                        padding: '8px 12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        background: alertsCurrentPage === page ? 'var(--primary)' : 'var(--bg-card)',
                        color: alertsCurrentPage === page ? 'white' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontWeight: alertsCurrentPage === page ? 600 : 400
                      }}
                    >
                      {page}
                    </button>
                  ))}
                  <button 
                    onClick={() => setAlertsCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={alertsCurrentPage === totalPages}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      cursor: alertsCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                      opacity: alertsCurrentPage === totalPages ? 0.5 : 1
                    }}
                  >
                    <FiChevronRight />
                  </button>
                </div>
              </div>
            )}
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* OverTime Tab */}
      {activeTab === 'overtime' && (
        <div className="overtime-section">
          {/* Search, Year Filter, and Excel in single row */}
          <div className="overtime-filters-row" style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'nowrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <FiSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', zIndex: 1 }} />
              <input
                type="text"
                placeholder="Search by Emp ID, Name, Date..."
                value={overtimeSearch}
                onChange={(e) => {
                  setOvertimeSearch(e.target.value);
                  setOvertimeCurrentPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem'
                }}
              />
            </div>
            <select
              value={overtimeYear}
              onChange={(e) => {
                setOvertimeYear(parseInt(e.target.value));
                setOvertimeCurrentPage(1);
              }}
              className="form-select"
              style={{ width: '80px', flexShrink: 0, padding: '10px 8px' }}
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <button
              onClick={handleOvertimeExport}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              <FiDownload /> Excel
            </button>
          </div>

          {loadingOvertime ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading overtime data...</p>
            </div>
          ) : (
            <>
              {(() => {
                const filteredOvertime = overtimeData.filter(record => {
                  const searchLower = overtimeSearch.toLowerCase();
                  return (
                    record.empid?.toLowerCase().includes(searchLower) ||
                    record.name?.toLowerCase().includes(searchLower) ||
                    record.date?.toLowerCase().includes(searchLower)
                  );
                });

                const totalPages = Math.ceil(filteredOvertime.length / recordsPerPage);
                const indexOfLastRecord = overtimeCurrentPage * recordsPerPage;
                const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
                const currentRecords = filteredOvertime.slice(indexOfFirstRecord, indexOfLastRecord);

                return (
                  <>
                    <div className="table-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table className="data-table" style={{ minWidth: '700px' }}>
                        <thead>
                          <tr>
                            <th>Image</th>
                            <th>Emp ID</th>
                            <th>Name</th>
                            <th>Date</th>
                            <th>In Time</th>
                            <th>Out Time</th>
                            <th>Applied</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentRecords.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="text-center">No overtime records found</td>
                            </tr>
                          ) : (
                            currentRecords.map((record, idx) => {
                              const firstLetter = record.name && record.name !== '-' ? record.name.charAt(0).toUpperCase() : '?';
                              return (
                                <tr key={idx}>
                                  <td>
                                    {record.image_base64 ? (
                                      <img 
                                        src={record.image_base64} 
                                        alt={record.name}
                                        style={{
                                          width: '40px',
                                          height: '40px',
                                          borderRadius: '50%',
                                          objectFit: 'cover',
                                          border: '2px solid var(--border-color)'
                                        }}
                                        onError={(e) => {
                                          // Fallback to first letter if image fails to load
                                          e.target.style.display = 'none';
                                          const fallback = e.target.parentElement.querySelector('.avatar-fallback');
                                          if (fallback) {
                                            fallback.style.display = 'flex';
                                          }
                                        }}
                                      />
                                    ) : null}
                                    <div
                                      className="avatar-fallback"
                                      style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                                        color: 'white',
                                        display: record.image_base64 ? 'none' : 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        border: '2px solid var(--border-color)'
                                      }}
                                    >
                                      {firstLetter}
                                    </div>
                                  </td>
                                  <td>{record.empid}</td>
                                  <td>{record.name}</td>
                                  <td>{new Date(record.date).toLocaleDateString()}</td>
                                  <td>{record.intime || '-'}</td>
                                  <td>{record.outtime || '-'}</td>
                                  <td>
                                    {record.applied === 'Approved' ? (
                                      <span className="badge badge-success">Approved</span>
                                    ) : record.applied === 'Applied (status was pending)' ? (
                                      <span className="badge badge-warning">Applied (status was pending)</span>
                                    ) : record.applied === 'Not applied' ? (
                                      <span className="badge badge-info">Not applied</span>
                                    ) : (
                                      <span className="badge badge-info">Not applied</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="pagination" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div className="pagination-info" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', flex: '1 1 100%', textAlign: 'center', order: 2 }}>
                          Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredOvertime.length)} of {filteredOvertime.length} records
                        </div>
                        <div className="pagination-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: '1 1 100%', justifyContent: 'center', order: 1 }}>
                          <button 
                            onClick={() => setOvertimeCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={overtimeCurrentPage === 1}
                            style={{
                              padding: '8px 12px',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              background: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              cursor: overtimeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                              opacity: overtimeCurrentPage === 1 ? 0.5 : 1
                            }}
                          >
                            <FiChevronLeft />
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                              key={page}
                              onClick={() => setOvertimeCurrentPage(page)}
                              style={{
                                padding: '8px 12px',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                background: overtimeCurrentPage === page ? 'var(--primary)' : 'var(--bg-card)',
                                color: overtimeCurrentPage === page ? 'white' : 'var(--text-primary)',
                                cursor: 'pointer',
                                fontWeight: overtimeCurrentPage === page ? 600 : 400
                              }}
                            >
                              {page}
                            </button>
                          ))}
                          <button 
                            onClick={() => setOvertimeCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={overtimeCurrentPage === totalPages}
                            style={{
                              padding: '8px 12px',
                              border: '1px solid var(--border-color)',
                              borderRadius: '8px',
                              background: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              cursor: overtimeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                              opacity: overtimeCurrentPage === totalPages ? 0.5 : 1
                            }}
                          >
                            <FiChevronRight />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Loans Tab */}
      {activeTab === 'loans' && (
        <div className="loans-section">
          <div className="loans-container">
            <div className="loans-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                <div className="loans-header-icon">
                  <FiDollarSign size={32} />
                </div>
                <div>
                  <h2 className="loans-title">Employee Loans</h2>
                  <p className="loans-subtitle">View and manage employee loan information</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {(user?.role === 'HR' || user?.role === 'Employee') && (
                  <button 
                    className="loan-action-btn loan-action-btn-primary"
                    onClick={() => setActiveTab('loan-installments')}
                  >
                    <FiList size={18} />
                    Loan Installments
                  </button>
                )}
                <button 
                  className="loan-action-btn loan-action-btn-primary"
                  onClick={() => navigate('/employee/apply-loan')}
                >
                  <FiPlus size={18} />
                  Apply Loan
                </button>
                <button className="loan-action-btn loan-action-btn-secondary">
                  <FiDownload size={18} />
                  Export Loans
                </button>
              </div>
            </div>

            <div className="loans-table-container">
              <div className="loans-table-header">
                <div className="loans-table-search">
                  <FiSearch size={18} />
                  <input
                    type="text"
                    placeholder="Search loans..."
                    className="loans-search-input"
                    value={loansSearch}
                    onChange={(e) => setLoansSearch(e.target.value)}
                  />
                </div>
              </div>
              {loadingLoans ? (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <p>Loading loans...</p>
                </div>
              ) : (
                <div className="loans-table-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table className="loans-table" style={{ minWidth: '900px' }}>
                    <thead>
                      <tr>
                        <th>Name (Emp ID)</th>
                        <th>Loan Type</th>
                        <th>Loan Amount</th>
                        <th>Tenure (Months)</th>
                        <th>Manager Status</th>
                        <th>HR Status</th>
                        <th>Accounts Status</th>
                        <th>Status</th>
                        <th>Applied Date</th>
                        {(user?.role === 'Manager' || user?.role === 'HR') && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filteredLoans = appliedLoans.filter(loan => {
                          if (!loansSearch.trim()) return true;
                          const searchLower = loansSearch.toLowerCase();
                          const employeeName = (loan.employee_name || loan.name || '').toLowerCase();
                          const empid = String(loan.empid || '').toLowerCase();
                          const loanType = (loan.loan_type || '').toLowerCase();
                          return employeeName.includes(searchLower) || 
                                 empid.includes(searchLower) || 
                                 loanType.includes(searchLower);
                        });
                        
                        if (filteredLoans.length === 0) {
                          return (
                            <tr>
                              <td colSpan={user?.role === 'Manager' || user?.role === 'HR' ? 10 : 9} className="loans-empty-state">
                                <div className="loans-empty-content">
                                  <FiDollarSign size={48} style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
                                  <p>No loans found</p>
                                  <small>{appliedLoans.length === 0 ? 'No loan applications available' : 'No loans match your search'}</small>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        
                        return filteredLoans.map((loan) => {
                          const managerStatus = loan.manager_status || {};
                          const hrStatus = loan.hr_status || {};
                          const accountsStatus = loan.accounts_status || {};
                          
                          const canManagerApprove = user?.role === 'Manager' && managerStatus.status === 'PENDING';
                          const canHRApprove = user?.role === 'HR' && managerStatus.status === 'APPROVED' && hrStatus.status === 'PENDING';
                          
                          // Get employee name
                          const employeeName = loan.employee_name || loan.name || 'Unknown';
                          
                          return (
                            <tr key={loan.loan_id}>
                              <td>{employeeName} ({loan.empid})</td>
                              <td>{loan.loan_type || '-'}</td>
                              <td>₹{parseFloat(loan.loan_amount).toLocaleString('en-IN')}</td>
                              <td>{loan.tenure_months}</td>
                              <td>
                                {managerStatus.status === 'APPROVED' ? (
                                  <span className="badge badge-success">Approved</span>
                                ) : managerStatus.status === 'REJECTED' ? (
                                  <span className="badge badge-danger">Rejected</span>
                                ) : (
                                  <span className="badge badge-warning">Pending</span>
                                )}
                              </td>
                              <td>
                                {hrStatus.status === 'APPROVED' ? (
                                  <span className="badge badge-success">Approved</span>
                                ) : hrStatus.status === 'REJECTED' ? (
                                  <span className="badge badge-danger">Rejected</span>
                                ) : (
                                  <span className="badge badge-warning">Pending</span>
                                )}
                              </td>
                              <td>
                                {accountsStatus.status === 'APPROVED' ? (
                                  <span className="badge badge-success">Approved</span>
                                ) : accountsStatus.status === 'REJECTED' ? (
                                  <span className="badge badge-danger">Rejected</span>
                                ) : (
                                  <span className="badge badge-warning">Pending</span>
                                )}
                              </td>
                              <td>
                                <span className={`badge badge-${loan.status === 'APPROVED' ? 'success' : loan.status === 'REJECTED' ? 'danger' : 'warning'}`}>
                                  {loan.status}
                                </span>
                              </td>
                              <td>{loan.created_at ? new Date(loan.created_at).toLocaleDateString('en-IN') : '-'}</td>
                              {(user?.role === 'Manager' || user?.role === 'HR') && (
                                <td>
                                  {canManagerApprove || canHRApprove ? (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <button
                                        className="btn-approve"
                                        onClick={() => {
                                          setSelectedLoan(loan);
                                          setApprovalAction('APPROVE');
                                          setShowApprovalModal(true);
                                        }}
                                        style={{
                                          padding: '6px 12px',
                                          background: '#10b981',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '6px',
                                          cursor: 'pointer',
                                          fontSize: '0.85rem',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}
                                      >
                                        <FiCheck size={16} />
                                        Approve
                                      </button>
                                      <button
                                        className="btn-reject"
                                        onClick={() => {
                                          setSelectedLoan(loan);
                                          setApprovalAction('REJECT');
                                          setShowApprovalModal(true);
                                        }}
                                        style={{
                                          padding: '6px 12px',
                                          background: '#ef4444',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '6px',
                                          cursor: 'pointer',
                                          fontSize: '0.85rem',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}
                                      >
                                        <FiX size={16} />
                                        Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loan Installments Tab - HR, Manager, and Employee */}
      {activeTab === 'loan-installments' && (user?.role === 'HR' || user?.role === 'Manager' || user?.role === 'Employee') && (
        <div className="loans-installments-container">
          <div className="loans-installments-header">
            <h3>Loan Installments</h3>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
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
              <div className="loans-table-search" style={{ marginLeft: 'auto' }}>
                <FiSearch size={18} />
                <input
                  type="text"
                  placeholder="Search installments..."
                  className="loans-search-input"
                  value={installmentsSearch}
                  onChange={(e) => setInstallmentsSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
          {loadingInstallments ? (
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
                <div className="installments-table-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table className="installments-table" style={{ minWidth: '600px' }}>
                    <thead>
                      <tr>
                        <th>Details</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Paid Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filteredInstallments = loanInstallments
                          .filter(inst => !selectedLoanId || inst.loan_id === selectedLoanId)
                          .filter(inst => {
                            if (!installmentsSearch.trim()) return true;
                            const searchLower = installmentsSearch.toLowerCase();
                            const userName = (inst.user_name || '').toLowerCase();
                            const empid = String(inst.empid || '').toLowerCase();
                            const loanId = String(inst.loan_id || '').toLowerCase();
                            return userName.includes(searchLower) || 
                                   empid.includes(searchLower) || 
                                   loanId.includes(searchLower);
                          });
                        
                        if (filteredInstallments.length === 0) {
                          return (
                            <tr>
                              <td colSpan="4" className="loans-empty-state">
                                <div className="loans-empty-content">
                                  <FiCalendar size={48} style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
                                  <p>No installments found</p>
                                  <small>{loanInstallments.length === 0 ? 'Installments will appear here once a loan is approved' : 'No installments match your search'}</small>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        
                        return filteredInstallments.flatMap((installmentData) => {
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
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Approval Modal */}
      <Modal
        isOpen={showApprovalModal}
        onClose={() => {
          setShowApprovalModal(false);
          setSelectedLoan(null);
          setApprovalRemarks('');
          setApprovalAction('');
        }}
        title={selectedLoan ? `${approvalAction === 'APPROVE' ? 'Approve' : 'Reject'} Loan Application` : 'Loan Approval'}
      >
        {selectedLoan && (
          <div className="loan-approval-modal">
            {/* Loan Details Card */}
            <div className="loan-details-card">
              <h3 className="loan-details-title">Loan Details</h3>
              <div className="loan-details-grid">
                <div className="loan-detail-item">
                  <span className="loan-detail-label">Loan ID</span>
                  <span className="loan-detail-value">#{selectedLoan.loan_id}</span>
                </div>
                <div className="loan-detail-item">
                  <span className="loan-detail-label">Employee ID</span>
                  <span className="loan-detail-value">{selectedLoan.empid}</span>
                </div>
                <div className="loan-detail-item">
                  <span className="loan-detail-label">Employee Name</span>
                  <span className="loan-detail-value">{selectedLoan.employee_name || selectedLoan.name || 'N/A'}</span>
                </div>
                <div className="loan-detail-item">
                  <span className="loan-detail-label">Loan Type</span>
                  <span className="loan-detail-value">{selectedLoan.loan_type || 'N/A'}</span>
                </div>
                <div className="loan-detail-item">
                  <span className="loan-detail-label">Loan Amount</span>
                  <span className="loan-detail-value amount">₹{parseFloat(selectedLoan.loan_amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="loan-detail-item">
                  <span className="loan-detail-label">Tenure</span>
                  <span className="loan-detail-value">{selectedLoan.tenure_months} months</span>
                </div>
                <div className="loan-detail-item">
                  <span className="loan-detail-label">EMI</span>
                  <span className="loan-detail-value">₹{selectedLoan.emi ? parseFloat(selectedLoan.emi).toLocaleString('en-IN') : 'N/A'}</span>
                </div>
                <div className="loan-detail-item">
                  <span className="loan-detail-label">Applied Date</span>
                  <span className="loan-detail-value">{selectedLoan.created_at ? formatDateTime(selectedLoan.created_at) : 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Remarks Section */}
            <div className="loan-remarks-section">
              <label className="loan-remarks-label">
                Remarks {approvalAction === 'APPROVE' ? '(Optional)' : '(Recommended)'}
              </label>
              <textarea
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                placeholder={approvalAction === 'APPROVE' 
                  ? 'Enter approval remarks (optional)...' 
                  : 'Enter rejection remarks (recommended)...'}
                className="loan-remarks-textarea"
                rows={4}
              />
              {approvalAction === 'REJECT' && (
                <p className="loan-remarks-hint">
                  <FiAlertCircle size={14} style={{ marginRight: '4px' }} />
                  Providing rejection remarks helps the employee understand the reason.
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="loan-approval-actions">
              <button
                type="button"
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedLoan(null);
                  setApprovalRemarks('');
                  setApprovalAction('');
                }}
                className="loan-action-btn loan-action-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleLoanApproval(selectedLoan.loan_id, approvalAction === 'APPROVE' ? 'APPROVED' : 'REJECTED')}
                className={`loan-action-btn ${approvalAction === 'APPROVE' ? 'loan-action-approve' : 'loan-action-reject'}`}
              >
                {approvalAction === 'APPROVE' ? (
                  <>
                    <FiCheck size={18} />
                    Approve Loan
                  </>
                ) : (
                  <>
                    <FiX size={18} />
                    Reject Loan
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Data;

