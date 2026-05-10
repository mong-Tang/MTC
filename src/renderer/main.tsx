import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// style import for global looks (we can migrate old styles.css later!)
import './index.css'; 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
