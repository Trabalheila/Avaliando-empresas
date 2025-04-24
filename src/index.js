import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google'; // Importa o provedor do Google
import './index.css'; // Importa o CSS com o Tailwind
import App from './App'; // Importa o componente App

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

// Renderiza o componente App dentro do root
root.render(
  <GoogleOAuthProvider clientId="307097641063-qm59mq95jjor1qcuru8tsqj8fkn8fnot.apps.googleusercontent.com">
    <App />
  </GoogleOAuthProvider>
);
