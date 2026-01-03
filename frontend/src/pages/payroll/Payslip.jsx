import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { FiPrinter, FiFileText, FiMail, FiMessageCircle, FiDownload, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './Payslip.css';

const Payslip = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [payslipData, setPayslipData] = useState(null);
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState({ email: '', subject: '', message: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [logoBase64, setLogoBase64] = useState(null);

  useEffect(() => {
    if (monthYear) {
      fetchPayslip();
    }
    fetchCompanyLogo();
  }, [monthYear]);

  const fetchCompanyLogo = async () => {
    try {
      const response = await api.get('/company/logo');
      if (response.data.logo_base64) {
        setLogoBase64(response.data.logo_base64);
      } else {
        setLogoError(true);
      }
    } catch (error) {
      console.error('Error fetching company logo:', error);
      setLogoError(true);
    }
  };

  const fetchPayslip = async () => {
    setLoading(true);
    try {
      const [year, month] = monthYear.split('-').map(Number);
      const params = {
        month,
        year,
        limit: 1
      };

      // Always filter by logged-in user's empid
      if (user?.empid) {
        try {
          // Try to use empid as integer for search
          const empIdInt = parseInt(user.empid);
          params.search = empIdInt.toString();
        } catch {
          params.search = user.empid;
        }
      }

      const response = await api.get('/payslip/list', { params });
      const data = response.data.data || [];
      
      if (data.length > 0) {
        setPayslipData(data[0]);
      } else {
        setPayslipData(null);
        // Show only one message
        //toast.error('Payslip not available so please wait');
      }
    } catch (error) {
      console.error('Error fetching payslip:', error);
      setPayslipData(null);
      toast.error('Failed to fetch payslip data');
    } finally {
      setLoading(false);
    }
  };

  // Convert number to words (Indian format)
  const numberToWords = (num) => {
    const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    
    if (num === 0) return 'ZERO';
    
    const convertHundreds = (n) => {
      let result = '';
      if (n >= 100) {
        result += ones[Math.floor(n / 100)] + ' HUNDRED ';
        n %= 100;
      }
      if (n >= 20) {
        result += tens[Math.floor(n / 10)] + ' ';
        n %= 10;
      }
      if (n > 0) {
        result += ones[n] + ' ';
      }
      return result.trim();
    };

    const convert = (n) => {
      if (n === 0) return '';
      
      if (n >= 10000000) {
        return convert(Math.floor(n / 10000000)) + ' CRORE ' + convert(n % 10000000);
      }
      if (n >= 100000) {
        return convert(Math.floor(n / 100000)) + ' LAKH ' + convert(n % 100000);
      }
      if (n >= 1000) {
        return convert(Math.floor(n / 1000)) + ' THOUSAND ' + convert(n % 1000);
      }
      return convertHundreds(n);
    };

    const numStr = num.toString();
    const parts = numStr.split('.');
    const rupees = parseInt(parts[0]);
    const paise = parts[1] ? parseInt(parts[1].padEnd(2, '0').substring(0, 2)) : 0;

    let result = convert(rupees).trim();
    if (paise > 0) {
      result += ' AND ' + convert(paise).trim() + ' PAISE';
    }
    return result + ' RUPEES ONLY';
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return num.toFixed(2);
  };

  const getMonthName = (monthNum) => {
    const months = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthNum] || '';
  };

  const handlePrint = () => {
    const printContent = document.getElementById('payslip-content');
    if (!printContent) {
      toast.error('Payslip content not found');
      return;
    }
    
    const printWindow = window.open('', '_blank');
    const printDocument = printWindow.document;
    
    printDocument.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payslip - ${getMonthName(payslipData.month)} ${payslipData.year}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Outfit:wght@100..900&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'DM Sans', sans-serif; }
            body { font-family: 'DM Sans', sans-serif; padding: 20px; background: #fafafa; }
            .payslip-container { max-width: 100%; margin: 0 auto; width: 100%; }
            .payslip-header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .payslip-logo { height: 120px; width: auto; max-width: 200px; object-fit: contain; }
            .payslip-title-cell { font-size: 16px; font-weight: 700; color: #007bff; text-align: right; font-family: 'Outfit', sans-serif; }
            .payslip-section { margin-bottom: 20px; }
            .payslip-section-header { background-color: #6b7785; color: white; padding: 10px; font-weight: 700; font-size: 12px; text-align: center; font-family: 'Outfit', sans-serif; }
            .info-grid { display: table; width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 15px; }
            .info-item { display: table-row; }
            .info-label { display: table-cell; font-weight: 700; background-color: #f1f3f5; padding: 12px; border-right: 2px solid #000; border-bottom: 2px solid #000; width: 30%; }
            .info-value { display: table-cell; padding: 12px; border-bottom: 2px solid #000; }
            .data-grid { display: table; width: 100%; border-collapse: collapse; border: 2px solid #000; }
            .data-header { display: table-cell; background-color: #f1f3f5; font-weight: 700; padding: 12px 8px; border-right: 2px solid #000; border-bottom: 2px solid #000; text-align: center; font-size: 11px; }
            .data-value { display: table-cell; padding: 12px 8px; border-right: 2px solid #000; border-bottom: 2px solid #000; text-align: center; font-size: 11px; }
            .total-grid { display: table; width: 100%; border-collapse: collapse; border: 2px solid #000; }
            .total-item { display: table-cell; border-right: 2px solid #000; }
            .total-label { font-weight: 700; background-color: #f1f3f5; padding: 14px; border-bottom: 2px solid #000; text-align: center; }
            .total-value { padding: 14px; text-align: center; font-size: 1.1rem; font-weight: 700; }
            .words-section { display: table; width: 100%; border-collapse: collapse; border: 2px solid #000; }
            .words-label { display: table-cell; font-weight: 700; background-color: #f1f3f5; padding: 12px; border-right: 2px solid #000; width: 20%; }
            .words-value { display: table-cell; padding: 14px; font-size: 11px; text-transform: uppercase; }
            .payslip-footer { text-align: center; padding-top: 20px; font-size: 10px; color: #6c757d; font-style: italic; }
            @media print {
              body { padding: 0; }
              @page { size: A4; margin: 15mm; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    
    printDocument.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleDownloadPDF = async () => {
    try {
      const payslipContent = document.getElementById('payslip-content');
      if (!payslipContent) {
        toast.error('Payslip content not found');
        return;
      }

      const html2pdf = (await import('html2pdf.js')).default;

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Payslip_${getMonthName(payslipData.month)}_${payslipData.emp_id || 'Employee'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          allowTaint: true,
          backgroundColor: '#ffffff'
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(payslipContent).save();
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to download PDF. Please try using Print instead.');
    }
  };

  const handleWhatsApp = () => {
    if (!payslipData) return;
    const message = `Payslip for ${getMonthName(payslipData.month)} ${payslipData.year}\nEmployee: ${payslipData.full_name}\nNet Salary: ₹${formatCurrency(payslipData.net_salary)}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleEmail = () => {
    if (!payslipData) return;
    setEmailData({
      email: user?.email || '',
      subject: `Payslip for ${getMonthName(payslipData.month)} ${payslipData.year}`,
      message: `Dear ${payslipData.full_name || 'Employee'},\n\nPlease find attached your payslip for ${getMonthName(payslipData.month)} ${payslipData.year}.\n\nBest regards,\nHRMS Team`
    });
    setShowEmailModal(true);
  };

  const sendEmail = async () => {
    if (!emailData.email || !emailData.email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSendingEmail(true);
    try {
      const response = await api.post('/payslip/send-email', {
        to_email: emailData.email,
        subject: emailData.subject,
        message: emailData.message,
        month: payslipData.month,
        year: payslipData.year,
        emp_id: payslipData.emp_id
      });

      if (response.data.success) {
        toast.success('Payslip sent via email successfully!');
        setShowEmailModal(false);
        setEmailData({ email: '', subject: '', message: '' });
      } else {
        toast.error(response.data.message || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error(error.response?.data?.detail || 'Failed to send email. Please try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDownloadWord = async () => {
    try {
      if (!payslipData) {
        toast.error('Payslip data not available');
        return;
      }

      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = await import('docx');
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `PAYSLIP FOR THE MONTH OF ${getMonthName(payslipData.month).toUpperCase()} ${payslipData.year}`,
                  bold: true,
                  size: 24,
                  color: "007bff"
                })
              ],
              alignment: AlignmentType.RIGHT,
              spacing: { after: 200 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: "NAME OF THE EMPLOYEE: ", bold: true }),
                new TextRun({ text: payslipData.full_name || '-' })
              ],
              spacing: { after: 100 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: "EMPLOYEE ID: ", bold: true }),
                new TextRun({ text: String(payslipData.emp_id || '-') + "    " }),
                new TextRun({ text: "MONTH: ", bold: true }),
                new TextRun({ text: getMonthName(payslipData.month) + "    " }),
                new TextRun({ text: "PF NO: ", bold: true }),
                new TextRun({ text: payslipData.pf_no || '-' })
              ],
              spacing: { after: 100 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: "DESIGNATION: ", bold: true }),
                new TextRun({ text: payslipData.designation || '-' + "    " }),
                new TextRun({ text: "PAID DAYS: ", bold: true }),
                new TextRun({ text: formatCurrency(payslipData.payable_days || 0) + "    " }),
                new TextRun({ text: "ESI NO: ", bold: true }),
                new TextRun({ text: payslipData.esi_no || '-' })
              ],
              spacing: { after: 200 }
            }),
            
            new Paragraph({
              children: [new TextRun({ text: "EARNINGS", bold: true, size: 20 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            
            new Table({
              columnWidths: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000],
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph("BASIC")] }),
                    new TableCell({ children: [new Paragraph("HRA")] }),
                    new TableCell({ children: [new Paragraph("CONV")] }),
                    new TableCell({ children: [new Paragraph("ARREARS")] }),
                    new TableCell({ children: [new Paragraph("FIX HRA")] }),
                    new TableCell({ children: [new Paragraph("OTHER ALLOW")] }),
                    new TableCell({ children: [new Paragraph("UNIFORM ALLOW")] }),
                    new TableCell({ children: [new Paragraph("MED ALLOW")] }),
                    new TableCell({ children: [new Paragraph("CCA")] }),
                    new TableCell({ children: [new Paragraph("MOBILE ALLOWANCES")] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(formatCurrency(payslipData.basic || 0))] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(payslipData.hra || 0))] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(payslipData.ca || 0))] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(payslipData.arrear_salary || 0))] }),
                    new TableCell({ children: [new Paragraph("0.00")] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(payslipData.sa || 0))] }),
                    new TableCell({ children: [new Paragraph("0.00")] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(payslipData.ma || 0))] }),
                    new TableCell({ children: [new Paragraph("0.00")] }),
                    new TableCell({ children: [new Paragraph("0.00")] })
                  ]
                })
              ]
            }),
            
            new Paragraph({
              children: [new TextRun({ text: "DEDUCTIONS", bold: true, size: 20 })],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 100 }
            }),
            
            new Table({
              columnWidths: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000],
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph("PF")] }),
                    new TableCell({ children: [new Paragraph("ESI")] }),
                    new TableCell({ children: [new Paragraph("PROF TAX")] }),
                    new TableCell({ children: [new Paragraph("LWF")] }),
                    new TableCell({ children: [new Paragraph("IT")] }),
                    new TableCell({ children: [new Paragraph("LIC")] }),
                    new TableCell({ children: [new Paragraph("OTHER")] }),
                    new TableCell({ children: [new Paragraph("BANK LOAN")] }),
                    new TableCell({ children: [new Paragraph("COMP LOAN")] }),
                    new TableCell({ children: [new Paragraph("RENT PAID")] }),
                    new TableCell({ children: [new Paragraph("SALARY ADV")] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(formatCurrency(payslipData.pf || 0))] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(payslipData.esi || 0))] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(payslipData.pt || 0))] }),
                    new TableCell({ children: [new Paragraph("0.00")] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(payslipData.tds || 0))] }),
                    new TableCell({ children: [new Paragraph("0.00")] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(payslipData.other_deduction || 0))] }),
                    new TableCell({ children: [new Paragraph("0.00")] }),
                    new TableCell({ children: [new Paragraph(formatCurrency(payslipData.loan_amount || 0))] }),
                    new TableCell({ children: [new Paragraph("0.00")] }),
                    new TableCell({ children: [new Paragraph("0.00")] })
                  ]
                })
              ]
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: "TOTAL EARNINGS (IN INR): ", bold: true }),
                new TextRun({ text: formatCurrency(payslipData.earned_gross || 0) + "    " }),
                new TextRun({ text: "TOTAL DEDUCTIONS (IN INR): ", bold: true }),
                new TextRun({ text: formatCurrency(payslipData.total_deductions || 0) + "    " }),
                new TextRun({ text: "NET PAY (IN INR): ", bold: true }),
                new TextRun({ text: formatCurrency(payslipData.net_salary || 0) })
              ],
              spacing: { before: 200, after: 100 }
            }),
            
            new Paragraph({
              children: [
                new TextRun({ text: "IN WORDS: ", bold: true }),
                new TextRun({ text: numberToWords(parseFloat(payslipData.net_salary || 0)) })
              ],
              spacing: { before: 200, after: 200 }
            }),
            
            new Paragraph({
              children: [new TextRun({ text: "** system generated print out. no signature required **", italics: true })],
              alignment: AlignmentType.CENTER
            })
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Payslip_${getMonthName(payslipData.month)}_${payslipData.emp_id || 'Employee'}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Word document downloaded successfully');
    } catch (error) {
      console.error('Error generating Word document:', error);
      toast.error('Failed to download Word document. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading payslip...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>PAYSLIP</h1>
        <div className="header-actions">
          <input
            type="month"
            value={monthYear}
            onChange={(e) => setMonthYear(e.target.value)}
            className="form-input"
            style={{ width: '180px' }}
          />
        </div>
      </div>

      {!payslipData ? (
        <div className="empty-state">
          <p style={{ fontSize: '1.1rem', marginBottom: '10px' }}>Payslip Not Available</p>
          <p style={{ fontSize: '0.9rem', marginBottom: '5px' }}>
            This payslip is not yet frozen. Once frozen, it will be visible here.
          </p>
          {user?.role === 'Employee' && (
            <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              Please contact HR if you believe this is an error.
            </p>
          )}
        </div>
      ) : (
        <div className="payslip-wrapper">
          <div className="payslip-container" id="payslip-content">
            {/* Header with Logo and Title - Table Format */}
            <table className="payslip-header-table">
              <tbody>
                <tr>
                  <td className="payslip-logo-cell">
                    {!logoError && logoBase64 && (
                      <img 
                        src={logoBase64} 
                        alt="Company Logo" 
                        className="payslip-logo" 
                        onError={() => setLogoError(true)}
                      />
                    )}
                  </td>
                  <td className="payslip-title-cell">
                    PAYSLIP FOR THE MONTH OF {getMonthName(payslipData.month).toUpperCase()} {payslipData.year}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="payslip-spacer"></div>

            {/* Employee Details - Table Format with 6 columns */}
            <table className="payslip-emp-table">
              <tbody>
                <tr>
                  <td className="payslip-emp-label">NAME OF THE EMPLOYEE:</td>
                  <td className="payslip-emp-value" colSpan="5">{payslipData.full_name || '-'}</td>
                </tr>
                <tr>
                  <td className="payslip-emp-label">EMPLOYEE ID:</td>
                  <td className="payslip-emp-value">{payslipData.emp_id || '-'}</td>
                  <td className="payslip-emp-label">MONTH:</td>
                  <td className="payslip-emp-value">{getMonthName(payslipData.month)}</td>
                  <td className="payslip-emp-label">PF NO:</td>
                  <td className="payslip-emp-value">{payslipData.pf_no || '-'}</td>
                </tr>
                <tr>
                  <td className="payslip-emp-label">DESIGNATION:</td>
                  <td className="payslip-emp-value">{payslipData.designation || '-'}</td>
                  <td className="payslip-emp-label">PAID DAYS:</td>
                  <td className="payslip-emp-value">{formatCurrency(payslipData.payable_days || 0)}</td>
                  <td className="payslip-emp-label">ESI NO:</td>
                  <td className="payslip-emp-value">{payslipData.esi_no || '-'}</td>
                </tr>
              </tbody>
            </table>

            <div className="payslip-spacer"></div>

            {/* Earnings Section */}
            <div className="payslip-section">
              <div className="payslip-section-header">EARNINGS</div>
              <table className="payslip-data-table">
                <thead>
                  <tr>
                    <th>BASIC</th>
                    <th>HRA</th>
                    <th>CONV</th>
                    <th>ARREARS</th>
                    <th>FIX HRA</th>
                    <th>OTHER ALLOW</th>
                    <th>UNIFORM ALLOW</th>
                    <th>MED ALLOW</th>
                    <th>CCA</th>
                    <th>MOBILE ALLOWANCES</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{formatCurrency(payslipData.basic || 0)}</td>
                    <td>{formatCurrency(payslipData.hra || 0)}</td>
                    <td>{formatCurrency(payslipData.ca || 0)}</td>
                    <td>{formatCurrency(payslipData.arrear_salary || 0)}</td>
                    <td>0.00</td>
                    <td>{formatCurrency(payslipData.sa || 0)}</td>
                    <td>0.00</td>
                    <td>{formatCurrency(payslipData.ma || 0)}</td>
                    <td>0.00</td>
                    <td>0.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="payslip-spacer"></div>

            {/* Deductions Section */}
            <div className="payslip-section">
              <div className="payslip-section-header">DEDUCTIONS</div>
              <table className="payslip-data-table">
                <thead>
                  <tr>
                    <th>PF</th>
                    <th>ESI</th>
                    <th>PROF TAX</th>
                    <th>LWF</th>
                    <th>IT</th>
                    <th>LIC</th>
                    <th>OTHER</th>
                    <th>BANK LOAN</th>
                    <th>COMP LOAN</th>
                    <th>RENT PAID</th>
                    <th>SALARY ADV</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{formatCurrency(payslipData.pf || 0)}</td>
                    <td>{formatCurrency(payslipData.esi || 0)}</td>
                    <td>{formatCurrency(payslipData.pt || 0)}</td>
                    <td>0.00</td>
                    <td>{formatCurrency(payslipData.tds || 0)}</td>
                    <td>0.00</td>
                    <td>{formatCurrency(payslipData.other_deduction || 0)}</td>
                    <td>0.00</td>
                    <td>{formatCurrency(payslipData.loan_amount || 0)}</td>
                    <td>0.00</td>
                    <td>0.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="payslip-spacer"></div>

            {/* Totals */}
            <table className="payslip-total-table">
              <tbody>
                <tr>
                  <td className="payslip-total-label">TOTAL EARNINGS (IN INR)</td>
                  <td className="payslip-total-value">{formatCurrency(payslipData.earned_gross || 0)}</td>
                  <td className="payslip-total-label">TOTAL DEDUCTIONS (IN INR)</td>
                  <td className="payslip-total-value">{formatCurrency(payslipData.total_deductions || 0)}</td>
                  <td className="payslip-total-label">NET PAY (IN INR)</td>
                  <td className="payslip-total-value">{formatCurrency(payslipData.net_salary || 0)}</td>
                </tr>
              </tbody>
            </table>

            <div className="payslip-spacer"></div>

            {/* In Words */}
            <table className="payslip-words-table">
              <tbody>
                <tr>
                  <td className="payslip-words-label">IN WORDS:</td>
                  <td className="payslip-words-value">{numberToWords(parseFloat(payslipData.net_salary || 0))}</td>
                </tr>
              </tbody>
            </table>

            {/* Footer */}
            <div className="payslip-footer">
              <p>** system generated print out. no signature required **</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="payslip-actions">
            <button className="action-card" onClick={handlePrint}>
              <FiPrinter className="action-icon" />
              <span>Print</span>
            </button>
            <button className="action-card" onClick={handleDownloadPDF}>
              <FiFileText className="action-icon" />
              <span>PDF</span>
            </button>
            <button className="action-card" onClick={handleWhatsApp}>
              <FiMessageCircle className="action-icon" />
              <span>WhatsApp</span>
            </button>
            <button className="action-card" onClick={handleEmail}>
              <FiMail className="action-icon" />
              <span>Email</span>
            </button>
            <button className="action-card" onClick={handleDownloadWord}>
              <FiDownload className="action-icon" />
              <span>Word</span>
            </button>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="email-modal-overlay" onClick={() => setShowEmailModal(false)}>
          <div className="email-modal" onClick={(e) => e.stopPropagation()}>
            <div className="email-modal-header">
              <h2>Send Payslip via Email</h2>
              <button className="email-modal-close" onClick={() => setShowEmailModal(false)}>
                <FiX />
              </button>
            </div>
            <div className="email-modal-body">
              <div className="form-group">
                <label>To Email *</label>
                <input
                  type="email"
                  className="form-input"
                  value={emailData.email}
                  onChange={(e) => setEmailData({ ...emailData, email: e.target.value })}
                  placeholder="Enter recipient email"
                  required
                />
              </div>
              <div className="form-group">
                <label>Subject *</label>
                <input
                  type="text"
                  className="form-input"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Message *</label>
                <textarea
                  className="form-input"
                  rows="5"
                  value={emailData.message}
                  onChange={(e) => setEmailData({ ...emailData, message: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="email-modal-footer">
              <button className="btn-secondary" onClick={() => setShowEmailModal(false)} disabled={sendingEmail}>
                Cancel
              </button>
              <button className="btn-primary" onClick={sendEmail} disabled={sendingEmail}>
                {sendingEmail ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payslip;
