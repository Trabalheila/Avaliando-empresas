import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { buildApiUrl } from "../utils/apiBase";

/**
 * EmployerVerification
 * ------------------------------------------------------------------
 * Fluxo de 3 etapas para empresas confirmarem propriedade de um perfil:
 *
 *  1) CNPJ            — informa o CNPJ; o backend valida na BrasilAPI/RF.
 *  2) E-mail corporativo — domínios públicos (gmail/hotmail/etc.) são
 *                         rejeitados; um código de 6 dígitos é enviado.
 *  3) Código          — usuário informa o código recebido. Se o tier for
 *                         Premium ou se o domínio do e-mail não combinar
 *                         com a razão social, o pedido fica em
 *                         "Aguardando verificação manual".
 */

function readUserProfile() {
  try {
    return JSON.parse(localStorage.getItem("userProfile") || "{}") || {};
  } catch {
    return {};
  }
}

function maskCnpj(value) {
  const d = String(value || "").replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export default function EmployerVerification({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const profile = useMemo(() => readUserProfile(), []);
  const uid = profile.uid || profile.id || profile.profileId || "";
  const isPremiumIntent =
    profile.is_premium === true ||
    profile.apoiadorPlano === "premium" ||
    profile.role === "admin_empresa";

  const [step, setStep] = useState(1);
  const [cnpj, setCnpj] = useState("");
  const [corporateEmail, setCorporateEmail] = useState(profile.corporateEmail || "");
  const [tier] = useState(isPremiumIntent ? "premium" : "free");
  const [code, setCode] = useState("");

  const [requestId, setRequestId] = useState("");
  const [requiresManual, setRequiresManual] = useState(false);
  const [companyData, setCompanyData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!uid) {
      navigate("/?next=/empresa/verificacao", { replace: true });
    }
  }, [uid, navigate]);

  const submitStep1 = async (e) => {
    e?.preventDefault?.();
    setError("");
    setInfo("");
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) {
      setError("Informe um CNPJ válido com 14 dígitos.");
      return;
    }
    if (!corporateEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(corporateEmail)) {
      setError("Informe um e-mail corporativo válido.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/admin?op=verify-request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          cnpj: digits,
          corporateEmail,
          pseudonym: profile.pseudonym || profile.name || "",
          tier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao iniciar verificação.");
      setRequestId(data.requestId);
      setRequiresManual(Boolean(data.requiresManual));
      setCompanyData({
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia,
      });
      setInfo(`Código enviado para ${corporateEmail}. Verifique sua caixa de entrada.`);
      setStep(2);
    } catch (err) {
      setError(err.message || "Erro inesperado.");
    }
    setLoading(false);
  };

  const submitStep2 = async (e) => {
    e?.preventDefault?.();
    setError("");
    setInfo("");
    const cleaned = code.replace(/\D/g, "");
    if (cleaned.length !== 6) {
      setError("O código tem 6 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/admin?op=verify-confirm"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, code: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Código inválido.");
      setDone(true);
      setRequiresManual(Boolean(data.requiresManual));
      setStep(3);
    } catch (err) {
      setError(err.message || "Erro ao confirmar código.");
    }
    setLoading(false);
  };

  const resendCode = async () => {
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl("/api/admin?op=verify-resend"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Falha ao reenviar.");
      setInfo("Novo código enviado.");
    } catch (err) {
      setError(err.message || "Erro ao reenviar código.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Verificação de Empresa" />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <header>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-200">
              Verificar minha empresa
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Confirme que você representa a empresa para gerenciar o perfil corporativo
              e responder avaliações.
            </p>
          </header>

          {/* Stepper */}
          <ol className="flex items-center gap-2 text-xs">
            {[
              { n: 1, label: "CNPJ + E-mail" },
              { n: 2, label: "Código" },
              { n: 3, label: "Conclusão" },
            ].map((s, i) => (
              <li key={s.n} className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                    step >= s.n
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                  }`}
                >
                  {s.n}
                </span>
                <span
                  className={`font-semibold ${
                    step >= s.n
                      ? "text-slate-700 dark:text-slate-200"
                      : "text-slate-400"
                  }`}
                >
                  {s.label}
                </span>
                {i < 2 && <span className="w-6 h-px bg-slate-300 dark:bg-slate-600" />}
              </li>
            ))}
          </ol>

          {error && (
            <p className="px-3 py-2 rounded-lg text-sm bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </p>
          )}
          {info && (
            <p className="px-3 py-2 rounded-lg text-sm bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {info}
            </p>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <form onSubmit={submitStep1} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  CNPJ
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cnpj}
                  onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  E-mail corporativo
                </label>
                <input
                  type="email"
                  value={corporateEmail}
                  onChange={(e) => setCorporateEmail(e.target.value)}
                  placeholder="seu.nome@empresa.com.br"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Domínios públicos (Gmail, Hotmail, Outlook, Yahoo, UOL, etc.) não são aceitos.
                </p>
              </div>
              {tier === "premium" && (
                <p className="text-xs px-3 py-2 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Plano Premium: após confirmar o e-mail, sua solicitação será revisada
                  manualmente pela equipe Trabalhei Lá antes da liberação final.
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? "Enviando…" : "Enviar código de verificação"}
              </button>
            </form>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <form onSubmit={submitStep2} className="space-y-3">
              {companyData && (
                <div className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500">CNPJ confirmado:</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {companyData.razaoSocial}
                  </p>
                  {companyData.nomeFantasia && (
                    <p className="text-xs text-slate-500">{companyData.nomeFantasia}</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Código de 6 dígitos
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-center text-2xl tracking-widest font-mono"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Validando…" : "Confirmar código"}
                </button>
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  Reenviar
                </button>
              </div>
            </form>
          )}

          {/* Step 3 */}
          {step === 3 && done && (
            <div className="space-y-3">
              {requiresManual ? (
                <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700">
                  <p className="font-bold text-amber-800 dark:text-amber-300">
                    E-mail confirmado — aguardando revisão manual
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300/90 mt-1">
                    Sua solicitação foi recebida. A equipe Trabalhei Lá entrará em
                    contato em até 2 dias úteis para concluir a verificação. Você
                    receberá um e-mail quando for aprovado.
                  </p>
                </div>
              ) : (
                <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700">
                  <p className="font-bold text-emerald-800 dark:text-emerald-300">
                    Empresa verificada!
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300/90 mt-1">
                    Você agora é gestor verificado da empresa. Faça login novamente
                    para que as permissões sejam aplicadas.
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => navigate("/")}
                className="w-full py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-300"
              >
                Voltar ao início
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
