// src/main.tsx
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
// Global styles + Tailwind directives yahan import hote hain

// Root element ko safely grab karte hain (null check ke saath)
const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  // Agar root nahi mila toh error console mein dikhao (development ke liye helpful)
  console.error('Root element not found! Check index.html for <div id="root"></div>');
}
