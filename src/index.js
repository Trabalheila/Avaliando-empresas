import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import TrabalheiLa from './TrabalheiLa'; // ✅ Agora aponta pro arquivo correto

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <TrabalheiLa />
  </React.StrictMode>
);
