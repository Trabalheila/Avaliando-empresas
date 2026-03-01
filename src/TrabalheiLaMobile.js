import React, { useState, useEffect } from "react";
import {
  FaStar, FaChartBar, FaHandshake, FaMoneyBillWave,
  FaBuilding, FaUserTie, FaHeart, FaBriefcase, FaLightbulb, FaPlus, FaMinus, // <-- ADDED FaMinus HERE
  FaCheckCircle
} from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import Select from "react-select";
import LoginLinkedInButton from "./components/LoginLinkedInButton";

function OutlinedStar({ active, onClick, size = 18, label }) {
  const outlineScale = 1.24;
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      style={{ padding: 0, margin: 0, border: 0, background: "transparent", cursor: "pointer", lineHeight: 0 }}>
      <span style={{ position: "relative", display: "inline-block", width: size, height: size, verticalAlign: "middle" }}>
        <span style={{ position: "absolute", left: 0, top: 0, transform: `scale(${outlineScale})`, transformOrigin: "center" }} aria-hidden="true">
          <FaStar size={size} color="#000" />
        </span>
        <span style={{ position: "relative" }} aria-hidden="true">
          <FaStar size={size} color={active ? "#facc15" : "#e5e7eb"} />
        </span>
      </span>
    </button>
  );
}

