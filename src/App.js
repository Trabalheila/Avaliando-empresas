import './App.css';
import { Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Home from './Home';
import AuthLinkedIn from './AuthLinkedIn'; // 👈 IMPORTANTE

function CompanyDetailPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-200">
      <h1 className="text-3xl font-bold text-gray-800">
        Página de Detalhes da Empresa (Em construção)
      </h1>
    </div>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || ""}>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/empresa/:companyName" element={<CompanyDetailPage />} />

          {/* 👇 NOVA ROTA DO LINKEDIN */}
          <Route path="/auth/linkedin" element={<AuthLinkedIn />} />
        </Routes>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;