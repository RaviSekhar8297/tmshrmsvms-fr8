import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

// Global error handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  // Log the error but don't show it to the user if it's a browser extension issue
  const errorMessage = event.reason?.message || String(event.reason);
  const errorStack = event.reason?.stack || '';
  
  // Check if error is from browser extension
  const isExtensionError = 
    errorMessage.includes('message channel closed') || 
    errorMessage.includes('Extension context invalidated') ||
    errorStack.includes('contentScript.js') ||
    errorStack.includes('extension://') ||
    errorStack.includes('chrome-extension://') ||
    errorStack.includes('moz-extension://');
  
  if (isExtensionError) {
    // Silently ignore browser extension errors
    event.preventDefault();
    return;
  }
  // For other errors, log them but prevent default browser behavior
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

// Global error handler for general errors (including extension errors)
window.addEventListener('error', (event) => {
  // Check if error is from browser extension
  const errorMessage = event.message || '';
  const errorSource = event.filename || '';
  const errorStack = event.error?.stack || '';
  
  const isExtensionError = 
    errorSource.includes('contentScript.js') ||
    errorSource.includes('extension://') ||
    errorSource.includes('chrome-extension://') ||
    errorSource.includes('moz-extension://') ||
    errorStack.includes('contentScript.js') ||
    errorStack.includes('extension://') ||
    (errorMessage.includes('Cannot read properties of undefined') && 
     (errorSource.includes('contentScript') || errorStack.includes('contentScript')));
  
  if (isExtensionError) {
    // Silently ignore browser extension errors
    event.preventDefault();
    return false; // Prevent default error handling
  }
  
  // Allow other errors to be handled normally
  return true;
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)






