import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Setup Tailwind Directives style injection (if not loaded via CDN in HTML, 
// but we used CDN in index.html for simplicity in this format. 
// We will add some custom global styles here for scrollbars though.)

const style = document.createElement('style');
style.textContent = `
  /* Custom Scrollbar for a cleaner legal look */
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f5f9; 
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1; 
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8; 
  }
`;
document.head.appendChild(style);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
