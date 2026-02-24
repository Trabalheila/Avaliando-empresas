    import React from "react";
    import {
      FaStar,
      FaChartBar,
      FaHandshake, // Re-importado: usado nos campos de avaliação
      FaMoneyBillWave, // Re-importado: usado nos campos de avaliação
      FaBuilding, // Re-importado: usado nos campos de avaliação
      FaUserTie, // Re-importado: usado nos campos de avaliação
      FaHeart, // Re-importado: usado nos campos de avaliação
      FaBriefcase, // Re-importado: usado nos campos de avaliação
      FaLightbulb, // Re-importado: usado nos campos de avaliação
      // FaLock, // Não é mais usado, então permanece removido
    } from "react-icons/fa";
    // import { FcGoogle } from "react-icons/fc"; // Não é mais usado, então permanece removido
    import Select from "react-select";

    // import LoginLinkedInButton from "./components/LoginLinkedInButton"; // Não é mais usado, então permanece removido

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
      isLoading,
      handleSubmit,
      empresas,
      top3,
      calcularMedia,
      getMedalColor,
      getMedalEmoji,
      getBadgeColor,
      handleCompanyChange,
      companyOptions,
      isNewCompany,
      setIsNewCompany,
    }) {
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
          label: "Acessibilidade e Liderança",
          icon: <FaUserTie className="text-purple-500" />,
          value: acessibilidadeLideranca,
          setter: setAcessibilidadeLideranca,
          comment: commentAcessibilidadeLideranca,
          commentSetter: setCommentAcessibilidadeLideranca,
        },
        {
          label: "Plano de Carreiras",
          icon: <FaBriefcase className="text-indigo-500" />,
          value: planoCarreiras,
          setter: setPlanoCarreiras,
          comment: commentPlanoCarreiras,
          commentSetter: setCommentPlanoCarreiras,
        },
        {
          label: "Bem-estar e Ambiente",
          icon: <FaHeart className="text-red-500" />,
          value: bemestar,
          setter: setBemestar,
          comment: commentBemestar,
          commentSetter: setCommentBemestar,
        },
        {
          label: "Estímulo e Organização",
          icon: <FaLightbulb className="text-orange-500" />,
          value: estimulacaoOrganizacao,
          setter: setEstimulacaoOrganizacao,
          comment: commentEstimulacaoOrganizacao,
          commentSetter: setCommentEstimulacaoOrganizacao,
        },
      ];

      // const linkedInClientId = "SEU_CLIENT_ID_LINKEDIN"; // Removido: não é mais usado
      // const linkedInDisabled = !linkedInClientId; // Removido: não é mais usado

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
          color: state.isSelected ? "white" : "#4a5568",
          "&:active": {
            backgroundColor: "#a78bfa",
          },
        }),
      };

      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-100 to-pink-100 flex flex-col items-center justify-center p-4">
          <div
            className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-6 md:p-8 border border-slate-200"
            style={{ maxWidth: 1120 }}
          >
            {/* Novo Cabeçalho - Adaptado da imagem */}
            <header className="bg-blue-50 p-6 rounded-2xl mb-8 shadow-inner border border-blue-100 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                {/* Seção da Empresa em Destaque (esquerda) */}
                <div className="flex-shrink-0 text-center md:text-left">
                  <p className="text-sm text-blue-600 font-semibold mb-2">
                    Empresa em Destaque
                  </p>
                  <div className="flex items-center justify-center md:justify-start gap-3 bg-white p-3 rounded-xl shadow-md border border-blue-200">
                    <img
                      src="/petrobras-logo.png" // Exemplo de logo, você pode tornar dinâmico
                      alt="Logo Petrobras"
                      className="w-10 h-10 object-contain"
                    />
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">Petrobras</h3>
                      <p className="text-sm text-gray-600">Nota: 4.5/5 ⭐</p>
                    </div>
                  </div>
                </div>

                {/* Seção Central do Título e Chamada */}
                <div className="flex-grow text-center">
                  <h1 className="text-4xl font-extrabold text-purple-700 mb-2">
                    Trabalhei Lá
                  </h1>
                  <p className="text-lg text-gray-700 mb-4 font-medium">
                    Sua opinião é anônima e ajuda outros profissionais
                  </p>
                  <p className="text-sm text-gray-500 mb-6">
                    Avaliações anônimas feitas por profissionais verificados.
                  </p>
                  <button className="bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transform hover:scale-105 transition-all">
                    Clique e Saiba Mais
                  </button>
                  <div className="mt-6 flex justify-center items-center gap-4 text-sm text-gray-600 font-semibold">
                    <span className="flex items-center gap-1">
                      <span className="text-green-500">●</span> Anônimo
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-blue-500">●</span> Verificado
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-purple-500">●</span> Confiável
                    </span>
                  </div>
                </div>

                {/* Seção de Ranking (direita) */}
                <div className="flex-shrink-0 w-full md:w-auto text-center md:text-right mt-6 md:mt-0">
                  <h2 className="text-xl font-bold text-blue-700 mb-3">
                    Melhores Empresas
                  </h2>
                  {Array.isArray(top3) && top3.length > 0 ? (
                    <div className="space-y-2">
                      {top3.slice(0, 3).map((emp, t) => {
                        const media = calcularMedia(emp);
                        return (
                          <div
                            key={t}
                            className="flex items-center justify-between bg-white p-2 rounded-lg shadow-sm border border-gray-200"
                          >
                            <span className="font-medium text-gray-700 text-sm">
                              {t + 1}º {emp.company}
                            </span>
                            <span className="text-yellow-500 font-bold text-sm">
                              {media} ⭐
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Nenhuma empresa no ranking ainda.
                    </p>
                  )}
                </div>
              </div>
            </header>

            {/* Seção de Avaliação da Empresa */}
            <section className="mt-8">
              <div className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-200">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">
                  Avalie uma Empresa
                </h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Campo de seleção/nova empresa */}
                  <div className="mb-4">
                    <label
                      htmlFor="company-select"
                      className="block text-gray-700 text-sm font-bold mb-2"
                    >
                      Nome da Empresa
                    </label>
                    <Select
                      id="company-select"
                      options={companyOptions}
                      value={company}
                      onChange={handleCompanyChange}
                      placeholder="Selecione ou digite uma empresa..."
                      isClearable
                      isSearchable
                      styles={selectStyles}
                      className="text-sm"
                    />
                  </div>

                  {isNewCompany && (
                    <div className="mb-4">
                      <label
                        htmlFor="new-company-name"
                        className="block text-gray-700 text-sm font-bold mb-2"
                      >
                        Nova Empresa
                      </label>
                      <input
                        type="text"
                        id="new-company-name"
                        className="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
                        value={newCompany}
                        onChange={(e) => setNewCompany(e.target.value)}
                        placeholder="Digite o nome da nova empresa"
                        required
                      />
                    </div>
                  )}

                  {/* Campos de avaliação */}
                  {ratingFields.map((field, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        {field.icon}
                        <label className="block text-gray-700 text-base font-bold">
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
                    (empresas || []).map((emp, t) => {
                      // Removido .slice(3) pois top3 está no header
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