function TrabalheiLaMobile({
  company, setCompany,
  newCompany, setNewCompany,
  rating, setRating,
  contatoRH, setContatoRH,
  salarioBeneficios, setSalarioBeneficios,
  estruturaEmpresa, setEstruturaEmpresa,
  acessibilidadeLideranca, setAcessibilidadeLideranca,
  planoCarreiras, setPlanoCarreiras,
  bemestar, setBemestar,
  estimulacaoOrganizacao, setEstimulacaoOrganizacao,
  commentContatoRH, setCommentContatoRH,
  commentSalarioBeneficios, setCommentSalarioBeneficios,
  commentEstruturaEmpresa, setCommentEstruturaEmpresa,
  commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca,
  commentPlanoCarreiras, setCommentPlanoCarreiras,
  commentBemestar, setCommentBemestar,
  commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao,
  generalComment, setGeneralComment,
  isLoading, setIsLoading,
  companies,
  handleAddNewCompany,
  handleSubmit,
  linkedInClientId, handleLinkedInLogin, handleGoogleLogin,
  error, isAuthenticated,
  top3, empresas,
  calcularMedia, getMedalColor, getMedalEmoji, getBadgeColor,
}) {
  const [showCommentInput, setShowCommentInput] = useState({});
  const [showNewCompanyInput, setShowNewCompanyInput] = useState(false);

  // Define campos array *AQUI*, antes do return
  const campos = [
    { label: "Contato com RH", value: contatoRH, set: setContatoRH, comment: commentContatoRH, setComment: setCommentContatoRH, icon: <FaHandshake className="text-blue-500" /> },
    { label: "Salário e Benefícios", value: salarioBeneficios, set: setSalarioBeneficios, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios, icon: <FaMoneyBillWave className="text-green-500" /> },
    { label: "Estrutura da Empresa", value: estruturaEmpresa, set: setEstruturaEmpresa, comment: commentEstruturaEmpresa, setComment: setCommentEstruturaEmpresa, icon: <FaBuilding className="text-purple-500" /> },
    { label: "Acessibilidade da Liderança", value: acessibilidadeLideranca, set: setAcessibilidadeLideranca, comment: commentAcessibilidadeLideranca, setComment: setCommentAcessibilidadeLideranca, icon: <FaUserTie className="text-red-500" /> },
    { label: "Plano de Carreiras", value: planoCarreiras, set: setPlanoCarreiras, comment: commentPlanoCarreiras, setComment: setCommentPlanoCarreiras, icon: <FaBriefcase className="text-yellow-500" /> },
    { label: "Bem-estar e Ambiente", value: bemestar, set: setBemestar, comment: commentBemestar, setComment: setCommentBemestar, icon: <FaHeart className="text-pink-500" /> },
    { label: "Estímulo e Organização", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaLightbulb className="text-orange-500" /> },
  ];

  const renderStars = (currentRating, setRating, currentComment, setComment, label) => (
    <div className="flex items-center gap-2">
      {[...Array(5)].map((_, i) => {
        const ratingValue = i + 1;
        return (
          <OutlinedStar
            key={i}
            active={ratingValue <= currentRating}
            onClick={() => setRating(ratingValue)}
            label={`${ratingValue} estrelas para ${label}`}
          />
        );
      })}
      {currentRating > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCommentInput(prev => ({ ...prev, [label]: !prev[label] }))}
            className="text-gray-500 hover:text-gray-700 transition-colors text-sm ml-2"
            aria-label={`Adicionar comentário para ${label}`}
          >
            {showCommentInput[label] ? <FaMinus /> : <FaPlus />}
          </button>
          {showCommentInput[label] && (
            <div className="absolute z-10 bg-white p-3 rounded-lg shadow-lg border border-gray-200 mt-2 w-64 right-0">
              <textarea
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={`Comentário para ${label}`}
                rows="2"
                value={currentComment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 text-slate-800 flex flex-col items-center p-4">
      <div className="max-w-md w-full">

        {/* HEADER - MOBILE LAYOUT (ADAPTADO DO DESKTOP) */}
        <header className="bg-gradient-to-r from-indigo-700 via-purple-600 to-pink-500 rounded-3xl shadow-2xl p-6 mb-6 text-white">
          <div className="flex flex-col items-center text-center"> {/* Changed to flex-col for mobile */}
            {/* Logo and Score - Centered for mobile */}
            <div className="flex items-center mb-4">
              <div className="bg-white/20 p-3 rounded-xl mr-3">
                <FaBuilding className="text-white text-3xl" />
                <p className="text-xs mt-1">Logo da Empresa</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold">0.0/5</p>
                <p className="text-sm">NOTA</p>
              </div>
            </div>
            {/* Title and Description - Centered for mobile */}
            <h1 className="text-4xl font-extrabold mb-2">TRABALHEI LÁ</h1>
            <p className="text-base mb-3">Sua opinião é anônima e ajuda outros profissionais</p>
            <p className="text-sm mb-4">Avaliações anônimas feitas por profissionais verificados.</p>
            <button className="bg-white text-purple-700 font-bold py-2 px-5 rounded-full shadow-lg hover:bg-gray-100 transition-all transform hover:scale-105 mb-4">
              CLIQUE E SAIBA MAIS
            </button>
            {/* Checkmarks - Centered for mobile */}
            <div className="flex flex-col items-center space-y-1 text-white font-semibold text-sm">
              <p className="flex items-center"><FaCheckCircle className="mr-2" /> Anônimo</p>
              <p className="flex items-center"><FaCheckCircle className="mr-2" /> Verificado</p>
              <p className="flex items-center"><FaCheckCircle className="mr-2" /> Confiável</p>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-6 mb-6">

          {/* SEÇÃO DE LOGIN E AVALIAÇÃO */}
          <div className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-blue-800 text-center mb-6">Login para Avaliar</h2>
              <div className="space-y-4 mb-6">
                <button onClick={handleGoogleLogin}
                  className="flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-xl shadow-sm hover:bg-gray-50 transition-all transform hover:scale-105">
                  <FcGoogle className="mr-3 text-2xl" />
                  Entrar com Google
                </button>
                <LoginLinkedInButton
                  clientId={linkedInClientId}
                  redirectUri={process.env.REACT_APP_LINKEDIN_REDIRECT_URI}
                  onLoginSuccess={handleLinkedInLogin}
                  onLoginFailure={(err) => console.error("Falha no login LinkedIn:", err)}
                  className="flex items-center justify-center bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-sm hover:bg-blue-800 transition-all transform hover:scale-105"
                />
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-blue-800 text-center mb-6">Avalie uma Empresa</h2>
              <div className="mb-6">
                <label htmlFor="company-select" className="text-slate-700 font-semibold text-lg block mb-2">Selecione a Empresa</label>
                <Select
                  id="company-select"
                  options={companies.map(c => ({ value: c.id, label: c.name }))}
                  value={company ? { value: company.id, label: company.name } : null}
                  onChange={(selectedOption) => setCompany(selectedOption ? { id: selectedOption.value, name: selectedOption.label } : null)}
                  placeholder="Buscar ou selecionar..."
                  isClearable
                  className="react-select-container"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({ ...base, padding: '0.5rem', borderRadius: '0.75rem', borderColor: '#d1d5db', boxShadow: 'none', '&:hover': { borderColor: '#a78bfa' } }),
                    placeholder: (base) => ({ ...base, color: '#9ca3af' }),
                    singleValue: (base) => ({ ...base, color: '#334155' }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isFocused ? '#ede9fe' : 'white',
                      color: '#334155',
                      '&:active': { backgroundColor: '#c4b5fd' },
                    }),
                  }}
                />
                <button
                  onClick={() => setShowNewCompanyInput(!showNewCompanyInput)}
                  className="mt-4 w-full bg-purple-600 text-white p-3 rounded-xl hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
                >
                  <FaPlus /> Adicionar Nova Empresa
                </button>
                {showNewCompanyInput && (
                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      className="flex-1 p-3 border border-gray-300 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nome da nova empresa"
                      value={newCompany}
                      onChange={(e) => setNewCompany(e.target.value)}
                    />
                    <button
                      onClick={handleAddNewCompany}
                      className="bg-green-600 text-white p-4 rounded-xl hover:bg-green-700 transition-all"
                    >
                      Adicionar
                    </button>
                  </div>
                )}
              </div>

              {/* Formulário de Avaliação */}
              <form onSubmit={handleSubmit}>
                <div className="space-y-8 mb-10">
                  {campos.map((campo, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <label className="w-1/3 text-slate-700 font-semibold flex items-center gap-2">
                        {campo.icon} {campo.label}
                      </label>
                      {renderStars(campo.value, campo.set, campo.comment, campo.setComment, campo.label)}
                    </div>
                  ))}
                </div>

                <div className="mb-6">
                  <label className="text-slate-700 font-semibold text-lg block mb-2">Comentário Geral</label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Deixe um comentário geral sobre a empresa (opcional)"
                    rows="4"
                    value={generalComment}
                    onChange={(e) => setGeneralComment(e.target.value)}
                  />
                </div>

                {error && <p className="text-red-500 text-center mb-4">{error}</p>}

                <div className="text-center">
                  <button
                    type="submit"
                    className={`px-8 py-4 rounded-full font-extrabold text-white text-lg transition-all transform ${
                      isAuthenticated
                        ? "bg-gradient-to-r from-purple-600 to-violet-600 hover:shadow-2xl hover:scale-[1.02]"
                        : "bg-slate-400 cursor-not-allowed opacity-60"
                    }`}
                    disabled={!isAuthenticated || isLoading}
                  >
                    {isLoading ? "Enviando..." : isAuthenticated ? "Enviar avaliação" : "Faça login para avaliar"}
                  </button>
                </div>
              </form>
            </section>
          </div>

          {/* SEÇÃO DE RANKING (MOBILE) */}
          <div className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100">
            <h2 className="text-2xl font-bold text-blue-800 text-center mb-6">🏆 Melhores Empresas</h2>

            {Array.isArray(top3) && top3.length > 0 && (
              <div className="mb-4 space-y-2">
                {top3.map((emp, i) => {
                  const media = calcularMedia(emp);
                  return (
                    <div key={i} className={`bg-gradient-to-r ${getMedalColor(i)} rounded-2xl p-3 text-white`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{getMedalEmoji(i)}</span>
                          <p className="font-bold text-sm">{emp.company}</p>
                        </div>
                        <div className="bg-white/20 px-2 py-1 rounded-full font-bold text-xs">{media} ⭐</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {Array.isArray(empresas) && empresas.length === 0 ? (
                <div className="text-center py-6">
                  <FaChartBar className="text-gray-300 text-4xl mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Nenhuma avaliação ainda</p>
                </div>
              ) : (
                (empresas || []).slice(3).map((emp, i) => {
                  const media = calcularMedia(emp);
                  return (
                    <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-200 hover:border-blue-300 transition-all">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-gray-800 text-sm">{emp.company}</p>
                        <div className={`${getBadgeColor(media)} px-2 py-1 rounded-full text-white font-bold text-xs`}>{media} ⭐</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <style>{`
              .custom-scrollbar::-webkit-scrollbar { width: 6px; }
              .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
              .custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #8b5cf6, #ec4899); border-radius: 10px; }
            `}</style>
          </div>

        </div>

        {/* FOOTER */}
        <footer className="mb-6 text-center">
          <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-5 border border-blue-100">
            <p className="text-slate-700 text-sm">
              <a href="/politica-de-privacidade.html" className="text-blue-700 hover:text-blue-900 font-extrabold underline">
                Política de Privacidade
              </a>
              {" • "}
              <span>© 2026 Trabalhei Lá - Todos os direitos reservados</span>
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}

export default TrabalheiLaMobile;