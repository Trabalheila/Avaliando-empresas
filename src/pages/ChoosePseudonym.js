import React, { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { saveUserProfile } from "../services/users";

const predefinedAvatars = [
  "🧑", "🧑‍💼", "🧑‍🔧", "🧑‍💻", "🧑‍🔬", "👩‍🏫", "👨‍🍳", "👩‍⚕️", "👨‍🚀", "👩‍🎨",
];

function ChoosePseudonym() {
  const navigate = useNavigate();
  const [pseudonym, setPseudonym] = useState("");
  const [cpf, setCpf] = useState("");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [avatar, setAvatar] = useState(predefinedAvatars[0]);
  const [confirmedHuman, setConfirmedHuman] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const profile = localStorage.getItem("userProfile");
    if (!profile) {
      navigate("/");
      return;
    }

    try {
      const parsed = JSON.parse(profile);
      if (parsed?.name) {
        setPseudonym(parsed.name);
      }
      if (parsed?.cpf) {
        setCpf(parsed.cpf);
      }
      if (parsed?.linkedInUrl) {
        setLinkedInUrl(parsed.linkedInUrl);
      }
      if (parsed?.avatar) {
        setAvatar(parsed.avatar);
      }
    } catch {
      // ignore
    }
  }, [navigate]);

  const convertFileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await convertFileToDataUrl(file);
      setAvatar(dataUrl);
    } catch {
      // ignore
    }
  };

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const trimmed = pseudonym.trim();
      if (!trimmed) {
        setError("Por favor, escolha um pseudônimo.");
        return;
      }

      if (!confirmedHuman) {
        setError("Por favor, confirme que você é um humano.");
        return;
      }

      const cpfNumbers = cpf.replace(/\D/g, "");
      if (cpfNumbers && cpfNumbers.length !== 11) {
        setError("CPF deve conter 11 dígitos.");
        return;
      }

      localStorage.setItem("userPseudonym", trimmed);
      const existingProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
      const nextProfile = {
        ...existingProfile,
        name: trimmed,
        cpf: cpfNumbers || undefined,
        linkedInUrl: linkedInUrl.trim() || undefined,
        avatar,
      };

      localStorage.setItem("userProfile", JSON.stringify(nextProfile));

      // Salva no Firebase para persistência centralizada
      try {
        await saveUserProfile({
          id: nextProfile.id || nextProfile.email || `anon_${Date.now()}`,
          ...nextProfile,
        });
      } catch (err) {
        console.warn("Falha ao salvar perfil no Firebase:", err);
      }

      // Dispara evento para que outras partes do app atualizem o estado de login
      window.dispatchEvent(new Event("trabalheiLa_user_updated"));

      navigate("/");
    },
    [navigate, pseudonym, cpf, linkedInUrl, avatar, confirmedHuman]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-8 border border-blue-100">
        <h1 className="text-2xl font-extrabold text-blue-800 mb-4 text-center">Seu perfil anônimo</h1>
        <p className="text-sm text-slate-600 mb-6">
          Essas informações ajudam a manter a qualidade das avaliações. Seus dados são armazenados localmente e não serão compartilhados.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
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
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">CPF (apenas números)</label>
            <input
              value={cpf}
              onChange={(e) => {
                setError(null);
                setCpf(e.target.value);
              }}
              placeholder="00000000000"
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700">Link do seu LinkedIn (opcional)</label>
            <input
              value={linkedInUrl}
              onChange={(e) => setLinkedInUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/seu-perfil"
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Isso ajuda a dar mais credibilidade às avaliações (não será exibido publicamente).
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Avatar</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {predefinedAvatars.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setAvatar(item)}
                  className={`h-12 w-12 rounded-xl border flex items-center justify-center text-2xl ${
                    avatar === item ? "border-blue-600 bg-blue-50" : "border-gray-200 bg-white"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input type="file" accept="image/*" onChange={handleAvatarUpload} />
              {avatar && typeof avatar === "string" && avatar.startsWith("data:") && (
                <span className="text-sm text-slate-600">Imagem carregada</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="confirm-human"
              checked={confirmedHuman}
              onChange={(e) => setConfirmedHuman(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor="confirm-human" className="text-sm text-slate-700">
              Não sou um robô e concordo em enviar uma avaliação sincera.
            </label>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition"
          >
            Salvar perfil
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChoosePseudonym;
