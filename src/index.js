import React from 'react';
import ReactDOM from 'react-dom/client';
<<<<<<< HEAD
<<<<<<< HEAD
import './index.css'; // Importa o CSS com o Tailwind
import App from './App'; // Importa o componente App
=======
import { GoogleOAuthProvider } from '@react-oauth/google'; // Importa o provedor do Google
import './index.css';
import App from './App';
>>>>>>> 0177c48 (Sua mensagem de commit)

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

<<<<<<< HEAD
// Renderiza o componente App dentro do root
root.render(<App />);
=======
import { GoogleOAuthProvider } from '@react-oauth/google'; // Importa o provedor do Google
import './index.css';
import App from './App';

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);

=======
>>>>>>> 0177c48 (Sua mensagem de commit)
root.render(
  <GoogleOAuthProvider clientId="307097641063-qm59mq95jjor1qcuru8tsqj8fkn8fnot.apps.googleusercontent.com">
    <App />
  </GoogleOAuthProvider>
);

<<<<<<< HEAD
>>>>>>> 0177c482981cbe8aec032138d4c0ab95fd411366
=======
>>>>>>> 0177c48 (Sua mensagem de commit)
