import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Importa o CSS global, incluindo o Tailwind
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom'; // Importa o BrowserRouter

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* O App precisa ser envolvido pelo BrowserRouter para que as rotas funcionem */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();
