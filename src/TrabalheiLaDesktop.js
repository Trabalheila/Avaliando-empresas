// src/TrabalheiLaDesktop.js
import React from "react";
import {
  FaChartBar, // Mantido para o caso de "Nenhuma avaliação ainda"
  FaCheckCircle, // Mantido para os ícones de verificação
} from "react-icons/fa";
import Select from "react-select";
import LoginLinkedInButton from "./components/LoginLinkedInButton";
import OutlinedStar from "./components/OutlinedStar"; // Importado corretamente

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
  commentRating, setCommentRating,
  commentContatoRH, setCommentContatoRH,
  commentSalarioBeneficios, setCommentSalarioBeneficios,
  commentEstruturaEmpresa, setCommentEstruturaEmpresa,
  commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca,
  commentPlanoCarreiras, setCommentPlanoCarreiras,
  commentBemestar, setCommentBemestar,
  commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao,
  generalComment, setGeneralComment,
  handleSubmit, isLoading, empresas, top3,
  showNewCompanyInput, setShowNewCompanyInput, handleAddNewCompany,
  linkedInClientId,
  error, isAuthenticated, setIsAuthenticated,
  selectedCompanyData, calcularMedia,
  getMedalColor, getMedalEmoji, getBadgeColor,
  safeCompanyOptions,
}) {
  const linkedInRedirectUri = process.env.REACT_APP_LINKEDIN_REDIRECT_URI;

  const campos = [
    { label: "Avaliação Geral", state: rating, setter: setRating, commentState: commentRating, commentSetter: setCommentRating },
    { label: "Contato com RH", state: contatoRH, setter: setContatoRH, commentState: commentContatoRH, commentSetter: setCommentContatoRH },
    { label: "Salário e Benefícios", state: salarioBeneficios, setter: setSalarioBeneficios, commentState: commentSalarioBeneficios, commentSetter: setCommentSalarioBeneficios },
    { label: "Estrutura da Empresa", state: estruturaEmpresa, setter: setEstruturaEmpresa, commentState: commentEstruturaEmpresa, commentSetter: setCommentEstruturaEmpresa },
    { label: "Acessibilidade da Liderança", state: acessibilidadeLideranca, setter: setAcessibilidadeLideranca, commentState: commentAcessibilidadeLideranca, commentSetter: setCommentAcessibilidadeLideranca },
    { label: "Plano de Carreiras", state: planoCarreiras, setter: setPlanoCarreiras, commentState: commentPlanoCarreiras, commentSetter: setCommentPlanoCarreiras },
    { label: "Bem-estar e Ambiente", state: bemestar, setter: setBemestar, commentState: commentBemestar, commentSetter: setCommentBemestar },
    { label: "Estimulação e Organização", state: estimulacaoOrganizacao, setter: setEstimulacaoOrganizacao, commentState: commentEstimulacaoOrganizacao, commentSetter: setCommentEstimulacaoOrganizacao },
  ];

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('userProfile'); // Limpa o perfil do usuário
    // Redireciona para a home ou recarrega a página
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 flex flex-col items-center p-4">
      <div className="w-full max-w-6xl mx-auto"> {/* Max width para desktop */}
        {/* HEADER */}
        <header className="mb-6 text-center">
          <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-5 border border-blue-100 shadow-lg">
            <h1 className="text-5xl font-extrabold text-blue-800 mb-2 azonix">TRABALHEI LÁ</h1>
            <p className="text-slate-600 text-lg">Sua opinião é anônima e ajuda outros profissionais.</p>
            <div className="flex justify-center items-center gap-6 mt-3">
              <span className="flex items-center text-base text-slate-500">
                <FaCheckCircle className="text-green-500 mr-2" /> Anônimo
              </span>
              <span className="flex items-center text-base text-slate-500">
                <FaCheckCircle className="text-green-500 mr-2" /> Verificado
              </span>
              <span className="flex items-center text-base text-slate-500">
                <FaCheckCircle className="text-green-500 mr-2" /> Confiável
              </span>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT - Desktop layout com duas colunas */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 mb-6">
          {/* Coluna Esquerda: Avaliação e Login */}
          <section className="bg-white/70 backdrop-blur-lg rounded-2xl p-6 border border-blue-100 shadow-lg mb-6 lg:mb-0">
            <h2 className="text-3xl font-bold text-blue-800 text-center mb-6">Avalie uma Empresa</h2>

            {/* SELEÇÃO DE EMPRESA */}
            <div className="mb-6">
              <label htmlFor="company-select" className="block text-slate-700 text-base font-bold mb-2">
                Selecione a empresa:
              </label>
              <Select
                id="company-select"
                options={safeCompanyOptions}
                value={company}
                onChange={setCompany}
                placeholder="Buscar ou adicionar empresa..."
                isClearable
                className="react-select-container"
                classNamePrefix="react-select"
              />
              {selectedCompanyData && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200 text-center">
                  <img
                    src={`https://logo.clearbit.com/${selectedCompanyData.company.toLowerCase().replace(/\s/g, '')}.com`}
                    alt={`${selectedCompanyData.company} logo`}
                    className="h-20 w-20 mx-auto mb-3 object-contain"
                    onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/80x80?text=Logo"; }}
                  />
                  <p className="text-2xl font-bold text-blue-800">{selectedCompanyData.company}</p>
                  <p className="text-3xl font-extrabold text-purple-700 mt-2">
                    {calcularMedia(selectedCompanyData)}/5.0 ⭐
                  </p>
                </div>
              )}
            </div>

            {/* ADICIONAR NOVA EMPRESA */}
            <div className="mb-6">
              <button
                onClick={() => setShowNewCompanyInput(!showNewCompanyInput)}
                className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-full hover:bg-blue-600 transition-colors text-base"
              >
                {showNewCompanyInput ? "Cancelar" : "Adicionar Nova Empresa"}
              </button>
              {showNewCompanyInput && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder="Nome da nova empresa"
                    className="flex-grow p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
                  />
                  <button
                    onClick={handleAddNewCompany}
                    className="bg-green-500 text-white font-bold py-2 px-4 rounded-full hover:bg-green-600 transition-colors text-base"
                  >
                    Adicionar
                  </button>
                </div>
              )}
            </div>

            {/* CAMPOS DE AVALIAÇÃO */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 mb-6">
                {campos.map((campo, index) => (
                  <div key={index} className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <label className="block text-slate-700 text-base font-bold mb-2">
                      {campo.label}:
                    </label>
                    <div className="flex items-center gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <OutlinedStar
                          key={star}
                          filled={star <= campo.state}
                          onClick={() => campo.setter(star)}
                        />
                      ))}
                      <span className="ml-2 text-slate-600 text-base">{campo.state} Estrelas</span>
                    </div>
                    <textarea
                      value={campo.commentState}
                      onChange={(e) => campo.commentSetter(e.target.value)}
                      placeholder={`Comentário sobre ${campo.label.toLowerCase()} (opcional)`}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
                      rows="2"
                    ></textarea>
                  </div>
                ))}
              </div>

              {/* COMENTÁRIO GERAL */}
              <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                <label htmlFor="general-comment" className="block text-slate-700 text-base font-bold mb-2">
                  Comentário Geral (opcional):
                </label>
                <textarea
                  id="general-comment"
                  value={generalComment}
                  onChange={(e) => setGeneralComment(e.target.value)}
                  placeholder="Compartilhe sua experiência geral na empresa..."
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
                  rows="3"
                ></textarea>
              </div>

              {/* BOTÕES DE LOGIN E SUBMIT */}
              <div className="space-y-3">
                {error && <p className="text-red-500 text-center text-base">{error}</p>}

                {!isAuthenticated ? (
                  <>
                    <LoginLinkedInButton
                      clientId={linkedInClientId}
                      redirectUri={linkedInRedirectUri}
                    />
                    {/* <button
                      onClick={handleGoogleLogin} // Removido conforme sua instrução
                      className="flex items-center justify-center gap-3 bg-red-500 text-white font-semibold py-2 px-4 rounded-full shadow-lg hover:bg-red-600 transition-colors text-base w-full"
                    >
                      <FcGoogle className="text-lg" /> Entrar com Google
                    </button> */}
                  </>
                ) : (
                  <>
                    <p className="text-green-600 text-center text-base font-semibold">
                      Login realizado com sucesso! Sua avaliação será anônima.
                    </p>
                    <button
                      type="submit"
                      className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-full shadow-lg hover:bg-purple-700 transition-colors text-lg"
                      disabled={isLoading}
                    >
                      {isLoading ? "Enviando..." : "Enviar Avaliação"}
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full bg-gray-400 text-white font-bold py-2 px-4 rounded-full hover:bg-gray-500 transition-colors text-base"
                    >
                      Sair
                    </button>
                  </>
                )}
              </div>
            </form>
          </section>

          {/* Coluna Direita: Ranking */}
          <section className="bg-white/70 backdrop-blur-lg rounded-2xl p-6 border border-blue-100 shadow-lg">
            <h2 className="text-3xl font-bold text-blue-800 text-center mb-6">
              🏆 Melhores Empresas
            </h2>

            {Array.isArray(top3) && top3.length > 0 && (
              <div className="mb-6 space-y-3">
                {top3.map((emp, i) => {
                  const media = calcularMedia(emp);
                  return (
                    <div
                      key={i}
                      className={`bg-gradient-to-r ${getMedalColor(i)} rounded-2xl p-4 text-white`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{getMedalEmoji(i)}</span>
                          <p className="font-bold text-lg">{emp.company}</p>
                        </div>
                        <div className="bg-white/20 px-3 py-1 rounded-full font-bold text-base">{media} ⭐</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto custom-scrollbar"> {/* Altura ajustada para desktop */}
              {Array.isArray(empresas) && empresas.length === 0 ? (
                <div className="text-center py-10">
                  <FaChartBar className="text-gray-300 text-5xl mx-auto mb-3" />
                  <p className="text-gray-500 text-lg">Nenhuma avaliação ainda</p>
                </div>
              ) : (
                (empresas || []).slice(3).map((emp, i) => {
                  const media = calcularMedia(emp);
                  return (
                    <div key={i} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-blue-300 transition-all">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-gray-800 text-base">{emp.company}</p>
                        <div className={`${getBadgeColor(media)} px-3 py-1 rounded-full text-white font-bold text-sm`}>{media} ⭐</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <style>{`
              .custom-scrollbar::-webkit-scrollbar { width: 8px; }
              .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
              .custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #8b5cf6, #ec4899); border-radius: 10px; }
            `}</style>
          </section>
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

export default TrabalheiLaDesktop;