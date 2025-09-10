import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/Animations.css';

// Initialize Firebase
import './firebase-config';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* REMOVED BrowserRouter from here - it's now in App.js */}
    <App />
  </React.StrictMode>
);