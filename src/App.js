import './App.css'; // Pode ser usado para estilos globais ou específicos do App
import { Routes, Route } from 'react-router-dom'; // Importa componentes de roteamento
import Home from './Home'; // Importa o seu componente Home

// Você pode criar outros componentes para outras rotas, se precisar
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
      {/* As rotas são definidas aqui */}
      <Routes>
        {/* A rota principal agora renderiza o seu componente Home */}
        <Route path="/" element={<Home />} />
        {/* Exemplo de rota para detalhes de empresa, usando um parâmetro dinâmico */}
        <Route path="/empresa/:companyName" element={<CompanyDetailPage />} />
        {/* Adicione mais rotas aqui para outras páginas do seu aplicativo */}
      </Routes>
    </div>
  );
}

    // Este é um comentário para forçar um novo commit


export default App;
