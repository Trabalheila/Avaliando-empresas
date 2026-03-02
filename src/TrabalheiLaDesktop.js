// src/TrabalheiLaDesktop.js
import React, { useState } from "react";
import {
  FaStar, FaStar, FaChartBar, FaHandshake, FaMoneyBillWave, FaBuilding, FaUserTie, FaHeart, FaBriefcase, FaLightbulb, FaPlus, FaMinus, FaCheckCirclee
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
        <span style={{ position: "absolute", left: 0, top: 0, transform: `scale(${outlineScale})`, transformOrigin: "center" }}>
          <FaStar size={size} color="#000" />
        </span>
        <FaStar size={size} color={active ? "#facc15" : "#e5e7eb"} />
      </span>
    </button>
  );
}

function TrabalheiLaDesktop({
  empresas,
  top3,
  calcularMedia,
  getBadgeColor,
  getMedalColor,
  getMedalEmoji,
  handleLinkedInLogin,
  handleGoogleLogin,
  isAuthenticated,
  user,
  error,
  isLoading,
  linkedInClientId,
  handleAddNewCompany,
  handleSubmit,
  newCompanyName,
  setNewCompanyName,
  newCompanyArea,
  setNewCompanyArea,
  newCompanyPeriodo,
  setNewCompanyPeriodo,
  newCompanyDescription,
  setNewCompanyDescription,
  contatoRH,
  setContatoRH,
  commentContatoRH,
  setCommentContatoRH,
  salarioBeneficios,
  setSalarioBeneficios,
  commentSalarioBeneficios,
  setCommentSalarioBeneficios,
  estruturaEmpresa,
  setEstruturaEmpresa,
  commentEstruturaEmpresa,
  setCommentEstruturaEmpresa,
  acessibilidadeLideranca,
  setAcessibilidadeLideranca,
  commentAcessibilidadeLideranca,
  setCommentAcessibilidadeLideranca,
  planoCarreiras,
  setPlanoCarreiras,
  commentPlanoCarreiras,
  setCommentPlanoCarreiras,
  bemEstarAmbiente,
  setBemEstarAmbiente,
  commentBemEstarAmbiente,
  setCommentBemEstarAmbiente,
  estimulacaoOrganizacao,
  setEstimulacaoOrganizacao,
  commentEstimulacaoOrganizacao,
  setCommentEstimulacaoOrganizacao,
  generalComment,
  setGeneralComment,
  showNewCompanyForm,
  setShowNewCompanyForm,
  selectedCompany,
  setSelectedCompany,
  companyOptions,
  setCompanyOptions,
}) {
  const [showCommentInput, setShowCommentInput] = useState({});

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

  // Array de campos de avaliação - DEFINIDO AQUI, FORA DO RETURN
  const campos = [
    { label: "Contato com RH", value: contatoRH, set: setContatoRH, comment: commentContatoRH, setComment: setCommentContatoRH, icon: <FaHandshake className="text-blue-500" /> },
    { label: "Salário e Benefícios", value: salarioBeneficios, set: setSalarioBeneficios, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios, icon: <FaMoneyBillWave className="text-green-500" /> },
    { label: "Estrutura da Empresa", value: estruturaEmpresa, set: setEstruturaEmpresa, comment: commentEstruturaEmpresa, setComment: setCommentEstruturaEmpresa, icon: <FaBuilding className="text-purple-500" /> },
    { label: "Acessibilidade da Liderança", value: acessibilidadeLideranca, set: setAcessibilidadeLideranca, comment: commentAcessibilidadeLideranca, setComment: setCommentAcessibilidadeLideranca, icon: <FaUserTie className="text-red-500" /> },
    { label: "Plano de Carreiras", value: planoCarreiras, set: setPlanoCarreiras, comment: commentPlanoCarreiras, setComment: setCommentPlanoCarreiras, icon: <FaBriefcase className="text-yellow-500" /> },
    { label: "Bem-estar e Ambiente", value: bemEstarAmbiente, set: setBemEstarAmbiente, comment: commentBemEstarAmbiente, setComment: setCommentBemEstarAmbiente, icon: <FaHeart className="text-pink-500" /> },
    { label: "Estímulo e Organização", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaLightbulb className="text-orange-500" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
      <div className="w-full max-w-6xl">

        {/* CABEÇALHO - DESKTOP */}
        <header className="bg-gradient-to-r from-indigo-700 via-purple-600 to-pink-500 rounded-3xl shadow-2xl p-8 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-white/20 p-4 rounded-xl mr-4">
                <FaBuilding className="text-white text-4xl" />
                <p className="text-xs mt-1">Logo da Empresa</p>
              </div>
              <p className="text-3xl font-extrabold">0.0/5 NOTA</p>
            </div>

            <div className="text-center flex-1">
              <h1 className="text-5xl font-extrabold mb-2" style={{ fontFamily: 'Azonix, sans-serif' }}>TRABALHEI LÁ</h1>
              <p className="text-lg mb-2">Sua opinião é anônima e ajuda outros profissionais</p>
              <p className="text-sm mb-4">Avaliações anônimas feitas por profissionais verificados.</p>
              <button className="bg-white text-purple-700 font-bold py-3 px-6 rounded-full shadow-lg hover:bg-gray-100 transition-all transform hover:scale-105">
                CLIQUE E SAIBA MAIS
              </button>
            </div>

            <div className="flex flex-col space-y-2 text-white font-semibold text-base">
              <p className="flex items-center"><FaCheckCircle className="mr-2" /> Anônimo</p>
              <p className="flex items-center"><FaCheckCircle className="mr-2" /> Verificado</p>
              <p className="flex items-center"><FaCheckCircle className="mr-2" /> Confiável</p>
            </div>
          </div>
        </header>

        <div className="flex gap-6 mb-8">
          {/* COLUNA ESQUERDA - FORMULÁRIO */}
          <div className="flex-1">
            <section className="bg-white rounded-3xl shadow-xl p-8 border border-blue-100 mb-6">
              <h2 className="text-2xl font-bold text-blue-800 text-center mb-6">Avalie uma Empresa</h2>

              {/* Botões de Login */}
              <div className="flex flex-col space-y-4 mb-6">
                <LoginLinkedInButton
                  clientId={linkedInClientId}
                  onLoginSuccess={handleLinkedInLogin}
                  onLoginFailure={(err) => console.error("Falha no login LinkedIn:", err)}
                  redirectUri={process.env.REACT_APP_LINKEDIN_REDIRECT_URI}
                  className="flex items-center justify-center bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-sm hover:bg-blue-800 transition-all transform hover:scale-105"
                />
                <button
                  onClick={handleGoogleLogin}
                  className="flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-xl shadow-sm hover:bg-gray-50 transition-all transform hover:scale-105"
                >
                  <FcGoogle className="text-2xl mr-2" /> Entrar com Google
                </button>
              </div>

              {/* Seleção/Adição de Empresa */}
              <div className="mb-6">
                <label className="block text-slate-700 text-lg font-semibold mb-2">Empresa que você trabalhou:</label>
                <Select
                  options={companyOptions}
                  value={selectedCompany}
                  onChange={setSelectedCompany}
                  placeholder="Selecione ou digite uma empresa"
                  isClearable
                  className="mb-4"
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderRadius: '0.75rem', // rounded-xl
                      padding: '0.25rem', // p-1
                      borderColor: '#d1d5db', // border-gray-300
                      boxShadow: 'none',
                      '&:hover': { borderColor: '#9ca3af' }
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected ? '#8b5cf6' : state.isFocused ? '#ede9fe' : null,
                      color: state.isSelected ? 'white' : '#4b5563',
                    }),
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewCompanyForm(!showNewCompanyForm)}
                  className="w-full flex items-center justify-center bg-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-sm hover:bg-purple-700 transition-all transform hover:scale-105"
                >
                  <FaPlus className="mr-2" /> Adicionar Nova Empresa
                </button>

                {showNewCompanyForm && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">Detalhes da Nova Empresa</h3>
                    <input
                      type="text"
                      placeholder="Nome da Empresa"
                      className="w-full p-2 border border-gray-300 rounded-md mb-2 text-sm"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Área de Atuação (Ex: Tecnologia)"
                      className="w-full p-2 border border-gray-300 rounded-md mb-2 text-sm"
                      value={newCompanyArea}
                      onChange={(e) => setNewCompanyArea(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Período de Trabalho (Ex: 2020-2023)"
                      className="w-full p-2 border border-gray-300 rounded-md mb-2 text-sm"
                      value={newCompanyPeriodo}
                      onChange={(e) => setNewCompanyPeriodo(e.target.value)}
                    />
                    <textarea
                      placeholder="Descrição da Empresa (opcional)"
                      className="w-full p-2 border border-gray-300 rounded-md mb-2 text-sm"
                      rows="2"
                      value={newCompanyDescription}
                      onChange={(e) => setNewCompanyDescription(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewCompany}
                      className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      Adicionar Empresa
                    </button>
                  </div>
                )}
              </div>

              {/* Formulário de Avaliação */}
              <form onSubmit={handleSubmit}>
                <div className="space-y-4 mb-6">
                  {campos.map((campo, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <label className="w-1/3 text-slate-700 font-semibold flex items-center gap-1 text-sm">
                        {campo.icon} {campo.label}
                      </label>
                      {renderStars(campo.value, campo.set, campo.comment, campo.setComment, campo.label)}
                    </div>
                  ))}
                </div>

                <div className="mb-5">
                  <label className="text-slate-700 font-semibold text-base block mb-2">Comentário Geral</label>
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Deixe um comentário geral sobre a empresa (opcional)"
                    rows="3"
                    value={generalComment}
                    onChange={(e) => setGeneralComment(e.target.value)}
                  />
                </div>

                {error && <p className="text-red-500 text-center mb-3 text-sm">{error}</p>}

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

          {/* COLUNA DIREITA - RANKING */}
          <div className="w-80">
            <div className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100 sticky top-6">
              <h2 className="text-xl font-bold text-blue-800 text-center mb-4">🏆 Ranking de Empresas</h2>

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
                .custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #1d4ed8, #3b82f6); border-radius: 10px; }
              `}</style>
            </div>
          </div>

        </div>

        <footer className="w-full px-6 py-8 text-center">
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

export default TrabalheiLaDesktop;