import React, { useState } from 'react';
import { FaStar } from 'react-icons/fa';
import './index.css';  // Importação do CSS
import LoginLinkedInButton from './components/LoginLinkedInButton'; // Importando o botão de login do LinkedIn

function TrabalheiLa() {
  const [company, setCompany] = useState("");
  const [rating, setRating] = useState(0);
  const [contatoRH, setContatoRH] = useState(0);
  const [salarioBeneficios, setSalarioBeneficios] = useState(0);
  const [estruturaEmpresa, setEstruturaEmpresa] = useState(0);
  const [acessibilidadeLideranca, setAcessibilidadeLideranca] = useState(0);
  const [planoCarreiras, setPlanoCarreiras] = useState(0);
  const [estimulacaoOrganizacao, setEstimulacaoOrganizacao] = useState(0);
  const [comment, setComment] = useState("");
  const [empresas, setEmpresas] = useState([]);

  const companies = [
    "Banco do Brasil", "Raízen Combustíveis", "Itaú Unibanco Holding", "Grupo Raízen",
    "Bradesco", "Vale", "Itaú Unibanco", "Caixa Econômica Federal", "Grupo Carrefour Brasil",
    "Magazine Luiza", "Ambev", "Embraer", "WEG", "Suzano Papel e Celulose", "XP Inc.",
    "Rede D'Or São Luiz", "Gerdau", "CVC Brasil", "Braskem", "Infotec"
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setEmpresas([...empresas, { company, rating, contatoRH, salarioBeneficios, estruturaEmpresa, acessibilidadeLideranca, planoCarreiras, estimulacaoOrganizacao, comment }]);
    setCompany("");
    setRating(0);
    setComment("");
    setContatoRH(0);
    setSalarioBeneficios(0);
    setEstruturaEmpresa(0);
    setAcessibilidadeLideranca(0);
    setPlanoCarreiras(0);
    setEstimulacaoOrganizacao(0);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-blue-100 p-6">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-4xl font-bold text-center text-blue-700" style={{ fontFamily: 'Arial' }}>Trabalhei lá</h1>
        <p className="text-center mt-2 mb-6">Compartilhe sua experiência nas empresas!</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label>Nome da Empresa</label>
            <select value={company} onChange={(e) => setCompany(e.target.value)} className="border w-full p-2 rounded">
              <option>Selecione uma empresa</option>
              {companies.map((comp, idx) => (
                <option key={idx} value={comp}>{comp}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Avaliação Geral <span className="font-bold">{rating}/5</span></label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <FaStar key={star}
                  size={24}
                  className="cursor-pointer"
                  color={star <= rating ? "#facc15" : "#d1d5db"}
                  onClick={() => setRating(star)}
                />
              ))}
            </div>
          </div>

          {/* Outras avaliações */}
          <div>
            <label>Contato com RH <span className="font-bold">{contatoRH}/5</span></label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <FaStar key={star}
                  size={24}
                  className="cursor-pointer"
                  color={star <= contatoRH ? "#facc15" : "#d1d5db"}
                  onClick={() => setContatoRH(star)}
                />
              ))}
            </div>
          </div>

          <div>
            <label>Salário mais benefícios <span className="font-bold">{salarioBeneficios}/5</span></label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <FaStar key={star}
                  size={24}
                  className="cursor-pointer"
                  color={star <= salarioBeneficios ? "#facc15" : "#d1d5db"}
                  onClick={() => setSalarioBeneficios(star)}
                />
              ))}
            </div>
          </div>

          <div>
            <label>Estrutura da empresa <span className="font-bold">{estruturaEmpresa}/5</span></label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <FaStar key={star}
                  size={24}
                  className="cursor-pointer"
                  color={star <= estruturaEmpresa ? "#facc15" : "#d1d5db"}
                  onClick={() => setEstruturaEmpresa(star)}
                />
              ))}
            </div>
          </div>

          <div>
            <label>Acessibilidade com a liderança <span className="font-bold">{acessibilidadeLideranca}/5</span></label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <FaStar key={star}
                  size={24}
                  className="cursor-pointer"
                  color={star <= acessibilidadeLideranca ? "#facc15" : "#d1d5db"}
                  onClick={() => setAcessibilidadeLideranca(star)}
                />
              ))}
            </div>
          </div>

          <div>
            <label>Plano de carreiras <span className="font-bold">{planoCarreiras}/5</span></label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <FaStar key={star}
                  size={24}
                  className="cursor-pointer"
                  color={star <= planoCarreiras ? "#facc15" : "#d1d5db"}
                  onClick={() => setPlanoCarreiras(star)}
                />
              ))}
            </div>
          </div>

          <div>
            <label>Estímulo à organização e saúde do profissional <span className="font-bold">{estimulacaoOrganizacao}/5</span></label>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <FaStar key={star}
                  size={24}
                  className="cursor-pointer"
                  color={star <= estimulacaoOrganizacao ? "#facc15" : "#d1d5db"}
                  onClick={() => setEstimulacaoOrganizacao(star)}
                />
              ))}
            </div>
          </div>

          {/* Adicionando o botão LinkedIn */}
          <div className="mt-4">
            <LoginLinkedInButton 
              clientId="77dv5urtc8ixj3"  // Substituindo pelo seu Client ID
              redirectUri="https://seu-dominio.com/auth/linkedin"  // Substitua pela sua URL de redirecionamento
              onLoginSuccess={(response) => console.log("Login com sucesso:", response)}  // Função para quando o login for bem-sucedido
              onLoginFailure={(error) => console.log("Falha no login:", error)}  // Função para quando houver erro no login
            />
          </div>

          <div>
            <label>Comentário</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="5"
              className="border w-full p-2 rounded"
              placeholder="Descreva sua experiência"
            ></textarea>
          </div>

          <button type="submit" className="bg-blue-700 text-white py-2 rounded hover:bg-blue-800">Enviar Avaliação</button>
        </form>

        <h2 className="text-2xl font-bold mt-10 text-center text-blue-700">Ranking das Empresas</h2>
        <div className="mt-4">
          {empresas.length === 0 && <p className="text-center">Nenhuma avaliação ainda.</p>}
          {empresas.map((emp, idx) => (
            <div key={idx} className="border-b py-2">
              <p className="font-semibold">{emp.company}</p>
              <p>★ {emp.rating}/5 estrelas</p>
              <p>Contato com RH: ★ {emp.contatoRH}/5</p>
              <p>Salário mais benefícios: ★ {emp.salarioBeneficios}/5</p>
              <p className="text-sm text-gray-600">{emp.comment}</p>
            </div>
          ))}
        </div>

        <footer className="mt-6 text-center">
          <a href="/politica-de-privacidade.html" className="text-blue-500 hover:underline">
            Política de Privacidade
          </a>
        </footer>
      </div>
    </div>
  );
}

export default TrabalheiLa;
