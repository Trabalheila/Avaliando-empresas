import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { applyActionCode } from "firebase/auth";
import { auth } from "../firebase";

/**
 * Handler universal para os links de ação do Firebase Auth.
 * URLs nesse formato chegam do template padrão do Firebase:
 *   /auth/action?mode=verifyEmail&oobCode=XYZ&continueUrl=...
 *
 * Quando o modo é verifyEmail, aplicamos o código e redirecionamos
 * automaticamente para /empresa/perfil após sucesso.
 */
export default function AuthAction() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");

  useEffect(() => {
    let canceled = false;

    async function run() {
      if (!mode || !oobCode) {
        setStatus("error");
        setErrorMsg("Link inválido ou incompleto.");
        return;
      }

      if (mode !== "verifyEmail") {
        setStatus("error");
        setErrorMsg("Operação não suportada por esta página.");
        return;
      }

      try {
        await applyActionCode(auth, oobCode);
        if (canceled) return;
        setStatus("success");
        // Redireciona automaticamente para o perfil da empresa.
        setTimeout(() => navigate("/empresa/perfil", { replace: true }), 1200);
      } catch (err) {
        if (canceled) return;
        console.error("Erro ao aplicar código de verificação:", err);
        setStatus("error");
        setErrorMsg("Não foi possível validar o link. Ele pode ter expirado ou já ter sido usado.");
      }
    }

    run();
    return () => {
      canceled = true;
    };
  }, [mode, oobCode, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
        <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 tracking-tight">Trabalhei Lá</div>

        {status === "loading" && (
          <>
            <div className="mt-8 mx-auto w-12 h-12 rounded-full border-4 border-blue-200 border-t-blue-700 animate-spin" />
            <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">Validando seu link de confirmação...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mt-8 mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <svg className="h-9 w-9 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="mt-5 text-2xl font-bold text-slate-800 dark:text-slate-100">E-mail confirmado!</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Redirecionando para o perfil da sua empresa...</p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="mt-8 text-xl font-bold text-red-600 dark:text-red-400">Não foi possível confirmar</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{errorMsg}</p>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mt-6 w-full h-12 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
            >
              Voltar para a página inicial
            </button>
          </>
        )}
      </div>
    </div>
  );
}
