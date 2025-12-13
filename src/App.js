import React, { useState } from 'react';
import { FaStar } from 'react-icons/fa';
import Select from 'react-select';
import './index.css';
import LoginLinkedInButton from './components/LoginLinkedInButton';

function TrabalheiLa() {
  const [company, setCompany] = useState(null);
  const [newCompany, setNewCompany] = useState("");
  const [rating, setRating] = useState(0);
  const [contatoRH, setContatoRH] = useState(0);
  const [salarioBeneficios, setSalarioBeneficios] = useState(0);
  const [estruturaEmpresa, setEstruturaEmpresa] = useState(0);
  const [acessibilidadeLideranca, setAcessibilidadeLideranca] = useState(0);
  const [planoCarreiras, setPlanoCarreiras] = useState(0);
  const [bemestar, setBemestar] = useState(0);
  const [estimulacaoOrganizacao, setEstimulacaoOrganizacao] = useState(0);
  const [comment, setComment] = useState("");
  const [empresas, setEmpresas] = useState([]);

  const [companies, setCompanies] = useState([
    "Banco do Brasil", "Raízen Combustíveis", "Itaú Unibanco Holding", "Grupo Raízen",
    "Bradesco", "Vale", "Itaú Unibanco", "Caixa Econômica Federal", "Grupo Carrefour Brasil",
    "Magazine Luiza", "Ambev", "Embraer", "WEG", "Suzano Papel e Celulose", "XP Inc.",
    "Rede D'Or São Luiz", "Gerdau", "CVC Brasil", "Braskem", "Infotec", "Engemon"
  ]);

  const companyOptions = companies.map((comp) => ({
    label: comp,
    value: comp
  }));

  const formatOptionLabel = ({ label }) => (
    <div className="flex items-center gap-2">
      <img
        src={`https://logo.clearbit.com/${label.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9]/g, '')}.com`}
        onError={(e) => (e.target.style.display = "none")}
        alt={`logo ${label}`}
        className="w-5 h-5 rounded"
      />
      <span>{label}</span>
    </div>
  );

  const handleAddCompany = () => {
    if (newCompany && !companies.includes(newCompany)) {
      setCompanies([...companies, newCompany]);
      setNewCompany("");
      setCompany({ label: newCompany, value: newCompany });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setEmpresas([...empresas, {
      company: company?.value || "",
      rating, contatoRH, salarioBeneficios, estruturaEmpresa,
      acessibilidadeLideranca, planoCarreiras, bemestar, estimulacaoOrganizacao, comment
    }]);
    setCompany(null);
    setRating(0);
    setComment("");
    setContatoRH(0);
    setSalarioBeneficios(0);
    setEstruturaEmpresa(0);
    setAcessibilidadeLideranca(0);
    setPlanoCarreiras(0);
    setBemestar(0);
    setEstimulacaoOrganizacao(0);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-blue-100 p-6">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-2xl">
        <div className="flex flex-col items-center mb-4">
          <img src="/logo.png" alt="Logo Trabalhei Lá" className="w-15 h-10 mb-2 mx-auto" />
          <p className="text-center mb-6 text-3xl font-extrabold text-gray-900 tracking-wide">
            Compartilhe sua experiência nas empresas!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label>Nome da Empresa</label>
            <Select 
              value={company}
              onChange={setCompany}
              options={companyOptions}
              formatOptionLabel={formatOptionLabel}
              className="mb-2"
              placeholder="Selecione uma empresa"
            />
          </div>

          <div>
            <label>Adicionar nova empresa</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                className="border p-2 rounded w-full"
                placeholder="Digite o nome da nova empresa"
              />
              <button
                type="button"
                onClick={handleAddCompany}
                className="bg-green-600 text-white px-4 rounded hover:bg-green-700"
              >
                Adicionar
              </button>
            </div>
          </div>

          {[{
            label: 'Avaliação Geral', value: rating, setter: setRating
          }, {
            label: 'Contato do RH', value: contatoRH, setter: setContatoRH
          }, {
            label: 'Salário e benefícios', value: salarioBeneficios, setter: setSalarioBeneficios
          }, {
            label: 'Estrutura da empresa', value: estruturaEmpresa, setter: setEstruturaEmpresa
          }, {
            label: 'Acessibilidade da liderança', value: acessibilidadeLideranca, setter: setAcessibilidadeLideranca
          }, {
            label: 'Plano de carreiras', value: planoCarreiras, setter: setPlanoCarreiras
          }, {
            label: 'Preocupação com o seu bem estar', value: bemestar, setter: setBemestar
          }, {
            label: 'Estímulo à organização', value: estimulacaoOrganizacao, setter: setEstimulacaoOrganizacao
          }].map((item, idx) => (
            <div key={idx}>
              <label>{item.label} <span className="font-bold">{item.value}/5</span></label>
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <FaStar key={star}
                    size={24}
                    className="cursor-pointer"
                    color={star <= item.value ? "#facc15" : "#d1d5db"}
                    onClick={() => item.setter(star)}
                  />
                ))}
              </div>
            </div>
          ))}

          <div>
            <label>Comentário</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="5"
              className="border w-[60%] p-2 rounded mb-2"
              placeholder="Descreva sua experiência"
            ></textarea>
          </div>

          <div className="mt-2">
            <LoginLinkedInButton 
              clientId="77dv5urtc8ixj3"
              redirectUri="https://trabalheila.com.br/auth/linkedin"
              onLoginSuccess={(response) => console.log("Login com sucesso:", response)}
              onLoginFailure={(error) => console.log("Falha no login:", error)}
            />
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
              <p>Salário e benefícios: ★ {emp.salarioBeneficios}/5</p>
              <p className="text-sm text-gray-600">{emp.comment}</p>
            </div>
          ))}
        </div>

        <footer className="mt-6 text-center text-sm text-gray-500">
          <a href="/politica-de-privacidade.html" className="text-blue-500 hover:underline">
            Política de Privacidade
          </a>
        </footer>
      </div>
    </div>
  );
}

export default TrabalheiLa;
