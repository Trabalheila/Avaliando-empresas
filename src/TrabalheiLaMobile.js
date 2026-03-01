import React, { useState, useEffect } from "react";
import {
  FaStar, FaChartBar, FaHandshake, FaMoneyBillWave,
  FaBuilding, FaUserTie, FaHeart, FaBriefcase, FaLightbulb, FaPlus, FaMinus, // <-- FaMinus ADICIONADO AQUI
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
  empresas,
  top3,
  isLoading,
  isAuthenticated,
  error,
  handleLinkedInLogin,
  handleGoogleLogin,
  handleSubmit,
  handleAddNewCompany,
  linkedInClientId,
  calcularMedia,
  getMedalColor,
  getMedalEmoji,
  getBadgeColor,
}) {
  const [showCommentInput, setShowCommentInput] = useState({});

  // FUNÇÃO renderStars (CORRIGIDA: usa FaMinus e FaPlus)
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
            {showCommentInput[label] ? <FaMinus /> : <FaPlus />} {/* <-- FaMinus e FaPlus usados aqui */}
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

  // DEFINIÇÃO DO ARRAY campos (MOVIDO PARA FORA DO RETURN PARA EVITAR ERROS ESTRUTURAIS)
  const campos = [
    { label: "Contato com RH", value: contatoRH, set: setContatoRH, comment: commentContatoRH, setComment: setCommentContatoRH, icon: <FaHandshake className="text-blue-500" /> },
    { label: "Salário e Benefícios", value: salarioBeneficios, set: setSalarioBeneficios, comment: commentSalarioBeneficios, setComment: setCommentSalarioBeneficios, icon: <FaMoneyBillWave className="text-green-500" /> },
    { label: "Estrutura da Empresa", value: estruturaEmpresa, set: setEstruturaEmpresa, comment: commentEstruturaEmpresa, setComment: setCommentEstruturaEmpresa, icon: <FaBuilding className="text-purple-500" /> },
    { label: "Acessibilidade da Liderança", value: acessibilidadeLideranca, set: setAcessibilidadeLideranca, comment: commentAcessibilidadeLideranca, setComment: setCommentAcessibilidadeLideranca, icon: <FaUserTie className="text-red-500" /> },
    { label: "Plano de Carreiras", value: planoCarreiras, set: setPlanoCarreiras, comment: commentPlanoCarreiras, setComment: setCommentPlanoCarreiras, icon: <FaBriefcase className="text-yellow-500" /> },
    { label: "Bem-estar e Ambiente", value: bemestar, set: setBemestar, comment: commentBemestar, setComment: setCommentBemestar, icon: <FaHeart className="text-pink-500" /> },
    { label: "Estímulo e Organização", value: estimulacaoOrganizacao, set: setEstimulacaoOrganizacao, comment: commentEstimulacaoOrganizacao, setComment: setCommentEstimulacaoOrganizacao, icon: <FaLightbulb className="text-orange-500" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 text-slate-800 flex flex-col items-center p-4"> {/* Padding ajustado para mobile */}
      <div className="max-w-full w-full"> {/* Largura máxima ajustada para mobile */}
        {/* CABEÇALHO (MOBILE) - ADAPTADO DO DESKTOP */}
        <header className="bg-gradient-to-r from-indigo-700 via-purple-600 to-pink-500 rounded-3xl shadow-2xl p-6 mb-6 text-white"> {/* Padding e margin ajustados */}
          <div className="flex flex-col items-center justify-center text-center"> {/* Flex column para mobile */}
            {/* Topo: Logo e Nota */}
            <div className="flex items-center justify-center mb-4"> {/* Centralizado */}
              <div className="bg-white/20 p-3 rounded-xl mr-3"> {/* Padding e margin ajustados */}
                <FaBuilding className="text-white text-3xl" /> {/* Tamanho do ícone ajustado */}
                <p className="text-xs mt-1">Logo da Empresa</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold">0.0/5</p> {/* Tamanho da fonte ajustado */}
                <p className="text-sm">NOTA</p>
              </div>
            </div>
            {/* Centro: Título e Descrição */}
            <div className="flex flex-col items-center flex-grow mb-4"> {/* Margin ajustado */}
              <h1 className="text-4xl font-extrabold mb-2">TRABALHEI LÁ</h1> {/* Tamanho da fonte ajustado */}
              <p className="text-base text-center mb-3">Sua opinião é anônima e ajuda outros profissionais</p> {/* Tamanho da fonte ajustado */}
              <p className="text-sm text-center mb-4">Avaliações anônimas feitas por profissionais verificados.</p> {/* Tamanho da fonte ajustado */}
              <button className="bg-white text-purple-700 font-bold py-2 px-5 rounded-full shadow-lg hover:bg-gray-100 transition-all transform hover:scale-105 mb-4"> {/* Padding e margin ajustados */}
                CLIQUE E SAIBA MAIS
              </button>
            </div>
            {/* Base: Checkmarks */}
            <div className="flex flex-col items-center space-y-1 text-white font-semibold text-xs"> {/* Flex column e tamanho da fonte ajustados */}
              <p className="flex items-center"><FaCheckCircle className="mr-1" /> Anônimo</p>
              <p className="flex items-center"><FaCheckCircle className="mr-1" /> Verificado</p>
              <p className="flex items-center"><FaCheckCircle className="mr-1" /> Confiável</p>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-6 mb-8"> {/* Flex column padrão para mobile */}
          {/* COLUNA ESQUERDA - FORMULÁRIO */}
          <div className="flex-1">
            <section className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100 mb-6">
              <h2 className="text-2xl font-bold text-blue-800 text-center mb-6">Login para Avaliar</h2>
              <div className="space-y-4 mb-6">
                <LoginLinkedInButton
                  clientId={linkedInClientId}
                  onLoginSuccess={handleLinkedInLogin}
                  onLoginFailure={(err) => console.error("Falha no login LinkedIn:", err)}
                  redirectUri={process.env.REACT_APP_LINKEDIN_REDIRECT_URI}
                  className="flex items-center justify-center bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-sm hover:bg-blue-800 transition-all transform hover:scale-105"
                />
                <button onClick={handleGoogleLogin}
                  className="flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-xl shadow-sm hover:bg-gray-50 transition-all transform hover:scale-105">
                  <FcGoogle className="mr-3 text-2xl" />
                  Entrar com Google
                </button>
              </div>
            </section>

            <section className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100">
              <h2 className="text-2xl font-bold text-blue-800 text-center mb-6">Avalie uma Empresa</h2>
              <div className="mb-6">
                <label htmlFor="company-select" className="text-slate-700 font-semibold text-lg block mb-2">Empresa que você trabalhou:</label>
                <Select
                  id="company-select"
                  options={empresas.map(emp => ({ value: emp.company, label: emp.company }))}
                  value={company ? { value: company, label: company } : null}
                  onChange={(selectedOption) => setCompany(selectedOption ? selectedOption.value : '')}
                  placeholder="Selecione ou digite uma empresa..."
                  isClearable
                  isSearchable
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
                {company === '' && (
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={handleAddNewCompany}
                      className="bg-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-md hover:bg-purple-700 transition-all transform hover:scale-105"
                    >
                      <FaPlus className="inline-block mr-2" /> Adicionar Nova Empresa
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