/* eslint-disable no-unused-vars */

import React, { useState } from "react";
import {
  FaStar,
  FaChartBar,
  FaHandshake,
  FaMoneyBillWave,
  FaBuilding,
  FaUserTie,
  FaLightbulb,
  FaPlus,
  FaMinus,
  FaCheckCircle,
} from "react-icons/fa";
import Select from "react-select";
import LoginLinkedInButton from "./components/LoginLinkedInButton";
import OutlinedStar from "./components/OutlinedStar";

function TrabalheiLaMobile({
  empresas = [],
  setEmpresas,
  top3 = [],
  isAuthenticated,
  linkedInClientId,
  linkedInRedirectUri,
  calcularMedia,
  getBadgeColor,
  getMedalColor,
  getMedalEmoji,
}) {
  const [selectedCompany, setSelectedCompany] = useState("");
  const [generalComment, setGeneralComment] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rating, setRating] = useState(0);

  const companyOptions = empresas.map((emp) => ({
    value: emp.company,
    label: emp.company,
  }));

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
      rating,
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

    setRating(0);
    setGeneralComment("");
    setSelectedCompany("");
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 p-4">
      <div className="max-w-md mx-auto">

        {/* HEADER */}
        <header className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/trofeu-new.png"
              alt="Logo Trabalhei Lá"
              className="h-10 w-10"
            />
            <h1 className="text-2xl font-extrabold tracking-tight">
              Trabalhei Lá
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold">4.8 ⭐</span>
            <FaCheckCircle className="text-green-300 text-2xl" />
          </div>
        </header>

        {/* ERRO */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* FORM */}
        <section className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-blue-100">
          <h2 className="text-xl font-bold text-blue-800 text-center mb-4">
            Avalie uma Empresa
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="mb-5">
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
            </div>

            <div className="flex gap-2 justify-center mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <OutlinedStar
                  key={star}
                  active={star <= rating}
                  onClick={() => setRating(star)}
                />
              ))}
            </div>

            <textarea
              className="w-full p-3 border border-gray-300 rounded-md text-sm mb-4"
              rows="4"
              placeholder="Comentário geral..."
              value={generalComment}
              onChange={(e) => setGeneralComment(e.target.value)}
            />

            <button
              type="submit"
              disabled={!isAuthenticated || isLoading}
              className={`w-full py-3 px-6 rounded-full font-bold text-white text-lg ${
                isAuthenticated
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {isLoading ? "Enviando..." : "Enviar avaliação"}
            </button>
          </form>
        </section>

        {/* LOGIN */}
        <section className="bg-white rounded-3xl shadow-xl p-6 mb-6 border border-blue-100">
          <h2 className="text-xl font-bold text-blue-800 text-center mb-4">
            Login
          </h2>
          <LoginLinkedInButton
            clientId={linkedInClientId}
            redirectUri={linkedInRedirectUri}
          />
        </section>

        {/* RANKING */}
        <section className="bg-white rounded-3xl shadow-xl p-6 border border-blue-100">
          <h2 className="text-xl font-bold text-blue-800 text-center mb-4">
            🏆 Melhores Empresas
          </h2>

          {top3.map((emp, i) => {
            const media = calcularMedia(emp);
            return (
              <div
                key={i}
                className={`bg-gradient-to-r ${getMedalColor(
                  i
                )} rounded-2xl p-3 text-white mb-2`}
              >
                <div className="flex justify-between">
                  <span>
                    {getMedalEmoji(i)} {emp.company}
                  </span>
                  <span>{media} ⭐</span>
                </div>
              </div>
            );
          })}
        </section>

      </div>
    </div>
  );
}

export default TrabalheiLaMobile;