import React from 'react';
import ReactDOM from 'react-dom/client';
// Self-hosted variable font: covers the full 100-900 weight axis (the CSS
// uses fractional weights like 550/650) plus italics for markdown emphasis.
// Registers as 'Inter Variable' — see --font-sans in index.css.
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/inter/wght-italic.css';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
