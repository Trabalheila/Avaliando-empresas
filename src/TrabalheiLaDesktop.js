import React, { useState } from "react";
import Select from "react-select";
import LoginLinkedInButton from "./components/LoginLinkedInButton";
import OutlinedStar from "./components/OutlinedStar";
import { FaCheckCircle } from "react-icons/fa";

function TrabalheiLaDesktop({
  empresas = [],
  setEmpresas,
  top3 = [],
  isAuthenticated,
  linkedInClientId,
  linkedInRedirectUri,
  calcularMedia,
  getMedalColor,
  getMedalEmoji,
}) {
  const [selectedCompany, setSelectedCompany] = useState("");
  const [generalComment, setGeneralComment] = useState("");
  const [rating, setRating] = useState(0);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

    setSelectedCompany("");
    setGeneralComment("");
    setRating(0);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 px-8 py-10">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-3xl shadow-lg mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/trofeu-new.png"
              alt="Logo Trabalhei Lá"
              className="h-14 w-14"
            />
            <h1 className="text-4xl font-extrabold tracking-tight font-azonix">
              Trabalhei Lá
            </h1>
          </div>

          <div className="flex items-center gap-3 text-2xl font-bold">
            4.8 ⭐
            <FaCheckCircle className="text-green-300 text-3xl" />
          </div>
        </header>

        {/* GRID PRINCIPAL */}
        <div className="grid grid-cols-2 gap-10">

          {/* COLUNA ESQUERDA - AVALIAÇÃO */}
          <section className="bg-white rounded-3xl shadow-md p-8 border border-blue-100">
            <h2 className="text-2xl font-bold text-blue-800 mb-6">
              Avalie uma Empresa
            </h2>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>

              <div className="mb-6">
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

              <div className="flex gap-3 justify-center mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <OutlinedStar
                    key={star}
                    active={star <= rating}
                    onClick={() => setRating(star)}
                  />
                ))}
              </div>

              <textarea
                className="w-full p-4 border border-gray-300 rounded-xl text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-purple-400"
                rows="5"
                placeholder="Comentário sobre sua experiência..."
                value={generalComment}
                onChange={(e) => setGeneralComment(e.target.value)}
              />

              <button
                type="submit"
                disabled={!isAuthenticated || isLoading}
                className={`w-full py-4 rounded-xl font-bold text-lg text-white transition-all ${
                  isAuthenticated
                    ? "bg-gradient-to-r from-purple-600 to-pink-500 hover:scale-[1.02]"
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

          {/* COLUNA DIREITA - RANKING */}
          <section className="bg-white rounded-3xl shadow-md p-8 border border-blue-100">
            <h2 className="text-2xl font-bold text-blue-800 mb-6">
              🏆 Ranking das Empresas
            </h2>

            <div className="space-y-4">
              {top3.map((emp, i) => {
                const media = calcularMedia(emp);
                return (
                  <div
                    key={i}
                    className={`bg-gradient-to-r ${getMedalColor(
                      i
                    )} rounded-2xl p-5 text-white flex justify-between items-center shadow-sm`}
                  >
                    <span className="text-lg font-semibold">
                      {getMedalEmoji(i)} {emp.company}
                    </span>

                    <span className="text-xl font-bold">
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