import { FiX } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, children, size = 'default', allowClose = true, className = '' }) => {
  if (!isOpen) return null;

  const handleOverlayClick = () => {
    if (allowClose && onClose) {
      onClose();
    } else if (onClose) {
      // Still call onClose to show toast, but don't actually close
      onClose();
    }
  };

  // For policy modal, disable animations completely to prevent blur on first render
  const isPolicyModal = className.includes('policy-modal');
  const overlayInitial = isPolicyModal ? { opacity: 1 } : { opacity: 0 };
  const overlayAnimate = isPolicyModal ? { opacity: 1 } : { opacity: 1 };
  const modalInitial = isPolicyModal ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 20 };
  const modalAnimate = isPolicyModal ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 };
  
  // For policy modal, use static rendering without framer-motion to prevent blur
  if (isPolicyModal) {
    return (
      <div
        className={`modal-overlay ${className}`}
        onClick={handleOverlayClick}
        style={{
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          filter: 'none',
          WebkitFilter: 'none',
          background: 'rgba(0, 0, 0, 0.75)',
          opacity: 1
        }}
      >
        <div
          className={`modal modal-${size} ${className}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: 'none',
            filter: 'none',
            WebkitFilter: 'none',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            opacity: 1,
            scale: 1
          }}
        >
          {title && (
            <div className="modal-header">
              <h3 className="modal-title">{title}</h3>
              <button className="modal-close" onClick={onClose}>
                <FiX />
              </button>
            </div>
          )}
          <div className="modal-body">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className={`modal-overlay ${className}`}
          initial={overlayInitial}
          animate={overlayAnimate}
          exit={{ opacity: 0 }}
          onClick={handleOverlayClick}
        >
          <motion.div 
            className={`modal modal-${size} ${className}`}
            initial={modalInitial}
            animate={modalAnimate}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="modal-header">
                <h3 className="modal-title">{title}</h3>
                <button className="modal-close" onClick={onClose}>
                  <FiX />
                </button>
              </div>
            )}
            <div className="modal-body">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;






