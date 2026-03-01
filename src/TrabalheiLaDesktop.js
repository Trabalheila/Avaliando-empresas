import React from "react";
import {
  FaStar, FaChartBar, FaHandshake, FaMoneyBillWave,
  FaBuilding, FaUserTie, FaHeart, FaBriefcase, FaLightbulb, FaPlus, FaCheckCircle
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

function TrabalheiLaDesktop({
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
  isLoading, handleSubmit,
  handleAddNewCompany,
  empresas,
  top3,
  calcularMedia, getMedalColor, getMedalEmoji, getBadgeColor,
  linkedInClientId, handleLinkedInLogin, handleGoogleLogin,
  isAuthenticated, error,
}) {
  const [showCommentInput, setShowCommentInput] = React.useState({});

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 text-slate-800 flex flex-col items-center p-6">
      <div className="max-w-4xl w-full">
        {/* HEADER DESKTOP - Layout correto e final */}
        <header className="bg-gradient-to-r from-indigo-700 via-purple-600 to-pink-500 rounded-3xl shadow-2xl p-8 mb-8 text-white">
          <div className="flex items-center justify-between">
            {/* Left side: Logo and Score */}
            <div className="flex items-center">
              <div className="bg-white/20 p-4 rounded-xl mr-4">
                <FaBuilding className="text-white text-4xl" />
                <p className="text-xs mt-1">Logo da Empresa</p>
              </div>
              <div>
                <p className="text-4xl font-extrabold">0.0/5</p>
                <p className="text-sm">NOTA</p>
              </div>
            </div>
            {/* Center: Title and Description */}
            <div className="flex flex-col items-center flex-grow">
              <h1 className="text-5xl font-extrabold mb-2">TRABALHEI LÁ</h1>
              <p className="text-lg text-center mb-4">Sua opinião é anônima e ajuda outros profissionais</p>
              <p className="text-sm text-center mb-6">Avaliações anônimas feitas por profissionais verificados.</p>
              <button className="bg-white text-purple-700 font-bold py-3 px-6 rounded-full shadow-lg hover:bg-gray-100 transition-all transform hover:scale-105 mb-6">
                CLIQUE E SAIBA MAIS
              </button>
            </div>
            {/* Right side: Checkmarks */}
            <div className="flex flex-col items-end space-y-2 text-white font-semibold text-sm">
              <p className="flex items-center"><FaCheckCircle className="mr-2" /> Anônimo</p>
              <p className="flex items-center"><FaCheckCircle className="mr-2" /> Verificado</p>
              <p className="flex items-center"><FaCheckCircle className="mr-2" /> Confiável</p>
            </div>
          </div>
        </header>

        {/* Conteúdo Principal (Login, Avaliação, Ranking) */}
        <div className="flex gap-6 mb-8">
          {/* COLUNA ESQUERDA - Login e Avaliação */}
          <div className="flex-1">
            <section className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100 mb-6">
              <h2 className="text-2xl font-bold text-slate-700 text-center mb-6">Login para Avaliar</h2>

              <div className="flex flex-col space-y-4 mb-8">
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

              <h2 className="text-2xl font-bold text-slate-700 text-center mb-6">Avalie uma Empresa</h2>

              <div className="mb-8">
                <label className="block text-slate-700 font-semibold text-lg mb-2">Empresa que você trabalhou:</label>
                <Select
                  options={empresas.map(emp => ({ value: emp.company, label: emp.company })).concat({ value: 'Adicionar Nova Empresa', label: 'Adicionar Nova Empresa' })}
                  value={company ? { value: company, label: company } : null}
                  onChange={(selectedOption) => setCompany(selectedOption ? selectedOption.value : '')}
                  placeholder="Selecione ou digite uma empresa"
                  isClearable
                  styles={{
                    control: (base) => ({
                      ...base,
                      padding: '0.5rem',
                      borderRadius: '0.75rem',
                      borderColor: '#d1d5db',
                      boxShadow: 'none',
                      '&:hover': { borderColor: '#9ca3af' },
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isSelected ? '#6366f1' : state.isFocused ? '#e0e7ff' : null,
                      color: state.isSelected ? 'white' : '#1f2937',
                    }),
                  }}
                />
                {company === 'Adicionar Nova Empresa' && (
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