import { useState, useEffect } from 'react';
import { FiUser, FiMail, FiPhone, FiEdit2, FiSave, FiLock, FiPlus, FiTrash2, FiX, FiDownload, FiCheck, FiAlertCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import api, { usersAPI, authAPI } from '../services/api';
import DatePicker from '../components/DatePicker';
import toast from 'react-hot-toast';
import './Profile.css';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Modal states for each detail type
  const [showModal, setShowModal] = useState(null); // 'bank', 'nominee', 'family', 'education', 'experience', 'documents'
  const [editingIndex, setEditingIndex] = useState(null);
  const [detailFormData, setDetailFormData] = useState({});
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    sms_consent: user?.sms_consent || false,
    whatsapp_consent: user?.whatsapp_consent || false,
    email_consent: user?.email_consent || false,
    image_base64: user?.image_base64 || '',
    dob: user?.dob || ''
  });

  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordStrength, setPasswordStrength] = useState(''); // 'weak', 'medium', 'strong'
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [oldPasswordVerified, setOldPasswordVerified] = useState(false);
  const [verifyingOldPassword, setVerifyingOldPassword] = useState(false);

  const [reportToUser, setReportToUser] = useState(null);
  const [loadingReportTo, setLoadingReportTo] = useState(false);
  const [showSalary, setShowSalary] = useState(false);

  // Calculate today's date in YYYY-MM-DD format for max date restriction
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper function to format date for input
  const formatDateForInput = (date) => {
    if (!date) return '';
    if (typeof date === 'string') {
      // If it's already a string in YYYY-MM-DD format
      if (date.includes('T')) {
        return date.split('T')[0];
      }
      // If it's a date string, try to parse it
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      return date;
    }
    // If it's a Date object
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate Full Name
    if (!formData.name || formData.name.trim() === '') {
      toast.error('Full Name is required');
      return;
    }
    
    // Validate Email
    if (!validateEmail(formData.email)) {
      return;
    }
    
    // Validate Phone
    if (!validatePhoneNumber(formData.phone)) {
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await usersAPI.update(user.id, formData);
      updateUser(response.data);
      toast.success('Profile updated successfully');
      setEditing(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Calculate password strength
  const calculatePasswordStrength = (password) => {
    if (!password || password.length === 0) {
      return '';
    }
    
    let strength = 0;
    
    // Length check (6-12)
    if (password.length >= 6 && password.length <= 12) {
      strength += 1;
    }
    
    // Has capital letter
    if (/[A-Z]/.test(password)) {
      strength += 1;
    }
    
    // Has small letter
    if (/[a-z]/.test(password)) {
      strength += 1;
    }
    
    // Has number
    if (/[0-9]/.test(password)) {
      strength += 1;
    }
    
    // Has special character (. @ #)
    if (/[.@#]/.test(password)) {
      strength += 1;
    }
    
    if (strength <= 2) {
      return 'weak';
    } else if (strength <= 4) {
      return 'medium';
    } else {
      return 'strong';
    }
  };

  // Get password strength percentage and color
  const getPasswordStrengthInfo = (strength) => {
    switch (strength) {
      case 'weak':
        return { percentage: 33, color: '#dc2626', label: 'Weak' };
      case 'medium':
        return { percentage: 66, color: '#d97706', label: 'Medium' };
      case 'strong':
        return { percentage: 100, color: '#16a34a', label: 'Strong' };
      default:
        return { percentage: 0, color: '#e5e7eb', label: '' };
    }
  };

  // Validate old password only on form submit
  // We don't validate in real-time to avoid unnecessary API calls

  // Validate password
  const validatePassword = (password) => {
    if (!password || password.trim() === '') {
      toast.error('Password is required');
      return false;
    }
    
    if (password.length < 6 || password.length > 12) {
      toast.error('Password must be between 6 and 12 characters');
      return false;
    }
    
    if (!/[A-Z]/.test(password)) {
      toast.error('Password must contain at least one capital letter');
      return false;
    }
    
    if (!/[a-z]/.test(password)) {
      toast.error('Password must contain at least one small letter');
      return false;
    }
    
    if (!/[0-9]/.test(password)) {
      toast.error('Password must contain at least one number');
      return false;
    }
    
    if (!/[.@#]/.test(password)) {
      toast.error('Password must contain at least one special character (. @ #)');
      return false;
    }
    
    return true;
  };

  const verifyOldPassword = async () => {
    if (!passwordData.old_password || passwordData.old_password.trim() === '') {
      toast.error('Please enter old password');
      return;
    }
    
    setVerifyingOldPassword(true);
    try {
      await api.post('/auth/verify-old-password', {
        old_password: passwordData.old_password
      });
      setOldPasswordVerified(true);
      toast.success('Old password verified');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Old password verification failed';
      toast.error(errorMsg);
      setOldPasswordVerified(false);
    } finally {
      setVerifyingOldPassword(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    // Verify old password is entered
    if (!passwordData.old_password || passwordData.old_password.trim() === '') {
      toast.error('Please enter old password');
      return;
    }
    
    // Validate new password
    if (!validatePassword(passwordData.new_password)) {
      return;
    }
    
    // Check if passwords match
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    
    setLoading(true);
    try {
      await authAPI.changePassword({
        old_password: passwordData.old_password,
        new_password: passwordData.new_password
      });
      toast.success('Password changed successfully');
      setChangingPassword(false);
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
      setPasswordStrength('');
      setOldPasswordVerified(false);
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (error) {
      // Handle error response - could be string, object, or array
      let errorMsg = '';
      if (error.response?.data) {
        if (typeof error.response.data.detail === 'string') {
          errorMsg = error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
          // FastAPI validation errors come as array
          errorMsg = error.response.data.detail.map(err => {
            if (typeof err === 'string') return err;
            if (err.msg) return err.msg;
            if (err.loc && err.msg) return `${err.loc.join('.')}: ${err.msg}`;
            return JSON.stringify(err);
          }).join(', ');
        } else if (typeof error.response.data.detail === 'object') {
          errorMsg = JSON.stringify(error.response.data.detail);
        } else {
          errorMsg = String(error.response.data.detail || error.response.data.message || '');
        }
      } else {
        errorMsg = error.message || 'Failed to change password';
      }
      
      toast.error(errorMsg || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type - only jpg, png, jpeg
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        toast.error('Please select a JPG, PNG, or JPEG image file only');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image_base64: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        sms_consent: user?.sms_consent || false,
        whatsapp_consent: user?.whatsapp_consent || false,
        email_consent: user?.email_consent || false,
        image_base64: user?.image_base64 || '',
        dob: user?.dob || ''
      });
    }
  }, [user]);

  // Fetch report_to user information
  useEffect(() => {
    const fetchReportToUser = async () => {
      if (!user?.report_to_id) {
        setReportToUser(null);
        return;
      }

      setLoadingReportTo(true);
      try {
        // Use /users/contacts endpoint which is accessible to all authenticated users
        const response = await api.get('/users/contacts');
        const allUsers = response.data || [];
        const reportTo = allUsers.find(u => u.empid === user.report_to_id);
        setReportToUser(reportTo || null);
      } catch (error) {
        console.error('Error fetching report_to user:', error);
        setReportToUser(null);
      } finally {
        setLoadingReportTo(false);
      }
    };

    fetchReportToUser();
  }, [user?.report_to_id]);

  // Format date and time
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

  // Handle detail update
  const handleDetailUpdate = async (detailType, data, action = 'add', index = null) => {
    // Validate based on detail type - ensure required fields are not empty
    if (detailType === 'family_details') {
      // Name is required
      if (!data.name || (typeof data.name === 'string' && data.name.trim() === '')) {
        toast.error('Name is required');
        return;
      }
      if (!validateName(data.name)) return;
      
      // Relation is required
      if (!data.relation || (typeof data.relation === 'string' && data.relation.trim() === '')) {
        toast.error('Relation is required');
        return;
      }
      if (!validateRelation(data.relation)) return;
      
      // Phone and Aadhar are optional, but validate if provided
      if (data.phone && data.phone.toString().trim() !== '' && !validatePhone(data.phone)) return;
      if (data.aadhar && data.aadhar.toString().trim() !== '' && !validateAadhar(data.aadhar)) return;
    } else if (detailType === 'nominee_details') {
      // Name is required
      if (!data.name || (typeof data.name === 'string' && data.name.trim() === '')) {
        toast.error('Name is required');
        return;
      }
      if (!validateName(data.name)) return;
      
      // Relation is required
      if (!data.relation || (typeof data.relation === 'string' && data.relation.trim() === '')) {
        toast.error('Relation is required');
        return;
      }
      if (!validateRelation(data.relation)) return;
      
      // Phone is required
      if (!data.phone || (typeof data.phone === 'string' && data.phone.trim() === '')) {
        toast.error('Phone is required');
        return;
      }
      if (!validatePhone(data.phone)) return;
      
      // Aadhar is optional, but validate if provided
      if (data.aadhar && data.aadhar.toString().trim() !== '' && !validateAadhar(data.aadhar)) return;
    } else if (detailType === 'bank_details') {
      // Bank Name is required
      if (!data.bank_name || (typeof data.bank_name === 'string' && data.bank_name.trim() === '')) {
        toast.error('Bank Name is required');
        return;
      }
      if (!validateBankName(data.bank_name)) return;
      
      // Account Number is required
      if (!data.account_number || (typeof data.account_number === 'string' && data.account_number.trim() === '')) {
        toast.error('Account Number is required');
        return;
      }
      if (!validateAccountNumber(data.account_number)) return;
      
      // IFSC is required
      if (!data.ifsc || (typeof data.ifsc === 'string' && data.ifsc.trim() === '')) {
        toast.error('IFSC is required');
        return;
      }
      if (!validateIFSC(data.ifsc)) return;
      
      // Optional fields - validate if provided
      if (data.pan && data.pan.toString().trim() !== '' && !validatePAN(data.pan)) return;
      if (data.aadhar && data.aadhar.toString().trim() !== '' && !validateAadhar(data.aadhar)) return;
      if (data.pf_no && data.pf_no.toString().trim() !== '' && !validatePFNO(data.pf_no)) return;
      if (data.esi_no && data.esi_no.toString().trim() !== '' && !validateESINO(data.esi_no)) return;
    } else if (detailType === 'education_details') {
      // Education name is required
      if (!data.education_name || data.education_name.trim() === '') {
        toast.error('Education name is required');
        return;
      }
      if (data.education_name.length > 25) {
        toast.error('Education name must be below 25 characters');
        return;
      }
      if (data.pass_out_year && data.pass_out_year.toString().trim() !== '') {
        const year = parseInt(data.pass_out_year);
        const currentYear = new Date().getFullYear();
        if (isNaN(year) || year > currentYear) {
          toast.error('Pass out year must be a past year');
          return;
        }
      }
      if (data.percentage && data.percentage.toString().trim() !== '') {
        const percentageNum = parseFloat(data.percentage);
        if (isNaN(percentageNum) || percentageNum < 0 || percentageNum > 100) {
          toast.error('Percentage must be between 0 and 100');
          return;
        }
      }
    } else if (detailType === 'experience_details') {
      // Company is required
      if (!data.prev_company_name || (typeof data.prev_company_name === 'string' && data.prev_company_name.trim() === '')) {
        toast.error('Company is required');
        return;
      }
      if (!validateCompany(data.prev_company_name)) return;
      
      // Optional fields - validate if provided
      if (data.year && data.year.toString().trim() !== '') {
        const year = parseInt(data.year);
        const currentYear = new Date().getFullYear();
        if (isNaN(year) || year > currentYear) {
          toast.error('Year must be a past year');
          return;
        }
      }
      if (data.designation && data.designation.toString().trim() !== '' && !validateDesignation(data.designation)) return;
      if (data.salary_per_annum && data.salary_per_annum.toString().trim() !== '' && !validateSalary(data.salary_per_annum)) return;
    } else if (detailType === 'documents') {
      if (!validateDocumentName(data.name)) return;
    }
    
    // Add current date and time to the data
    const currentDateTime = new Date().toISOString();
    const dataWithDate = { ...data, date: currentDateTime };
    
    setLoading(true);
    try {
      let payload;
      if (detailType === 'bank_details' || detailType === 'nominee_details') {
        // Single object types
        payload = dataWithDate;
      } else {
        // Array types - ensure index is a number
        const indexValue = index !== null ? parseInt(index) : null;
        payload = { 
          action, 
          data: dataWithDate || {}, 
          index: indexValue 
        };
      }
      
      console.log('Updating detail:', { detailType, payload }); // Debug log
      
      const response = await usersAPI.updateDetail(user.id, detailType, payload);
      
      // If bank_details, also update payslip_data table
      if (detailType === 'bank_details' && user?.empid) {
        try {
          await usersAPI.updatePayslipBankDetails(user.empid, {
            bank_name: data.bank_name || null,
            bank_acc_no: data.account_number || null,
            ifsc_code: data.ifsc || null,
            pan_no: data.pan || null,
            pf_no: data.pf_no || null,
            esi_no: data.esi_no || null
          });
        } catch (error) {
          console.error('Error updating payslip bank details:', error);
          // Don't fail the main update if payslip update fails
        }
      }
      
      // Force refresh user data
      const updatedUser = await usersAPI.getById(user.id);
      updateUser(updatedUser.data);
      toast.success(`${detailType.replace(/_/g, ' ')} ${action === 'add' ? 'added' : action === 'edit' ? 'updated' : 'deleted'} successfully`);
      setShowModal(null);
      setEditingIndex(null);
      setDetailFormData({});
    } catch (error) {
      console.error('Error updating detail:', error); // Debug log
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to update details';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Validation functions
  const validateName = (name) => {
    if (!name || name.trim() === '') {
      toast.error('Name is required');
      return false;
    }
    // Check if name contains only letters and spaces
    const nameRegex = /^[A-Za-z\s]+$/;
    if (!nameRegex.test(name.trim())) {
      toast.error('Name must contain only letters and spaces');
      return false;
    }
    if (name.length > 40) {
      toast.error('Name must be 40 characters or less');
      return false;
    }
    return true;
  };

  const validateRelation = (relation) => {
    if (!relation || relation.trim() === '') {
      toast.error('Relation is required');
      return false;
    }
    // Check if relation contains only letters and spaces
    const relationRegex = /^[A-Za-z\s]+$/;
    if (!relationRegex.test(relation.trim())) {
      toast.error('Relation must contain only letters and spaces');
      return false;
    }
    if (relation.length > 40) {
      toast.error('Relation must be 40 characters or less');
      return false;
    }
    return true;
  };

  const validatePhone = (phone) => {
    if (!phone || phone.toString().trim() === '') {
      toast.error('Phone is required');
      return false;
    }
    const phoneStr = phone.toString().trim();
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phoneStr)) {
      toast.error('Phone must be exactly 10 digits');
      return false;
    }
    // Check if phone starts with 6, 7, 8, or 9
    const firstDigit = phoneStr.charAt(0);
    if (!['6', '7', '8', '9'].includes(firstDigit)) {
      toast.error('Phone number must start with 6, 7, 8, or 9');
      return false;
    }
    return true;
  };

  const validateAadhar = (aadhar) => {
    if (!aadhar || aadhar.trim() === '') {
      return true; // Optional field
    }
    const aadharRegex = /^\d{12}$/;
    if (!aadharRegex.test(aadhar)) {
      toast.error('Aadhar must be exactly 12 digits');
      return false;
    }
    return true;
  };

  const validateBankName = (bankName) => {
    if (!bankName || bankName.trim() === '') {
      toast.error('Bank Name is required');
      return false;
    }
    // Check if bank name contains only letters and spaces
    const bankNameRegex = /^[A-Za-z\s]+$/;
    if (!bankNameRegex.test(bankName.trim())) {
      toast.error('Bank Name must contain only letters and spaces');
      return false;
    }
    if (bankName.length > 40) {
      toast.error('Bank Name must be 40 characters or less');
      return false;
    }
    return true;
  };

  const validateAccountNumber = (accountNumber) => {
    if (!accountNumber || accountNumber.trim() === '') {
      toast.error('Account Number is required');
      return false;
    }
    const accountRegex = /^\d{1,21}$/;
    if (!accountRegex.test(accountNumber)) {
      toast.error('Account Number must be below 21 digits');
      return false;
    }
    return true;
  };

  const validateIFSC = (ifsc) => {
    if (!ifsc || ifsc.trim() === '') {
      toast.error('IFSC is required');
      return false;
    }
    const ifscRegex = /^[A-Z0-9]{11}$/;
    if (!ifscRegex.test(ifsc.toUpperCase())) {
      toast.error('IFSC must be 11 alphanumeric characters');
      return false;
    }
    return true;
  };

  const validatePAN = (pan) => {
    if (!pan || pan.trim() === '') {
      return true; // Optional field
    }
    const panRegex = /^[A-Z]{5}\d{4}[A-Z]{1}$/;
    if (!panRegex.test(pan.toUpperCase())) {
      toast.error('PAN must be 10 alphanumeric characters (5 capital letters, 4 digits, 1 character)');
      return false;
    }
    return true;
  };

  const validatePFNO = (pfNo) => {
    if (!pfNo || pfNo.trim() === '') {
      return true; // Optional field
    }
    const pfRegex = /^\d{12}$/;
    if (!pfRegex.test(pfNo)) {
      toast.error('PF NO must be exactly 12 digits');
      return false;
    }
    return true;
  };

  const validateESINO = (esiNo) => {
    if (!esiNo || esiNo.trim() === '') {
      return true; // Optional field
    }
    const esiRegex = /^\d{10}$/;
    if (!esiRegex.test(esiNo)) {
      toast.error('ESI NO must be exactly 10 digits');
      return false;
    }
    return true;
  };

  const validateCompany = (company) => {
    if (!company || company.trim() === '') {
      toast.error('Company is required');
      return false;
    }
    // Check if company contains only letters and spaces
    const companyRegex = /^[A-Za-z\s]+$/;
    if (!companyRegex.test(company.trim())) {
      toast.error('Company must contain only letters and spaces');
      return false;
    }
    if (company.length > 40) {
      toast.error('Company must be 40 characters or less');
      return false;
    }
    return true;
  };

  const validateEducationName = (educationName) => {
    if (!educationName || educationName.trim() === '') {
      toast.error('Education Name is required');
      return false;
    }
    // Check if education name contains only letters and spaces
    const educationRegex = /^[A-Za-z\s]+$/;
    if (!educationRegex.test(educationName.trim())) {
      toast.error('Education Name must contain only letters and spaces');
      return false;
    }
    if (educationName.length > 40) {
      toast.error('Education Name must be 40 characters or less');
      return false;
    }
    return true;
  };

  const validateDocumentName = (documentName) => {
    if (!documentName || documentName.trim() === '') {
      toast.error('Document Name is required');
      return false;
    }
    // Check if document name contains only letters and spaces
    const documentRegex = /^[A-Za-z\s]+$/;
    if (!documentRegex.test(documentName.trim())) {
      toast.error('Document Name must contain only letters and spaces');
      return false;
    }
    if (documentName.length > 40) {
      toast.error('Document Name must be 40 characters or less');
      return false;
    }
    return true;
  };

  const validatePercentage = (percentage) => {
    if (!percentage || percentage.toString().trim() === '') {
      return true; // Optional field
    }
    const percentageNum = parseFloat(percentage);
    if (isNaN(percentageNum)) {
      toast.error('Percentage must be a valid number');
      return false;
    }
    if (percentageNum < 0 || percentageNum > 100) {
      toast.error('Percentage must be between 0 and 100');
      return false;
    }
    return true;
  };

  const validateYear = (year) => {
    if (!year || year.trim() === '') {
      return true; // Optional field
    }
    const yearRegex = /^\d{4}$/;
    if (!yearRegex.test(year)) {
      toast.error('Year must be exactly 4 digits');
      return false;
    }
    return true;
  };

  const validateDesignation = (designation) => {
    if (!designation || designation.trim() === '') {
      return true; // Optional field
    }
    if (designation.length > 50) {
      toast.error('Designation must be below 50 characters');
      return false;
    }
    return true;
  };

  const validateSalary = (salary) => {
    if (!salary || salary.toString().trim() === '') {
      return true; // Optional field
    }
    const salaryNum = parseFloat(salary);
    if (isNaN(salaryNum)) {
      toast.error('Salary must be a valid number');
      return false;
    }
    if (salaryNum < 50000) {
      toast.error('Salary must be at least ₹50,000');
      return false;
    }
    if (salaryNum > 250000000) {
      toast.error('Salary must be at most ₹25 crore');
      return false;
    }
    return true;
  };

  const validateEmail = (email) => {
    if (!email || email.trim() === '') {
      toast.error('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const validatePhoneNumber = (phone) => {
    if (!phone || phone.trim() === '') {
      toast.error('Phone is required');
      return false;
    }
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      toast.error('Phone must be exactly 10 digits');
      return false;
    }
    return true;
  };

  // Handle detail delete
  const handleDetailDelete = async (detailType, index) => {
    setLoading(true);
    try {
      const indexValue = parseInt(index);
      console.log('Deleting detail:', { detailType, index: indexValue }); // Debug log
      
      await usersAPI.updateDetail(user.id, detailType, {
        action: 'delete',
        index: indexValue
      });
      // Force refresh user data
      const updatedUser = await usersAPI.getById(user.id);
      updateUser(updatedUser.data);
      toast.success('Item deleted successfully');
    } catch (error) {
      console.error('Error deleting detail:', error); // Debug log
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to delete item';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Open modal for add/edit
  const openModal = (type, index = null) => {
    setShowModal(type);
    setEditingIndex(index);
    
    if (index !== null) {
      // Edit mode - populate form with existing data
      if (type === 'bank_details') {
        const existingData = user?.bank_details || {};
        setDetailFormData({
          ...existingData,
          pf_no: existingData.pf_no || '',
          esi_no: existingData.esi_no || ''
        });
      } else if (type === 'nominee_details') {
        setDetailFormData(user?.nominee_details ? {...user.nominee_details} : {});
      } else if (type === 'family_details') {
        const familyData = user?.family_details;
        if (Array.isArray(familyData) && familyData[index]) {
          setDetailFormData({...familyData[index]});
        } else {
          setDetailFormData({});
        }
      } else if (type === 'education_details') {
        const eduData = user?.education_details;
        if (Array.isArray(eduData) && eduData[index]) {
          setDetailFormData({...eduData[index]});
        } else {
          setDetailFormData({});
        }
      } else if (type === 'experience_details') {
        const expData = user?.experience_details;
        if (Array.isArray(expData) && expData[index]) {
          setDetailFormData({...expData[index]});
        } else {
          setDetailFormData({});
        }
      } else if (type === 'documents') {
        const docData = user?.documents;
        if (Array.isArray(docData) && docData[index]) {
          setDetailFormData({...docData[index]});
        } else {
          setDetailFormData({});
        }
      }
    } else {
      // Add mode - reset form
      setDetailFormData({});
    }
  };

  // Handle document image upload
  const handleDocumentImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type - only jpg, png, jpeg
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        toast.error('Please select a JPG, PNG, or JPEG image file only');
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setDetailFormData({ ...detailFormData, image: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle document download
  const handleDocumentDownload = (doc, index) => {
    if (!doc.image) {
      toast.error('No image available for download');
      return;
    }

    try {
      // Convert base64 to blob
      const base64Data = doc.image.split(',')[1] || doc.image;
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = doc.name || `document-${index + 1}`;
      link.download = `${fileName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Document downloaded successfully');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download document');
    }
  };

  return (
    <div className="profile-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">PROFILE</h1>
          <p className="page-subtitle">Manage your personal information</p>
        </div>
      </div>

      <div className="profile-layout">
        {/* Profile Card */}
        <div className="card profile-card">
          <div className="profile-header">
            <div className="profile-avatar">
              {formData.image_base64 ? (
                <img src={formData.image_base64} alt={user?.name} />
              ) : (
                <span>{user?.name?.charAt(0).toUpperCase()}</span>
              )}
              {editing && (
                <label className="avatar-upload">
                  <input type="file" accept="image/jpeg,image/jpg,image/png" onChange={handleImageChange} />
                  <FiEdit2 />
                </label>
              )}
            </div>
            <div className="profile-info">
              <h2>{user?.name}</h2>
              <span className="badge badge-primary">{user?.role}</span>
              <p className="profile-empid">{user?.empid}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="profile-details">
              <div className="form-group">
                <label className="form-label"><FiUser /> Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Only allow letters and spaces
                    if (value === '' || /^[A-Za-z\s]+$/.test(value)) {
                      setFormData({ ...formData, name: value });
                    }
                  }}
                  disabled={!editing}
                  maxLength={40}
                />
              </div>

              <div className="form-group">
                <label className="form-label"><FiMail /> Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!editing}
                />
              </div>

              <div className="form-group">
                <label className="form-label"><FiPhone /> Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setFormData({ ...formData, phone: value });
                  }}
                  disabled={!editing}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Company</label>
                <input
                  type="text"
                  className="form-input"
                  value={user?.company_name || 'Pending'}
                  disabled={true}
                  readOnly
                  style={{ 
                    cursor: 'not-allowed',
                    opacity: 0.8,
                    backgroundColor: 'var(--bg-hover)'
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Branch</label>
                <input
                  type="text"
                  className="form-input"
                  value={user?.branch_name || 'Pending'}
                  disabled={true}
                  readOnly
                  style={{ 
                    cursor: 'not-allowed',
                    opacity: 0.8,
                    backgroundColor: 'var(--bg-hover)'
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notification Preferences</label>
                <div className="consent-toggles-horizontal">
                  <div className="toggle-column">
                    <span className="toggle-title">Email</span>
                    <label className={`toggle-switch ${!editing ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={formData.email_consent}
                        onChange={(e) => setFormData({ ...formData, email_consent: e.target.checked })}
                        disabled={!editing}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className={`toggle-status ${formData.email_consent ? 'yes' : 'no'}`}>
                      {formData.email_consent ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="toggle-column">
                    <span className="toggle-title">WhatsApp</span>
                    <label className={`toggle-switch ${!editing ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={formData.whatsapp_consent}
                        onChange={(e) => setFormData({ ...formData, whatsapp_consent: e.target.checked })}
                        disabled={!editing}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className={`toggle-status ${formData.whatsapp_consent ? 'yes' : 'no'}`}>
                      {formData.whatsapp_consent ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="toggle-column">
                    <span className="toggle-title">SMS</span>
                    <label className={`toggle-switch ${!editing ? 'disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={formData.sms_consent}
                        onChange={(e) => setFormData({ ...formData, sms_consent: e.target.checked })}
                        disabled={!editing}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className={`toggle-status ${formData.sms_consent ? 'yes' : 'no'}`}>
                      {formData.sms_consent ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="profile-actions">
              {editing ? (
                <>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      // Reset form data to original user values
                      setFormData({
                        name: user?.name || '',
                        email: user?.email || '',
                        phone: user?.phone || '',
                        sms_consent: user?.sms_consent || false,
                        whatsapp_consent: user?.whatsapp_consent || false,
                        email_consent: user?.email_consent || false,
                        image_base64: user?.image_base64 || '',
                        dob: user?.dob || ''
                      });
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    <FiSave /> Save Changes
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
                  <FiEdit2 /> Edit Profile
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Security Card */}
        <div className="card security-card">
          <div className="card-header">
            <h3 className="card-title"><FiLock /> Security</h3>
          </div>

          {changingPassword ? (
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label className="form-label">Old Password</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      className="form-input"
                      style={{ paddingRight: '40px', width: '100%' }}
                      value={passwordData.old_password}
                      onChange={(e) => {
                        setPasswordData({ ...passwordData, old_password: e.target.value });
                        setOldPasswordVerified(false);
                      }}
                      placeholder="Enter old password"
                      disabled={oldPasswordVerified}
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        zIndex: 1
                      }}
                    >
                      {showOldPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                  {!oldPasswordVerified && (
                    <button
                      type="button"
                      onClick={verifyOldPassword}
                      className="btn btn-secondary"
                      disabled={verifyingOldPassword || !passwordData.old_password}
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      {verifyingOldPassword ? 'Verifying...' : 'Verify'}
                    </button>
                  )}
                </div>
                {!oldPasswordVerified && (
                  <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Once Verify Your Old password then Update new password
                  </div>
                )}
                {oldPasswordVerified && (
                  <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FiCheck size={14} />
                    <span>Old password verified</span>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                <input
                    type={showNewPassword ? 'text' : 'password'}
                  className="form-input"
                    style={{ paddingRight: '40px' }}
                  value={passwordData.new_password}
                    onChange={(e) => {
                      const newPassword = e.target.value;
                      setPasswordData({ ...passwordData, new_password: newPassword });
                      setPasswordStrength(calculatePasswordStrength(newPassword));
                    }}
                    placeholder="6-12 characters, include A-Z, a-z, 0-9, and . @ #"
                    disabled={!oldPasswordVerified}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px'
                    }}
                  >
                    {showNewPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
                {passwordData.new_password && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ 
                      flex: 1,
                      height: '24px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <div style={{
                        width: `${getPasswordStrengthInfo(passwordStrength).percentage}%`,
                        height: '100%',
                        backgroundColor: getPasswordStrengthInfo(passwordStrength).color,
                        transition: 'all 0.3s ease',
                        borderRadius: '4px',
                        position: 'absolute',
                        left: 0,
                        top: 0
                      }} />
                      <span style={{
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: passwordStrength ? '#ffffff' : 'var(--text-secondary)',
                        zIndex: 1,
                        textShadow: passwordStrength ? '0 1px 2px rgba(0,0,0,0.2)' : 'none'
                      }}>
                        {getPasswordStrengthInfo(passwordStrength).label || 'Enter password'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                <input
                    type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input"
                    style={{ paddingRight: '40px' }}
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                    placeholder="Re-enter new password"
                    disabled={!oldPasswordVerified}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px'
                    }}
                  >
                    {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
                {passwordData.confirm_password && passwordData.new_password !== passwordData.confirm_password && (
                  <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FiAlertCircle size={14} />
                    <span>Passwords do not match</span>
                  </div>
                )}
                {passwordData.confirm_password && passwordData.new_password === passwordData.confirm_password && passwordData.new_password && (
                  <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FiCheck size={14} />
                    <span>Passwords match</span>
                  </div>
                )}
              </div>
              <div className="profile-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setChangingPassword(false);
                    setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
                    setPasswordStrength('');
                    setOldPasswordVerified(false);
                    setShowOldPassword(false);
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading || !oldPasswordVerified}>
                  Change Password
                </button>
              </div>
            </form>
          ) : (
            <div className="security-info">
              <p>Keep your account secure by using a strong password.</p>
              <button className="btn btn-secondary" onClick={() => setChangingPassword(true)}>
                <FiLock /> Change Password
              </button>
            </div>
          )}
        </div>

        {/* Account Info */}
        <div className="card account-card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 className="card-title">Account Information</h3>
              {user?.is_active && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ 
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#22c55e'
                  }}></span>
                  <span style={{ 
                    color: '#22c55e',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}>Active</span>
                </div>
              )}
            </div>
          </div>
          <div className="account-info-table">
            <table className="info-table">
              <tbody>
                <tr>
                  <td className="info-label">Username</td>
                  <td className="info-value">{user?.username}</td>
                </tr>
                <tr>
                  <td className="info-label">Employee ID</td>
                  <td className="info-value">{user?.empid}</td>
                </tr>
                <tr>
                  <td className="info-label">Role</td>
                  <td className="info-value">
                    <span className="badge badge-info">{user?.role}</span>
                  </td>
                </tr>
                <tr>
                  <td className="info-label">Designation</td>
                  <td className="info-value">
                    {user?.designation && user.designation.trim() ? user.designation : 'Pending'}
                  </td>
                </tr>
                <tr>
                  <td className="info-label">Date Of Birth</td>
                  <td className="info-value">
                    {editing ? (
                      <DatePicker
                        value={formData.dob}
                        onChange={(date) => {
                          // Validate that selected date is not in the future
                          if (date) {
                            const selectedDate = new Date(date);
                            const today = new Date();
                            today.setHours(23, 59, 59, 999); // Set to end of today
                            if (selectedDate > today) {
                              toast.error('Date of birth cannot be in the future');
                              return;
                            }
                          }
                          setFormData({ ...formData, dob: date || null });
                        }}
                        placeholder="Select date of birth"
                        max={getTodayDateString()}
                      />
                    ) : (
                      user?.dob ? new Date(user.dob).toLocaleDateString() : 'Pending'
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="info-label">Date of Join</td>
                  <td className="info-value">
                    {user?.doj ? new Date(user.doj).toLocaleDateString() : 'Pending'}
                  </td>
                </tr>
                <tr>
                  <td className="info-label">Salary Per Annum</td>
                  <td className="info-value">
                    {user?.salary_per_annum && user.salary_per_annum > 0 ? (
                      <span
                        onClick={() => setShowSalary(!showSalary)}
                        style={{
                          cursor: 'pointer',
                          userSelect: 'none',
                          display: 'inline-block',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          transition: 'background-color 0.2s',
                          fontWeight: showSalary ? 'normal' : '600',
                          letterSpacing: showSalary ? 'normal' : '2px'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = 'var(--bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = 'transparent';
                        }}
                        title={showSalary ? 'Click to hide' : 'Click to reveal'}
                      >
                        {showSalary 
                          ? `₹${parseFloat(user.salary_per_annum).toLocaleString('en-IN')}` 
                          : '****'}
                      </span>
                    ) : (
                      'Pending'
                    )}
                  </td>
                </tr>
                {user?.role !== 'Admin' && (
                  <tr>
                    <td className="info-label">Report To</td>
                    <td className="info-value">
                      {loadingReportTo ? (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading...</span>
                      ) : reportToUser ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {reportToUser.image_base64 ? (
                            <img 
                              src={reportToUser.image_base64} 
                              alt={reportToUser.name}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1px solid var(--border-color)'
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '0.875rem',
                              fontWeight: 600
                            }}>
                              {reportToUser.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                          <span>{reportToUser.name || 'Unknown'}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Not Assigned</span>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Additional Details Section */}
      <div className="profile-details-section">
        <h2 className="section-title">Additional Details</h2>
        
        {/* Row 1: Family Details, Nominee Details */}
        <div className="details-row">
          {/* Family Details */}
          <div className="detail-card">
            <div className="detail-card-header">
              <h3 className="detail-card-title">FAMILY DETAILS</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`detail-status ${user?.family_details && user.family_details.length > 0 ? 'completed' : 'pending'}`}>
                  {user?.family_details && user.family_details.length > 0 ? 'Completed' : 'Pending'}
                </span>
                <button className="detail-action-btn" onClick={() => openModal('family_details')}>
                  <FiPlus />
                </button>
              </div>
            </div>
            <div className="detail-card-body">
              {user?.family_details && Array.isArray(user.family_details) && user.family_details.length > 0 ? (
                <table className="detail-members-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Relation</th>
                      <th>Phone</th>
                      <th>Aadhar</th>
                      <th className="action-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.family_details.map((member, index) => (
                      <tr key={`family-${index}`}>
                        <td>{member?.name || '-'}</td>
                        <td>{member?.relation || '-'}</td>
                        <td>{member?.phone || '-'}</td>
                        <td>{member?.aadhar || '-'}</td>
                        <td className="action-cell">
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button 
                              className="detail-edit-btn" 
                              onClick={() => {
                                console.log('Editing family member at index:', index);
                                openModal('family_details', index);
                              }}
                              title="Edit"
                            >
                              <FiEdit2 />
                            </button>
                            <button 
                              className="detail-delete-btn" 
                              onClick={() => {
                                console.log('Deleting family member at index:', index);
                                handleDetailDelete('family_details', index);
                              }}
                              title="Delete"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="detail-pending">Pending</div>
              )}
            </div>
          </div>

          {/* Nominee Details */}
          <div className="detail-card">
            <div className="detail-card-header">
              <h3 className="detail-card-title">NOMINEE DETAILS</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`detail-status ${user?.nominee_details ? 'completed' : 'pending'}`}>
                  {user?.nominee_details ? 'Completed' : 'Pending'}
                </span>
                <button className="detail-action-btn" onClick={() => openModal('nominee_details', user?.nominee_details ? 0 : null)}>
                  {user?.nominee_details ? <FiEdit2 /> : <FiPlus />}
                </button>
              </div>
            </div>
            <div className="detail-card-body">
              {user?.nominee_details ? (
                <table className="detail-members-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Relation</th>
                      <th>Phone</th>
                      <th>Aadhar</th>
                      <th className="action-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{user.nominee_details?.name || '-'}</td>
                      <td>{user.nominee_details?.relation || '-'}</td>
                      <td>{user.nominee_details?.phone || '-'}</td>
                      <td>{user.nominee_details?.aadhar || '-'}</td>
                      <td className="action-cell">
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            className="detail-edit-btn" 
                            onClick={() => openModal('nominee_details', 0)}
                            title="Edit"
                          >
                            <FiEdit2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="detail-pending">Pending</div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Bank Details, Education Details */}
        <div className="details-row">
          {/* Bank Details */}
          <div className="detail-card">
            <div className="detail-card-header">
              <h3 className="detail-card-title">BANK DETAILS</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`detail-status ${user?.bank_details ? 'completed' : 'pending'}`}>
                  {user?.bank_details ? 'Completed' : 'Pending'}
                </span>
                <button className="detail-action-btn" onClick={() => openModal('bank_details', user?.bank_details ? 0 : null)}>
                  {user?.bank_details ? <FiEdit2 /> : <FiPlus />}
                </button>
              </div>
            </div>
            <div className="detail-card-body">
              {user?.bank_details ? (
                <table className="detail-members-table">
                  <thead>
                    <tr>
                      <th>Bank</th>
                      <th>Acc No</th>
                      <th>IFSC</th>
                      <th>PAN</th>
                      <th>Aadhar</th>
                      <th>PF NO</th>
                      <th>ESI NO</th>
                      <th className="action-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{user.bank_details?.bank_name || '-'}</td>
                      <td>{user.bank_details?.account_number || '-'}</td>
                      <td>{user.bank_details?.ifsc || '-'}</td>
                      <td>{user.bank_details?.pan || '-'}</td>
                      <td>{user.bank_details?.aadhar || '-'}</td>
                      <td>{user.bank_details?.pf_no || 'N/A'}</td>
                      <td>{user.bank_details?.esi_no || 'N/A'}</td>
                      <td className="action-cell">
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button 
                            className="detail-edit-btn" 
                            onClick={() => openModal('bank_details', 0)}
                            title="Edit"
                          >
                            <FiEdit2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="detail-pending">Pending</div>
              )}
            </div>
          </div>

          {/* Education Details */}
          <div className="detail-card">
            <div className="detail-card-header">
              <h3 className="detail-card-title">EDUCATION DETAILS</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`detail-status ${user?.education_details && user.education_details.length > 0 ? 'completed' : 'pending'}`}>
                  {user?.education_details && user.education_details.length > 0 ? 'Completed' : 'Pending'}
                </span>
                <button className="detail-action-btn" onClick={() => openModal('education_details')}>
                  <FiPlus />
                </button>
              </div>
            </div>
            <div className="detail-card-body">
              {user?.education_details && Array.isArray(user.education_details) && user.education_details.length > 0 ? (
                <table className="detail-members-table">
                  <thead>
                    <tr>
                      <th>Education</th>
                      <th>Pass Out Year</th>
                      <th>Percentage</th>
                      <th className="action-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.education_details.map((edu, index) => (
                      <tr key={index}>
                        <td>{edu.education_name || '-'}</td>
                        <td>{edu.pass_out_year || '-'}</td>
                        <td>{edu.percentage ? `${edu.percentage}%` : '-'}</td>
                        <td className="action-cell">
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button className="detail-edit-btn" onClick={() => openModal('education_details', index)}>
                              <FiEdit2 />
                            </button>
                            <button className="detail-delete-btn" onClick={() => handleDetailDelete('education_details', index)}>
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="detail-pending">Pending</div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Experience Details, Documents */}
        <div className="details-row">
          {/* Experience Details */}
          <div className="detail-card">
            <div className="detail-card-header">
              <h3 className="detail-card-title">Experience Details</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`detail-status ${user?.experience_details && user.experience_details.length > 0 ? 'completed' : 'pending'}`}>
                  {user?.experience_details && user.experience_details.length > 0 ? 'Completed' : 'Pending'}
                </span>
                <button className="detail-action-btn" onClick={() => openModal('experience_details')}>
                  <FiPlus />
                </button>
              </div>
            </div>
            <div className="detail-card-body">
              {user?.experience_details && Array.isArray(user.experience_details) && user.experience_details.length > 0 ? (
                <table className="detail-members-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Year</th>
                      <th>Designation</th>
                      <th>Salary (PA)</th>
                      <th className="action-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.experience_details.map((exp, index) => (
                      <tr key={index}>
                        <td>{exp.prev_company_name || '-'}</td>
                        <td>{exp.year || '-'}</td>
                        <td>{exp.designation || '-'}</td>
                        <td>{exp.salary_per_annum ? `₹${exp.salary_per_annum}` : '-'}</td>
                        <td className="action-cell">
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button className="detail-edit-btn" onClick={() => openModal('experience_details', index)}>
                              <FiEdit2 />
                            </button>
                            <button className="detail-delete-btn" onClick={() => handleDetailDelete('experience_details', index)}>
                              <FiTrash2 />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="detail-pending">Pending</div>
              )}
            </div>
          </div>

        </div>

        {/* Documents Section - Full Width */}
        <div className="documents-section">
          <div className="detail-card documents-card">
            <div className="detail-card-header">
              <h3 className="detail-card-title">Documents</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className={`detail-status ${user?.documents && user.documents.length > 0 ? 'completed' : 'pending'}`}>
                  {user?.documents && user.documents.length > 0 ? 'Completed' : 'Pending'}
                </span>
                <button className="detail-action-btn" onClick={() => openModal('documents')}>
                  <FiPlus />
                </button>
              </div>
            </div>
            <div className="detail-card-body">
              {user?.documents && Array.isArray(user.documents) && user.documents.length > 0 ? (
                <div className="detail-items documents-grid">
                  {user.documents.map((doc, index) => (
                    <div key={`doc-${index}`} className="document-item">
                      {doc?.image && (
                        <img src={doc.image} alt={doc?.name || 'Document'} className="document-image" />
                      )}
                      <div className="document-name">{doc?.name || 'Document'}</div>
                      <div className="document-actions">
                        <button className="detail-download-btn" onClick={() => handleDocumentDownload(doc, index)} title="Download">
                          <FiDownload />
                        </button>
                        <button 
                          className="detail-edit-btn" 
                          onClick={() => {
                            console.log('Editing document at index:', index);
                            openModal('documents', index);
                          }} 
                          title="Edit"
                        >
                          <FiEdit2 />
                        </button>
                        <button 
                          className="detail-delete-btn" 
                          onClick={() => {
                            console.log('Deleting document at index:', index);
                            handleDetailDelete('documents', index);
                          }} 
                          title="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="detail-pending">Pending</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modals - close only via close icon or Cancel, not overlay */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content detail-modal">
            <div className="modal-header">
              <h3>
                {editingIndex !== null ? 'Edit' : 'Add'} {
                  showModal === 'bank_details' ? 'Bank Details' :
                  showModal === 'nominee_details' ? 'Nominee Details' :
                  showModal === 'family_details' ? 'Family Member' :
                  showModal === 'education_details' ? 'Education' :
                  showModal === 'experience_details' ? 'Experience' :
                  'Document'
                }
              </h3>
              <button className="modal-close" onClick={() => { setShowModal(null); setEditingIndex(null); setDetailFormData({}); }}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={(e) => {
                e.preventDefault();
                const action = editingIndex !== null ? 'edit' : 'add';
                handleDetailUpdate(showModal, detailFormData, action, editingIndex);
              }}>
                {showModal === 'bank_details' && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Bank Name *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.bank_name || ''} 
                          onChange={(e) => {
                            const value = e.target.value;
                            // Only allow letters and spaces
                            if (value === '' || /^[A-Za-z\s]+$/.test(value)) {
                              setDetailFormData({...detailFormData, bank_name: value});
                            }
                          }}
                          maxLength={40}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Account Number *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.account_number || ''} 
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 21);
                            setDetailFormData({...detailFormData, account_number: value});
                          }}
                          required
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>IFSC *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.ifsc || ''} 
                          onChange={(e) => {
                            const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
                            setDetailFormData({...detailFormData, ifsc: value});
                          }}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>PAN</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.pan || ''} 
                          onChange={(e) => {
                            const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                            setDetailFormData({...detailFormData, pan: value});
                          }}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Aadhar</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.aadhar || ''} 
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                            setDetailFormData({...detailFormData, aadhar: value});
                          }}
                        />
                      </div>
                      <div className="form-group">
                        <label>PF NO</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.pf_no || ''} 
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                            setDetailFormData({...detailFormData, pf_no: value});
                          }}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>ESI NO</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={detailFormData.esi_no || ''} 
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setDetailFormData({...detailFormData, esi_no: value});
                        }}
                      />
                    </div>
                  </>
                )}

                {showModal === 'nominee_details' && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Name *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.name || ''} 
                          onChange={(e) => {
                            const value = e.target.value;
                            // Only allow letters and spaces
                            if (value === '' || /^[A-Za-z\s]+$/.test(value)) {
                              setDetailFormData({...detailFormData, name: value});
                            }
                          }}
                          maxLength={40}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Relation *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.relation || ''} 
                          onChange={(e) => {
                            const value = e.target.value;
                            // Only allow letters and spaces
                            if (value === '' || /^[A-Za-z\s]+$/.test(value)) {
                              setDetailFormData({...detailFormData, relation: value});
                            }
                          }}
                          maxLength={40}
                          required
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Phone *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.phone || ''} 
                          onChange={(e) => {
                            let value = e.target.value.replace(/\D/g, '').slice(0, 10);
                            // If first digit is entered, ensure it's 6, 7, 8, or 9
                            if (value.length > 0) {
                              const firstDigit = value.charAt(0);
                              if (!['6', '7', '8', '9'].includes(firstDigit)) {
                                // Remove invalid first digit
                                value = value.slice(1);
                              }
                            }
                            setDetailFormData({...detailFormData, phone: value});
                          }}
                          placeholder="Must start with 6, 7, 8, or 9"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Aadhar</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.aadhar || ''} 
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                            setDetailFormData({...detailFormData, aadhar: value});
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {showModal === 'family_details' && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Name *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.name || ''} 
                          onChange={(e) => {
                            const value = e.target.value;
                            // Only allow letters and spaces
                            if (value === '' || /^[A-Za-z\s]+$/.test(value)) {
                              setDetailFormData({...detailFormData, name: value});
                            }
                          }}
                          maxLength={40}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Relation *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.relation || ''} 
                          onChange={(e) => {
                            const value = e.target.value;
                            // Only allow letters and spaces
                            if (value === '' || /^[A-Za-z\s]+$/.test(value)) {
                              setDetailFormData({...detailFormData, relation: value});
                            }
                          }}
                          maxLength={40}
                          required
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Phone</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.phone || ''} 
                          onChange={(e) => {
                            let value = e.target.value.replace(/\D/g, '').slice(0, 10);
                            // If first digit is entered, ensure it's 6, 7, 8, or 9
                            if (value.length > 0) {
                              const firstDigit = value.charAt(0);
                              if (!['6', '7', '8', '9'].includes(firstDigit)) {
                                // Remove invalid first digit
                                value = value.slice(1);
                              }
                            }
                            setDetailFormData({...detailFormData, phone: value});
                          }}
                          placeholder="Must start with 6, 7, 8, or 9"
                        />
                      </div>
                      <div className="form-group">
                        <label>Aadhar</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.aadhar || ''} 
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 12);
                            setDetailFormData({...detailFormData, aadhar: value});
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {showModal === 'education_details' && (
                  <>
                    <div className="form-group">
                      <label>Education Name *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={detailFormData.education_name || ''} 
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value.length <= 25) {
                            setDetailFormData({...detailFormData, education_name: value});
                          }
                        }}
                        maxLength={25}
                        placeholder="Enter education name (max 25 characters)"
                        required
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Pass Out Year</label>
                        <input 
                          type="number" 
                          className="form-input" 
                          value={detailFormData.pass_out_year || ''} 
                          onChange={(e) => {
                            const year = parseInt(e.target.value);
                            const currentYear = new Date().getFullYear();
                            if (!e.target.value || (year && year <= currentYear)) {
                              setDetailFormData({...detailFormData, pass_out_year: e.target.value});
                            }
                          }}
                          max={new Date().getFullYear()}
                          placeholder="Past years only"
                        />
                      </div>
                      <div className="form-group">
                        <label>Percentage</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          className="form-input" 
                          value={detailFormData.percentage || ''} 
                          onChange={(e) => {
                            const value = parseFloat(e.target.value);
                            if (!e.target.value || (!isNaN(value) && value >= 0 && value <= 100)) {
                              setDetailFormData({...detailFormData, percentage: e.target.value});
                            }
                          }}
                          min="0"
                          max="100"
                          placeholder="0 to 100"
                        />
                      </div>
                    </div>
                  </>
                )}

                {showModal === 'experience_details' && (
                  <>
                    <div className="form-group">
                      <label>Company *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={detailFormData.prev_company_name || ''} 
                        onChange={(e) => {
                          const value = e.target.value;
                          // Only allow letters and spaces
                          if (value === '' || /^[A-Za-z\s]+$/.test(value)) {
                            setDetailFormData({...detailFormData, prev_company_name: value});
                          }
                        }}
                        maxLength={40}
                        required
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Year</label>
                        <input 
                          type="number" 
                          className="form-input" 
                          value={detailFormData.year || ''} 
                          onChange={(e) => {
                            const year = parseInt(e.target.value);
                            const currentYear = new Date().getFullYear();
                            if (!e.target.value || (year && year <= currentYear)) {
                              setDetailFormData({...detailFormData, year: e.target.value});
                            }
                          }}
                          max={new Date().getFullYear()}
                          placeholder="Past years only"
                        />
                      </div>
                      <div className="form-group">
                        <label>Designation</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={detailFormData.designation || ''} 
                          onChange={(e) => setDetailFormData({...detailFormData, designation: e.target.value})}
                          maxLength={50}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Salary (PA)</label>
                      <input 
                        type="number" 
                        step="1" 
                        className="form-input" 
                        value={detailFormData.salary_per_annum || ''} 
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setDetailFormData({...detailFormData, salary_per_annum: value});
                        }}
                        min="50000"
                        max="250000000"
                      />
                    </div>
                  </>
                )}

                {showModal === 'documents' && (
                  <>
                    <div className="form-group">
                      <label>Document Name *</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={detailFormData.name || ''} 
                        onChange={(e) => {
                          const value = e.target.value;
                          // Only allow letters and spaces
                          if (value === '' || /^[A-Za-z\s]+$/.test(value)) {
                            setDetailFormData({...detailFormData, name: value});
                          }
                        }}
                        maxLength={40}
                      />
                    </div>
                    <div className="form-group">
                      <label>Document Image</label>
                      <input type="file" accept="image/jpeg,image/jpg,image/png" className="form-input" onChange={handleDocumentImageChange} />
                      {detailFormData.image && (
                        <img src={detailFormData.image} alt="Preview" style={{ marginTop: '8px', maxWidth: '200px', borderRadius: '8px' }} />
                      )}
                    </div>
                  </>
                )}

                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(null); setEditingIndex(null); setDetailFormData({}); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : editingIndex !== null ? 'Update' : 'Add'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;





