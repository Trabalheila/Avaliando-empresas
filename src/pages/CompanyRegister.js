import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";

const PERSONAL_EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "yahoo.com", "yahoo.com.br", "outlook.com", "live.com", "icloud.com"];

function validarSenha(s) {
  return {
    tamanho: s.length >= 8,
    maiuscula: /[A-Z]/.test(s),
    numero: /\d/.test(s),
    especial: /[@#$%&*!]/.test(s),
  };
}

export default function CompanyRegister() {
  const navigate = useNavigate();
  const [cnpj, setCnpj] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [confirmarTouched, setConfirmarTouched] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Busca razão social via BrasilAPI
  async function fetchRazaoSocial(cnpjValue) {
    try {
      setLoadingCnpj(true);
      setRazaoSocial("");
      if (!cnpjValue || cnpjValue.length < 14) return;
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjValue}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();
      setRazaoSocial(data.razao_social || "");
    } catch {
      setRazaoSocial("");
    } finally {
      setLoadingCnpj(false);
    }
  }

  function formatCnpjMask(value) {
    const v = value.replace(/\D/g, "").slice(0, 14);
    if (!v) return "";
    let m = v;
    if (v.length > 12) m = `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8,12)}-${v.slice(12)}`;
    else if (v.length > 8) m = `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5,8)}/${v.slice(8)}`;
    else if (v.length > 5) m = `${v.slice(0,2)}.${v.slice(2,5)}.${v.slice(5)}`;
    else if (v.length > 2) m = `${v.slice(0,2)}.${v.slice(2)}`;
    return m;
  }

  function handleCnpjChange(e) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 14);
    setCnpj(formatCnpjMask(e.target.value));
    if (raw.length === 14) fetchRazaoSocial(raw);
    else setRazaoSocial("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const empresaId = cnpj;
      await setDoc(doc(db, "companies", empresaId), {
        cnpj,
        razaoSocial,
        responsavel,
        cargo,
        email,
        senha,
        status: "pendente",
        createdAt: Date.now(),
      });
      await fetch("/api/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          companyName: razaoSocial,
          token: window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now()
        })
      });
      setLoading(false);
      navigate("/empresa/enviado");
    } catch (err) {
      setError("Erro ao cadastrar empresa. Tente novamente.");
      setLoading(false);
    }
  }

  const senhaChecks = useMemo(() => validarSenha(senha), [senha]);
  const senhaValida = senhaChecks.tamanho && senhaChecks.maiuscula && senhaChecks.numero && senhaChecks.especial;
  const senhasCoincidem = senha.length > 0 && senha === confirmarSenha;
  const cnpjCompleto = cnpj.replace(/\D/g, "").length === 14;

  const emailDomain = email.split("@")[1]?.toLowerCase().trim();
  const emailPessoal = !!emailDomain && PERSONAL_EMAIL_DOMAINS.includes(emailDomain);
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const formValido =
    cnpjCompleto &&
    razaoSocial.trim().length > 0 &&
    responsavel.trim().length > 0 &&
    cargo.trim().length > 0 &&
    emailValido &&
    senhaValida &&
    senhasCoincidem;

  const inputClass =
    "w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
  const labelClass = "block mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 tracking-tight">Trabalhei Lá</div>
          <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-700 text-white text-[11px] font-bold tracking-wider px-3 py-1 rounded-full">
            ACESSO EMPRESARIAL
          </div>
          <h2 className="mt-5 text-2xl font-bold text-slate-800 dark:text-slate-100">Cadastro de Empresa</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-snug">
            Preencha os dados para criar o perfil empresarial e gerenciar avaliações.
          </p>
        </div>

        {/* CNPJ */}
        <div className="mb-4">
          <label className={labelClass}>CNPJ</label>
          <input
            type="text"
            value={cnpj}
            onChange={handleCnpjChange}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            className={inputClass}
            required
          />
        </div>

        {/* Razão Social (readonly) */}
        <div className="mb-4">
          <label className={labelClass}>Razão Social</label>
          <div className="relative">
            <input
              type="text"
              value={razaoSocial}
              readOnly
              placeholder={loadingCnpj ? "Buscando..." : "Preenchido automaticamente"}
              className={`${inputClass} pr-10 cursor-not-allowed opacity-90`}
              required
            />
            <div className="absolute inset-y-0 right-3 flex items-center text-slate-400 dark:text-slate-500" aria-hidden="true">
              {loadingCnpj ? (
                <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Responsável */}
        <div className="mb-4">
          <label className={labelClass}>Nome do Responsável</label>
          <input
            type="text"
            value={responsavel}
            onChange={e => setResponsavel(e.target.value)}
            placeholder="Nome completo do responsável"
            className={inputClass}
            required
          />
        </div>

        {/* Cargo */}
        <div className="mb-4">
          <label className={labelClass}>Cargo do Responsável</label>
          <input
            type="text"
            value={cargo}
            onChange={e => setCargo(e.target.value)}
            placeholder="Ex: Diretor, Gerente de RH"
            className={inputClass}
            required
          />
        </div>

        {/* E-mail */}
        <div className="mb-4">
          <label className={labelClass}>E-mail Corporativo</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@suaempresa.com.br"
            className={inputClass}
            required
          />
          {emailPessoal && (
            <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg px-3 py-2">
              <svg className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Recomendamos usar um e-mail corporativo para maior credibilidade.</span>
            </div>
          )}
        </div>

        {/* Senha */}
        <div className="mb-4">
          <label className={labelClass}>Senha</label>
          <div className="relative">
            <input
              type={showSenha ? "text" : "password"}
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="Crie uma senha segura"
              className={`${inputClass} pr-11`}
              required
            />
            <button
              type="button"
              onClick={() => setShowSenha(v => !v)}
              className="absolute inset-y-0 right-2 flex items-center px-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
            >
              {showSenha ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.06 21.06 0 0 1 5.06-6.06" />
                  <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.06 21.06 0 0 1-3.16 4.19" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {[
              { ok: senhaChecks.tamanho, label: "Mínimo 8 caracteres" },
              { ok: senhaChecks.maiuscula, label: "Uma letra maiúscula" },
              { ok: senhaChecks.numero, label: "Um número" },
              { ok: senhaChecks.especial, label: "Um especial (@#$%&*!)" },
            ].map((req, i) => (
              <li
                key={i}
                className={`flex items-center gap-1.5 ${req.ok ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}
              >
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  {req.ok ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="9" strokeWidth="2" />}
                </svg>
                <span>{req.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Confirmar Senha */}
        <div className="mb-5">
          <label className={labelClass}>Confirmar Senha</label>
          <div className="relative">
            <input
              type={showConfirmar ? "text" : "password"}
              value={confirmarSenha}
              onChange={e => setConfirmarSenha(e.target.value)}
              onBlur={() => setConfirmarTouched(true)}
              placeholder="Repita a senha"
              className={`${inputClass} pr-11`}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmar(v => !v)}
              className="absolute inset-y-0 right-2 flex items-center px-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label={showConfirmar ? "Ocultar senha" : "Mostrar senha"}
            >
              {showConfirmar ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.06 21.06 0 0 1 5.06-6.06" />
                  <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.06 21.06 0 0 1-3.16 4.19" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          {confirmarSenha.length > 0 && (
            senhasCoincidem ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Senhas coincidem
              </p>
            ) : (
              (confirmarTouched || confirmarSenha.length >= senha.length) && (
                <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">As senhas não coincidem</p>
              )
            )
          )}
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!formValido || loading}
          style={{ backgroundColor: formValido && !loading ? "#1a237e" : undefined }}
          className={`w-full h-12 rounded-lg font-bold text-white transition-colors ${
            formValido && !loading
              ? "hover:brightness-110"
              : "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed"
          }`}
        >
          {loading ? "Enviando..." : "Cadastrar Empresa"}
        </button>

        <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Ao cadastrar sua empresa você concorda com os{" "}
          <a href="/termos" className="text-blue-700 dark:text-blue-300 hover:underline">Termos de Uso</a>{" "}
          e a{" "}
          <a href="/politica-de-privacidade" className="text-blue-700 dark:text-blue-300 hover:underline">Política de Privacidade</a>{" "}
          do Trabalhei Lá.
        </p>
      </form>
    </div>
  );
}
