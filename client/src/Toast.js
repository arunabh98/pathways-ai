import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import './Toast.css';

function Toast({ message, show, duration = 3000, onClose }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        if (onClose) {
          onClose();
        }
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!show) return null;

  return (
    <div className="toast-container">
      <div className="toast">
        <span className="toast-message">{message}</span>
      </div>
    </div>
  );
}

Toast.propTypes = {
  message: PropTypes.string.isRequired,
  show: PropTypes.bool.isRequired,
  duration: PropTypes.number,
  onClose: PropTypes.func
};

Toast.defaultProps = {
  duration: 3000
};

export default Toast;