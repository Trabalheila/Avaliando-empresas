    import React from "react";
          import {
          FaStar,
          FaHandshake,
          FaMoneyBillWave,
          FaBuilding,
          FaUserTie,
          FaHeart,
          FaChartBar,
          FaLightbulb,
          FaLock,
        } from "react-icons/fa";

    import { FcGoogle } from "react-icons/fc";
    import Select from "react-select";

    import LoginLinkedInButton from "./components/LoginLinkedInButton";

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
      isAuthenticated,
      setIsAuthenticated,
      user,
      setUser,
      companyOptions,
      handleSubmit,
      isLoading,
      error,
      empresas,
      calcularMedia,
      top3,
      getMedalColor,
      getMedalEmoji,
      getBadgeColor,
    }) {
      const safeCompanyOptions = Array.isArray(companyOptions) ? companyOptions : [];

      const linkedInClientId = process.env.REACT_APP_LINKEDIN_CLIENT_ID || "";
      const linkedInDisabled = Boolean(isLoading || !linkedInClientId);

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
          minHeight: "48px", // Garante altura mínima para mobile
        }),
        option: (base, state) => ({
          ...base,
          backgroundColor: state.isSelected
            ? "#8b5cf6"
            : state.isFocused
              ? "#f3e8ff"
              : null,
          color: state.isSelected ? "white" : "#4b5563",
          "&:active": {
            backgroundColor: "#a78bfa",
          },
        }),
        singleValue: (base) => ({
          ...base,
          color: "#1f2937", // text-gray-900
          fontWeight: "500", // font-medium
        }),
        placeholder: (base) => ({
          ...base,
          color: "#9ca3af", // text-gray-400
        }),
      };

      const ratingFields = [
        {
          label: "Avaliação Geral",
          icon: <FaStar className="text-yellow-500" />,
          value: rating,
          setter: setRating,
          comment: commentRating,
          commentSetter: setCommentRating,
        },
        {
          label: "Contato com RH",
          icon: <FaHandshake className="text-blue-500" />,
          value: contatoRH,
          setter: setContatoRH,
          comment: commentContatoRH,
          commentSetter: setCommentContatoRH,
        },
        {
          label: "Salário e Benefícios",
          icon: <FaMoneyBillWave className="text-green-500" />,
          value: salarioBeneficios,
          setter: setSalarioBeneficios,
          comment: commentSalarioBeneficios,
          commentSetter: setCommentSalarioBeneficios,
        },
        {
          label: "Estrutura da Empresa",
          icon: <FaBuilding className="text-gray-500" />,
          value: estruturaEmpresa,
          setter: setEstruturaEmpresa,
          comment: commentEstruturaEmpresa,
          commentSetter: setCommentEstruturaEmpresa,
        },
        {
          label: "Acessibilidade à Liderança",
          icon: <FaUserTie className="text-indigo-500" />,
          value: acessibilidadeLideranca,
          setter: setAcessibilidadeLideranca,
          comment: commentAcessibilidadeLideranca,
          commentSetter: setCommentAcessibilidadeLideranca,
        },
        {
          label: "Plano de Carreiras",
          icon: <FaChartBar className="text-red-500" />,
          value: planoCarreiras,
          setter: setPlanoCarreiras,
          comment: commentPlanoCarreiras,
          commentSetter: setCommentPlanoCarreiras,
        },
        {
          label: "Bem-estar e Qualidade de Vida",
          icon: <FaHeart className="text-pink-500" />,
          value: bemestar,
          setter: setBemestar,
          comment: commentBemestar,
          commentSetter: setCommentBemestar,
        },
        {
          label: "Estímulo à Organização",
          icon: <FaLightbulb className="text-orange-500" />,
          value: estimulacaoOrganizacao,
          setter: setEstimulacaoOrganizacao,
          comment: commentEstimulacaoOrganizacao,
          commentSetter: setCommentEstimulacaoOrganizacao,
        },
      ];

      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex flex-col items-center p-4">
          <section className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border border-slate-200">
            {/* Cabeçalho */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-extrabold text-purple-800 mb-2">
                Trabalhei Lá
              </h1>
              <p className="text-lg text-gray-600 mb-6">
                Sua plataforma para avaliar empresas e encontrar o lugar ideal para
                trabalhar.
              </p>

              {/* Botões de Login */}
              <div className="space-y-3 mb-6">
                <LoginLinkedInButton
                  clientId={linkedInClientId}
                  isDisabled={linkedInDisabled}
                  onLoginSuccess={(userData) => {
                    setIsAuthenticated(true);
                    setUser(userData);
                  }}
                  onLoginFailure={(err) => {
                    console.error("LinkedIn login failed:", err);
                    alert("Falha ao fazer login com LinkedIn.");
                  }}
                />
                <button
                  className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  disabled={isLoading}
                >
                  <FcGoogle className="text-xl mr-2" />
                  Entrar com Google
                </button>
              </div>

              {/* Card de Privacidade */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-purple-800 text-sm flex items-center justify-center space-x-2 shadow-inner">
                <FaLock className="text-purple-600 text-lg" />
                <p className="font-medium">Sua privacidade é garantida.</p>
              </div>
            </div>

            {/* Formulário de Avaliação */}
            <h2 className="text-2xl font-bold text-slate-700 text-center mb-6">
              Avalie uma Empresa
            </h2>

            {error && (
              <div
                className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-4"
                role="alert"
              >
                <strong className="font-bold">Erro!</strong>
                <span className="block sm:inline"> {error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="company-select"
                  className="block text-gray-700 text-sm font-bold mb-2"
                >
                  Selecione a Empresa:
                </label>
                <Select
                  id="company-select"
                  options={safeCompanyOptions}
                  value={safeCompanyOptions.find((opt) => opt.value === company)}
                  onChange={(selectedOption) =>
                    setCompany(selectedOption ? selectedOption.value : "")
                  }
                  placeholder="Buscar ou adicionar empresa..."
                  isClearable
                  isSearchable
                  className="react-select-container"
                  classNamePrefix="react-select"
                  styles={selectStyles}
                  isDisabled={isLoading}
                />
              </div>

              <div>
                <label
                  htmlFor="new-company"
                  className="block text-gray-700 text-sm font-bold mb-2"
                >
                  Ou adicione uma nova empresa:
                </label>
                <input
                  type="text"
                  id="new-company"
                  className="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="Nome da nova empresa"
                  disabled={isLoading}
                />
              </div>

              {ratingFields.map((field, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="block text-gray-700 text-sm font-bold mb-2 flex items-center">
                    {field.icon}
                    <span className="ml-2">{field.label}:</span>
                  </label>
                  <div className="flex space-x-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <OutlinedStar
                        key={star}
                        active={star <= field.value}
                        onClick={() => field.setter(star)}
                        size={28}
                        label={`${star} estrelas para ${field.label}`}
                      />
                    ))}
                  </div>
                  <textarea
                    className="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
                    rows="2"
                    value={field.comment}
                    onChange={(e) => field.commentSetter(e.target.value)}
                    placeholder={`Comentário sobre ${field.label.toLowerCase()} (opcional)`}
                  ></textarea>
                </div>
              ))}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-4 rounded-xl focus:outline-none focus:shadow-outline transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? "Enviando..." : "Avaliar Empresa"}
              </button>
            </form>
          </section>

          {/* Ranking e Outras Avaliações */}
          <section className="mt-8 w-full max-w-md">
            <div className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 mt-6">
              <div className="flex flex-col items-center mb-5">
                <h2 className="text-2xl font-bold text-slate-700 text-center mb-3">
                  Ranking - Top Empresas Avaliadas
                </h2>
                <img
                  src="/trofeu-new.png"
                  alt="Troféu Trabalhei Lá"
                  className="w-24 h-24 object-contain drop-shadow-lg"
                />
              </div>
              {Array.isArray(top3) && top3.length > 0 && (
                <div className="mb-4 space-y-3">
                  {top3.map((emp, t) => {
                    const media = calcularMedia(emp);
                    return (
                      <div
                        key={t}
                        className={`bg-gradient-to-r ${getMedalColor(
                          t
                        )} rounded-2xl p-4 text-white shadow-lg`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{getMedalEmoji(t)}</span>
                            <div>
                              <h3 className="font-bold text-base">{emp.company}</h3>
                              <p className="text-xs opacity-90">
                                {emp.area} • {emp.periodo}
                              </p>
                            </div>
                          </div>
                          <div className="bg-white/20 px-3 py-1.5 rounded-full font-bold text-sm">
                            {media} ⭐
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                  (empresas || []).slice(3).map((emp, t) => {
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
