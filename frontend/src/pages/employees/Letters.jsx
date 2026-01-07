import { useState, useEffect, useRef } from 'react';
import { FiFileText, FiMail, FiTrendingUp, FiSend, FiSearch, FiX, FiImage, FiAward } from 'react-icons/fi';
import api, { usersAPI } from '../../services/api';
import toast from 'react-hot-toast';
import DatePicker from '../../components/DatePicker';
import './Letters.css';

const Letters = () => {
  const [activeTab, setActiveTab] = useState('offer');
  
  const [offerLetterData, setOfferLetterData] = useState({
    companyName: '',
    companyAddress: '',
    phone: '',
    email: '',
    date: '',
    employeeName: '',
    designation: '',
    location: '',
    dateOfJoining: '',
    ctc: ''
  });

  const [appointmentLetterData, setAppointmentLetterData] = useState({
    companyName: '',
    companyAddress: '',
    date: '',
    employeeName: '',
    designation: '',
    effectiveDate: '',
    employmentType: 'Permanent',
    ctc: '',
    placeOfPosting: '',
    noticePeriod: ''
  });

  const [hikeLetterData, setHikeLetterData] = useState({
    companyName: '',
    companyAddress: '',
    phone: '',
    email: '',
    date: '',
    employeeName: '',
    employeeId: '',
    oldCTC: '',
    newCTC: '',
    effectiveDate: '',
    designation: ''
  });

  const [promotionLetterData, setPromotionLetterData] = useState({
    companyName: '',
    companyAddress: '',
    phone: '',
    email: '',
    date: '',
    employeeName: '',
    employeeId: '',
    oldDesignation: '',
    newDesignation: '',
    effectiveDate: '',
    ctc: ''
  });

  const [offerLetterEmail, setOfferLetterEmail] = useState('');
  const [appointmentLetterEmail, setAppointmentLetterEmail] = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);
  const [sendingAppointment, setSendingAppointment] = useState(false);
  const [appointmentImages, setAppointmentImages] = useState([]);
  const appointmentImageInputRef = useRef(null);
  
  // Employee search for hike letter
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const employeeDropdownRef = useRef(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (employeeDropdownRef.current && !employeeDropdownRef.current.contains(event.target)) {
        setShowEmployeeDropdown(false);
      }
    };
    if (showEmployeeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmployeeDropdown]);

  const fetchEmployees = async () => {
    try {
      const response = await usersAPI.getEmployees();
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    if (!employeeSearch) return true;
    const search = employeeSearch.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(search) ||
      emp.empid?.toLowerCase().includes(search) ||
      emp.email?.toLowerCase().includes(search)
    );
  });

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
    setEmployeeSearch(`${employee.empid} - ${employee.name}`);
    setShowEmployeeDropdown(false);
    setHikeLetterData(prev => ({
      ...prev,
      employeeName: employee.name || '',
      employeeId: employee.empid || '',
      email: employee.email || '',
      phone: employee.phone || '',
      designation: employee.designation || ''
    }));
    setPromotionLetterData(prev => ({
      ...prev,
      employeeName: employee.name || '',
      employeeId: employee.empid || '',
      email: employee.email || '',
      phone: employee.phone || '',
      oldDesignation: employee.designation || ''
    }));
  };

  const handleOfferLetterChange = (field, value) => {
    setOfferLetterData(prev => ({ ...prev, [field]: value }));
  };

  const handleAppointmentLetterChange = (field, value) => {
    setAppointmentLetterData(prev => ({ ...prev, [field]: value }));
  };

  const handleHikeLetterChange = (field, value) => {
    setHikeLetterData(prev => ({ ...prev, [field]: value }));
  };

  const handlePromotionLetterChange = (field, value) => {
    setPromotionLetterData(prev => ({ ...prev, [field]: value }));
  };

  const formatOfferLetter = () => {
    const { companyName, companyAddress, phone, email, date, employeeName, designation, location, dateOfJoining, ctc } = offerLetterData;
    
    return `OFFER LETTER – FORMAT (Simple & Professional)

${companyName || 'Company Name'}
${companyAddress || 'Company Address'}
${phone ? `Phone: ${phone}` : ''}${phone && email ? ' | ' : ''}${email ? `Email: ${email}` : ''}

Date: ${date || '___ / ___ / _____'}

To,
Mr./Ms. ${employeeName || '____________________'}

Subject: Offer of Employment

Dear Mr./Ms. ${employeeName || '__________'},

We are pleased to offer you employment with ${companyName || 'Company Name'} for the position of ${designation || '__________'}, based at ${location || '__________'} location.

Your employment terms are as follows:

Designation: ${designation || '__________'}

Department: __________

Date of Joining: ${dateOfJoining || '__________'}

CTC: ₹ ${ctc || '__________'} per annum

Working Hours: As per company policy

This offer is subject to:

Submission of required documents

Background verification

Medical fitness (if applicable)

You are requested to sign and return a copy of this letter as a token of acceptance.

We welcome you to our organization and look forward to a mutually beneficial association.

Warm regards,

For ${companyName || 'Company Name'}
BTL`;
  };

  const formatAppointmentLetter = () => {
    const { companyName, companyAddress, date, employeeName, designation, effectiveDate, employmentType, ctc, placeOfPosting, noticePeriod } = appointmentLetterData;
    
    return `APPOINTMENT LETTER – FORMAT (Permanent Employee)

${companyName || 'Company Name'}
${companyAddress || 'Company Address'}

Date: ${date || '___ / ___ / _____'}

To,
Mr./Ms. ${employeeName || '____________________'}

Subject: Appointment Letter

Dear Mr./Ms. ${employeeName || '__________'},

With reference to your acceptance of our offer letter, we are pleased to appoint you as ${designation || '__________'} with effect from ${effectiveDate || '__________'}.

Your terms of appointment are as under:

Employment Type: ${employmentType || 'Permanent'}

CTC: ₹ ${ctc || '__________'} per annum

Place of Posting: ${placeOfPosting || '__________'}

Working Hours: As per company rules

Leave & Benefits: As per company policy

Termination: Either party may terminate with ${noticePeriod || '___'} days' notice

You shall abide by all rules, regulations, and policies of the company as amended from time to time.

We wish you a successful career with us.

Sincerely,

For ${companyName || 'Company Name'}
BTL`;
  };

  const handleSendOfferLetter = async () => {
    if (!offerLetterEmail) {
      toast.error('Please enter recipient email address');
      return;
    }

    const requiredFields = ['companyName', 'companyAddress', 'date', 'employeeName', 'designation', 'location', 'dateOfJoining', 'ctc'];
    const missingFields = requiredFields.filter(field => !offerLetterData[field]);
    
    if (missingFields.length > 0) {
      toast.error(`Please fill all required fields: ${missingFields.join(', ')}`);
      return;
    }

    setSendingOffer(true);
    try {
      const response = await api.post('/letters/send-offer-letter', {
        to_email: offerLetterEmail,
        ...offerLetterData
      });
      toast.success('Offer letter sent successfully!');
      setOfferLetterEmail('');
    } catch (error) {
      console.error('Error sending offer letter:', error);
      toast.error(error.response?.data?.detail || 'Failed to send offer letter');
    } finally {
      setSendingOffer(false);
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast.error('Please select valid image files');
      return;
    }
    
    setAppointmentImages(prev => [...prev, ...imageFiles]);
    e.target.value = ''; // Reset input
  };

  const removeImage = (index) => {
    setAppointmentImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendAppointmentLetter = async () => {
    if (!appointmentLetterEmail) {
      toast.error('Please enter recipient email address');
      return;
    }

    const requiredFields = ['companyName', 'companyAddress', 'date', 'employeeName', 'designation', 'effectiveDate', 'ctc', 'placeOfPosting', 'noticePeriod'];
    const missingFields = requiredFields.filter(field => !appointmentLetterData[field]);
    
    if (missingFields.length > 0) {
      toast.error(`Please fill all required fields: ${missingFields.join(', ')}`);
      return;
    }

    setSendingAppointment(true);
    try {
      const formData = new FormData();
      formData.append('to_email', appointmentLetterEmail);
      formData.append('companyName', appointmentLetterData.companyName);
      formData.append('companyAddress', appointmentLetterData.companyAddress);
      formData.append('date', appointmentLetterData.date);
      formData.append('employeeName', appointmentLetterData.employeeName);
      formData.append('designation', appointmentLetterData.designation);
      formData.append('effectiveDate', appointmentLetterData.effectiveDate);
      formData.append('employmentType', appointmentLetterData.employmentType);
      formData.append('ctc', appointmentLetterData.ctc);
      formData.append('placeOfPosting', appointmentLetterData.placeOfPosting);
      formData.append('noticePeriod', appointmentLetterData.noticePeriod);
      
      // Append images
      appointmentImages.forEach((image, index) => {
        formData.append('images', image);
      });

      const response = await api.post('/letters/send-appointment-letter', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Appointment letter sent successfully!');
      setAppointmentLetterEmail('');
      setAppointmentImages([]);
    } catch (error) {
      console.error('Error sending appointment letter:', error);
      toast.error(error.response?.data?.detail || 'Failed to send appointment letter');
    } finally {
      setSendingAppointment(false);
    }
  };

  const formatHikeLetter = () => {
    const { companyName, companyAddress, phone, email, date, employeeName, oldCTC, newCTC, effectiveDate, designation } = hikeLetterData;
    const displayPhone = phone || 'pending';
    const displayEmail = email || 'pending';
    const phoneEmailLine = displayPhone && displayEmail ? `${displayPhone} | ${displayEmail}` : (displayPhone || displayEmail);
    
    return `HIKE LETTER – FORMAT

${companyName || 'Company Name'}
${companyAddress || 'Company Address'}
${phoneEmailLine ? phoneEmailLine : ''}

Date: ${date || '___ / ___ / _____'}

To,
Mr./Ms. ${employeeName || '____________________'}

Subject: Salary Revision / Increment Letter

Dear Mr./Ms. ${employeeName || '__________'},

We are pleased to inform you that based on your performance and contribution to ${companyName || 'Company Name'}, your salary has been revised.

Your revised compensation details are as follows:

Designation: ${designation || 'pending'}

Previous CTC: ₹ ${oldCTC || '__________'} per annum

Revised CTC: ₹ ${newCTC || '__________'} per annum

Effective Date: ${effectiveDate || '__________'}

This revision reflects our appreciation for your dedication and commitment to the organization. We look forward to your continued success and growth with us.

Please sign and return a copy of this letter as acknowledgment.

Warm regards,

For ${companyName || 'Company Name'}
BTL`;
  };

  const formatPromotionLetter = () => {
    const { companyName, companyAddress, phone, email, date, employeeName, oldDesignation, newDesignation, effectiveDate, ctc } = promotionLetterData;
    const displayPhone = phone || 'pending';
    const displayEmail = email || 'pending';
    const phoneEmailLine = displayPhone && displayEmail ? `${displayPhone} | ${displayEmail}` : (displayPhone || displayEmail);
    
    return `PROMOTION LETTER – FORMAT

${companyName || 'Company Name'}
${companyAddress || 'Company Address'}
${phoneEmailLine ? phoneEmailLine : ''}

Date: ${date || '___ / ___ / _____'}

To,
Mr./Ms. ${employeeName || '____________________'}

Subject: Promotion Letter

Dear Mr./Ms. ${employeeName || '__________'},

We are pleased to inform you that based on your outstanding performance, dedication, and contribution to ${companyName || 'Company Name'}, you have been promoted to a higher position.

Your promotion details are as follows:

Previous Designation: ${oldDesignation || 'pending'}

New Designation: ${newDesignation || 'pending'}

Effective Date: ${effectiveDate || '__________'}

${ctc ? `CTC: ₹ ${ctc} per annum` : ''}

This promotion reflects our confidence in your abilities and our appreciation for your commitment to the organization. We believe you will continue to excel in your new role and contribute significantly to our growth.

Please sign and return a copy of this letter as acknowledgment.

Congratulations on your well-deserved promotion!

Warm regards,

For ${companyName || 'Company Name'}
BTL`;
  };

  return (
    <div className="letters-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">EMPLOYEE LETTERS</h1>
          <p className="page-subtitle">Generate offer, appointment, hike, and promotion letters for employees</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="letters-tabs">
        <button
          className={`letters-tab ${activeTab === 'offer' ? 'active' : ''}`}
          onClick={() => setActiveTab('offer')}
        >
          <FiMail /> Offer Letter
        </button>
        <button
          className={`letters-tab ${activeTab === 'appointment' ? 'active' : ''}`}
          onClick={() => setActiveTab('appointment')}
        >
          <FiFileText /> Appointment Letter
        </button>
        <button
          className={`letters-tab ${activeTab === 'hike' ? 'active' : ''}`}
          onClick={() => setActiveTab('hike')}
        >
          <FiTrendingUp /> Hike Letter
        </button>
        <button
          className={`letters-tab ${activeTab === 'promotion' ? 'active' : ''}`}
          onClick={() => setActiveTab('promotion')}
        >
          <FiAward /> Promotion Letter
        </button>
      </div>

      {/* Offer Letter Tab */}
      {activeTab === 'offer' && (
        <div className="letter-section">
          <div className="letter-container">
            <div className="letter-form-section">
              <h2 className="letter-form-title">Enter Details</h2>
              <div className="letter-form-grid">
                <div className="letter-form-group">
                  <label>Company Name</label>
                  <input
                    type="text"
                    value={offerLetterData.companyName}
                    onChange={(e) => handleOfferLetterChange('companyName', e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Company Address</label>
                  <input
                    type="text"
                    value={offerLetterData.companyAddress}
                    onChange={(e) => handleOfferLetterChange('companyAddress', e.target.value)}
                    placeholder="Enter company address"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Phone</label>
                  <input
                    type="text"
                    value={offerLetterData.phone}
                    onChange={(e) => handleOfferLetterChange('phone', e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={offerLetterData.email}
                    onChange={(e) => handleOfferLetterChange('email', e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Date</label>
                  <DatePicker
                    value={offerLetterData.date}
                    onChange={(date) => handleOfferLetterChange('date', date)}
                    placeholder="Select date"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Employee Name</label>
                  <input
                    type="text"
                    value={offerLetterData.employeeName}
                    onChange={(e) => handleOfferLetterChange('employeeName', e.target.value)}
                    placeholder="Enter employee name"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Designation</label>
                  <input
                    type="text"
                    value={offerLetterData.designation}
                    onChange={(e) => handleOfferLetterChange('designation', e.target.value)}
                    placeholder="Enter designation"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={offerLetterData.location}
                    onChange={(e) => handleOfferLetterChange('location', e.target.value)}
                    placeholder="Enter location"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Date of Joining</label>
                  <DatePicker
                    value={offerLetterData.dateOfJoining}
                    onChange={(date) => handleOfferLetterChange('dateOfJoining', date)}
                    placeholder="Select date of joining"
                  />
                </div>
                <div className="letter-form-group">
                  <label>CTC (per annum)</label>
                  <input
                    type="text"
                    value={offerLetterData.ctc}
                    onChange={(e) => handleOfferLetterChange('ctc', e.target.value)}
                    placeholder="Enter CTC amount"
                  />
                </div>
                <div className="letter-form-group email-section">
                  <label className="email-label">
                    <FiMail /> Recipient Email Address *
                  </label>
                  <div className="email-input-wrapper">
                    <input
                      type="email"
                      className="email-input"
                      value={offerLetterEmail}
                      onChange={(e) => setOfferLetterEmail(e.target.value)}
                      placeholder="Enter recipient email address"
                    />
                  </div>
                </div>
                <div className="letter-form-group">
                  <button
                    className="letter-submit-btn"
                    onClick={handleSendOfferLetter}
                    disabled={sendingOffer}
                  >
                    <FiSend /> {sendingOffer ? 'Sending Email...' : 'Send Offer Letter'}
                  </button>
                </div>
              </div>
            </div>

            <div className="letter-display-section">
              <h2 className="letter-display-title">Letter Preview</h2>
              <div className="letter-display-content">
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <img 
                    src="https://www.brihaspathi.com/highbtlogo%20tm%20(1).png" 
                    alt="Company Logo" 
                    style={{ maxWidth: '150px', height: 'auto' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div style={{ textAlign: 'right' }}>
                    <div>{offerLetterData.location || 'Hyderabad'}</div>
                    <div style={{ marginTop: '5px', fontSize: '0.9em' }}>{offerLetterData.date || new Date().toLocaleDateString()}</div>
                  </div>
                </div>
                <pre>{formatOfferLetter()}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Letter Tab */}
      {activeTab === 'appointment' && (
        <div className="letter-section">
          <div className="letter-container">
            <div className="letter-form-section">
              <h2 className="letter-form-title">Enter Details</h2>
              <div className="letter-form-grid">
                <div className="letter-form-group">
                  <label>Company Name</label>
                  <input
                    type="text"
                    value={appointmentLetterData.companyName}
                    onChange={(e) => handleAppointmentLetterChange('companyName', e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Company Address</label>
                  <input
                    type="text"
                    value={appointmentLetterData.companyAddress}
                    onChange={(e) => handleAppointmentLetterChange('companyAddress', e.target.value)}
                    placeholder="Enter company address"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Date</label>
                  <DatePicker
                    value={appointmentLetterData.date}
                    onChange={(date) => handleAppointmentLetterChange('date', date)}
                    placeholder="Select date"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Employee Name</label>
                  <input
                    type="text"
                    value={appointmentLetterData.employeeName}
                    onChange={(e) => handleAppointmentLetterChange('employeeName', e.target.value)}
                    placeholder="Enter employee name"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Designation</label>
                  <input
                    type="text"
                    value={appointmentLetterData.designation}
                    onChange={(e) => handleAppointmentLetterChange('designation', e.target.value)}
                    placeholder="Enter designation"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Effective Date</label>
                  <DatePicker
                    value={appointmentLetterData.effectiveDate}
                    onChange={(date) => handleAppointmentLetterChange('effectiveDate', date)}
                    placeholder="Select effective date"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Employment Type</label>
                  <input
                    type="text"
                    value={appointmentLetterData.employmentType}
                    onChange={(e) => handleAppointmentLetterChange('employmentType', e.target.value)}
                    placeholder="e.g., Permanent"
                  />
                </div>
                <div className="letter-form-group">
                  <label>CTC (per annum)</label>
                  <input
                    type="text"
                    value={appointmentLetterData.ctc}
                    onChange={(e) => handleAppointmentLetterChange('ctc', e.target.value)}
                    placeholder="Enter CTC amount"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Place of Posting</label>
                  <input
                    type="text"
                    value={appointmentLetterData.placeOfPosting}
                    onChange={(e) => handleAppointmentLetterChange('placeOfPosting', e.target.value)}
                    placeholder="Enter place of posting"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Notice Period (days)</label>
                  <input
                    type="text"
                    value={appointmentLetterData.noticePeriod}
                    onChange={(e) => handleAppointmentLetterChange('noticePeriod', e.target.value)}
                    placeholder="Enter notice period"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Attach Images (Optional)</label>
                  <div className="image-upload-section">
                    <input
                      ref={appointmentImageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="image-input-hidden"
                      id="appointment-images-input"
                    />
                    <label htmlFor="appointment-images-input" className="image-upload-btn">
                      <FiImage /> Add Images
                    </label>
                    {appointmentImages.length > 0 && (
                      <div className="selected-images-list">
                        {appointmentImages.map((image, index) => (
                          <div key={index} className="selected-image-item">
                            <img src={URL.createObjectURL(image)} alt={`Preview ${index + 1}`} />
                            <button
                              type="button"
                              className="remove-image-btn"
                              onClick={() => removeImage(index)}
                            >
                              <FiX />
                            </button>
                            <span className="image-name">{image.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="letter-form-group email-section">
                  <label className="email-label">
                    <FiMail /> Recipient Email Address *
                  </label>
                  <div className="email-input-wrapper">
                    <input
                      type="email"
                      className="email-input"
                      value={appointmentLetterEmail}
                      onChange={(e) => setAppointmentLetterEmail(e.target.value)}
                      placeholder="Enter recipient email address"
                    />
                  </div>
                </div>
                <div className="letter-form-group">
                  <button
                    className="letter-submit-btn"
                    onClick={handleSendAppointmentLetter}
                    disabled={sendingAppointment}
                  >
                    <FiSend /> {sendingAppointment ? 'Sending Email...' : 'Send Appointment Letter'}
                  </button>
                </div>
              </div>
            </div>

            <div className="letter-display-section">
              <h2 className="letter-display-title">Letter Preview</h2>
              <div className="letter-display-content">
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <img 
                    src="https://www.brihaspathi.com/highbtlogo%20tm%20(1).png" 
                    alt="Company Logo" 
                    style={{ maxWidth: '150px', height: 'auto' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div style={{ textAlign: 'right' }}>
                    <div>{appointmentLetterData.placeOfPosting || 'Hyderabad'}</div>
                    <div style={{ marginTop: '5px', fontSize: '0.9em' }}>{appointmentLetterData.date || new Date().toLocaleDateString()}</div>
                  </div>
                </div>
                <pre>{formatAppointmentLetter()}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hike Letter Tab */}
      {activeTab === 'hike' && (
        <div className="letter-section">
          <div className="letter-container">
            <div className="letter-form-section">
              <h2 className="letter-form-title">Enter Details</h2>
              <div className="letter-form-grid">
                <div className="letter-form-group">
                  <label>Company Name</label>
                  <input
                    type="text"
                    value={hikeLetterData.companyName}
                    onChange={(e) => handleHikeLetterChange('companyName', e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Company Address</label>
                  <input
                    type="text"
                    value={hikeLetterData.companyAddress}
                    onChange={(e) => handleHikeLetterChange('companyAddress', e.target.value)}
                    placeholder="Enter company address"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Employee Name *</label>
                  <div className="employee-search-wrapper" ref={employeeDropdownRef}>
                    <div className="employee-search-input-wrapper">
                      <FiSearch className="employee-search-icon" />
                      <input
                        type="text"
                        className="employee-search-input"
                        value={employeeSearch}
                        onChange={(e) => {
                          setEmployeeSearch(e.target.value);
                          setShowEmployeeDropdown(true);
                        }}
                        onFocus={() => setShowEmployeeDropdown(true)}
                        placeholder="Search by Employee ID or Name"
                      />
                    </div>
                    {showEmployeeDropdown && filteredEmployees.length > 0 && (
                      <div className="employee-dropdown">
                        {filteredEmployees.map((emp) => (
                          <div
                            key={emp.id}
                            className="employee-dropdown-item"
                            onClick={() => handleEmployeeSelect(emp)}
                          >
                            <div className="employee-dropdown-name">{emp.empid} - {emp.name}</div>
                            {emp.email && (
                              <div className="employee-dropdown-email">{emp.email}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="letter-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={hikeLetterData.email || 'pending'}
                    onChange={(e) => handleHikeLetterChange('email', e.target.value === 'pending' ? '' : e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Phone</label>
                  <input
                    type="text"
                    value={hikeLetterData.phone || 'pending'}
                    onChange={(e) => handleHikeLetterChange('phone', e.target.value === 'pending' ? '' : e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Designation</label>
                  <input
                    type="text"
                    value={hikeLetterData.designation || 'pending'}
                    onChange={(e) => handleHikeLetterChange('designation', e.target.value === 'pending' ? '' : e.target.value)}
                    placeholder="Enter designation"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Date</label>
                  <DatePicker
                    value={hikeLetterData.date}
                    onChange={(date) => handleHikeLetterChange('date', date)}
                    placeholder="Select date"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Previous CTC (per annum)</label>
                  <input
                    type="text"
                    value={hikeLetterData.oldCTC}
                    onChange={(e) => handleHikeLetterChange('oldCTC', e.target.value)}
                    placeholder="Enter previous CTC"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Revised CTC (per annum)</label>
                  <input
                    type="text"
                    value={hikeLetterData.newCTC}
                    onChange={(e) => handleHikeLetterChange('newCTC', e.target.value)}
                    placeholder="Enter revised CTC"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Effective Date</label>
                  <DatePicker
                    value={hikeLetterData.effectiveDate}
                    onChange={(date) => handleHikeLetterChange('effectiveDate', date)}
                    placeholder="Select effective date"
                  />
                </div>
              </div>
            </div>

            <div className="letter-display-section">
              <h2 className="letter-display-title">Letter Preview</h2>
              <div className="letter-display-content">
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <img 
                    src="https://www.brihaspathi.com/highbtlogo%20tm%20(1).png" 
                    alt="Company Logo" 
                    style={{ maxWidth: '150px', height: 'auto' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div style={{ textAlign: 'right' }}>
                    <div>Hyderabad</div>
                    <div style={{ marginTop: '5px', fontSize: '0.9em' }}>{hikeLetterData.date || new Date().toLocaleDateString()}</div>
                  </div>
                </div>
                <pre>{formatHikeLetter()}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Promotion Letter Tab */}
      {activeTab === 'promotion' && (
        <div className="letter-section">
          <div className="letter-container">
            <div className="letter-form-section">
              <h2 className="letter-form-title">Enter Details</h2>
              <div className="letter-form-grid">
                <div className="letter-form-group">
                  <label>Company Name</label>
                  <input
                    type="text"
                    value={promotionLetterData.companyName}
                    onChange={(e) => handlePromotionLetterChange('companyName', e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Company Address</label>
                  <input
                    type="text"
                    value={promotionLetterData.companyAddress}
                    onChange={(e) => handlePromotionLetterChange('companyAddress', e.target.value)}
                    placeholder="Enter company address"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Employee Name *</label>
                  <div className="employee-search-wrapper" ref={employeeDropdownRef}>
                    <div className="employee-search-input-wrapper">
                      <FiSearch className="employee-search-icon" />
                      <input
                        type="text"
                        className="employee-search-input"
                        value={employeeSearch}
                        onChange={(e) => {
                          setEmployeeSearch(e.target.value);
                          setShowEmployeeDropdown(true);
                        }}
                        onFocus={() => setShowEmployeeDropdown(true)}
                        placeholder="Search by Employee ID or Name"
                      />
                    </div>
                    {showEmployeeDropdown && filteredEmployees.length > 0 && (
                      <div className="employee-dropdown">
                        {filteredEmployees.map((emp) => (
                          <div
                            key={emp.id}
                            className="employee-dropdown-item"
                            onClick={() => handleEmployeeSelect(emp)}
                          >
                            <div className="employee-dropdown-name">{emp.empid} - {emp.name}</div>
                            {emp.email && (
                              <div className="employee-dropdown-email">{emp.email}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="letter-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={promotionLetterData.email || 'pending'}
                    onChange={(e) => handlePromotionLetterChange('email', e.target.value === 'pending' ? '' : e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Phone</label>
                  <input
                    type="text"
                    value={promotionLetterData.phone || 'pending'}
                    onChange={(e) => handlePromotionLetterChange('phone', e.target.value === 'pending' ? '' : e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Date</label>
                  <DatePicker
                    value={promotionLetterData.date}
                    onChange={(date) => handlePromotionLetterChange('date', date)}
                    placeholder="Select date"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Previous Designation</label>
                  <input
                    type="text"
                    value={promotionLetterData.oldDesignation || 'pending'}
                    onChange={(e) => handlePromotionLetterChange('oldDesignation', e.target.value === 'pending' ? '' : e.target.value)}
                    placeholder="Enter previous designation"
                  />
                </div>
                <div className="letter-form-group">
                  <label>New Designation</label>
                  <input
                    type="text"
                    value={promotionLetterData.newDesignation}
                    onChange={(e) => handlePromotionLetterChange('newDesignation', e.target.value)}
                    placeholder="Enter new designation"
                  />
                </div>
                <div className="letter-form-group">
                  <label>Effective Date</label>
                  <DatePicker
                    value={promotionLetterData.effectiveDate}
                    onChange={(date) => handlePromotionLetterChange('effectiveDate', date)}
                    placeholder="Select effective date"
                  />
                </div>
                <div className="letter-form-group">
                  <label>CTC (per annum) - Optional</label>
                  <input
                    type="text"
                    value={promotionLetterData.ctc}
                    onChange={(e) => handlePromotionLetterChange('ctc', e.target.value)}
                    placeholder="Enter CTC amount"
                  />
                </div>
              </div>
            </div>

            <div className="letter-display-section">
              <h2 className="letter-display-title">Letter Preview</h2>
              <div className="letter-display-content">
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <img 
                    src="https://www.brihaspathi.com/highbtlogo%20tm%20(1).png" 
                    alt="Company Logo" 
                    style={{ maxWidth: '150px', height: 'auto' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div style={{ textAlign: 'right' }}>
                    <div>Hyderabad</div>
                    <div style={{ marginTop: '5px', fontSize: '0.9em' }}>{promotionLetterData.date || new Date().toLocaleDateString()}</div>
                  </div>
                </div>
                <pre>{formatPromotionLetter()}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Letters;

