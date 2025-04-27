import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Importa o CSS com o Tailwind
import TrabalheiLa from './App'; // Importa o componente App

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

// Renderiza o componente App dentro do root
root.render(
  <TrabalheiLa />
);
