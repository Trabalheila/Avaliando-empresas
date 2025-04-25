import React, { useState } from 'react';
import { LinkedIn } from 'react-linkedin-login-oauth2';  // Importando o componente de login do LinkedIn
import EmpresaList from './components/EmpresaList';  // Importando o componente de lista de empresas

function App() {
  const [company, setCompany] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [empresas, setEmpresas] = useState([]);  // Estado para armazenar as empresas avaliadas
  const [user, setUser] = useState(null);  // Estado para armazenar o usuário autenticado
  const [criterios, setCriterios] = useState({
    cordialidade: 0,
    valorizacaoSalarial: 0,
    beneficios: 0,
    organizacao: 0,
    acessibilidadeRecursos: 0,
    acessibilidadeSuperiores: 0,
    estimuloBoasPraticas: 0,
    valorizacaoSaude: 0,
    planoCarreira: 0
  });

  const companies = [
    "Banco do Brasil",
    "Raízen Combustíveis",
    "Itaú Unibanco Holding",
    "Grupo Raízen",
    "Bradesco",
    "Vale",
    "Itaú Unibanco",
    "Caixa Econômica Federal",
    "Grupo Carrefour Brasil",
    "Magazine Luiza",
    "Ambev",
    "Embraer",
    "WEG",
    "Suzano Papel e Celulose",
    "XP Inc.",
    "Rede D'Or São Luiz",
    "Gerdau",
    "CVC Brasil Operadora e Agência de Viagens S.A.",
    "Vale",
    "Braskem",
    "Infotec",
  ];

  const handleLoginSuccess = (data) => {
    console.log("Login bem-sucedido:", data);
    setUser(data);  // Armazena as informações do usuário autenticado
  };

  const handleLoginFailure = (error) => {
    console.error("Erro no login:", error);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const novaEmpresa = {
      nome: company,
      rating,
      comment,
      criterios,
    };

    setEmpresas([...empresas, novaEmpresa]);  // Adiciona a nova empresa à lista
    setCompany("");
    setRating(0);
    setComment("");
    setCriterios({
      cordialidade: 0,
      valorizacaoSalarial: 0,
      beneficios: 0,
      organizacao: 0,
      acessibilidadeRecursos: 0,
      acessibilidadeSuperiores: 0,
      estimuloBoasPraticas: 0,
      valorizacaoSaude: 0,
      planoCarreira: 0
    });
  };

  // Função para calcular a média de uma empresa
  const calcularMedia = (empresa) => {
    const allRatings = Object.values(empresa.criterios);
    const total = allRatings.reduce((acc, val) => acc + val, 0);
    return total / allRatings.length;
  };

  return (
    <div className="min-h-screen bg-blue-500 flex justify-center items-center p-6">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg">
        <h1 className="text-4xl font-bold text-center text-blue-600 mb-4">Trabalhei lá</h1>
        <p className="text-center text-lg mb-6">Compartilhe sua experiência em uma das empresas listadas abaixo.</p>

        {/* Se o usuário não estiver logado, exibe o botão de login do LinkedIn */}
        {!user ? (
          <LinkedIn
            clientId="YOUR_LINKEDIN_CLIENT_ID"
            redirectUri="YOUR_REDIRECT_URI"
            onFailure={handleLoginFailure}
            onSuccess={handleLoginSuccess}
          >
            <button className="bg-blue-700 text-white py-2 px-4 rounded-full w-full">
              Fazer login com o LinkedIn
            </button>
          </LinkedIn>
        ) : (
          <div className="text-center">
            <p className="text-lg">Bem-vindo, {user.firstName} {user.lastName}!</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-8">
          <div>
            <label className="block text-lg font-semibold">Nome da Empresa</label>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md"
              required
            >
              <option value="">Selecione uma empresa</option>
              {companies.map((companyName, index) => (
                <option key={index} value={companyName}>{companyName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-lg font-semibold">Avaliação (1 a 5 estrelas)</label>
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`w-10 h-10 rounded-full ${star <= rating ? "bg-yellow-400" : "bg-gray-300"}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Avaliação detalhada */}
          <div className="mt-4">
            <h2 className="text-lg font-semibold">Avalie a empresa em aspectos específicos:</h2>
            {Object.keys(criterios).map((criterio) => (
              <div key={criterio}>
                <label className="block text-md font-semibold">{criterio.replace(/([A-Z])/g, ' $1')}</label>
                <div className="flex space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setCriterios({ ...criterios, [criterio]: star })}
                      className={`w-10 h-10 rounded-full ${star <= criterios[criterio] ? "bg-yellow-400" : "bg-gray-300"}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-lg font-semibold">Comentário</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="4"
              className="w-full p-3 border border-gray-300 rounded-md"
              placeholder="Compartilhe sua experiência"
              required
            ></textarea>
          </div>

          <div className="text-center">
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-md mt-4 hover:bg-blue-700"
            >
              Enviar Avaliação
            </button>
          </div>
        </form>

        {/* Exibe as avaliações das empresas */}
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Empresas Avaliadas</h2>
          <EmpresaList empresas={empresas} />
        </div>

        {/* Exibe o ranking das melhores empresas */}
        <div className="mt-8">
          <h2 className="text-2xl font-semibold mb-4">Ranking das Melhores Empresas</h2>
          <div>
            {empresas
              .sort((a, b) => calcularMedia(b) - calcularMedia(a)) // Ordena pelo ranking
              .map((empresa, index) => (
                <div key={index} className="border-b py-2">
                  <p className="text-lg font-semibold">{empresa.nome}</p>
                  <p>Nota Média: {calcularMedia(empresa).toFixed(2)} ★</p>
                </div>
              ))}
          </div>
        </div>

        {/* Link para a Política de Privacidade */}
        <footer className="mt-8 text-center text-blue-300 hover:text-white">
          <a href="/politica-de-privacidade.html">
            Política de Privacidade
          </a>
        </footer>
      </div>
    </div>
  );
}

export default App;
