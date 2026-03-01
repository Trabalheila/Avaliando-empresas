import './App.css'; // Pode ser usado para estilos globais ou específicos do App
import { Routes, Route } from 'react-router-dom'; // Importa componentes de roteamento
import Home from './Home'; // Importa o seu componente Home

function CompanyDetailPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-200">
      <h1 className="text-3xl font-bold text-gray-800">Página de Detalhes da Empresa (Em construção)</h1>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/empresa/:companyName" element={<CompanyDetailPage />} />
      </Routes>
    </div>
  );
}

export default App;