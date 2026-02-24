    import React from "react";
    import {
      FaStar,
      FaChartBar,
      // FaHandshake, FaMoneyBillWave, FaBuilding, FaUserTie, FaLightbulb, FaLock, // Removidos: não são mais usados no novo cabeçalho
    } from "react-icons/fa";
    // import { FcGoogle } from "react-icons/fc"; // Removido: não é mais usado no novo cabeçalho
    import Select from "react-select";

    // import LoginLinkedInButton from "./components/LoginLinkedInButton"; // Removido: não é mais usado no novo cabeçalho

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

      // const linkedInClientId = process.env.REACT_APP_LINKEDIN_CLIENT_ID || ""; // Removido: não é mais usado
      // const linkedInDisabled = Boolean(isLoading || !linkedInClientId); // Removido: não é mais usado

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
          icon: <FaStar className="text-yellow-400" />,
          value: rating,
          setter: setRating,
          comment: commentRating,
          commentSetter: setCommentRating,
        },
        {
          label: "Contato com RH",
          icon: <FaHandshake className="text-blue-400" />,
          value: contatoRH,
          setter: setContatoRH,
          comment: commentContatoRH,
          commentSetter: setCommentContatoRH,
        },
        {
          label: "Salário e Benefícios",
          icon: <FaMoneyBillWave className="text-green-400" />,
          value: salarioBeneficios,
          setter: setSalarioBeneficios,
          comment: commentSalarioBeneficios,
          commentSetter: setCommentSalarioBeneficios,
        },
        {
          label: "Estrutura da Empresa",
          icon: <FaBuilding className="text-gray-400" />,
          value: estruturaEmpresa,
          setter: setEstruturaEmpresa,
          comment: commentEstruturaEmpresa,
          commentSetter: setCommentEstruturaEmpresa,
        },
        {
          label: "Acessibilidade à Liderança",
          icon: <FaUserTie className="text-purple-400" />,
          value: acessibilidadeLideranca,
          setter: setAcessibilidadeLideranca,
          comment: commentAcessibilidadeLideranca,
          commentSetter: setCommentAcessibilidadeLideranca,
        },
        {
          label: "Plano de Carreiras",
          icon: <FaHeart className="text-red-400" />,
          value: planoCarreiras,
          setter: setPlanoCarreiras,
          comment: commentPlanoCarreiras,
          commentSetter: setCommentPlanoCarreiras,
        },
        {
          label: "Bem-estar e Qualidade de Vida",
          icon: <FaBriefcase className="text-orange-400" />,
          value: bemestar,
          setter: setBemestar,
          comment: commentBemestar,
          commentSetter: setCommentBemestar,
        },
        {
          label: "Estímulo à Organização e Inovação",
          icon: <FaLightbulb className="text-yellow-500" />,
          value: estimulacaoOrganizacao,
          setter: setEstimulacaoOrganizacao,
          comment: commentEstimulacaoOrganizacao,
          commentSetter: setCommentEstimulacaoOrganizacao,
        },
      ];

      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 font-sans text-gray-900">
          <div className="max-w-full mx-auto p-4 md:p-6">
            {/* Novo Cabeçalho */}
            <header className="bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-3xl shadow-2xl p-6 mb-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <img
                  src="/bg-header-pattern.svg" // Assumindo que você tem um SVG de padrão
                  alt="Background Pattern"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                {/* Seção Esquerda - Logo e Nota (Exemplo estático) */}
                <div className="flex items-center gap-3 bg-white/20 px-4 py-2 rounded-full backdrop-blur-sm">
                  <img
                    src="/logo-petrobras.png" // Exemplo de logo
                    alt="Logo Petrobras"
                    className="w-8 h-8 object-contain"
                  />
                  <span className="font-bold text-lg">Nota 4.5/5</span>
                </div>

                {/* Seção Central - Título e Chamada */}
                <div className="flex-1 text-center md:text-left">
                  <h1 className="text-4xl font-extrabold mb-2 drop-shadow-lg">
                    Trabalhei Lá
                  </h1>
                  <p className="text-lg font-medium mb-3 opacity-90">
                    Sua opinião é anônima e ajuda outros profissionais
                  </p>
                  <p className="text-sm opacity-80 mb-4">
                    Avaliações anônimas feitas por profissionais verificados.
                  </p>
                  <button
                    type="button" // Alterado de <a> para <button>
                    className="bg-white text-blue-700 font-bold py-2 px-5 rounded-full shadow-lg hover:bg-blue-100 transition-all transform hover:scale-105"
                    onClick={() => alert("Saiba Mais clicado!")} // Adicione sua lógica aqui
                  >
                    Clique e Saiba Mais
                  </button>
                  <div className="mt-4 text-xs opacity-70 flex justify-center md:justify-start gap-3">
                    <span>Anônimo</span> • <span>Verificado</span> •{" "}
                    <span>Confiável</span>
                  </div>
                </div>

                {/* Seção Direita - Ranking Melhores Empresas */}
                <div className="w-full md:w-1/3 bg-white/20 p-4 rounded-2xl backdrop-blur-sm mt-6 md:mt-0">
                  <h2 className="text-xl font-bold mb-4 text-center">
                    Melhores Empresas
                  </h2>
                  {Array.isArray(top3) && top3.length > 0 ? (
                    <div className="space-y-3">
                      {top3.map((emp, t) => {
                        const media = calcularMedia(emp);
                        return (
                          <div
                            key={t}
                            className={`bg-gradient-to-r ${getMedalColor(
                              t
                            )} rounded-xl p-3 text-white shadow-md flex items-center justify-between`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{getMedalEmoji(t)}</span>
                              <h3 className="font-semibold text-sm">{emp.company}</h3>
                            </div>
                            <div className="bg-white/20 px-2 py-0.5 rounded-full font-bold text-xs">
                              {media} ⭐
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-sm opacity-80">
                      Nenhuma empresa no ranking ainda.
                    </p>
                  )}
                </div>
              </div>
            </header>

            {/* Seção Principal de Avaliação */}
            <section className="mt-8">
              {error && (
                <div
                  className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-6"
                  role="alert"
                >
                  <strong className="font-bold">Erro!</strong>
                  <span className="block sm:inline"> {error}</span>
                </div>
              )}

              <div className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200">
                <h2 className="text-3xl font-bold text-slate-700 text-center mb-6">
                  Avalie uma Empresa
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label
                      htmlFor="company-select"
                      className="block text-gray-800 text-base font-semibold mb-3"
                    >
                      Empresa
                    </label>
                    <Select
                      id="company-select"
                      options={safeCompanyOptions}
                      value={
                        company
                          ? { value: company, label: company }
                          : null
                      }
                      onChange={(selectedOption) =>
                        setCompany(selectedOption ? selectedOption.value : "")
                      }
                      placeholder="Selecione ou digite uma empresa"
                      isClearable
                      isSearchable
                      styles={selectStyles}
                      className="text-sm"
                    />
                  </div>

                  {company === "Outra" && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <label
                        htmlFor="new-company-name"
                        className="block text-gray-800 text-base font-semibold mb-3"
                      >
                        Nome da Nova Empresa
                      </label>
                      <input
                        type="text"
                        id="new-company-name"
                        className="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        value={newCompany}
                        onChange={(e) => setNewCompany(e.target.value)}
                        placeholder="Digite o nome da nova empresa"
                        required
                      />
                    </div>
                  )}

                  {ratingFields.map((field, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-gray-800 text-base font-semibold">
                          {field.label}
                        </label>
                      </div>
                      <div className="flex justify-center gap-1 mb-3">
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
              </div>
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
                    (empresas || []).map((emp, t) => { // Removido .slice(3) pois top3 está no header
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
