import React, { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function ChoosePseudonym() {
  const navigate = useNavigate();
  const [pseudonym, setPseudonym] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    const profile = localStorage.getItem("userProfile");
    if (!profile) {
      navigate("/");
    }
  }, [navigate]);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const trimmed = pseudonym.trim();
      if (!trimmed) {
        setError("Por favor, escolha um pseudônimo.");
        return;
      }

      localStorage.setItem("userPseudonym", trimmed);
      navigate("/");
    },
    [navigate, pseudonym]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-blue-100">
        <h1 className="text-2xl font-extrabold text-blue-800 mb-4 text-center">Escolha seu Pseudônimo</h1>
        <p className="text-sm text-slate-600 mb-6">
          Seu pseudônimo será usado nas avaliações para proteger sua identidade. Você poderá alterá-lo depois em suas configurações.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Pseudônimo</label>
          <input
            value={pseudonym}
            onChange={(e) => {
              setError(null);
              setPseudonym(e.target.value);
            }}
            placeholder="Ex.: Profissional Anônimo"
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
          >
            Confirmar pseudônimo
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChoosePseudonym;
