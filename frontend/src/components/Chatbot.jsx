import React, { useState, useRef, useEffect } from 'react';
import { FiX, FiSend, FiMinimize2 } from 'react-icons/fi';
import api from '../services/api';
import chatbotGif from '../images/chatbotgif.gif';
import './Chatbot.css';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm your TMS assistant. How can I help you today?",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingSelection, setPendingSelection] = useState(null); // Store pending selection data
  const [originalQuestion, setOriginalQuestion] = useState(''); // Store original question for follow-up
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      text: inputMessage.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const questionText = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await api.post('/chatbot/ask', {
        question: questionText
      });

      const botMessage = {
        id: Date.now() + 1,
        text: response.data.answer,
        sender: 'bot',
        timestamp: new Date(),
        image: response.data.image_base64 || null,
        selection_required: response.data.selection_required || false,
        selection_data: response.data.selection_data || null,
        selection_type: response.data.selection_type || null
      };

      // If selection is required, store the original question and selection data
      if (botMessage.selection_required && botMessage.selection_data) {
        setPendingSelection({
          question: questionText,
          selection_data: botMessage.selection_data,
          selection_type: botMessage.selection_type
        });
        setOriginalQuestion(questionText);
      } else {
        // Clear pending selection if not needed
        setPendingSelection(null);
        setOriginalQuestion('');
      }

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chatbot error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, I'm having trouble processing your request. Please try again later.",
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setPendingSelection(null);
      setOriginalQuestion('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelection = async (selectedItem) => {
    if (!pendingSelection) return;
    
    // Create a follow-up question with the selected empid
    const selectedEmpid = selectedItem.empid;
    const originalQ = pendingSelection.question.toLowerCase();
    
    // Extract the field being asked for from original question
    let fieldQuery = '';
    if (pendingSelection.selection_type === 'USER') {
      // For user queries, reconstruct the question with empid
      // Replace name with empid in the question
      const words = originalQ.split(' ');
      const fieldIndex = words.findIndex(w => w === 'of');
      if (fieldIndex > 0 && fieldIndex < words.length - 1) {
        const field = words[fieldIndex - 1]; // Field before "of"
        fieldQuery = `${field} of ${selectedEmpid}`;
      } else {
        // Fallback: just use empid
        fieldQuery = `${originalQ.replace(/of\s+\w+/i, `of ${selectedEmpid}`)}`;
      }
    } else if (pendingSelection.selection_type === 'LEAVE') {
      // For leave queries
      const words = originalQ.split(' ');
      const leaveFieldIndex = words.findIndex(w => 
        ['balance', 'total', 'used', 'casual', 'sick', 'comp', 'off', 'leave'].includes(w)
      );
      if (leaveFieldIndex >= 0) {
        const leaveField = words.slice(leaveFieldIndex).join(' ');
        fieldQuery = `${leaveField} of ${selectedEmpid}`;
      } else {
        fieldQuery = `leave balance of ${selectedEmpid}`;
      }
    }
    
    // Clear pending selection
    setPendingSelection(null);
    setOriginalQuestion('');
    
    // Add user message showing selection
    const userMessage = {
      id: Date.now(),
      text: `Selected: ${selectedItem.name}`,
      sender: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    try {
      const response = await api.post('/chatbot/ask', {
        question: fieldQuery
      });

      const botMessage = {
        id: Date.now() + 1,
        text: response.data.answer,
        sender: 'bot',
        timestamp: new Date(),
        image: response.data.image_base64 || null,
        selection_required: response.data.selection_required || false,
        selection_data: response.data.selection_data || null,
        selection_type: response.data.selection_type || null
      };

      // If selection is required again, store it
      if (botMessage.selection_required && botMessage.selection_data) {
        setPendingSelection({
          question: fieldQuery,
          selection_data: botMessage.selection_data,
          selection_type: botMessage.selection_type
        });
        setOriginalQuestion(fieldQuery);
      }

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chatbot error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: "Sorry, I'm having trouble processing your request. Please try again later.",
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    if (isOpen) {
      if (isMinimized) {
        setIsMinimized(false);
      } else {
        setIsMinimized(true);
      }
    } else {
      setIsOpen(true);
      setIsMinimized(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) {
    return (
      <button
        className="chatbot-toggle-btn"
        onClick={handleToggle}
        aria-label="Open chatbot"
        title="Chat with TMS Assistant"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer'
        }}
      >
        <img 
          src={chatbotGif} 
          alt="Chatbot" 
          style={{ 
            width: '64px', 
            height: '64px', 
            objectFit: 'contain',
            display: 'block',
            borderRadius: '50%',
            transition: 'transform 0.3s ease'
          }}
        />
      </button>
    );
  }

  return (
    <div className={`chatbot-container ${isMinimized ? 'minimized' : ''}`}>
      <div className="chatbot-header">
        <div className="chatbot-header-content">
          <div className="chatbot-avatar">🤖</div>
          <div className="chatbot-header-text">
            <h3>TMS Assistant</h3>
            <span className="chatbot-status">Online</span>
          </div>
        </div>
        <div className="chatbot-header-actions">
          <button
            className="chatbot-icon-btn"
            onClick={handleToggle}
            aria-label="Minimize chatbot"
          >
            <FiMinimize2 size={18} />
          </button>
          <button
            className="chatbot-icon-btn"
            onClick={handleClose}
            aria-label="Close chatbot"
          >
            <FiX size={18} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="chatbot-messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`chatbot-message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}
              >
                <div className="chatbot-message-content">
                  {message.image && (
                    <div className="chatbot-message-image">
                      <img 
                        src={message.image.startsWith('data:image/') ? message.image : `data:image/jpeg;base64,${message.image}`}
                        alt="User profile" 
                        className="chatbot-user-image"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <p>{message.text}</p>
                  
                  {/* Selection buttons */}
                  {message.selection_required && message.selection_data && (
                    <div className="chatbot-selection-buttons" style={{ 
                      marginTop: '16px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '8px',
                      maxHeight: '250px',
                      overflowY: 'auto',
                      paddingRight: '4px'
                    }}>
                      {message.selection_data.slice(0, 10).map((item, index) => (
                        <button
                          key={index}
                          onClick={() => handleSelection(item)}
                          className="chatbot-selection-btn"
                          style={{
                            padding: '12px 18px',
                            background: '#f8f9fa',
                            border: '1.5px solid #e0e0e0',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.25s ease',
                            fontSize: '0.95rem',
                            color: '#333',
                            fontWeight: 500,
                            width: '100%',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                            e.target.style.color = 'white';
                            e.target.style.borderColor = '#667eea';
                            e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                            e.target.style.transform = 'translateX(4px)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = '#f8f9fa';
                            e.target.style.color = '#333';
                            e.target.style.borderColor = '#e0e0e0';
                            e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                            e.target.style.transform = 'translateX(0)';
                          }}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <span className="chatbot-message-time">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="chatbot-message bot-message">
                <div className="chatbot-message-content">
                  <div className="chatbot-typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chatbot-input-form" onSubmit={handleSendMessage}>
            <input
              ref={inputRef}
              type="text"
              className="chatbot-input"
              placeholder="Type your question here..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="chatbot-send-btn"
              disabled={!inputMessage.trim() || isLoading}
            >
              <FiSend size={18} />
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default Chatbot;

