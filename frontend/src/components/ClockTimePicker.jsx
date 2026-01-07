import { useState, useRef, useEffect } from 'react';
import { FiClock } from 'react-icons/fi';
import './ClockTimePicker.css';

const ClockTimePicker = ({ value, onChange, disabled, placeholder = "Select time" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [time, setTime] = useState(value || { hours: 12, minutes: 0, period: 'AM' });
  const [displayTime, setDisplayTime] = useState(value || '12:00');
  const [mode, setMode] = useState('hours'); // 'hours' or 'minutes'
  const pickerRef = useRef(null);

  useEffect(() => {
    if (value) {
      const [hours, minutes] = value.split(':');
      const h = parseInt(hours) || 12;
      const m = parseInt(minutes) || 0;
      const period = h >= 12 ? 'PM' : 'AM';
      const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      setTime({ hours: displayH, minutes: m, period });
      setDisplayTime(value);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleTimeChange = (newTime) => {
    setTime(newTime);
    const h24 = newTime.period === 'PM' 
      ? (newTime.hours === 12 ? 12 : newTime.hours + 12)
      : (newTime.hours === 12 ? 0 : newTime.hours);
    const timeString = `${String(h24).padStart(2, '0')}:${String(newTime.minutes).padStart(2, '0')}`;
    setDisplayTime(timeString);
    onChange(timeString);
  };

  const handleHourClick = (hour) => {
    handleTimeChange({ ...time, hours: hour });
    setMode('minutes');
  };

  const handleMinuteClick = (minute) => {
    handleTimeChange({ ...time, minutes: minute });
    setIsOpen(false);
  };

  const togglePeriod = () => {
    handleTimeChange({ ...time, period: time.period === 'AM' ? 'PM' : 'AM' });
  };

  const generateHours = () => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  };

  const generateMinutes = () => {
    return Array.from({ length: 60 }, (_, i) => i);
  };

  const getHourPosition = (hour) => {
    // Clock starts at 12 (top), so hour 12 is at angle -90 degrees
    const angle = ((hour * 30) - 90) * (Math.PI / 180);
    return {
      x: 50 + 35 * Math.cos(angle),
      y: 50 + 35 * Math.sin(angle)
    };
  };

  const getMinutePosition = (minute) => {
    // Clock starts at 12 (top), so minute 0 is at angle -90 degrees
    const angle = ((minute * 6) - 90) * (Math.PI / 180);
    return {
      x: 50 + 35 * Math.cos(angle),
      y: 50 + 35 * Math.sin(angle)
    };
  };

  if (disabled) {
    return (
      <div className="clock-time-picker-wrapper">
        <div className="clock-time-input disabled">
          <span className="time-display">{displayTime || placeholder}</span>
          <FiClock className="time-icon" />
        </div>
      </div>
    );
  }

  return (
    <div className="clock-time-picker-wrapper" ref={pickerRef}>
      <div 
        className="clock-time-input"
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="time-display">{displayTime || placeholder}</span>
        <FiClock className="time-icon" />
      </div>

      {isOpen && (
        <div className="clock-picker-dropdown">
          <div className="clock-picker-header">
            <div className="time-preview">
              <span className="preview-hours">{String(time.hours).padStart(2, '0')}</span>
              <span className="preview-separator">:</span>
              <span className="preview-minutes">{String(time.minutes).padStart(2, '0')}</span>
              <button 
                className="period-toggle"
                onClick={togglePeriod}
              >
                {time.period}
              </button>
            </div>
            <div className="mode-selector">
              <button 
                className={mode === 'hours' ? 'active' : ''}
                onClick={() => setMode('hours')}
              >
                Hours
              </button>
              <button 
                className={mode === 'minutes' ? 'active' : ''}
                onClick={() => setMode('minutes')}
              >
                Minutes
              </button>
            </div>
          </div>

          <div className="clock-face">
            {mode === 'hours' ? (
              <>
                {generateHours().map((hour) => {
                  const pos = getHourPosition(hour);
                  return (
                    <button
                      key={hour}
                      className={`clock-number ${time.hours === hour ? 'selected' : ''}`}
                      style={{
                        position: 'absolute',
                        left: `${pos.x}%`,
                        top: `${pos.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      onClick={() => handleHourClick(hour)}
                    >
                      {hour}
                    </button>
                  );
                })}
                <div className="clock-center" />
              </>
            ) : (
              <>
                {generateMinutes().filter(m => m % 5 === 0).map((minute) => {
                  const pos = getMinutePosition(minute);
                  return (
                    <button
                      key={minute}
                      className={`clock-number ${time.minutes === minute ? 'selected' : ''}`}
                      style={{
                        position: 'absolute',
                        left: `${pos.x}%`,
                        top: `${pos.y}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                      onClick={() => handleMinuteClick(minute)}
                    >
                      {String(minute).padStart(2, '0')}
                    </button>
                  );
                })}
                <div className="clock-center" />
              </>
            )}
          </div>

          <div className="clock-picker-footer">
            <button 
              className="done-button"
              onClick={() => setIsOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClockTimePicker;

