import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';  // Importando o componente de login com o Google
import EmpresaList from './components/EmpresaList';  // Importando o componente de lista de empresas

function App() {
  const [company, setCompany] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [empresas, setEmpresas] = useState([]);  // Estado para armazenar as empresas avaliadas
  const [user, setUser] = useState(null);  // Estado para armazenar o usuário autenticado

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

  // Função chamada após o sucesso do login
  const handleLoginSuccess = (response) => {
    console.log("Login bem-sucedido:", response);
    setUser(response);  // Armazena as informações do usuário autenticado
  };

  // Função chamada se o login falhar
  const handleLoginFailure = (error) => {
    console.error("Erro no login:", error);
  };

  // Função para enviar a avaliação
  const handleSubmit = (e) => {
    e.preventDefault();
    const novaEmpresa = { nome: company, rating, comment };
    setEmpresas([...empresas, novaEmpresa]);  // Adiciona a nova empresa à lista
    setCompany("");
    setRating(0);
    setComment("");
  };

  return (
    <div className="min-h-screen bg-blue-500 flex justify-center items-center p-6">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg">
        <h1 className="text-4xl font-bold text-center text-blue-600 mb-4">Trabalhei lá</h1>
        <p className="text-center text-lg mb-6">Compartilhe sua experiência em uma das empresas listadas abaixo.</p>

        {/* Se o usuário não estiver logado, exibe o botão de login do Google */}
        {!user ? (
          <GoogleLogin
            onSuccess={handleLoginSuccess}  // Sucesso do login
            onError={handleLoginFailure}     // Erro no login
            useOneTap  // Habilita o login "One Tap"
          />
        ) : (
          <div className="text-center">
            <p className="text-lg">Bem-vindo, {user.profileObj.name}!</p>
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
