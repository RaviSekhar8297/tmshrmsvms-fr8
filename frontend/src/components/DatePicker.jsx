import { useState, useEffect, useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiCalendar, FiX } from 'react-icons/fi';
import './DatePicker.css';

const DatePicker = ({ value, onChange, min, max, placeholder = "Select date", disabled = false, disabledDates = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(value ? new Date(value) : null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const pickerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (value) {
      const date = new Date(value);
      setSelectedDate(date);
      setCurrentMonth(date.getMonth());
      setCurrentYear(date.getFullYear());
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target) &&
          dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Calculate position when dropdown opens
      if (pickerRef.current) {
        const rect = pickerRef.current.getBoundingClientRect();
        
        // Position below the input field (using fixed positioning, no scroll offset needed)
        let top = rect.bottom + 8;
        let left = rect.left;
        
        // Check if dropdown would go off screen and adjust
        const dropdownHeight = 380; // Approximate height of dropdown
        const dropdownWidth = 320; // Approximate width of dropdown
        
        // Check viewport boundaries (for fixed positioning)
        if (top + dropdownHeight > window.innerHeight) {
          // Position above if not enough space below
          top = rect.top - dropdownHeight - 8;
          // Ensure it doesn't go above viewport
          if (top < 8) {
            top = 8;
          }
        }
         if (left < 0) {
          // Adjust left if goes off left edge
          left = 16;
        }
        if (left + dropdownWidth > window.innerWidth) {
          // Adjust left if goes off right edge
          left = window.innerWidth - dropdownWidth - 16;
        }
        
       
        
        setDropdownPosition({ top, left });
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const isDateDisabled = (date) => {
    if (!date) return false;
    // Format date as YYYY-MM-DD using local timezone (IST) instead of UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
    // Check if date is in disabledDates array
    if (disabledDates && disabledDates.length > 0) {
      if (disabledDates.includes(dateStr)) return true;
    }
    return false;
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date) => {
    if (!date || !selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  const handleDateSelect = (day) => {
    const newDate = new Date(currentYear, currentMonth, day);
    if (!isDateDisabled(newDate)) {
      setSelectedDate(newDate);
      // Format date as YYYY-MM-DD using local timezone (IST) instead of UTC
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const date = String(newDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${date}`;
      onChange(dateStr);
      setIsOpen(false);
    }
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      const newYear = currentYear - 1;
      if (!max || new Date(newYear, 11, 31) <= new Date(max)) {
        setCurrentMonth(11);
        setCurrentYear(newYear);
      }
    } else {
      const newMonth = currentMonth - 1;
      if (!max || new Date(currentYear, newMonth, 1) <= new Date(max)) {
        setCurrentMonth(newMonth);
      }
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      const newYear = currentYear + 1;
      if (!max || new Date(newYear, 0, 1) <= new Date(max)) {
        setCurrentMonth(0);
        setCurrentYear(newYear);
      }
    } else {
      const newMonth = currentMonth + 1;
      if (!max || new Date(currentYear, newMonth, 1) <= new Date(max)) {
        setCurrentMonth(newMonth);
      }
    }
  };

  const handleToday = () => {
    const today = new Date();
    if (!isDateDisabled(today)) {
      setSelectedDate(today);
      // Format date as YYYY-MM-DD using local timezone (IST) instead of UTC
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const date = String(today.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${date}`;
      onChange(dateStr);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setSelectedDate(null);
    onChange('');
    setIsOpen(false);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
  const days = [];

  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day);
  }

  return (
    <div className="date-picker-wrapper" ref={pickerRef}>
      <div 
        className={`date-picker-input ${isOpen ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <input
          type="text"
          value={formatDate(selectedDate)}
          readOnly
          placeholder={placeholder}
          disabled={disabled}
          className="date-picker-input-field"
        />
        <FiCalendar className="date-picker-icon" />
      </div>

      {isOpen && (
        <div 
          ref={dropdownRef}
          className="date-picker-dropdown"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`
          }}
        >
          <div className="date-picker-header">
            <button 
              type="button" 
              className="date-picker-nav-btn"
              onClick={handlePrevMonth}
              disabled={(() => {
                if (!min) return false;
                const minDate = new Date(min);
                return currentYear === minDate.getFullYear() && currentMonth === minDate.getMonth();
              })()}
            >
              <FiChevronLeft />
            </button>
            <div className="date-picker-month-year">
              <select
                className="date-picker-select"
                value={currentYear}
                onChange={(e) => setCurrentYear(Number(e.target.value))}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  outline: 'none',
                  background: 'var(--bg-hover)',
                  color: 'var(--text-primary)'
                }}
              >
                {(() => {
                  const years = [];
                  const currentDate = new Date();
                  const maxYear = max ? new Date(max).getFullYear() : currentDate.getFullYear();
                  const minYear = min ? new Date(min).getFullYear() : 1900;
                  for (let year = maxYear; year >= minYear; year--) {
                    years.push(year);
                  }
                  return years;
                })().map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                className="date-picker-select"
                value={currentMonth}
                onChange={(e) => setCurrentMonth(Number(e.target.value))}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '14px',
                  cursor: 'pointer',
                  outline: 'none',
                  background: 'var(--bg-hover)',
                  color: 'var(--text-primary)'
                }}
              >
                {monthNames.map((month, index) => {
                  // Disable future months if max date is set
                  if (max) {
                    const maxDate = new Date(max);
                    if (currentYear === maxDate.getFullYear() && index > maxDate.getMonth()) {
                      return null;
                    }
                  }
                  // Disable past months if min date is set
                  if (min) {
                    const minDate = new Date(min);
                    if (currentYear === minDate.getFullYear() && index < minDate.getMonth()) {
                      return null;
                    }
                  }
                  return <option key={index} value={index}>{month}</option>;
                })}
              </select>
            </div>
            <button 
              type="button" 
              className="date-picker-nav-btn"
              onClick={handleNextMonth}
              disabled={(() => {
                if (!max) return false;
                const maxDate = new Date(max);
                return currentYear === maxDate.getFullYear() && currentMonth === maxDate.getMonth();
              })()}
            >
              <FiChevronRight />
            </button>
          </div>

          <div className="date-picker-weekdays">
            {dayNames.map(day => (
              <div key={day} className="date-picker-weekday">{day}</div>
            ))}
          </div>

          <div className="date-picker-days">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="date-picker-day empty"></div>;
              }

              const date = new Date(currentYear, currentMonth, day);
              const disabled = isDateDisabled(date);
              const today = isToday(date);
              const selected = isSelected(date);

              return (
                <button
                  key={day}
                  type="button"
                  className={`date-picker-day ${today ? 'today' : ''} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                  onClick={() => handleDateSelect(day)}
                  disabled={disabled}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="date-picker-footer">
            <button 
              type="button" 
              className="date-picker-today-btn"
              onClick={handleToday}
            >
              Today
            </button>
            {selectedDate && (
              <button 
                type="button" 
                className="date-picker-clear-btn"
                onClick={handleClear}
              >
                <FiX /> Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;

