import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// O arquivo index.css foi removido pois estamos usando Tailwind via CDN e estilos no index.html

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