import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function CompanyConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [empresa, setEmpresa] = useState(null);
  const [reenviando, setReenviando] = useState(false);
  const token = searchParams.get("token");
  // Evita execução dupla do efeito (React 18 StrictMode em dev) e re-execuções
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    async function checkToken() {
      if (!token) {
        setStatus("invalid");
        setError("Token não informado.");
        return;
      }
      try {
        const response = await fetch("/api/confirm-company", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok) {
          setStatus("success");
          // Após confirmar, leva para a tela de login com a flag de confirmação
          // e o destino final (dashboard da empresa) após o login.
          setTimeout(() => {
            navigate(
              "/login?companyConfirmed=true&redirectAfterLogin=/empresa-dashboard",
              { replace: true }
            );
          }, 2500);
          return;
        }

        // Erro retornado pela API
        const apiError = result.error || "Erro desconhecido na confirmação.";
        if (apiError === "Token expirado") {
          setStatus("expired");
          // API devolve email/companyName quando o token expira → permite reenvio
          setEmpresa({
            token,
            email: result.email,
            companyName: result.companyName,
          });
        } else {
          setStatus("invalid");
          setEmpresa((prev) => prev || { token });
        }
        setError(apiError);
      } catch (apiError) {
        console.error("Erro ao chamar API de confirmação:", apiError);
        setStatus("invalid");
        setError("Falha na comunicação com o servidor.");
      }
    }
    checkToken();
    // eslint-disable-next-line
  }, [token]);

  async function handleResend() {
    setReenviando(true);
    try {
      await fetch("/api/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: empresa?.email,
          companyName: empresa?.companyName,
          token: empresa?.token || token,
        }),
      });
      setStatus("reenviado");
    } catch {
      setError("Falha ao reenviar e-mail. Tente novamente mais tarde.");
    }
    setReenviando(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-blue-100 dark:border-slate-700 p-8 text-center">
        <span className="inline-block px-4 py-1 rounded-full bg-blue-600 text-white text-xs font-bold tracking-widest uppercase mb-4">Acesso Empresarial</span>
        {status === "loading" && <p className="text-blue-900 dark:text-blue-100 font-bold">Validando token...</p>}
        {status === "success" && <>
          <h1 className="text-xl font-extrabold text-emerald-700 mb-2">Cadastro confirmado!</h1>
          <p className="text-slate-700 dark:text-slate-200 mb-4">
            Sua empresa foi ativada com sucesso.<br />
            Você será redirecionado para a página de login. Após entrar, será levado(a) ao painel da empresa.
          </p>
        </>}
        {status === "invalid" && <>
          <h1 className="text-xl font-extrabold text-red-700 mb-2">Token inválido</h1>
          <p className="text-slate-700 dark:text-slate-200 mb-4">{error}</p>
        </>}
        {status === "expired" && <>
          <h1 className="text-xl font-extrabold text-yellow-700 mb-2">Token expirado</h1>
          <p className="text-slate-700 dark:text-slate-200 mb-4">{error}</p>
          <button onClick={handleResend} disabled={reenviando} className="mt-2 px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition disabled:opacity-60">
            {reenviando ? "Reenviando..." : "Reenviar e-mail de confirmação"}
          </button>
          {status === "reenviado" && <p className="text-emerald-700 mt-2">E-mail reenviado! Verifique sua caixa de entrada.</p>}
        </>}
      </div>
    </div>
  );
}
