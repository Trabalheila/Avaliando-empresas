    import React from "react";
    import {
      FaStar,
      FaChartBar,
      FaHandshake,
      FaMoneyBillWave,
      FaBuilding,
      FaUserTie,
      FaHeart,
      FaBriefcase,
      FaLightbulb,
      FaPlus, // Para o botão de adicionar nova empresa
      FaLock, // Re-importado para o card de privacidade, caso seja reintroduzido ou usado em outro lugar
    } from "react-icons/fa";
    import { FcGoogle } from "react-icons/fc"; // Re-importado para o botão de login
    import Select from "react-select";

    import LoginLinkedInButton from "./components/LoginLinkedInButton"; // Re-importado para o botão de login

    /** ⭐ Estrela com contorno preto */
    function OutlinedStar({ active, onClick, size = 18, label }) {
      const outlineScale = 1.24;

      return (
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          title={label}
          style={{
            padding: 0,
            margin: 0,
            border: 0,
            background: "transparent",
            cursor: "pointer",
            lineHeight: 0,
          }}
        >
          <span
            style={{
              position: "relative",
              display: "inline-block",
              width: size,
              height: size,
              verticalAlign: "middle",
            }}
          >
            {/* contorno */}
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: `scale(${outlineScale})`,
                transformOrigin: "center",
              }}
              aria-hidden="true"
            >
              <FaStar size={size} color="#000" />
            </span>

            {/* estrela principal */}
            <span style={{ position: "relative" }} aria-hidden="true">
              <FaStar size={size} color={active ? "#facc15" : "#e5e7eb"} />
            </span>
          </span>
        </button>
      );
    }

    function TrabalheiLaMobile({
      company,
      setCompany,
      newCompany,
      setNewCompany,
      rating,
      setRating,
      contatoRH,
      setContatoRH,
      salarioBeneficios,
      setSalarioBeneficios,
      estruturaEmpresa,
      setEstruturaEmpresa,
      acessibilidadeLideranca,
      setAcessibilidadeLideranca,
      planoCarreiras,
      setPlanoCarreiras,
      bemestar,
      setBemestar,
      estimulacaoOrganizacao,
      setEstimulacaoOrganizacao,
      commentRating,
      setCommentRating,
      commentContatoRH,
      setCommentContatoRH,
      commentSalarioBeneficios,
      setCommentSalarioBeneficios,
      commentEstruturaEmpresa,
      setCommentEstruturaEmpresa,
      commentAcessibilidadeLideranca,
      setCommentAcessibilidadeLideranca,
      commentPlanoCarreiras,
      setCommentPlanoCarreiras,
      commentBemestar,
      setCommentBemestar,
      commentEstimulacaoOrganizacao,
      setCommentEstimulacaoOrganizacao,
      generalComment, // Novo estado para o comentário geral
      setGeneralComment, // Novo setter para o comentário geral
      handleSubmit,
      isLoading,
      empresas,
      top3,
      setTop3,
      // Estados para a nova empresa
      showNewCompanyInput,
      setShowNewCompanyInput,
      handleAddNewCompany,
      // Login
      linkedInClientId,
      handleLinkedInLogin,
      handleGoogleLogin,
    }) {
      // Funções auxiliares para o cálculo da média e cores
      const calcularMedia = (emp) => {
        const sum =
          emp.rating +
          emp.contatoRH +
          emp.salarioBeneficios +
          emp.estruturaEmpresa +
          emp.acessibilidadeLideranca +
          emp.planoCarreiras +
          emp.bemestar +
          emp.estimulacaoOrganizacao;
        return (sum / 8).toFixed(1);
      };

      const getBadgeColor = (media) => {
        if (media >= 4.5) return "bg-green-500";
        if (media >= 3.5) return "bg-yellow-500";
        return "bg-red-500";
      };

      // A função getMedalColor foi removida pois não é mais utilizada com o novo cabeçalho.

      const getMedalEmoji = (index) => {
        if (index === 0) return "🥇";
        if (index === 1) return "🥈";
        if (index === 2) return "🥉";
        return "🏅";
      };

      // Estilos para o componente Select (mantidos)
      const selectStyles = {
        control: (base, state) => ({
          ...base,
          borderRadius: "0.75rem", // rounded-xl
          padding: "0.25rem", // p-1
          borderColor: state.isFocused ? "#8b5cf6" : "#e5e7eb", // focus:border-purple-500
          boxShadow: state.isFocused ? "0 0 0 1px #8b5cf6" : "none", // focus:ring-1 focus:ring-purple-500
          "&:hover": {
            borderColor: state.isFocused ? "#8b5cf6" : "#d1d5db",
          },
        }),
        option: (base, state) => ({
          ...base,
          backgroundColor: state.isFocused ? "#ede9fe" : "white", // focus:bg-purple-100
          color: "#4a5568", // text-gray-700
          "&:active": {
            backgroundColor: "#d8b4fe", // active:bg-purple-200
          },
        }),
        singleValue: (base) => ({
          ...base,
          color: "#4a5568", // text-gray-700
          fontWeight: "600", // font-semibold
        }),
        placeholder: (base) => ({
          ...base,
          color: "#a0aec0", // text-gray-500
        }),
      };

      // Componente auxiliar para renderizar as estrelas e o campo de comentário
      const renderStars = (currentRating, setRatingFn, comment, setCommentFn, labelText) => (
        <div className="flex flex-col items-start w-full md:w-2/3">
          <div className="flex items-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <OutlinedStar
                key={star}
                active={star <= currentRating}
                onClick={() => setRatingFn(star)}
                label={`${star} de 5 estrelas para ${labelText}`}
              />
            ))}
            <span className="ml-2 text-slate-600 font-medium">
              {currentRating > 0 ? `${currentRating} Estrela${currentRating > 1 ? "s" : ""}` : "Não avaliado"}
            </span>
          </div>
          <textarea
            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
            placeholder={`Comentário sobre ${labelText.toLowerCase()} (opcional)`}
            value={comment}
            onChange={(e) => setCommentFn(e.target.value)}
          ></textarea>
        </div>
      );

      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 font-sans text-gray-800">
          <div className="max-w-full mx-auto px-4 py-8">
            {/* Novo Cabeçalho - Conforme a imagem */}
            <header className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 mb-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                {/* Seção Esquerda (Logo Petrobras e Nota) - Exemplo Estático */}
                <div className="flex-shrink-0 text-center md:text-left">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Petrobras_logo.svg/1200px-Petrobras_logo.svg.png" // Exemplo de logo
                    alt="Petrobras Logo"
                    className="h-12 w-auto mx-auto md:mx-0 mb-2"
                  />
                  <p className="text-sm font-bold text-gray-700">Nota: 4.5/5 ⭐</p>
                </div>

                {/* Seção Central (Título, Subtítulos, Botão, Tags) */}
                <div className="flex-grow text-center">
                  <h1 className="text-4xl font-extrabold text-purple-700 mb-2 leading-tight">
                    Trabalhei Lá
                  </h1>
                  <p className="text-lg text-gray-600 mb-3">
                    Sua opinião é anônima e ajuda outros profissionais.
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Avaliações anônimas feitas por profissionais verificados.
                  </p>
                  <button
                    onClick={() => alert("Funcionalidade 'Saiba Mais' em desenvolvimento!")} // Ação temporária
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2 px-6 rounded-full shadow-lg transition-all transform hover:scale-105 mb-4"
                  >
                    Clique e Saiba Mais
                  </button>
                  <div className="flex justify-center gap-3 text-sm font-medium text-gray-500">
                    <span className="bg-gray-100 px-3 py-1 rounded-full">Anônimo</span>
                    <span className="bg-gray-100 px-3 py-1 rounded-full">Verificado</span>
                    <span className="bg-gray-100 px-3 py-1 rounded-full">Confiável</span>
                  </div>
                </div>

                {/* Seção Direita (Melhores Empresas - Ranking) */}
                <div className="flex-shrink-0 w-full md:w-1/4 bg-purple-50 p-4 rounded-2xl shadow-inner mt-6 md:mt-0">
                  <h3 className="text-lg font-bold text-purple-700 mb-3 text-center">
                    Melhores Empresas
                  </h3>
                  {Array.isArray(top3) && top3.length > 0 ? (
                    <div className="space-y-2">
                      {top3.map((emp, t) => (
                        <div
                          key={t}
                          className={`flex items-center justify-between p-2 rounded-xl ${
                            t === 0
                              ? "bg-yellow-100 border-yellow-300"
                              : t === 1
                              ? "bg-gray-100 border-gray-300"
                              : "bg-amber-100 border-amber-300"
                          } border`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{getMedalEmoji(t)}</span>
                            <span className="font-semibold text-gray-800 text-sm">
                              {emp.company}
                            </span>
                          </div>
                          <span className="font-bold text-purple-600 text-sm">
                            {calcularMedia(emp)} ⭐
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-gray-500">
                      Nenhuma empresa no ranking ainda.
                    </p>
                  )}
                </div>
              </div>
            </header>

            {/* Seção de Avaliação */}
            <section className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 mt-6">
              <h2 className="text-3xl font-bold text-slate-700 text-center mb-6">
                Avalie uma Empresa
              </h2>

              {/* Botões de Login (Reintroduzidos, posicionamento a ser definido) */}
              <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
                <LoginLinkedInButton onClick={handleLinkedInLogin} />
                <button
                  onClick={handleGoogleLogin}
                  className="flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-xl shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <FcGoogle className="text-xl" />
                  Entrar com Google
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Seleção de Empresa */}
                <div className="mb-6">
                  <label
                    htmlFor="company-select"
                    className="block text-slate-700 text-lg font-semibold mb-3"
                  >
                    Selecione a Empresa
                  </label>
                  <Select
                    id="company-select"
                    options={empresas.map((emp) => ({
                      value: emp.company,
                      label: emp.company,
                    }))}
                    value={company ? { value: company, label: company } : null}
                    onChange={(selectedOption) => setCompany(selectedOption ? selectedOption.value : "")}
                    placeholder="Buscar ou selecionar empresa..."
                    isClearable
                    styles={selectStyles}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewCompanyInput(!showNewCompanyInput)}
                    className="mt-3 flex items-center gap-2 text-purple-600 hover:text-purple-800 font-medium transition-colors"
                  >
                    <FaPlus />
                    {showNewCompanyInput ? "Cancelar Nova Empresa" : "Adicionar Nova Empresa"}
                  </button>
                </div>

                {/* Campo para Nova Empresa (Reintroduzido) */}
                {showNewCompanyInput && (
                  <div className="mb-6">
                    <label
                      htmlFor="new-company-name"
                      className="block text-slate-700 text-lg font-semibold mb-3"
                    >
                      Nome da Nova Empresa
                    </label>
                    <input
                      type="text"
                      id="new-company-name"
                      className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Digite o nome da nova empresa"
                      value={newCompany}
                      onChange={(e) => setNewCompany(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewCompany}
                      className="mt-3 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-xl transition-colors"
                    >
                      Adicionar Empresa
                    </button>
                  </div>
                )}

                {/* Campos de Avaliação por Estrelas (Reconectados) */}
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-slate-700 mb-4">Critérios de Avaliação</h3>

                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                      <FaStar className="mr-2 text-yellow-500" /> Avaliação Geral
                    </label>
                    {renderStars(rating, setRating, commentRating, setCommentRating, "Avaliação Geral")}
                  </div>

                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                      <FaHandshake className="mr-2 text-blue-500" /> Contato com RH
                    </label>
                    {renderStars(contatoRH, setContatoRH, commentContatoRH, setCommentContatoRH, "Contato com RH")}
                  </div>

                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                      <FaMoneyBillWave className="mr-2 text-green-500" /> Salário e Benefícios
                    </label>
                    {renderStars(salarioBeneficios, setSalarioBeneficios, commentSalarioBeneficios, setCommentSalarioBeneficios, "Salário e Benefícios")}
                  </div>

                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                      <FaBuilding className="mr-2 text-gray-500" /> Estrutura da Empresa
                    </label>
                    {renderStars(estruturaEmpresa, setEstruturaEmpresa, commentEstruturaEmpresa, setCommentEstruturaEmpresa, "Estrutura da Empresa")}
                  </div>

                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                      <FaUserTie className="mr-2 text-indigo-500" /> Acessibilidade à Liderança
                    </label>
                    {renderStars(acessibilidadeLideranca, setAcessibilidadeLideranca, commentAcessibilidadeLideranca, setCommentAcessibilidadeLideranca, "Acessibilidade à Liderança")}
                  </div>

                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                      <FaBriefcase className="mr-2 text-purple-500" /> Plano de Carreiras
                    </label>
                    {renderStars(planoCarreiras, setPlanoCarreiras, commentPlanoCarreiras, setCommentPlanoCarreiras, "Plano de Carreiras")}
                  </div>

                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                      <FaHeart className="mr-2 text-pink-500" /> Bem-estar e Ambiente
                    </label>
                    {renderStars(bemestar, setBemestar, commentBemestar, setCommentBemestar, "Bem-estar e Ambiente")}
                  </div>

                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    <label className="w-full md:w-1/3 text-slate-700 font-semibold flex items-center">
                      <FaLightbulb className="mr-2 text-yellow-600" /> Estímulo à Inovação
                    </label>
                    {renderStars(estimulacaoOrganizacao, setEstimulacaoOrganizacao, commentEstimulacaoOrganizacao, setCommentEstimulacaoOrganizacao, "Estímulo à Inovação")}
                  </div>
                </div>

                {/* Campo de Comentário Geral (Reintroduzido) */}
                <div className="mt-8">
                  <label
                    htmlFor="general-comment"
                    className="block text-slate-700 text-lg font-semibold mb-3"
                  >
                    Comentário Geral (Opcional)
                  </label>
                  <textarea
                    id="general-comment"
                    className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[100px]"
                    placeholder="Escreva seu comentário geral sobre a empresa..."
                    value={generalComment}
                    onChange={(e) => setGeneralComment(e.target.value)}
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-4 rounded-xl focus:outline-none focus:shadow-outline transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? "Enviando..." : "Avaliar Empresa"}
                </button>
              </form>
            </section>

            {/* Ranking e Outras Avaliações (agora fora do cabeçalho) */}
            <section className="mt-8">
              <div className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 mt-6">
                <div className="flex flex-col items-center mb-5">
                  <h2 className="text-2xl font-bold text-slate-700 text-center mb-3">
                    Outras Avaliações
                  </h2>
                  <img
                    src="/trofeu-new.png"
                    alt="Troféu Trabalhei Lá"
                    className="w-24 h-24 object-contain drop-shadow-lg"
                  />
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {Array.isArray(empresas) && empresas.length === 0 ? (
                    <div className="text-center py-8">
                      <FaChartBar className="text-gray-300 text-5xl mx-auto mb-3" />
                      <p className="text-gray-500 font-medium text-lg">
                        Nenhuma avaliação ainda
                      </p>
                      <p className="text-sm text-gray-400 mt-2">
                        Seja o primeiro a avaliar!
                      </p>
                    </div>
                  ) : (
                    (empresas || []).map((emp, t) => {
                      const media = calcularMedia(emp);
                      return (
                        <div
                          key={t}
                          className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-4 border-2 border-gray-200 hover:border-purple-400 hover:shadow-xl transition-all cursor-pointer group"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors text-base">
                                {emp.company}
                              </h3>
                              <p className="text-xs opacity-90">
                                {emp.area} • {emp.periodo}
                              </p>
                            </div>
                            <div
                              className={`${getBadgeColor(
                                media
                              )} px-3 py-1.5 rounded-full text-white font-bold text-sm shadow-md`}
                            >
                              {media} ⭐
                            </div>
                          </div>

                          {emp.comment && (
                            <p className="text-sm text-gray-600 italic border-t border-gray-200 pt-2 mt-2">
                              "{emp.comment.substring(0, 100)}
                              {emp.comment.length > 100 ? "..." : ""}"
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <style>{`
                  .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                  .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
                  .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: linear-gradient(to bottom, #8b5cf6, #ec4899);
                    border-radius: 10px;
                  }
                  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(to bottom, #7c3aed, #db2777);
                  }
                `}</style>
              </div>
            </section>
          </div>

          <footer
            className="mx-auto px-6 md:px-8 py-8 text-center"
            style={{ maxWidth: 1120 }}
          >
            <div className="bg-white/70 backdrop-blur-lg rounded-2xl p-5 border border-white/20">
              <p className="text-slate-700 text-sm">
                <a
                  href="/politica-de-privacidade.html"
                  className="text-indigo-700 hover:text-indigo-900 font-extrabold underline"
                >
                  Política de Privacidade
                </a>
                {" • "}
                <span>© 2026 Trabalhei Lá - Todos os direitos reservados</span>
              </p>
            </div>
          </footer>
        </div>
      );
    }

    export default TrabalheiLaMobile;
