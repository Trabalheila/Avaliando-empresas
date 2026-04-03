import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteUserProfile } from "../services/users";
import AppHeader from "../components/AppHeader";

function extractProfileIds(profile) {
  const candidates = [profile?.id, profile?.uid, profile?.userId, profile?.email]
    .map((value) => (value || "").toString().trim())
    .filter(Boolean);
  return Array.from(new Set(candidates));
}

function clearAppLocalData() {
  const keys = Object.keys(localStorage);
  const appPrefixes = [
    "comments_",
    "comment_reactions_",
    "blocked_authors_",
    "hidden_content_",
    "reports_registry_",
    "evaluations_",
    "trabalheiLa_",
    "userProfile",
    "userPseudonym",
    "empresasData",
  ];

  keys.forEach((key) => {
    if (appPrefixes.some((prefix) => key.startsWith(prefix))) {
      localStorage.removeItem(key);
    }
  });

  sessionStorage.clear();
}

export default function DeleteData({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const profile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch {
      return {};
    }
  }, []);

  const profileIds = useMemo(() => extractProfileIds(profile), [profile]);

  const handleDeleteData = async () => {
    setError("");
    setMessage("");
    setIsDeleting(true);

    try {
      for (const id of profileIds) {
        try {
          await deleteUserProfile(id);
        } catch {
          // Continue deletion flow even if one identifier does not exist on server.
        }
      }

      clearAppLocalData();
      window.dispatchEvent(new Event("trabalheiLa_user_updated"));

      setMessage("Seus dados locais foram excluídos e o perfil vinculado foi solicitado para remoção.");
      setTimeout(() => navigate("/"), 1300);
    } catch {
      setError("Nao foi possivel concluir a exclusao agora. Tente novamente em instantes.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-blue-100 dark:border-slate-700 p-8 mt-6 mx-4">
        <h1 className="text-3xl font-extrabold text-blue-800 mb-4">Exclusão de dados</h1>
        <p className="text-slate-700 mb-4">
          Esta página permite excluir seus dados pessoais relacionados ao app Trabalhei Lá.
        </p>

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-5">
          <p className="text-sm text-blue-900 font-semibold mb-2">O que será removido:</p>
          <ul className="text-sm text-blue-900 list-disc pl-5 space-y-1">
            <li>Perfil de usuário vinculado (quando identificado no Firebase).</li>
            <li>Dados armazenados localmente no dispositivo/navegador.</li>
            <li>Sessão local de autenticação do app.</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={handleDeleteData}
          disabled={isDeleting}
          className="w-full py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition disabled:opacity-70"
        >
          {isDeleting ? "Excluindo dados..." : "Excluir meus dados"}
        </button>

        {message && <p className="mt-4 text-sm text-emerald-700 font-semibold">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-600 font-semibold">{error}</p>}

        <div className="mt-8 text-center space-x-3">
          <Link to="/" className="inline-block px-5 py-2 rounded-xl border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50">
            Voltar para principal
          </Link>
          <a href="/politica-de-privacidade.html" className="inline-block px-5 py-2 rounded-xl border border-blue-200 text-blue-700 font-semibold hover:bg-blue-50">
            Política de Privacidade
          </a>
        </div>
      </div>
    </div>
  );
}
