import React, { useState } from "react";
import {
  FaHandshake,
  FaMoneyBillWave,
  FaBuilding,
  FaUserTie,
  FaLightbulb,
  FaChartBar,
  FaCheckCircle,
} from "react-icons/fa";
import Select from "react-select";
import LoginLinkedInButton from "./components/LoginLinkedInButton";
import OutlinedStar from "./components/OutlinedStar";

function TrabalheiLaDesktop({
  empresas = [],
  setEmpresas,
  top3 = [],
  isAuthenticated,
  linkedInClientId,
  linkedInRedirectUri,
  calcularMedia,
  getBadgeColor,
  getMedalEmoji,
}) {
  const [selectedCompany, setSelectedCompany] = useState("");
  const [generalComment, setGeneralComment] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [ratings, setRatings] = useState({
    rh: 0,
    salario: 0,
    crescimento: 0,
    cultura: 0,
    organizacao: 0,
  });

  const companyOptions = empresas.map((emp) => ({
    value: emp.company,
    label: emp.company,
  }));

  const renderStars = (key) => (
    <div className="flex gap-2 mt-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <OutlinedStar
          key={star}
          active={star <= ratings[key]}
          onClick={() =>
            setRatings((prev) => ({ ...prev, [key]: star }))
          }
        />
      ))}
    </div>
  );

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      setError("Você precisa estar logado para enviar uma avaliação.");
      return;
    }

    if (!selectedCompany) {
      setError("Selecione uma empresa.");
      return;
    }

    setIsLoading(true);

    const novaAvaliacao = {
      ...ratings,
      generalComment,
      timestamp: new Date().toISOString(),
    };

    setEmpresas((prev) =>
      prev.map((emp) =>
        emp.company === selectedCompany
          ? { ...emp, avaliacoes: [...(emp.avaliacoes || []), novaAvaliacao] }
          : emp
      )
    );

    setRatings({
      rh: 0,
      salario: 0,
      crescimento: 0,
      cultura: 0,
      organizacao: 0,
    });

    setGeneralComment("");
    setSelectedCompany("");
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-10">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <header className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl shadow-2xl p-10 mb-10 border border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <img
                src="/trofeu-new.png"
                alt="Logo"
                className="h-16 w-16"
              />
              <h1 className="text-5xl font-black tracking-tight text-white">
                TRABALHEI LÁ
              </h1>
            </div>

            <div className="flex items-center gap-3 bg-blue-600 px-6 py-3 rounded-2xl text-white font-bold text-2xl shadow-lg">
              4.8 ⭐
              <FaCheckCircle className="text-green-300 text-2xl" />
            </div>
          </div>

          <p className="text-slate-400 mt-6 text-lg">
            Avaliações anônimas verificadas por profissionais reais.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-10">

          {/* FORMULÁRIO */}
          <section className="bg-white text-slate-800 rounded-3xl shadow-2xl p-8 border border-slate-200">
            <h2 className="text-2xl font-bold text-blue-800 mb-6">
              Avalie uma Empresa
            </h2>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 p-3 rounded mb-5">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

              <Select
                options={companyOptions}
                value={companyOptions.find(
                  (option) => option.value === selectedCompany
                )}
                onChange={(option) =>
                  setSelectedCompany(option ? option.value : "")
                }
                placeholder="Buscar empresa..."
                isClearable
              />

              <div>
                <label className="font-semibold flex items-center gap-2">
                  <FaHandshake /> Contato com RH
                </label>
                {renderStars("rh")}
              </div>

              <div>
                <label className="font-semibold flex items-center gap-2">
                  <FaMoneyBillWave /> Salário e Benefícios
                </label>
                {renderStars("salario")}
              </div>

              <div>
                <label className="font-semibold flex items-center gap-2">
                  <FaBuilding /> Crescimento
                </label>
                {renderStars("crescimento")}
              </div>

              <div>
                <label className="font-semibold flex items-center gap-2">
                  <FaUserTie /> Cultura
                </label>
                {renderStars("cultura")}
              </div>

              <div>
                <label className="font-semibold flex items-center gap-2">
                  <FaLightbulb /> Organização
                </label>
                {renderStars("organizacao")}
              </div>

              <textarea
                className="w-full p-4 border border-slate-300 rounded-xl"
                rows="4"
                placeholder="Comentário geral..."
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
              />

              <button
                type="submit"
                disabled={!isAuthenticated || isLoading}
                className={`w-full py-4 rounded-xl font-bold text-white transition ${
                  isAuthenticated
                    ? "bg-blue-700 hover:bg-blue-800"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                {isLoading ? "Enviando..." : "Enviar avaliação"}
              </button>
            </form>

            <div className="mt-6">
              <LoginLinkedInButton
                clientId={linkedInClientId}
                redirectUri={linkedInRedirectUri}
              />
            </div>
          </section>

          {/* RANKING */}
          <section className="bg-white text-slate-800 rounded-3xl shadow-2xl p-8 border border-slate-200">
            <h2 className="text-2xl font-bold text-blue-800 mb-6 flex items-center gap-2">
              <FaChartBar /> Ranking das Empresas
            </h2>

            <div className="space-y-4 mb-6">
              {top3.map((emp, i) => {
                const media = calcularMedia(emp);

                return (
                  <div
                    key={i}
                    className="bg-slate-100 rounded-2xl p-4 border border-slate-300"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold">
                        {getMedalEmoji(i)} {emp.company}
                      </span>
                      <span className="font-extrabold text-blue-700">
                        {media} ⭐
                      </span>
                    </div>

                    <div className="w-full bg-slate-300 h-2 rounded-full">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${media * 20}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {empresas.slice(3).map((emp, i) => {
                const media = calcularMedia(emp);

                return (
                  <div
                    key={i}
                    className="bg-slate-50 p-3 rounded-xl flex justify-between border"
                  >
                    <span>{emp.company}</span>

                    <span
                      className={`${getBadgeColor(
                        media
                      )} px-2 py-1 rounded-full text-white text-xs`}
                    >
                      {media} ⭐
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

export default TrabalheiLaDesktop;