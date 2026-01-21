import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { FiSearch, FiDownload, FiUpload, FiChevronLeft, FiChevronRight, FiX, FiCalendar, FiChevronDown } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './Attendance.css';
import '../employee/Employee.css';
import '../self/Punch.css';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

const AttendanceHistory = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState({ employees: [], dates: [] });
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 50;
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [showPunchLogsModal, setShowPunchLogsModal] = useState(false);
  const [punchLogsData, setPunchLogsData] = useState([]);
  const [loadingPunchLogs, setLoadingPunchLogs] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [punchLogsMap, setPunchLogsMap] = useState({}); // Store punch logs by employee_id_date
  const [loadingPunchLogsMap, setLoadingPunchLogsMap] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const monthPickerRef = useRef(null);

  useEffect(() => {
    fetchAttendanceHistory();
    setPunchLogsMap({}); // Clear punch logs map when month/year changes
  }, [currentMonth, currentYear]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close month picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMonthPicker && monthPickerRef.current && !monthPickerRef.current.contains(event.target)) {
        setShowMonthPicker(false);
      }
    };
    if (showMonthPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMonthPicker]);

  const fetchAttendanceHistory = async () => {
    setLoading(true);
    try {
      let response;
      // For Employee role, fetch only their own data
      if (user?.role === 'Employee') {
        response = await api.get(`/attendance/history-month-self?month=${currentMonth}&year=${currentYear}`);
      } else {
        response = await api.get(`/attendance/history-month?month=${currentMonth}&year=${currentYear}`);
      }
      
      setAttendanceData(response.data);
      setFilteredEmployees(response.data.employees || []);
    } catch (error) {
      
      setAttendanceData({ employees: [], dates: [] });
      setFilteredEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter employees based on search query (matching Count page style)
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setFilteredEmployees(attendanceData.employees || []);
    } else {
      const term = debouncedSearchQuery.toLowerCase().trim();
      const filtered = (attendanceData.employees || []).filter(emp => {
        const name = (emp.employee_name || '').toLowerCase();
        const empId = (emp.employee_id || '').toLowerCase();
        return name.includes(term) || empId.includes(term);
      });
      setFilteredEmployees(filtered);
    }
    setCurrentPage(1); // Reset to page 1 when search changes
  }, [debouncedSearchQuery, attendanceData.employees]);

  // Pagination logic
  const totalPages = Math.ceil(filteredEmployees.length / recordsPerPage);
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredEmployees.slice(indexOfFirstRecord, indexOfLastRecord);

  // Fetch punch logs for visible employees and dates
  useEffect(() => {
    if (attendanceData.employees && attendanceData.employees.length > 0 && attendanceData.dates && attendanceData.dates.length > 0 && currentRecords.length > 0) {
      fetchPunchLogsForVisibleDates();
    }
  }, [attendanceData, currentRecords]);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const formatDuration = (hours) => {
    if (!hours || hours === 0) return '00:00';
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const getStatusDisplay = (status, hours) => {
    // If status is provided (from backend - includes leave types, holidays, week-offs), use it directly
    if (status) return status;
    // Calculate status based on hours if no status provided
    if (hours && hours >= 9) return 'P';
    if (hours && hours >= 4.5 && hours < 9) return 'H/D';
    if (hours && hours > 0 && hours < 4.5) return 'Abs';
    // If no hours and no status, return Abs (no records)
    return 'Abs';
  };

  const getStatusColor = (status) => {
    if (!status) return '#9E9E9E'; // Gray for empty
    const upperStatus = status.toUpperCase();
    
    // Present
    if (upperStatus === 'P') return '#4CAF50'; // Green
    
    // Half Day
    if (upperStatus === 'H/D') return '#FF9800'; // Orange
    
    // Week Off
    if (upperStatus === 'WO') return '#2196F3'; // Blue
    
    // Holiday
    if (upperStatus === 'HOLIDAY') return '#9C27B0'; // Purple
    
    // Leave types
    if (upperStatus === 'SICK' || upperStatus === 'SL') return '#E91E63'; // Pink
    if (upperStatus === 'CASUAL' || upperStatus === 'CL') return '#00BCD4'; // Cyan
    if (upperStatus === 'ANNUAL' || upperStatus === 'AL') return '#FF5722'; // Deep Orange
    if (upperStatus === 'EMERGENCY') return '#F44336'; // Red
    if (upperStatus === 'OTHER') return '#795548'; // Brown
    
    // Absent
    if (upperStatus === 'ABS' || upperStatus === 'ABSENT') return '#F44336'; // Red
    
    // Default
    return '#9E9E9E'; // Gray
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      // Export attendance history table data (same format as displayed)
      if (!attendanceData.employees || attendanceData.employees.length === 0) {
        toast.error('No data to export');
        setExportingExcel(false);
        return;
      }

      // Get all employees (use filteredEmployees if search is active, otherwise all)
      const employeesToExport = debouncedSearchQuery.trim() ? filteredEmployees : attendanceData.employees;
      
      // Create worksheet data array
      const worksheetData = [];
      
      // Row 0: First header row with merged date cells
      const headerRow1 = ['NAME', 'EmployeeId'];
      attendanceData.dates.forEach(date => {
        // Convert date from dd-mm-yyyy to yyyy-mm-dd for display
        const [day, month, year] = date.split('-');
        const dateStr = `${year}-${month}-${day}`;
        // Add date header once (will be merged across 4 columns in next row)
        headerRow1.push(dateStr);
        // Add empty cells for the remaining 3 columns that will be merged
        headerRow1.push('', '', '');
      });
      worksheetData.push(headerRow1);
      
      // Row 1: Second header row with sub-columns
      const headerRow2 = ['', '']; // Empty for NAME and EmployeeId columns
      attendanceData.dates.forEach(() => {
        // Add sub-columns for each date: IN-TIME, OUT-TIME, DURATION, STATUS
        headerRow2.push('IN-TIME', 'OUT-TIME', 'DURATION', 'STATUS');
      });
      worksheetData.push(headerRow2);
      
      // Data rows
      for (const emp of employeesToExport) {
        const dataRow = [
          emp.employee_name || '',
          emp.employee_id || ''
        ];
        
        // Add data for each date
        for (const date of attendanceData.dates) {
          const dayData = emp.dates[date];
          const key = `${emp.employee_id}_${date}`;
          const punchLogs = punchLogsMap[key] || [];
          
          // Get intime/outtime from punch logs
          const punchData = getIntimeOuttimeFromPunchLogs(punchLogs);
          
          // Use punch logs data if available, otherwise fall back to dayData
          const checkIn = punchLogs.length > 0 ? punchData.intime : formatTime(dayData?.check_in || '00:00');
          const checkOut = punchLogs.length > 0 ? punchData.outtime : formatTime(dayData?.check_out || '00:00');
          const duration = punchLogs.length > 0 ? punchData.duration : formatDuration(dayData?.hours || 0);
          const status = punchLogs.length > 0 ? punchData.status : getStatusDisplay(dayData?.status, dayData?.hours);
          
          // Check punch logs directly for location and remarks
          // Sort punch logs by time to get intime (first) and outtime (last)
          let intimeRecord = null;
          let outtimeRecord = null;
          
          if (punchLogs.length > 0) {
            const sorted = [...punchLogs].sort((a, b) => {
              return new Date(a.punch_time).getTime() - new Date(b.punch_time).getTime();
            });
            intimeRecord = sorted[0]; // First record = intime
            outtimeRecord = sorted.length > 1 ? sorted[sorted.length - 1] : sorted[0]; // Last record = outtime
          }
          
          // Check if location and remarks are not null for intime
          const intimeHasLocation = intimeRecord && intimeRecord.location && intimeRecord.location.trim() !== '';
          const intimeHasRemarks = intimeRecord && intimeRecord.remarks && intimeRecord.remarks.trim() !== '';
          
          // Check if location and remarks are not null for outtime
          const outtimeHasLocation = outtimeRecord && outtimeRecord.location && outtimeRecord.location.trim() !== '';
          const outtimeHasRemarks = outtimeRecord && outtimeRecord.remarks && outtimeRecord.remarks.trim() !== '';
          
          // Store checkIn and checkOut with their indicators
          dataRow.push({
            value: checkIn,
            hasLocation: intimeHasLocation,
            hasRemarks: intimeHasRemarks
          });
          dataRow.push({
            value: checkOut,
            hasLocation: outtimeHasLocation,
            hasRemarks: outtimeHasRemarks
          });
          dataRow.push(duration);
          dataRow.push(status || '');
        }
        
        worksheetData.push(dataRow);
      }

      // Create workbook using ExcelJS for styling support
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Attendance History');

      // Set column widths
      worksheet.getColumn(1).width = 25; // NAME
      worksheet.getColumn(2).width = 15; // EmployeeId
      // Set widths for date columns (4 columns per date)
      let colNum = 3;
      for (let i = 0; i < attendanceData.dates.length * 4; i++) {
        worksheet.getColumn(colNum).width = 12;
        colNum++;
      }

      // Add data rows with styling
      worksheetData.forEach((row, rowIndex) => {
        // Process row data - convert objects to strings for initial row creation
        const processedRow = row.map((cellValue, colIndex) => {
          // Check if this is an object with location/remarks info (intime/outtime columns)
          if (typeof cellValue === 'object' && cellValue !== null && cellValue.value !== undefined) {
            // Return the time value as string, we'll add rich text later
            return cellValue.value;
          }
          // Regular cell value
          return cellValue;
        });
        
        const excelRow = worksheet.addRow(processedRow);
        
        // Store original row data for rich text processing
        const originalRow = row;
        
        // Style header rows (row 0 and 1)
        if (rowIndex === 0 || rowIndex === 1) {
          excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            // Dark blue background for headers
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF366092' } // Dark blue
            };
            cell.font = {
              color: { argb: 'FFFFFFFF' }, // White text
              bold: true,
              size: 11
            };
            cell.alignment = {
              horizontal: 'center',
              vertical: 'middle',
              wrapText: true
            };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF2a4a6b' } },
              left: { style: 'thin', color: { argb: 'FF2a4a6b' } },
              bottom: { style: 'thin', color: { argb: 'FF2a4a6b' } },
              right: { style: 'thin', color: { argb: 'FF2a4a6b' } }
            };
          });
        } else {
          // Style data rows
          excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const originalCellValue = originalRow[colNumber - 1];
            
            // Check if this is an intime/outtime cell with location/remarks
            // IN-TIME is at colNumber 3, 7, 11, etc. (every 4th column starting from 3)
            // OUT-TIME is at colNumber 4, 8, 12, etc. (every 4th column starting from 4)
            const isIntimeColumn = colNumber > 2 && (colNumber - 3) % 4 === 0;
            const isOuttimeColumn = colNumber > 2 && (colNumber - 3) % 4 === 1;
            const isTimeCell = (isIntimeColumn || isOuttimeColumn) && 
                              typeof originalCellValue === 'object' && 
                              originalCellValue !== null && 
                              originalCellValue.value !== undefined;
            
            // Alternate row colors
            const isEvenRow = rowIndex % 2 === 0;
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: isEvenRow ? 'FFFFFFFF' : 'FFF5F5F5' } // White or light gray
            };
            
            // Style NAME column (column 1)
            if (colNumber === 1) {
              cell.font = { bold: true, size: 11, color: { argb: 'FF000000' } };
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isEvenRow ? 'FFE8F4F8' : 'FFD0E8F0' } // Light blue for name
              };
            }
            
            // Style EmployeeId column (column 2)
            else if (colNumber === 2) {
              cell.font = { bold: true, size: 11, color: { argb: 'FF000000' } };
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isEvenRow ? 'FFE8F4F8' : 'FFD0E8F0' } // Light blue for empid
              };
            }
            
            // Style date columns with different colors for each date group
            else if (colNumber > 2) {
              const dateGroupIndex = Math.floor((colNumber - 3) / 4);
              const colors = [
                { argb: 'FFE3F2FD' }, // Light blue
                { argb: 'FFF1F8E9' }, // Light green
                { argb: 'FFFFF3E0' }, // Light orange
                { argb: 'FFFCE4EC' }, // Light pink
                { argb: 'FFF3E5F5' }  // Light purple
              ];
              const colorIndex = dateGroupIndex % colors.length;
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: isEvenRow ? colors[colorIndex] : { argb: 'FFFFFFFF' }
              };
            }
            
            cell.alignment = {
              horizontal: 'center',
              vertical: 'middle'
            };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
              right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
            };
            
            // Set rich text for time cells AFTER styling (so it doesn't get overwritten)
            if (isTimeCell && originalCellValue) {
              const timeValue = originalCellValue.value || '00:00';
              const hasLocation = originalCellValue.hasLocation === true;
              const hasRemarks = originalCellValue.hasRemarks === true;
              
              // Only create rich text if we have indicators
              if (hasLocation || hasRemarks) {
                const richTextParts = [];
                
                // Add time value in black
                richTextParts.push({
                  text: timeValue,
                  font: { size: 11, color: { argb: 'FF000000' } }
                });
                
                // Add green asterisk for location
                if (hasLocation) {
                  richTextParts.push({
                    text: ' *',
                    font: { size: 12, color: { argb: 'FF4CAF50' }, bold: true }
                  });
                }
                
                // Add red asterisk for remarks
                if (hasRemarks) {
                  richTextParts.push({
                    text: ' *',
                    font: { size: 12, color: { argb: 'FFF44336' }, bold: true }
                  });
                }
                
                // Apply rich text - clear font first to avoid conflicts
                cell.font = null;
                cell.value = { richText: richTextParts };
              } else {
                // No indicators, just plain text
                cell.value = timeValue;
              }
            }
          });
        }
      });

      // Merge cells for headers
      // Merge NAME column (A1:A2)
      worksheet.mergeCells(1, 1, 2, 1);
      // Merge EmployeeId column (B1:B2)
      worksheet.mergeCells(1, 2, 2, 2);
      
      // Merge date headers (each date spans 4 columns)
      let colIndex = 3; // Start after NAME and EmployeeId
      attendanceData.dates.forEach(() => {
        // Merge date header across 4 columns in row 1
        worksheet.mergeCells(1, colIndex, 1, colIndex + 3);
        colIndex += 4;
      });

      // Set row heights
      worksheet.getRow(1).height = 25; // First header row
      worksheet.getRow(2).height = 25; // Second header row

      // Generate Excel file buffer
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Create blob and download
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const searchSuffix = debouncedSearchQuery.trim() ? `_filtered` : '';
      link.download = `attendance_history_${currentYear}_${String(currentMonth).padStart(2, '0')}${searchSuffix}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast.error('Failed to export Excel file');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleDownloadSampleExcel = () => {
    // Create sample data with Reason column - use DD-MM-YYYY format for date
    const today = new Date();
    const sampleDate = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
    const sampleData = [
      { empid: '1027', Name: 'John Doe', date: sampleDate, intime: '09:00', outtime: '18:00', Reason: 'Regular attendance' },
      { empid: '1028', Name: 'Jane Smith', date: sampleDate, intime: '09:30', outtime: '18:30', Reason: 'Late arrival' }
    ];

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sample');

    // Download
    XLSX.writeFile(wb, 'attendance_sample.xlsx');
    toast.success('Sample Excel file downloaded');
  };

  const handleUploadExcel = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      event.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          // Read Excel with formatted values enabled to get display text
          const workbook = XLSX.read(data, { type: 'array', cellDates: false, cellNF: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Get JSON data - this will have formatted values where available
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
          
          // Also read raw to get actual cell values for date parsing
          const workbookRaw = XLSX.read(data, { type: 'array', cellDates: false, raw: true });
          const worksheetRaw = workbookRaw.Sheets[firstSheetName];
          const jsonDataRaw = XLSX.utils.sheet_to_json(worksheetRaw, { raw: true, defval: '' });
          
          // Create a map to get formatted date strings from cells
          const getFormattedDate = (rowIndex, dateColName) => {
            try {
              // Find the date column index
              const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
              let dateColIndex = -1;
              
              // Find date column in header
              for (let C = range.s.c; C <= range.e.c; C++) {
                const headerCell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
                if (headerCell && (
                  headerCell.v === 'date' || 
                  headerCell.v === 'Date' ||
                  headerCell.w === 'date' ||
                  headerCell.w === 'Date'
                )) {
                  dateColIndex = C;
                  break;
                }
              }
              
              if (dateColIndex >= 0) {
                const dataRowIndex = range.s.r + 1 + rowIndex; // Header + row index
                const cellAddress = XLSX.utils.encode_cell({ r: dataRowIndex, c: dateColIndex });
                const cell = worksheet[cellAddress];
                if (cell && cell.w) {
                  return cell.w.trim(); // Return formatted text
                }
              }
            } catch (e) {
              console.warn('Error getting formatted date:', e);
            }
            return null;
          };

          // Validate and process data
          const records = [];
          let rowIndex = 1; // Start at 1 because row 0 is header
          for (const row of jsonData) {
            const empid = row.empid || row.EmpID || row['Employee ID'];
            const name = row.Name || row.name || row['Employee Name'];
            let date = row.date || row.Date;
            
            // Try to get formatted date string from cell if available
            // This gives us the date as it appears in Excel (DD-MM-YYYY format)
            const formattedDate = getFormattedDate(rowIndex - 1, 'date'); // rowIndex - 1 because we start at 1
            if (formattedDate && /^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/.test(formattedDate)) {
              date = formattedDate;
              console.log(`Row ${rowIndex}: Using formatted date from cell:`, date);
            }
            
            const intime = row.intime || row['In Time'] || row['InTime'] || row['intime'];
            const outtime = row.outtime || row['Out Time'] || row['OutTime'] || row['outtime'];
            const reason = row.Reason || row.reason || row['Reason'] || '';

            if (!empid || !name || !date || !intime) {
              rowIndex++;
              continue; // Skip invalid rows (at least need empid, name, date, intime)
            }

            // Format date string - handle Excel date serial numbers and various formats
            let dateStr;
            
            // Convert date to string first to handle all cases
            let dateValue = date;
            
            // Debug: Log the original date value and its type
            console.log(`Row ${rowIndex} - Original date value:`, dateValue, 'Type:', typeof dateValue, 'Is Date:', dateValue instanceof Date);
            
            // Priority 1: If it's a string, parse it first (most reliable, no timezone issues)
            if (typeof dateValue === 'string') {
              // Handle different date string formats - this is the most common case
              dateValue = dateValue.trim();
              
              // Try DD-MM-YYYY format first (common in India) - this is the format in sample
              // This is the format: 02-12-2025 (2nd December 2025)
              if (/^\d{2}-\d{2}-\d{4}$/.test(dateValue)) {
                const [day, month, year] = dateValue.split('-');
                // Directly construct YYYY-MM-DD without any Date object conversion
                // This prevents timezone issues - this is the key fix!
                dateStr = `${year}-${month}-${day}`;
                console.log('Parsed DD-MM-YYYY string:', dateValue, '->', dateStr);
              }
              // Try YYYY-MM-DD format
              else if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                dateStr = dateValue;
                console.log('Parsed YYYY-MM-DD string:', dateValue);
              }
              // Try MM/DD/YY format (US format - Excel often converts to this)
              // Examples: 12/2/25, 12/02/25 (December 2, 2025)
              else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(dateValue)) {
                const [month, day, yearShort] = dateValue.split('/');
                // Convert 2-digit year to 4-digit (assume 20XX for years 00-99)
                const year = parseInt(yearShort) < 50 ? `20${yearShort.padStart(2, '0')}` : `19${yearShort.padStart(2, '0')}`;
                dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                console.log('Parsed MM/DD/YY string:', dateValue, '->', dateStr);
              }
              // Try MM/DD/YYYY format (US format)
              // Examples: 12/2/2025, 12/02/2025 (December 2, 2025)
              else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateValue)) {
                const [month, day, year] = dateValue.split('/');
                dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                console.log('Parsed MM/DD/YYYY string:', dateValue, '->', dateStr);
              }
              // Try DD/MM/YYYY format
              else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateValue)) {
                const [day, month, year] = dateValue.split('/');
                dateStr = `${year}-${month}-${day}`;
                console.log('Parsed DD/MM/YYYY string:', dateValue, '->', dateStr);
              }
              // Try DD/MM/YY format
              else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(dateValue)) {
                const parts = dateValue.split('/');
                // Check if first part is > 12 (likely day) or second part is > 12 (likely month)
                const first = parseInt(parts[0]);
                const second = parseInt(parts[1]);
                if (first > 12) {
                  // First is day (DD/MM/YY)
                  const [day, month, yearShort] = parts;
                  const year = parseInt(yearShort) < 50 ? `20${yearShort.padStart(2, '0')}` : `19${yearShort.padStart(2, '0')}`;
                  dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                  console.log('Parsed DD/MM/YY string:', dateValue, '->', dateStr);
                } else if (second > 12) {
                  // Second is day (MM/DD/YY) - already handled above, but just in case
                  const [month, day, yearShort] = parts;
                  const year = parseInt(yearShort) < 50 ? `20${yearShort.padStart(2, '0')}` : `19${yearShort.padStart(2, '0')}`;
                  dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                  console.log('Parsed MM/DD/YY string (ambiguous):', dateValue, '->', dateStr);
                } else {
                  // Ambiguous - assume MM/DD/YY (US format, more common in Excel)
                  const [month, day, yearShort] = parts;
                  const year = parseInt(yearShort) < 50 ? `20${yearShort.padStart(2, '0')}` : `19${yearShort.padStart(2, '0')}`;
                  dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                  console.log('Parsed ambiguous date as MM/DD/YY:', dateValue, '->', dateStr);
                }
              }
              // Try YYYY/MM/DD format
              else if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateValue)) {
                dateStr = dateValue.replace(/\//g, '-');
                console.log('Parsed YYYY/MM/DD string:', dateValue, '->', dateStr);
              }
              // If contains space, take date part
              else if (dateValue.includes(' ')) {
                const datePart = dateValue.split(' ')[0];
                // Check if it's DD-MM-YYYY
                if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
                  const [day, month, year] = datePart.split('-');
                  dateStr = `${year}-${month}-${day}`;
                  console.log('Parsed date with space (DD-MM-YYYY):', datePart, '->', dateStr);
                } else if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                  dateStr = datePart;
                  console.log('Parsed date with space (YYYY-MM-DD):', datePart);
                } else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(datePart)) {
                  // MM/DD/YY format
                  const [month, day, yearShort] = datePart.split('/');
                  const year = parseInt(yearShort) < 50 ? `20${yearShort.padStart(2, '0')}` : `19${yearShort.padStart(2, '0')}`;
                  dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                  console.log('Parsed date with space (MM/DD/YY):', datePart, '->', dateStr);
                } else {
                  console.warn('Cannot parse date string with space:', dateValue);
                  continue; // Skip if can't parse date
                }
              }
              // Try other patterns
              else {
                // First try DD-MM-YYYY pattern
                if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(dateValue)) {
                  const parts = dateValue.split('-');
                  if (parts[0].length <= 2 && parts[1].length <= 2) {
                    // Likely DD-MM-YYYY
                    const [day, month, year] = parts;
                    dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    console.log('Parsed flexible DD-MM-YYYY:', dateValue, '->', dateStr);
                  } else {
                    // Might be YYYY-MM-DD
                    dateStr = dateValue;
                    console.log('Parsed as YYYY-MM-DD:', dateValue);
                  }
                } else {
                  console.warn('Cannot parse date string:', dateValue);
                  continue; // Skip if can't parse date
                }
              }
            }
            // Priority 2: If date is a number (Excel serial date), convert it
            else if (typeof dateValue === 'number') {
              // Excel serial date conversion
              // Excel stores dates as serial numbers where 1 = Jan 1, 1900
              // Excel incorrectly treats 1900 as a leap year (bug), so we need to account for that
              
              // Method: Convert Excel serial to JavaScript Date
              // Excel epoch: Dec 30, 1899 (day 0 in Excel's system)
              // Excel date 1 = Dec 31, 1899, but Excel treats it as Jan 1, 1900
              // So we use: Dec 30, 1899 + (serial - 1) days
              
              // Create base date: Dec 30, 1899 at midnight in local timezone
              const excelEpoch = new Date(1899, 11, 30); // Month is 0-indexed, 11 = December
              
              // Add days (Excel serial - 1) to get the actual date
              // Use setDate to avoid timezone issues
              const jsDate = new Date(excelEpoch);
              jsDate.setDate(jsDate.getDate() + (dateValue - 1));
              
              // Extract date components using LOCAL methods (not UTC)
              // This preserves the date as it appears in Excel
              const year = jsDate.getFullYear();
              const month = String(jsDate.getMonth() + 1).padStart(2, '0');
              const day = String(jsDate.getDate()).padStart(2, '0');
              dateStr = `${year}-${month}-${day}`;
              console.log('Parsed Excel serial number:', dateValue, '->', dateStr);
            }
            // Priority 3: If it's a Date object (Excel might convert dates to Date objects)
            else if (dateValue instanceof Date) {
              // Excel might convert dates to Date objects - extract date parts directly
              // IMPORTANT: Use local date methods, NOT UTC, to avoid timezone shifts
              // The date was entered in local time, so we extract it in local time
              const year = dateValue.getFullYear();
              const month = String(dateValue.getMonth() + 1).padStart(2, '0');
              const day = String(dateValue.getDate()).padStart(2, '0');
              dateStr = `${year}-${month}-${day}`;
              console.log('Parsed Date object:', dateValue.toISOString(), '->', dateStr);
            } else {
              console.warn('Unknown date type:', typeof dateValue, dateValue);
              continue; // Skip if date is not valid
            }
            
            // Validate the final date string format
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              continue; // Skip if date format is still invalid
            }

            // Format intime - ensure it's in HH:MM format
            let intimeStr = intime.toString().trim();
            if (!intimeStr.includes(':')) {
              continue; // Skip if intime format is invalid
            }
            // Ensure proper format (HH:MM or HH:MM:SS)
            const timeParts = intimeStr.split(':');
            if (timeParts.length < 2) {
              continue; // Skip invalid time format
            }
            intimeStr = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;

            // Create intime record - punch_time = date + intime
            records.push({
              employee_id: String(empid),
              employee_name: String(name),
              date: dateStr,
              punchtime: `${dateStr} ${intimeStr}:00`, // Add seconds for proper datetime format
              remarks: reason ? String(reason) : null
            });

            // Create outtime record if outtime is provided
            if (outtime) {
              let outtimeStr = outtime.toString().trim();
              if (outtimeStr.includes(':')) {
                const timeParts = outtimeStr.split(':');
                if (timeParts.length >= 2) {
                  outtimeStr = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
                  records.push({
                    employee_id: String(empid),
                    employee_name: String(name),
                    date: dateStr,
                    punchtime: `${dateStr} ${outtimeStr}:00`,
                    remarks: reason ? String(reason) : null
                  });
                }
              }
            }
            
            // Increment row index for next iteration
            rowIndex++;
          }

          if (records.length === 0) {
            toast.error('No valid records found in Excel file');
            setUploading(false);
            return;
          }

          // Upload to backend
          const response = await api.post('/attendance/upload-excel', { records });
          toast.success(`Successfully uploaded ${records.length} punch records`);
          
          // Refresh data
          fetchAttendanceHistory();
        } catch (error) {
          console.error('Error processing Excel:', error);
          toast.error('Failed to process Excel file: ' + (error.response?.data?.detail || error.message || 'Unknown error'));
        } finally {
          setUploading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error('Failed to read Excel file');
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr || timeStr === '00:00' || timeStr === null) return '00:00';
    // If it's already in HH:MM format, return as is
    if (timeStr.includes(':')) {
      return timeStr;
    }
    return '00:00';
  };

  const handleRowClick = async (employeeId, date) => {
    try {
      setSelectedEmployee(employeeId);
      setSelectedDate(date);
      setLoadingPunchLogs(true);
      setShowPunchLogsModal(true);
      
      // Convert date from dd-mm-yyyy to yyyy-mm-dd
      const [day, month, year] = date.split('-');
      const dateStr = `${year}-${month}-${day}`;
      
      const response = await api.get('/attendance/punch-logs-by-date', {
        params: {
          employee_id: employeeId,
          date: dateStr
        }
      });
      
      setPunchLogsData(response.data || []);
    } catch (error) {
      console.error('Error fetching punch logs:', error);
      toast.error('Failed to fetch punch logs');
      setShowPunchLogsModal(false);
    } finally {
      setLoadingPunchLogs(false);
    }
  };

  const formatPunchTime = (timeStr) => {
    if (!timeStr) return '-';
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return timeStr;
    }
  };

  const formatTimeOnly = (timeStr) => {
    if (!timeStr) return '00:00';
    try {
      const date = new Date(timeStr);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '00:00';
    }
  };

  const fetchPunchLogsForVisibleDates = async () => {
    if (loadingPunchLogsMap) return;
    
    setLoadingPunchLogsMap(true);
    const newMap = { ...punchLogsMap };
    
    try {
      // Collect all requests that need to be made
      const requests = [];
      for (const emp of currentRecords) {
        for (const date of attendanceData.dates) {
          const key = `${emp.employee_id}_${date}`;
          if (!newMap[key]) {
            // Convert date from dd-mm-yyyy to yyyy-mm-dd
            const [day, month, year] = date.split('-');
            const dateStr = `${year}-${month}-${day}`;
            
            requests.push({
              key,
              employee_id: emp.employee_id,
              date: dateStr
            });
          }
        }
      }
      
      // Process requests in batches of 10 to avoid overwhelming the browser
      const batchSize = 10;
      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        
        const batchPromises = batch.map(req =>
          api.get('/attendance/punch-logs-by-date', {
            params: {
              employee_id: req.employee_id,
              date: req.date
            }
          })
            .then(response => {
              newMap[req.key] = response.data || [];
            })
            .catch(() => {
              newMap[req.key] = [];
            })
        );
        
        await Promise.all(batchPromises);
        
        // Update state after each batch to show progress
        setPunchLogsMap({ ...newMap });
        
        // Small delay between batches to prevent overwhelming the server
        if (i + batchSize < requests.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Error fetching punch logs:', error);
    } finally {
      setLoadingPunchLogsMap(false);
    }
  };

  const getIntimeOuttimeFromPunchLogs = (punchLogs) => {
    if (!punchLogs || punchLogs.length === 0) {
      return { 
        intime: '00:00', 
        outtime: '00:00', 
        duration: '00:00', 
        status: 'Abs', 
        intimeHasLocation: false, 
        intimeHasRemarks: false,
        outtimeHasLocation: false, 
        outtimeHasRemarks: false
      };
    }
    
    // Sort by punch_time only
    const sorted = [...punchLogs].sort((a, b) => {
      const timeA = new Date(a.punch_time).getTime();
      const timeB = new Date(b.punch_time).getTime();
      return timeA - timeB;
    });
    
    const numRecords = sorted.length;
    let intimeRecord, outtimeRecord;
    
    if (numRecords === 1) {
      // 1 record: same time for both intime and outtime
      intimeRecord = sorted[0];
      outtimeRecord = sorted[0];
    } else {
      // 2+ records: first = intime, last = outtime
      intimeRecord = sorted[0];
      outtimeRecord = sorted[sorted.length - 1];
    }
    
    const intime = formatTimeOnly(intimeRecord.punch_time);
    const outtime = formatTimeOnly(outtimeRecord.punch_time);
    
    let duration = '00:00';
    let status = 'Abs';
    
    if (numRecords === 1) {
      // 1 record: duration 00:00, status Abs
      duration = '00:00';
      status = 'Abs';
    } else {
      // Calculate duration
      const timeDiff = new Date(outtimeRecord.punch_time) - new Date(intimeRecord.punch_time);
      const hours = timeDiff / (1000 * 60 * 60);
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      duration = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      
      // Calculate status based on hours
      if (hours >= 9) {
        status = 'P';
      } else if (hours >= 4.5) {
        status = 'H/D';
      } else {
        status = 'Abs';
      }
    }
    
    // Check for location and remarks in intime record (first record)
    const intimeHasLocation = intimeRecord.location && intimeRecord.location.trim() !== '';
    const intimeHasRemarks = intimeRecord.remarks && intimeRecord.remarks.trim() !== '';
    
    // Check for location and remarks in outtime record (last record)
    const outtimeHasLocation = outtimeRecord.location && outtimeRecord.location.trim() !== '';
    const outtimeHasRemarks = outtimeRecord.remarks && outtimeRecord.remarks.trim() !== '';
    
    return { 
      intime, 
      outtime, 
      duration, 
      status, 
      intimeHasLocation, 
      intimeHasRemarks,
      outtimeHasLocation, 
      outtimeHasRemarks
    };
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>ATTENDANCE HISTORY</h1>
        <div className="header-buttons" style={{ flexWrap: 'wrap', gap: '2px', alignItems: 'center', width: '100%' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search employee name or ID"
            style={{ minWidth: '220px', flex: '1 1 220px' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="month-year" style={{ display: 'flex', gap: '8px', flex: '0 0 auto' }}>
            <div className="month-picker-wrapper" ref={monthPickerRef} style={{ width: '200px' }}>
              <div 
                className="month-picker-input"
                onClick={() => setShowMonthPicker(!showMonthPicker)}
              >
                <FiCalendar size={18} />
                <span>
                  {new Date(currentYear, currentMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <FiChevronDown size={18} className={showMonthPicker ? 'rotate' : ''} />
              </div>
              {showMonthPicker && (
                <div className="month-picker-dropdown" style={{ zIndex: 1000 }}>
                  <div className="month-picker-header">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentYear(prev => prev - 1);
                        setCurrentPage(1);
                      }}
                      className="month-picker-nav"
                    >
                      ←
                    </button>
                    <span className="month-picker-year">{currentYear}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const currentDate = new Date();
                        const maxYear = currentDate.getFullYear();
                        if (currentYear < maxYear) {
                          setCurrentYear(prev => prev + 1);
                          setCurrentPage(1);
                        }
                      }}
                      className="month-picker-nav"
                      disabled={currentYear >= new Date().getFullYear()}
                    >
                      →
                    </button>
                  </div>
                  <div className="month-picker-grid">
                    {monthNames.map((month, index) => {
                      const currentDate = new Date();
                      const currentYearNow = currentDate.getFullYear();
                      const currentMonthNow = currentDate.getMonth() + 1;
                      const isCurrentMonth = currentYear === currentYearNow && (index + 1) === currentMonthNow;
                      const isFutureMonth = currentYear > currentYearNow || (currentYear === currentYearNow && (index + 1) > currentMonthNow);
                      
                      return (
                        <button
                          key={month}
                          type="button"
                          className={`month-picker-option ${isCurrentMonth ? 'current' : ''} ${currentMonth === (index + 1) ? 'selected' : ''} ${isFutureMonth ? 'disabled' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isFutureMonth) {
                              setCurrentMonth(index + 1);
                              setCurrentPage(1);
                              setShowMonthPicker(false);
                            }
                          }}
                          disabled={isFutureMonth}
                        >
                          {month.substring(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          {user?.role === 'HR' && (
            <div className="header-buttons" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button 
                className="btn-primary" 
                onClick={handleDownloadSampleExcel}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiDownload /> Download Sample
              </button>
              <label 
                className="btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}
              >
                <FiUpload /> {uploading ? 'Uploading...' : 'Upload Excel'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleUploadExcel}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
              <button 
                className="btn-primary" 
                onClick={handleExportExcel}
                disabled={exportingExcel}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <FiDownload /> {exportingExcel ? 'Downloading...' : 'Excel'}
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading attendance history...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="empty-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
            {searchQuery ? 'No employees found matching your search' : 'No attendance records found'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-container" style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 300px)', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <table className="data-table attendance-history-table" style={{ minWidth: '1200px', borderCollapse: 'collapse', width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 100 }}>
              {/* First header row - Date headers spanning 4 columns */}
              <tr style={{ background: '#366092', color: '#FFFFFF' }}>
                <th 
                  rowSpan={2}
                  style={{ 
                    position: 'sticky', 
                    left: 0, 
                    background: '#366092', 
                    zIndex: 102, 
                    minWidth: '150px', 
                    textAlign: 'center',
                    border: '1px solid #2a4a6b',
                    padding: '12px 8px',
                    fontWeight: 600
                  }}
                >
                  NAME
                </th>
                <th 
                  rowSpan={2}
                  style={{ 
                    position: 'sticky', 
                    left: '150px', 
                    background: '#366092', 
                    zIndex: 102, 
                    minWidth: '120px', 
                    textAlign: 'center',
                    border: '1px solid #2a4a6b',
                    padding: '12px 8px',
                    fontWeight: 600
                  }}
                >
                  EmployeeId
                </th>
                {attendanceData.dates.map((date, idx) => {
                  // Convert dd-mm-yyyy to yyyy-mm-dd
                  const [day, month, year] = date.split('-');
                  const dateStr = `${year}-${month}-${day}`;
                  return (
                    <th 
                      key={idx} 
                      colSpan={4}
                      style={{ 
                        minWidth: '200px', 
                        textAlign: 'center', 
                        fontSize: '0.85rem', 
                        fontWeight: 600,
                        border: '1px solid #2a4a6b',
                        padding: '8px 4px',
                        background: '#366092'
                      }}
                    >
                      {dateStr}
                    </th>
                  );
                })}
              </tr>
              {/* Second header row - Column names (IN-TIME, OUT-TIME, DURATION, STATUS) */}
              <tr style={{ background: '#366092', color: '#FFFFFF' }}>
                {attendanceData.dates.map((date, idx) => (
                  <React.Fragment key={idx}>
                    <th style={{ 
                      minWidth: '50px', 
                      textAlign: 'center', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      border: '1px solid #2a4a6b',
                      padding: '8px 4px',
                      background: '#366092'
                    }}>IN-TIME</th>
                    <th style={{ 
                      minWidth: '50px', 
                      textAlign: 'center', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      border: '1px solid #2a4a6b',
                      padding: '8px 4px',
                      background: '#366092'
                    }}>OUT-TIME</th>
                    <th style={{ 
                      minWidth: '50px', 
                      textAlign: 'center', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      border: '1px solid #2a4a6b',
                      padding: '8px 4px',
                      background: '#366092'
                    }}>DURATION</th>
                    <th style={{ 
                      minWidth: '50px', 
                      textAlign: 'center', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      border: '1px solid #2a4a6b',
                      padding: '8px 4px',
                      background: '#366092'
                    }}>STATUS</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentRecords.map((emp, empIdx) => {
                const isLoggedInUser = user && user.empid === emp.employee_id;
                const actualIndex = indexOfFirstRecord + empIdx;
                return (
                  <tr 
                    key={emp.employee_id}
                    style={{ 
                      background: actualIndex % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)',
                      borderBottom: isLoggedInUser ? '2px solid #4CAF50' : `1px solid var(--border-color)`
                    }}
                  >
                    <td style={{ 
                      position: 'sticky', 
                      left: 0, 
                      background: actualIndex % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)', 
                      fontWeight: 600, 
                      zIndex: 10, 
                      padding: '10px 8px',
                      border: `1px solid var(--border-color)`,
                      borderRight: isLoggedInUser ? '2px solid #4CAF50' : `1px solid var(--border-color)`,
                      color: 'var(--text-primary)'
                    }}>
                      {emp.employee_name}
                    </td>
                    <td style={{ 
                      position: 'sticky', 
                      left: '150px', 
                      background: actualIndex % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-hover)', 
                      fontWeight: 600, 
                      zIndex: 10, 
                      textAlign: 'center',
                      padding: '10px 8px',
                      border: `1px solid var(--border-color)`,
                      borderRight: isLoggedInUser ? '2px solid #4CAF50' : `1px solid var(--border-color)`,
                      color: 'var(--text-primary)'
                    }}>
                      {emp.employee_id}
                    </td>
                    {attendanceData.dates.map((date, idx) => {
                      const dayData = emp.dates[date];
                      const key = `${emp.employee_id}_${date}`;
                      const punchLogs = punchLogsMap[key] || [];
                      
                      // Get intime/outtime from punch logs using new logic
                      const punchData = getIntimeOuttimeFromPunchLogs(punchLogs);
                      
                      // Priority: Backend status (Holiday/WO/Leave) > Punch log calculated status (P/Abs/H/D)
                      // Backend filters holidays by employee's branch_id (defaults to 1 if null)
                      // If backend returns special status (Holiday/WO/Leave), use it; otherwise use punch log status
                      const backendStatus = dayData?.status;
                      const isSpecialStatus = backendStatus && 
                        ['HOLIDAY', 'WO', 'SICK', 'CASUAL', 'ANNUAL', 'EMERGENCY', 'OTHER', 'SL', 'CL', 'AL'].includes(backendStatus.toUpperCase());
                      
                      // Use punch logs data if available, otherwise fall back to dayData
                      const checkIn = punchLogs.length > 0 ? punchData.intime : formatTime(dayData?.check_in || '00:00');
                      const checkOut = punchLogs.length > 0 ? punchData.outtime : formatTime(dayData?.check_out || '00:00');
                      const duration = punchLogs.length > 0 ? punchData.duration : formatDuration(dayData?.hours || 0);
                      
                      // Status priority: Backend special status > Punch log calculated status > Default
                      let status;
                      if (isSpecialStatus) {
                        // Use backend status (Holiday/WO/Leave) - filtered by branch_id
                        status = backendStatus;
                      } else if (punchLogs.length > 0) {
                        // Use punch log calculated status (P/Abs/H/D)
                        status = punchData.status;
                      } else {
                        // Use backend status or calculate from hours
                        status = getStatusDisplay(dayData?.status, dayData?.hours);
                      }
                      
                      // Check location and remarks for intime (first record) and outtime (last record)
                      const intimeHasLocation = punchData.intimeHasLocation;
                      const intimeHasRemarks = punchData.intimeHasRemarks;
                      const outtimeHasLocation = punchData.outtimeHasLocation;
                      const outtimeHasRemarks = punchData.outtimeHasRemarks;
                      
                      // Check if this is a leave day (status is a leave type) - leaves show 00:00
                      const isLeaveDay = status && ['SICK', 'CASUAL', 'ANNUAL', 'EMERGENCY', 'OTHER', 'SL', 'CL', 'AL'].includes(status.toUpperCase());
                      
                      // Check if this is a holiday or week-off - these show attendance times if available
                      const isHolidayOrWeekOff = status && ['HOLIDAY', 'WO'].includes(status.toUpperCase());
                      
                      return (
                        <React.Fragment key={idx}>
                          <td 
                            onClick={() => handleRowClick(emp.employee_id, date)}
                            style={{ 
                              textAlign: 'center', 
                              padding: '10px 4px', 
                              fontSize: '0.85rem',
                              border: `1px solid var(--border-color)`,
                              color: (checkIn === '00:00' || isLeaveDay) ? 'var(--text-muted)' : 'var(--text-primary)',
                              fontWeight: (checkIn === '00:00' || isLeaveDay) ? 400 : 500,
                              cursor: 'pointer'
                            }}
                          >
                            {/* For leaves: show 00:00. For holidays/week-offs: show attendance times if available */}
                            {isLeaveDay ? '00:00' : (
                              <>
                                {checkIn}
                                {intimeHasLocation && (
                                  <span style={{ color: '#4CAF50', fontWeight: 700, fontSize: '1.2rem', marginLeft: '4px' }}>*</span>
                                )}
                                {intimeHasRemarks && (
                                  <span style={{ color: '#F44336', fontWeight: 700, fontSize: '1.2rem', marginLeft: '4px' }}>*</span>
                                )}
                              </>
                            )}
                          </td>
                          <td 
                            onClick={() => handleRowClick(emp.employee_id, date)}
                            style={{ 
                              textAlign: 'center', 
                              padding: '10px 4px', 
                              fontSize: '0.85rem',
                              border: `1px solid var(--border-color)`,
                              color: (checkOut === '00:00' || isLeaveDay) ? 'var(--text-muted)' : 'var(--text-primary)',
                              fontWeight: (checkOut === '00:00' || isLeaveDay) ? 400 : 500,
                              cursor: 'pointer'
                            }}
                          >
                            {/* For leaves: show 00:00. For holidays/week-offs: show attendance times if available */}
                            {isLeaveDay ? '00:00' : (
                              <>
                                {checkOut}
                                {outtimeHasLocation && (
                                  <span style={{ color: '#4CAF50', fontWeight: 700, fontSize: '1.2rem', marginLeft: '4px' }}>*</span>
                                )}
                                {outtimeHasRemarks && (
                                  <span style={{ color: '#F44336', fontWeight: 700, fontSize: '1.2rem', marginLeft: '4px' }}>*</span>
                                )}
                              </>
                            )}
                          </td>
                          <td 
                            onClick={() => handleRowClick(emp.employee_id, date)}
                            style={{ 
                              textAlign: 'center', 
                              padding: '10px 4px', 
                              fontSize: '0.85rem',
                              border: `1px solid var(--border-color)`,
                              color: (duration === '00:00' || isLeaveDay) ? 'var(--text-muted)' : 'var(--text-primary)',
                              fontWeight: (duration === '00:00' || isLeaveDay) ? 400 : 500,
                              cursor: 'pointer'
                            }}
                          >
                            {/* For leaves: show 00:00. For holidays/week-offs: show duration if available */}
                            {isLeaveDay ? '00:00' : duration}
                          </td>
                          <td 
                            onClick={() => handleRowClick(emp.employee_id, date)}
                            style={{ 
                              textAlign: 'center', 
                              padding: '10px 4px', 
                              fontSize: '0.85rem',
                              border: `1px solid var(--border-color)`,
                              cursor: 'pointer'
                            }}
                          >
                            {status ? (
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: getStatusColor(status),
                                color: '#FFFFFF'
                              }}>
                                {status}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <div className="pagination-info">
              Showing {indexOfFirstRecord + 1} to {Math.min(indexOfLastRecord, filteredEmployees.length)} of {filteredEmployees.length} employees
            </div>
            <div className="pagination-controls">
              <button 
                className="pagination-btn"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <FiChevronLeft />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </button>
              ))}
              <button 
                className="pagination-btn"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
        )}
      </>
      )}

      {/* Punch Logs Modal */}
      {showPunchLogsModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowPunchLogsModal(false)}
        >
          <div 
            style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Punch Logs Details
              </h2>
              <button
                onClick={() => setShowPunchLogsModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  color: 'var(--text-secondary)',
                  padding: '4px 8px'
                }}
              >
                <FiX />
              </button>
            </div>
            
            {selectedDate && selectedEmployee && (
              <div style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <div><strong>Employee ID:</strong> {selectedEmployee}</div>
                <div><strong>Date:</strong> {selectedDate}</div>
              </div>
            )}

            {loadingPunchLogs ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Loading punch logs...</p>
              </div>
            ) : punchLogsData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                <p>No punch logs found for this date</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(() => {
                  // Sort punch logs by punch_time only (ignore punch_type)
                  const sortedLogs = [...punchLogsData].sort((a, b) => {
                    const timeA = new Date(a.punch_time).getTime();
                    const timeB = new Date(b.punch_time).getTime();
                    return timeA - timeB;
                  });
                  
                  return sortedLogs.map((log, idx) => {
                    const hasImage = log.image && log.image.trim() !== '';
                    const hasLocation = log.location && log.location.trim() !== '';
                    const isFirst = idx === 0;
                    const isLast = idx === sortedLogs.length - 1;
                    const punchLabel = isFirst ? 'Intime' : isLast ? 'Outtime' : '';
                    
                    return (
                      <div
                        key={idx}
                        style={{
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '16px',
                          background: 'var(--bg-hover)'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                          {hasImage ? (
                            <img
                              src={log.image.startsWith('data:') ? log.image : `data:image/jpeg;base64,${log.image}`}
                              alt="Punch"
                              style={{
                                width: '100px',
                                height: '100px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)'
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '100px',
                                height: '100px',
                                borderRadius: '8px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-muted)',
                                fontSize: '0.8rem',
                                textAlign: 'center',
                                padding: '8px'
                              }}
                            >
                              Empty
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ marginBottom: '8px' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>Time:</strong>{' '}
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {formatPunchTime(log.punch_time)}
                              </span>
                            </div>
                            {(isFirst || isLast) && (
                              <div style={{ marginBottom: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Type:</strong>{' '}
                                <span style={{ 
                                  color: isFirst ? '#4CAF50' : '#2196F3',
                                  textTransform: 'uppercase',
                                  fontWeight: 600
                                }}>
                                  {punchLabel}
                                </span>
                              </div>
                            )}
                            <div>
                              <strong style={{ color: 'var(--text-primary)' }}>Location:</strong>{' '}
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {hasLocation ? log.location : 'Device Punch'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceHistory;
