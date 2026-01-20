import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api, { attendanceAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { FiClock, FiCamera, FiX, FiChevronLeft, FiChevronRight, FiCalendar, FiChevronDown } from 'react-icons/fi';
import '../employee/Employee.css';
import './Punch.css';

const Punch = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [todayPunches, setTodayPunches] = useState([]);
  const [punchHistory, setPunchHistory] = useState([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // total for today
  const [baseElapsed, setBaseElapsed] = useState(0); // completed elapsed (seconds)
  const [runningStart, setRunningStart] = useState(null); // Date when current run started
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [weekOffDates, setWeekOffDates] = useState([]);
  const [location, setLocation] = useState(null);
  const [locationName, setLocationName] = useState(null);
  const [coordinates, setCoordinates] = useState(null);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const geocodingAttemptedRef = useRef(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [isDetectingFace, setIsDetectingFace] = useState(false);
  const detectionIntervalRef = useRef(null);
  const [showPunchLogsModal, setShowPunchLogsModal] = useState(false);
  const [punchLogsData, setPunchLogsData] = useState([]);
  const [loadingPunchLogs, setLoadingPunchLogs] = useState(false);
  const [selectedDateForModal, setSelectedDateForModal] = useState(null);
  const [attendanceCycle, setAttendanceCycle] = useState(null);
  const [lateLogTime, setLateLogTime] = useState(null);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchTodayPunches();
    fetchPunchHistory();
    fetchLeaves();
    fetchWeekOffDates();
    fetchAttendanceCycle();
    const initLocation = async () => {
      await fetchGoogleMapsApiKey();
      getCurrentLocation();
    };
    initLocation();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Re-try geocoding when coordinates change
  useEffect(() => {
    // Reset geocoding attempt flag when coordinates change
    geocodingAttemptedRef.current = false;
    
    const performGeocoding = async () => {
      // Only geocode once per coordinate change
      if (!coordinates || locationName || isGeocoding || geocodingAttemptedRef.current) {
        return;
      }
      
      geocodingAttemptedRef.current = true;
      
      let apiKey = googleMapsApiKey;
      
      // Try to fetch from backend if not available
      if (!apiKey) {
        apiKey = await fetchGoogleMapsApiKey();
      }
      
      // API key should be set in backend .env file
      if (!apiKey) {
        console.warn('Google Maps API key not found. Please set GOOGLE_MAPS_API_KEY in backend .env file');
        return;
      }
      
      if (apiKey) {
        const [lat, lng] = coordinates.split(',').map(c => parseFloat(c.trim()));
        if (!isNaN(lat) && !isNaN(lng)) {
          await reverseGeocode(lat, lng, apiKey);
        }
      }
    };
    
    // Small delay to ensure state is settled
    const timeoutId = setTimeout(() => {
      performGeocoding();
    }, 500);
    
    return () => clearTimeout(timeoutId);
    // Only run when coordinates change - don't include other dependencies to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates]);

  useEffect(() => {
    if (runningStart) {
      timerIntervalRef.current = setInterval(() => {
        const now = new Date();
        const running = Math.max(0, Math.floor((now - runningStart) / 1000));
        setElapsedSeconds(baseElapsed + running);
      }, 1000);
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [runningStart, baseElapsed]);

  useEffect(() => {
    fetchPunchHistory();
    // fetchLeaves and fetchWeekOffDates are now handled in fetchPunchHistory
  }, [selectedMonth, selectedYear]);

  // Close month picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMonthPicker && !event.target.closest('.month-picker-wrapper')) {
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

  const fetchLeaves = async () => {
    try {
      const response = await api.get('/leaves/self');
      setLeaves(response.data || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      setLeaves([]);
    }
  };

  const fetchWeekOffDates = async () => {
    try {
      const response = await api.get(`/week-offs/dates?employee_id=${user?.empid}&month=${selectedMonth + 1}&year=${selectedYear}`);
      const dates = response.data || [];
      setWeekOffDates(dates.map(d => d.date || d));
    } catch (error) {
      console.error('Error fetching week off dates:', error);
      setWeekOffDates([]);
    }
  };

  const fetchAttendanceCycle = async () => {
    try {
      const response = await attendanceAPI.getCycle();
      if (response.data) {
        setAttendanceCycle(response.data);
        setLateLogTime(response.data.late_log_time || '09:45');
      }
    } catch (error) {
      console.error('Error fetching attendance cycle:', error);
      // Default to 09:45 if cycle not found
      setLateLogTime('09:45');
    }
  };

  const fetchGoogleMapsApiKey = async () => {
    try {
      const response = await api.get('/config/google-maps-key');
      const apiKey = response.data?.api_key;
      if (apiKey && apiKey.trim() !== '') {
        setGoogleMapsApiKey(apiKey);
        return apiKey;
      } else {
        // Don't log warning repeatedly - just return null and use fallback
        return null;
      }
    } catch (error) {
      // Don't log error repeatedly - just return null and use fallback
      return null;
    }
  };

  const reverseGeocode = async (latitude, longitude, apiKey) => {
    if (!apiKey) {
      // Try to fetch API key again, or use fallback
      const fetchedKey = await fetchGoogleMapsApiKey();
      if (fetchedKey) {
        apiKey = fetchedKey;
      } else {
        // API key should be set in backend .env file
        console.warn('Google Maps API key not found. Please set GOOGLE_MAPS_API_KEY in backend .env file');
        return;
      }
    }
    
    setIsGeocoding(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const address = data.results[0].formatted_address;
        setLocationName(address);
        setLocation(address);
        setIsGeocoding(false);
        return address;
      } else {
        // If geocoding failed, just use coordinates
        const coordString = `${latitude}, ${longitude}`;
        setLocationName(null);
        setLocation(coordString);
        setIsGeocoding(false);
        return coordString;
      }
    } catch (error) {
      // If error occurs, just use coordinates
      const coordString = `${latitude}, ${longitude}`;
      setLocationName(null);
      setLocation(coordString);
      setIsGeocoding(false);
      return coordString;
    }
  };

  const getCurrentLocation = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          // Set coordinates first
          const coordString = `${latitude}, ${longitude}`;
          setCoordinates(coordString);
          
          // Always try to get API key and geocode
          let apiKey = googleMapsApiKey;
          if (!apiKey) {
            apiKey = await fetchGoogleMapsApiKey();
          }
          
          // API key should be set in backend .env file
          if (!apiKey) {
            console.warn('Google Maps API key not found. Please set GOOGLE_MAPS_API_KEY in backend .env file');
            return;
          }
          
          // Always try to geocode
          await reverseGeocode(latitude, longitude, apiKey);
        },
        (error) => {
          console.error('Error getting geolocation:', error);
          setCoordinates(null);
          setLocationName(null);
          setLocation('Location not available');
          setIsGeocoding(false);
        }
      );
    } else {
      setCoordinates(null);
      setLocationName(null);
      setLocation('Geolocation not supported');
      setIsGeocoding(false);
    }
  };

  const fetchTodayPunches = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      // Fetch punch logs directly (ordered by punch_time only, not punch_type)
      const response = await api.get(`/attendance/punch-logs-by-date`, {
        params: {
          employee_id: user?.empid,
          date: today
        }
      });
      const punchLogs = response.data || [];
      
      // Group by punch_time only (first is in, last is out)
      const groupedPunches = [];
      if (punchLogs.length > 0) {
        // Sort by punch_time
        const sortedLogs = [...punchLogs].sort((a, b) => 
          new Date(a.punch_time) - new Date(b.punch_time)
        );
        
        // First record is intime, last record is outtime
        const firstLog = sortedLogs[0];
        const lastLog = sortedLogs.length > 1 ? sortedLogs[sortedLogs.length - 1] : firstLog;
        
        groupedPunches.push({
          id: firstLog.id,
          check_in: firstLog.punch_time,
          check_in_image: firstLog.image,
          check_out: lastLog.punch_time !== firstLog.punch_time ? lastLog.punch_time : null,
          check_out_image: lastLog.punch_time !== firstLog.punch_time ? lastLog.image : null,
          status: firstLog.status || 'present'
        });
      }
      
      setTodayPunches(groupedPunches);
      let total = 0;
      let openStart = null;
      groupedPunches.forEach(p => {
        if (p.check_in && p.check_out) {
          total += Math.max(0, (new Date(p.check_out) - new Date(p.check_in)) / 1000);
        } else if (p.check_in && !p.check_out) {
          openStart = new Date(p.check_in);
        }
      });
      setBaseElapsed(Math.max(0, Math.floor(total)));
      if (openStart) {
        setRunningStart(openStart);
        const now = new Date();
        setElapsedSeconds(Math.max(0, Math.floor(total + (now - openStart) / 1000)));  
      } else {
        setRunningStart(null);
        setElapsedSeconds(Math.max(0, Math.floor(total)));
      }
    } catch (error) {
      setTodayPunches([]);
      setElapsedSeconds(0);
      setBaseElapsed(0);
      setRunningStart(null);
    }
  };

  const fetchPunchHistory = async () => {
    try {
      const response = await api.get(`/attendance/punch-calendar?month=${selectedMonth + 1}&year=${selectedYear}`);
      const data = response.data || [];
      setPunchHistory(data);
      
      // Extract week off dates, holidays, and leaves from calendar data
      const woDates = [];
      const holidayDates = {};
      const leaveDates = {};
      
      data.forEach(day => {
        if (day.week_off) {
          woDates.push(day.date);
        }
        if (day.holiday) {
          holidayDates[day.date] = day.holiday;
        }
        if (day.leave_type) {
          leaveDates[day.date] = day.leave_type;
        }
      });
      
      setWeekOffDates(woDates);
    } catch (error) {
      console.error('Error fetching punch history:', error);
      setPunchHistory([]);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Start face detection once video is playing
        videoRef.current.onloadedmetadata = () => {
          startFaceDetection();
        };
      }
    } catch (error) {
      toast.error('Failed to access camera');
      console.error('Camera error:', error);
    }
  };

  const startFaceDetection = async () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    
    setIsDetectingFace(true);
    setFaceDetected(false);
    
    // Start detection loop
    detectionIntervalRef.current = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        if (window.FaceDetector) {
          // Use native FaceDetector API if available (Chrome/Edge)
          try {
            const faceDetector = new window.FaceDetector({ fastMode: true });
            const faces = await faceDetector.detect(videoRef.current);
            setFaceDetected(faces.length > 0);
          } catch (error) {
            detectFaceBasic();
          }
        } else {
          // Fallback to basic detection
          detectFaceBasic();
        }
      }
    }, 300);
  };

  const detectFaceBasic = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Improved face detection using skin tone and feature analysis
    let faceScore = 0;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const centerRadius = Math.min(canvas.width, canvas.height) * 0.25;
    
    // Check center area for face-like features
    const sampleRate = 5; // Sample every 5 pixels for better performance
    for (let y = centerY - centerRadius; y < centerY + centerRadius; y += sampleRate) {
      for (let x = centerX - centerRadius; x < centerX + centerRadius; x += sampleRate) {
        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
          const idx = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          // Improved skin tone detection
          if (r > 95 && g > 40 && b > 20 && 
              Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
              Math.abs(r - g) > 15 && r > g && r > b &&
              r < 250 && g < 250 && b < 250) {
            faceScore++;
          }
        }
      }
    }
    
    // Threshold for face detection
    const sampleCount = ((centerRadius * 2 / sampleRate) * (centerRadius * 2 / sampleRate));
    const threshold = sampleCount * 0.15; // 15% of samples should match skin tone
    const detected = faceScore > threshold;
    
    setFaceDetected(detected);
  };

  const stopCamera = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setFaceDetected(false);
    setIsDetectingFace(false);
  };

  const captureImage = () => {
    if (!faceDetected) {
      toast.error('Please position your face in the camera. Face not detected.');
      return;
    }
    
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      // Flip the image back to normal when capturing (mirror the canvas context)
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);
      stopCamera();
    }
  };

  const handlePunchClick = () => {
    setShowCameraModal(true);
    setCapturedImage(null);
    startCamera();
  };

  const handleCancelCamera = () => {
    stopCamera();
    setShowCameraModal(false);
    setCapturedImage(null);
  };

  const handleSubmitPunch = async (punchType) => {
    if (!capturedImage) {
      toast.error('Please capture an image first');
      return;
    }

    setLoading(true);
    try {
      // Get location again before submitting if not available
      let locationToSend = locationName || location;
      if (!locationToSend || locationToSend === 'Getting location...' || locationToSend === 'Location not available') {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              try {
                if (googleMapsApiKey) {
                  locationToSend = await reverseGeocode(latitude, longitude, googleMapsApiKey);
                } else {
                  // Try to fetch API key if not available
                  const apiKey = await fetchGoogleMapsApiKey();
                  if (apiKey) {
                    locationToSend = await reverseGeocode(latitude, longitude, apiKey);
                  } else {
                    locationToSend = `${latitude}, ${longitude}`;
                    setLocation(locationToSend);
                  }
                }
                resolve();
              } catch (error) {
                locationToSend = `${latitude}, ${longitude}`;
                setLocation(locationToSend);
                resolve();
              }
            },
            () => {
              locationToSend = 'Location not available';
              resolve();
            }
          );
        });
      }
      
      // Extract base64 string from data URL if needed
      let imageToSend = capturedImage;
      if (capturedImage && capturedImage.startsWith('data:image')) {
        // Extract base64 part from data URL (format: data:image/jpeg;base64,<base64string>)
        imageToSend = capturedImage.split(',')[1] || capturedImage;
      }
      
      const response = await api.post(`/attendance/punch-${punchType}`, {
        image: imageToSend || null,
        location: locationToSend || coordinates || 'Location not available'
      });
      
      toast.success(`Punched ${punchType === 'in' ? 'In' : 'Out'} successfully`);
      setShowCameraModal(false);
      setCapturedImage(null);
      fetchTodayPunches();
      fetchPunchHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to punch ${punchType}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      month: 'short',
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatTimeOnly = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
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

  const handleDateClick = async (dateStr) => {
    try {
      setSelectedDateForModal(dateStr);
      setLoadingPunchLogs(true);
      setShowPunchLogsModal(true);
      
      const response = await api.get('/attendance/punch-logs-by-date', {
        params: {
          employee_id: user?.empid,
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

  const isAnniversaryDate = (dateStr) => {
    if (!user?.doj) return false;
    const doj = new Date(user.doj);
    const checkDate = new Date(dateStr);
    return doj.getMonth() === checkDate.getMonth() && doj.getDate() === checkDate.getDate();
  };

  const isBirthdayDate = (dateStr) => {
    if (!user?.dob) return false;
    const dob = new Date(user.dob);
    const checkDate = new Date(dateStr);
    return dob.getMonth() === checkDate.getMonth() && dob.getDate() === checkDate.getDate();
  };

  const getCalendarStatus = (dayData, dateStr) => {
    // Priority: Week-Off > Leave > Holiday > Attendance
    
    // Check if it's a week off (WO takes priority)
    if (dayData?.week_off || weekOffDates.includes(dateStr)) {
      return { 
        status: 'WO', 
        color: '#8b5cf6', 
        cls: 'cal-weekoff',
        week_off: true,
        label: dayData?.week_off || 'Week-Off'
      };
    }
    
    // Check if it's a leave
    if (dayData?.leave_type) {
      const leaveType = dayData.leave_type;
      return { 
        status: leaveType?.substring(0, 3).toUpperCase() || 'L', 
        color: '#3b82f6', 
        cls: 'cal-leave', 
        leaveType: leaveType 
      };
    }
    
    // Check if it's a holiday
    if (dayData?.holiday) {
      return { 
        status: 'H', 
        color: '#f59e0b', 
        cls: 'cal-holiday',
        holidayName: dayData.holiday
      };
    }
    
    // Calculate status based on hours (Max - Min time)
    // Hours already calculated in backend from punch logs
    if (!dayData || dayData.hours === undefined || dayData.hours === null) {
      return { status: 'Abs', color: '#ef4444', cls: 'cal-abs' };
    }
    
    const hours = parseFloat(dayData.hours);
    if (hours >= 9) {
      return { status: 'P', color: '#10b981', cls: 'cal-present' };
    } else if (hours >= 4.5) {
      return { status: 'H/D', color: '#f59e0b', cls: 'cal-half' };
    } else {
      return { status: 'Abs', color: '#ef4444', cls: 'cal-abs' };
    }
  };

  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  // Helper function to compare time strings in HH:MM format
  const compareTimes = (time1, time2) => {
    if (!time1 || !time2) return false;
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    const total1 = h1 * 60 + m1;
    const total2 = h2 * 60 + m2;
    return total1 > total2;
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const firstDay = getFirstDayOfMonth(selectedMonth, selectedYear);
    const days = [];
    
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = punchHistory.find(h => h.date === dateStr);
      const status = getCalendarStatus(dayData, dateStr);
      const isAnniversary = isAnniversaryDate(dateStr);
      const isBirthday = isBirthdayDate(dateStr);
      
      // Get intime (first) and outtime (last) from punch logs
      let intime = null;
      let outtime = null;
      let duration = null;
      
      if (dayData && dayData.min_time && dayData.max_time) {
        intime = dayData.min_time;
        outtime = dayData.max_time;
        // Calculate duration in HH:MM format
        if (dayData.hours !== undefined && dayData.hours !== null) {
          const hours = parseFloat(dayData.hours);
          const h = Math.floor(hours);
          const m = Math.floor((hours - h) * 60);
          duration = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
      } else if (status.cls === 'cal-weekoff' || status.cls === 'cal-leave' || status.cls === 'cal-holiday') {
        intime = '00:00';
        outtime = '00:00';
        duration = '00:00';
      }
      
      // Check if intime > late_log_time (only for days with intime, not week-off/holiday/leave)
      const isLateLogin = intime && intime !== '00:00' && lateLogTime && compareTimes(intime, lateLogTime) &&
                          !status.week_off && !status.holidayName && !status.leaveType;
      
      days.push(
        <div 
          key={day} 
          className={`calendar-day ${status.cls}`} 
          onClick={() => handleDateClick(dateStr)}
          style={{
            background: status.cls === 'cal-present' ? 'rgba(16, 185, 129, 0.1)' :
                       status.cls === 'cal-half' ? 'rgba(245, 158, 11, 0.1)' :
                       status.cls === 'cal-abs' ? 'rgba(239, 68, 68, 0.1)' :
                       status.cls === 'cal-weekoff' ? 'rgba(139, 92, 246, 0.1)' :
                       status.cls === 'cal-leave' ? 'rgba(59, 130, 246, 0.1)' :
                       status.cls === 'cal-holiday' ? 'rgba(245, 158, 11, 0.1)' :
                       'var(--bg-hover)',
            borderColor: isAnniversary ? '#ff6b6b' : isBirthday ? '#4ecdc4' : status.color,
            borderWidth: isAnniversary || isBirthday ? '3px' : '2px',
            cursor: 'pointer',
            position: 'relative',
            animation: (isAnniversary || isBirthday) ? 'celebrate 2s infinite' : 'none',
            boxShadow: (isAnniversary || isBirthday) ? (isAnniversary ? '0 0 20px rgba(255, 107, 107, 0.9)' : '0 0 20px rgba(78, 205, 196, 0.9)') : 'none',
            transform: (isAnniversary || isBirthday) ? 'scale(1)' : 'none',
            overflow: 'visible'
          }}>
          {(isAnniversary || isBirthday) && (
            <>
              {/* Animated GIF Background */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                height: '100%',
                zIndex: 1,
                pointerEvents: 'none',
                opacity: 0.6,
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <img 
                  src={isAnniversary ? 'https://i.pinimg.com/originals/89/f2/67/89f267bef0f5538b1fbe206b065a6724.gif' : 'https://lovenamepix.com/images/full/celebrate-digitally-with-classy-happy-birthday-gifs-to-share-anywhere-love-name-pix-2ddf.gif'}
                  alt={isAnniversary ? 'Anniversary' : 'Birthday'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                  onError={(e) => {
                    console.error('GIF failed to load:', e.target.src);
                    e.target.style.display = 'none';
                  }}
                  onLoad={() => {
                   
                  }}
                />
              </div>
              
              {/* Floating Emoji */}
              <div style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                fontSize: '1.5rem',
                fontWeight: 700,
                zIndex: 15,
                animation: 'float 2s ease-in-out infinite',
                filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.8))'
              }}>
                {isAnniversary ? '🎉' : '🎂'}
              </div>
              
              {/* Sparkle Effects */}
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: `${20 + i * 15}%`,
                    left: `${15 + i * 20}%`,
                    width: '8px',
                    height: '8px',
                    background: isAnniversary ? '#ff6b6b' : '#4ecdc4',
                    borderRadius: '50%',
                    zIndex: 12,
                    animation: `sparkle 1.5s ease-in-out infinite`,
                    animationDelay: `${i * 0.2}s`,
                    boxShadow: `0 0 10px ${isAnniversary ? '#ff6b6b' : '#4ecdc4'}`
                  }}
                />
              ))}
            </>
          )}
          <div className="calendar-day-number" style={{ 
            fontSize: '1.2rem', 
            fontWeight: 700, 
            color: 'var(--text-primary)',
            marginBottom: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            position: 'relative',
            zIndex: 5
          }}>
            <span className="calendar-date-number">{day}</span>
            <div className="calendar-status-mobile" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isLateLogin && (
                <span style={{ 
                  fontSize: '1rem',
                  color: '#eab308',
                  fontWeight: 700
                }}>★</span>
              )}
              <span className="calendar-status-text" style={{ 
                color: status.color, 
                fontWeight: 700,
                fontSize: '1.1rem'
              }}>
                {status.status}
              </span>
            </div>
          </div>
          <div className="calendar-day-info" style={{ width: '100%', gap: '2px', position: 'relative', zIndex: 5 }}>
            {/* Show intime and outtime on desktop, hidden on mobile */}
            {intime && outtime && (
              <div className="calendar-time-info" style={{ 
                fontSize: '0.65rem', 
                color: 'var(--text-secondary)', 
                fontWeight: 500,
                lineHeight: '1.3',
                textAlign: 'center',
                width: '100%',
                marginBottom: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', width: '100%' }}>
                  <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.7rem' }}>{intime}</span>
                  <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.7rem' }}>{outtime}</span>
                </div>
                {duration && (
                  <div style={{ 
                    color: 'var(--text-primary)', 
                    fontWeight: 600,
                    marginTop: '2px',
                    fontSize: '0.85rem'
                  }}>
                    {duration}
                  </div>
                )}
              </div>
            )}
            {/* Show week off/holiday/leave labels */}
            <div className="calendar-labels-mobile">
              {status.week_off && (
                <div style={{ fontSize: '0.7rem', color: status.color, fontWeight: 600, marginTop: '2px', textAlign: 'center' }}>
                  {status.label || 'Week-Off'}
                </div>
              )}
              {status.holidayName && (
                <div style={{ fontSize: '0.7rem', color: status.color, fontWeight: 600, marginTop: '2px', textAlign: 'center' }}>
                  {status.holidayName}
                </div>
              )}
              {status.leaveType && (
                <div style={{ fontSize: '0.7rem', color: status.color, fontWeight: 600, marginTop: '2px', textAlign: 'center' }}>
                  {status.leaveType}
                </div>
              )}
              {/* If no special status and no time, show status */}
              {!status.week_off && !status.holidayName && !status.leaveType && !intime && !outtime && (
                <div style={{ 
                  fontSize: '0.7rem', 
                  color: status.color, 
                  fontWeight: 600,
                  textAlign: 'center',
                  marginTop: '2px'
                }}>
                  {status.status}
                </div>
              )}
              {isAnniversary && (
                <div style={{ fontSize: '0.65rem', color: '#ff6b6b', fontWeight: 600, marginTop: '2px', textAlign: 'center' }}>
                  Anniversary
                </div>
              )}
              {isBirthday && (
                <div style={{ fontSize: '0.65rem', color: '#4ecdc4', fontWeight: 600, marginTop: '2px', textAlign: 'center' }}>
                  Birthday
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    
    return days;
  };

  const targetSeconds = 9 * 3600;
  const progressRatio = Math.min(1, elapsedSeconds / targetSeconds);
  const firstPunchTime = todayPunches.length > 0 ? todayPunches[0]?.check_in : null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h1>MARK ATTENDANCE</h1>
          {user && user.role === 'Employee' && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '8px 16px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
              borderRadius: '8px',
              border: '1px solid rgba(99, 102, 241, 0.2)'
            }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                Employee({user.empid || 'UL'})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Location Card - Display at Top */}
      <div className="location-card" style={{ 
        width: '100%', 
        marginBottom: '24px',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          marginBottom: '16px' 
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '20px' }}>📍</span>
          </div>
          <h3 style={{ 
            margin: 0,
            fontSize: '1.1rem', 
            fontWeight: 700, 
            color: 'var(--text-primary)',
            letterSpacing: '0.3px'
          }}>
            Current Location
          </h3>
        </div>
        {coordinates ? (
          <>
            {locationName ? (
              <>
                <div style={{ 
                  padding: '16px 20px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-hover)',
                  wordBreak: 'break-word',
                  lineHeight: '1.6',
                  transition: 'all 0.2s ease',
                  marginBottom: '12px',
                }}>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-secondary)', 
                    fontWeight: 500,
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Address
                  </div>
                  <div style={{ 
                    fontSize: '1rem', 
                    color: 'var(--text-primary)', 
                    fontWeight: 600,
                  }}>
                    {locationName}
                  </div>
                </div>
                {/* Show coordinates in mobile view */}
                <div className="location-coordinates-mobile" style={{ 
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-hover)',
                  display: 'none', // Hidden on desktop, shown on mobile via CSS
                }}>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-secondary)', 
                    fontWeight: 500,
                    marginBottom: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Coordinates
                  </div>
                  <div style={{ 
                    fontSize: '0.85rem', 
                    color: 'var(--text-primary)', 
                    fontWeight: 600, 
                    fontFamily: 'monospace',
                    letterSpacing: '0.5px'
                  }}>
                    {coordinates}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div style={{ 
                  padding: '16px 20px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-hover)',
                  marginBottom: '12px',
                }}>
                  <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-secondary)', 
                    fontWeight: 500,
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Coordinates
                  </div>
                  <div style={{ 
                    fontSize: '0.95rem', 
                    color: 'var(--text-primary)', 
                    fontWeight: 600, 
                    fontFamily: 'monospace',
                    letterSpacing: '0.5px'
                  }}>
                    {coordinates}
                  </div>
                </div>
                {location && location !== coordinates && (
                  <div style={{ 
                    padding: '16px 20px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-hover)',
                    wordBreak: 'break-word',
                    lineHeight: '1.6',
                    marginBottom: '12px',
                  }}>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--text-secondary)', 
                      fontWeight: 500,
                      marginBottom: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Address
                    </div>
                    <div style={{ 
                      fontSize: '1rem', 
                      color: 'var(--text-primary)', 
                      fontWeight: 600,
                    }}>
                      {location}
                    </div>
                  </div>
                )}
                {(!location || location === coordinates) && (
                  <div style={{ 
                    fontSize: '0.875rem', 
                    color: 'var(--text-secondary)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.05)',
                    border: '1px solid rgba(59, 130, 246, 0.1)'
                  }}>
                    {isGeocoding ? (
                      <>
                        <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderTopColor: '#3b82f6' }}></span>
                        <span>Converting coordinates to address...</span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '16px' }}>⏳</span>
                        <span>Converting coordinates to address...</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ 
            padding: '20px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-hover)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            justifyContent: 'center'
          }}>
            <span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderTopColor: '#3b82f6' }}></span>
            <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500 }}>
              Getting location...
            </span>
          </div>
        )}
      </div>

      <div className="punch-cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Punch Card */}
        <div className="form-container punch-attendance-card">
          <div className="attendance-header">
            <div className="attendance-icon-wrapper">
              <FiClock className="attendance-icon" />
            </div>
            <div className="attendance-info">
              <h2 className="attendance-title">Today's Attendance</h2>
              <div className="attendance-date">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div className="attendance-entry-time">
                Entry Time: {firstPunchTime ? formatDateTime(firstPunchTime) : 'Not yet'}
              </div>
              {locationName && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  📍 {locationName}
                </div>
              )}
            </div>
          </div>

          {/* Timer with Linear Progress */}
          <div style={{ marginBottom: '24px', width: '100%', maxWidth: '520px', marginInline: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              <span>Worked</span>
              <span>{formatTime(elapsedSeconds)} / 09:00:00</span>
            </div>
            <div style={{ position: 'relative', height: '18px', width: '100%', background: 'var(--bg-hover)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${progressRatio * 100}%`,
                  background: progressRatio >= 1 ? '#16a34a' : '#10b981',
                  transition: 'width 0.3s ease',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: `${progressRatio * 100}%`,
                  top: 0,
                  bottom: 0,
                  right: 0,
                  background: progressRatio >= 1 ? '#16a34a' : '#ef4444',
                  opacity: progressRatio >= 1 ? 0.15 : 0.35,
                  transition: 'left 0.3s ease'
                }}
              />
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Remaining to 9h: {formatTime(Math.max(0, Math.floor(targetSeconds - elapsedSeconds)))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
            {todayPunches.length === 0 || todayPunches[todayPunches.length - 1]?.check_out ? (
              <button 
                className="btn-primary" 
                onClick={handlePunchClick}
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? 'Processing...' : 'Punch In'}
              </button>
            ) : (
              <button 
                className="btn-primary" 
                onClick={handlePunchClick}
                disabled={loading}
                style={{ flex: 1, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
              >
                {loading ? 'Processing...' : 'Punch Out'}
              </button>
            )}
          </div>
        </div>

        {/* Today's Punches list */}
        <div className="form-container" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)', border: '2px solid rgba(99, 102, 241, 0.2)' }}>
          <h3 style={{ marginBottom: '20px', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiClock style={{ color: 'var(--primary)' }} /> Today's Punches
          </h3>
          <div className="punches-scroll-container">
            {todayPunches.length === 0 ? (
              <div className="empty-state">
                <p>No punches today</p>
              </div>
            ) : (
              todayPunches.map((punch, index) => (
                <div key={punch.id || index} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '12px',
                  padding: '16px',
                  background: 'transparent',
                  borderRadius: '12px',
                  border: '2px solid rgba(99, 102, 241, 0.15)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.15)';
                }}
                >
                  <div>
                <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
                  Punch {index + 1}
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: punch.check_out ? '8px' : '0'
                }}>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Punch In :
                  </div>
                  <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {formatTimeOnly(punch.check_in)}
                  </div>
                </div>
                {punch.check_out && (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Punch Out :
                    </div>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {formatTimeOnly(punch.check_out)}
                    </div>
                  </div>
                )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    {punch.check_in_image ? (
                      <img
                        src={punch.check_in_image.startsWith('data:') ? punch.check_in_image : `data:image/jpeg;base64,${punch.check_in_image}`}
                        alt="In"
                        style={{ width: '56px', height: '56px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextSibling) {
                            e.target.nextSibling.style.display = 'flex';
                          }
                        }}
                      />
                    ) : (
                      <div style={{ 
                        width: '56px', 
                        height: '56px', 
                        borderRadius: '6px', 
                        background: 'var(--bg-hover)', 
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.7rem',
                        textAlign: 'center'
                      }}>
                        Empty
                      </div>
                    )}
                    {punch.check_out && (punch.check_out_image ? (
                      <img
                        src={punch.check_out_image.startsWith('data:') ? punch.check_out_image : `data:image/jpeg;base64,${punch.check_out_image}`}
                        alt="Out"
                        style={{ width: '56px', height: '56px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextSibling) {
                            e.target.nextSibling.style.display = 'flex';
                          }
                        }}
                      />
                    ) : (
                      <div style={{ 
                        width: '56px', 
                        height: '56px', 
                        borderRadius: '6px', 
                        background: 'var(--bg-hover)', 
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.7rem',
                        textAlign: 'center'
                      }}>
                        Empty
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="form-container full-width-card punch-calendar-full" style={{ background: 'transparent', border: '2px solid rgba(99, 102, 241, 0.15)', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)' }}>
        <div className="punch-calendar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid var(--border-color)' }}>
          <h3 className="punch-calendar-title" style={{ fontSize: '1.5rem', fontWeight: 700, background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Punch History Calendar</h3>
          <div className="punch-calendar-selectors" style={{ position: 'relative' }}>
            <div className="month-picker-wrapper" style={{ width: '200px' }}>
              <div 
                className="month-picker-input"
                onClick={() => setShowMonthPicker(!showMonthPicker)}
              >
                <FiCalendar size={18} />
                <span>
                  {new Date(selectedYear, selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
                        setSelectedYear(prev => prev - 1);
                      }}
                      className="month-picker-nav"
                    >
                      ←
                    </button>
                    <span className="month-picker-year">{selectedYear}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const currentDate = new Date();
                        const maxYear = currentDate.getFullYear();
                        if (selectedYear < maxYear) {
                          setSelectedYear(prev => prev + 1);
                        }
                      }}
                      className="month-picker-nav"
                      disabled={selectedYear >= new Date().getFullYear()}
                    >
                      →
                    </button>
                  </div>
                  <div className="month-picker-grid">
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => {
                      const currentDate = new Date();
                      const currentYear = currentDate.getFullYear();
                      const currentMonth = currentDate.getMonth();
                      const isCurrentMonth = selectedYear === currentYear && index === currentMonth;
                      const isFutureMonth = selectedYear > currentYear || (selectedYear === currentYear && index > currentMonth);
                      
                      return (
                        <button
                          key={month}
                          type="button"
                          className={`month-picker-option ${isCurrentMonth ? 'current' : ''} ${selectedMonth === index ? 'selected' : ''} ${isFutureMonth ? 'disabled' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isFutureMonth) {
                              setSelectedMonth(index);
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
        </div>
        <div className="calendar-container" style={{ background: 'transparent' }}>
          <div className="calendar-header">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="calendar-header-day">{day}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {renderCalendar()}
          </div>
        </div>
        {/* Legend Card with Late Mark */}
        <div style={{ 
          marginTop: '20px', 
          padding: '20px', 
          background: 'var(--bg-card)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        }}>
          {/* Legend Items in horizontal row */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'row', 
            alignItems: 'center',
            gap: '24px',
            flexWrap: 'wrap',
            justifyContent: 'flex-start'
          }}>
            {/* Late Mark */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px'
            }}>
              <span style={{ 
                fontSize: '1.5rem',
                color: '#eab308',
                fontWeight: 700,
                lineHeight: 1
              }}>★</span>
              <span style={{ 
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                fontWeight: 600
              }}>Late Mark</span>
            </div>
            
            {/* Present */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px'
            }}>
              <div style={{ 
                width: '20px',
                height: '20px',
                background: '#10b981',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}></div>
              <span style={{ 
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                fontWeight: 600
              }}>Present (≥9H)</span>
            </div>
            
            {/* Half Day */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px'
            }}>
              <div style={{ 
                width: '20px',
                height: '20px',
                background: '#f59e0b',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}></div>
              <span style={{ 
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                fontWeight: 600
              }}>Half Day (4.5H-8.59H)</span>
            </div>
            
            {/* Absent */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px'
            }}>
              <div style={{ 
                width: '20px',
                height: '20px',
                background: '#ef4444',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}></div>
              <span style={{ 
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                fontWeight: 600
              }}>Absent (&lt;4.5H)</span>
            </div>
            
            {/* Week Off */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px'
            }}>
              <div style={{ 
                width: '20px',
                height: '20px',
                background: '#8b5cf6',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}></div>
              <span style={{ 
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                fontWeight: 600
              }}>Week Off (WO)</span>
            </div>
            
            {/* Leave */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px'
            }}>
              <div style={{ 
                width: '20px',
                height: '20px',
                background: '#3b82f6',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}></div>
              <span style={{ 
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                fontWeight: 600
              }}>Leave</span>
            </div>
            
            {/* Holiday */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px'
            }}>
              <div style={{ 
                width: '20px',
                height: '20px',
                background: '#f59e0b',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}></div>
              <span style={{ 
                fontSize: '0.9rem',
                color: 'var(--text-primary)',
                fontWeight: 600
              }}>Holiday</span>
            </div>
          </div>
        </div>
      </div>

      {/* Camera Modal */}
      {showCameraModal && (
        <div className="modal-overlay" onClick={handleCancelCamera}>
          <div className="modal-content camera-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Capture Image</h3>
              <button className="modal-close" onClick={handleCancelCamera}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              {!capturedImage ? (
                <>
                  <div style={{ position: 'relative', width: '100%', maxWidth: '500px', margin: '0 auto' }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      style={{ 
                        width: '100%', 
                        borderRadius: '8px',
                        border: faceDetected ? '3px solid #10b981' : '3px solid #ef4444',
                        transition: 'border-color 0.3s ease',
                        transform: 'scaleX(-1)' // Mirror the video (left to right, right to left)
                      }}
                    />
                    <canvas
                      ref={canvasRef}
                      style={{ display: 'none' }}
                    />
                    {isDetectingFace && (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '8px 16px',
                        background: faceDetected 
                          ? 'rgba(16, 185, 129, 0.9)' 
                          : 'rgba(239, 68, 68, 0.9)',
                        color: 'white',
                        borderRadius: '20px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        {faceDetected ? (
                          <>✓ Face Detected</>
                        ) : (
                          <>⚠ No Face Detected</>
                        )}
                      </div>
                    )}
                  </div>
                  <p style={{ 
                    marginTop: '12px', 
                    textAlign: 'center', 
                    color: faceDetected ? '#10b981' : '#ef4444',
                    fontSize: '0.9rem',
                    fontWeight: 500
                  }}>
                    {faceDetected 
                      ? 'Face detected! You can capture now.' 
                      : 'Please position your face in the camera frame.'}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                    <button 
                      className="btn-primary" 
                      onClick={captureImage}
                      disabled={!faceDetected}
                      style={{ opacity: faceDetected ? 1 : 0.6 }}
                    >
                      <FiCamera /> Capture
                    </button>
                    <button className="btn-secondary" onClick={handleCancelCamera}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <img 
                    src={capturedImage} 
                    alt="Captured" 
                    style={{ width: '100%', maxWidth: '500px', borderRadius: '8px', marginBottom: '16px' }}
                  />
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button 
                      className="btn-primary" 
                      onClick={() => {
                        const lastPunch = todayPunches[todayPunches.length - 1];
                        if (!lastPunch || lastPunch.check_out) {
                          handleSubmitPunch('in');
                        } else {
                          handleSubmitPunch('out');
                        }
                      }}
                      disabled={loading}
                    >
                      {loading ? 'Submitting...' : 'Submit'}
                    </button>
                    <button 
                      className="btn-secondary" 
                      onClick={() => {
                        setCapturedImage(null);
                        startCamera();
                      }}
                    >
                      Retake
                    </button>
                    <button className="btn-secondary" onClick={handleCancelCamera}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
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
            
            {selectedDateForModal && (
              <div style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <div><strong>Date:</strong> {new Date(selectedDateForModal).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
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
                                if (e.target.nextSibling) {
                                  e.target.nextSibling.style.display = 'flex';
                                }
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

export default Punch;


