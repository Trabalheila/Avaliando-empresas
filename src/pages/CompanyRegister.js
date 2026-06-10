import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import YouTubeEmbed from "../components/YouTubeEmbed";
import EssencialFreePopup from "../components/EssencialFreePopup";

const PERSONAL_EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "yahoo.com", "yahoo.com.br", "outlook.com", "live.com", "icloud.com"];

// Opções padronizadas de Ramo de Atuação (alto nível, independente de CNAE).
const RAMOS_DE_ATUACAO = [
  "Tecnologia",
  "Saúde",
  "Educação",
  "Finanças",
  "Varejo",
  "Indústria",
  "Serviços",
  "Construção Civil",
  "Agropecuária",
  "Energia e Utilidades",
  "Transporte e Logística",
  "Telecomunicações",
  "Hospedagem e Alimentação",
  "Mídia e Entretenimento",
  "Imobiliário",
  "Setor Público",
  "Terceiro Setor / ONG",
  "Outros",
];

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
  const [cnae, setCnae] = useState(null); // { codigo, descricao, setor }
  const [ramoAtuacao, setRamoAtuacao] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [confirmarTouched, setConfirmarTouched] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [cnpjLookupFailed, setCnpjLookupFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Modal informativo (uma vez por sessão)
  const [showFreeModal, setShowFreeModal] = useState(false);
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const seen = window.sessionStorage.getItem("companyRegisterFreeModalSeen");
      if (!seen) setShowFreeModal(true);
    } catch { /* sessionStorage indisponível */ }
  }, []);

  function dismissFreeModal() {
    try { window.sessionStorage.setItem("companyRegisterFreeModalSeen", "1"); } catch { /* ignore */ }
    setShowFreeModal(false);
  }

  // Busca razão social via BrasilAPI
  async function fetchRazaoSocial(cnpjValue) {
    try {
      setLoadingCnpj(true);
      setCnpjLookupFailed(false);
      setRazaoSocial("");
      setCnae(null);
      if (!cnpjValue || cnpjValue.length < 14) return;
      const res = await fetch(`/api/cnpj?op=info&cnpj=${cnpjValue}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();
      setRazaoSocial(data.razao_social || "");
      // CNAE principal: BrasilAPI retorna `cnae_fiscal` (número) e `cnae_fiscal_descricao`.
      const cnaeCodigoRaw = data?.cnae_fiscal ?? data?.cnae_principal?.codigo ?? null;
      const cnaeDescricao = data?.cnae_fiscal_descricao || data?.cnae_principal?.descricao || "";
      const cnaeCodigo = cnaeCodigoRaw != null ? String(cnaeCodigoRaw).replace(/\D/g, "") : "";
      // Setor: primeiros 2 dígitos do CNAE = divisão (proxy de setor para agrupamento).
      const setor = cnaeCodigo ? cnaeCodigo.slice(0, 2) : "";
      if (cnaeCodigo || cnaeDescricao) {
        setCnae({ codigo: cnaeCodigo, descricao: cnaeDescricao, setor });
      }
      if (!data.razao_social) setCnpjLookupFailed(true);
    } catch {
      setRazaoSocial("");
      setCnae(null);
      setCnpjLookupFailed(true);
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
    else {
      setRazaoSocial("");
      setCnae(null);
      setCnpjLookupFailed(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // CNPJ sem máscara, usado como id da empresa em companies/{cnpjDigits}
      // após a confirmação por e-mail.
      const cnpjDigits = cnpj.replace(/\D/g, "");
      const token = (window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now()
      ).replace(/[^A-Za-z0-9_-]/g, "");

      // Toda a persistência (incluindo senha) é feita no backend pelo
      // Admin SDK em /api/send-confirmation. O cliente NÃO grava nada
      // no Firestore aqui — assim a senha não vai parar em /companies
      // em texto puro, e só é usada para criar o usuário no Firebase
      // Auth depois que o e-mail for confirmado.
      const resp = await fetch("/api/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email,
          password: senha,
          companyName: razaoSocial,
          cnpj: cnpjDigits,
          cnaeCodigo: cnae?.codigo || null,
          cnaeDescricao: cnae?.descricao || null,
          setor: cnae?.setor || null,
          ramoAtuacao: ramoAtuacao || null,
          responsavel,
          cargo,
        }),
      });
      if (!resp.ok) {
        // Tenta JSON; se falhar, lê como texto (ex.: página HTML 500 do Vercel)
        // para que o usuário enxergue a causa real ao invés do genérico.
        let body = null;
        let textBody = "";
        try {
          body = await resp.clone().json();
        } catch {
          try { textBody = await resp.text(); } catch { /* ignore */ }
        }
        const detail =
          body?.error ||
          (textBody && textBody.length < 300 ? textBody : "") ||
          `HTTP ${resp.status}`;
        throw new Error(`Falha ao enviar confirmação: ${detail}`);
      }
      setLoading(false);
      setSubmitted(true);
    } catch (err) {
      console.error("Erro no cadastro:", err?.code, err?.message, err);
      setError(err?.message || "Erro ao cadastrar empresa. Tente novamente.");
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
    ramoAtuacao.trim().length > 0 &&
    responsavel.trim().length > 0 &&
    cargo.trim().length > 0 &&
    emailValido &&
    senhaValida &&
    senhasCoincidem;

  const inputClass =
    "w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
  const labelClass = "block mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200";

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
          <div className="text-3xl font-extrabold text-blue-700 dark:text-blue-300 tracking-tight">Trabalhei Lá</div>

          <div className="mt-6 mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <svg className="h-9 w-9 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <h1 className="mt-5 text-2xl font-bold text-slate-800 dark:text-slate-100">
            Cadastro enviado com sucesso!
          </h1>

          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Enviamos um e-mail de confirmação para o endereço cadastrado. Por favor, acesse sua caixa de entrada e clique no link para ativar o perfil da sua empresa na plataforma. Verifique também a pasta de spam caso não encontre o e-mail.
          </p>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-8 w-full h-12 rounded-lg font-bold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
          >
            Voltar para a página inicial
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 px-4 py-10">
      <EssencialFreePopup
        planName="Empresa Essencial"
        storageKey="essencialFreePopup:employer:v1"
        ctaLabel="Quero Aproveitar!"
        accent="indigo"
      />
      {showFreeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="free-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:px-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={dismissFreeModal}
        >
          <div
            className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 text-center max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-2xl">
              🎉
            </div>
            <h2 id="free-modal-title" className="mt-4 text-xl font-extrabold text-slate-800 dark:text-slate-100">
              Atenção Importante!
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              O <span className="font-bold text-blue-700 dark:text-blue-300">Plano Premium Empresa</span>{" "}
              está <span className="font-bold text-emerald-600 dark:text-emerald-400">GRATUITO</span> até{" "}
              <span className="font-bold">01/08/2026</span>! Aproveite todos os recursos estratégicos para sua empresa
              sem custo durante este período.
            </p>
            <button
              type="button"
              onClick={dismissFreeModal}
              className="mt-6 w-full py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm transition"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        {/* Botão Voltar */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Voltar para a página anterior"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-300 font-bold text-sm shadow-sm hover:bg-blue-50 dark:hover:bg-slate-700 transition"
          >
            <span aria-hidden="true">←</span>
            <span>Voltar</span>
          </button>
        </div>

        {/* Vídeo explicativo do cadastro do empresário */}
        <div className="max-w-2xl mx-auto mb-6">
          <YouTubeEmbed videoId="twcL4RSKznY" title="Cadastro Empresário" />
        </div>

        {/* Stepper visual (3 etapas) */}
        <ol className="mb-8 grid grid-cols-3 gap-2 sm:gap-4" aria-label="Progresso do cadastro">
          {[
            { n: 1, label: "Dados da Empresa", active: true, done: false },
            { n: 2, label: "Confirmação de E-mail", active: false, done: false },
            { n: 3, label: "Acesse seu Dashboard", active: false, done: false },
          ].map((step) => (
            <li key={step.n} className="flex items-center gap-2 sm:gap-3">
              <span
                aria-current={step.active ? "step" : undefined}
                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                  step.active
                    ? "bg-blue-700 text-white border-blue-700"
                    : step.done
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-slate-600"
                }`}
              >
                {step.n}
              </span>
              <span
                className={`text-xs sm:text-sm leading-snug ${
                  step.active
                    ? "font-bold text-blue-700 dark:text-blue-300"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex flex-col lg:grid lg:grid-cols-[55%_45%] lg:gap-8 lg:items-start">
          {/* Painel esquerdo: formulário */}
          <form
            onSubmit={handleSubmit}
            className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 lg:p-10"
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

        {/* Grupo: Dados da Empresa */}
        <h3 className="text-[11px] font-bold tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400 mb-3">
          Dados da Empresa
        </h3>

        {/* CNPJ */}
        <div className="mb-4">
          <label htmlFor="cnpj" className={labelClass}>CNPJ</label>
          <input
            id="cnpj"
            name="cnpj"
            type="text"
            value={cnpj}
            onChange={handleCnpjChange}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            autoComplete="off"
            className={inputClass}
            required
          />
        </div>

        {/* Razão Social (readonly quando vinda da API; editável quando falha) */}
        <div className="mb-4">
          <label htmlFor="razaoSocial" className={labelClass}>Razão Social</label>
          <div className="relative">
            <input
              id="razaoSocial"
              name="razaoSocial"
              type="text"
              value={razaoSocial}
              onChange={e => setRazaoSocial(e.target.value)}
              readOnly={!cnpjLookupFailed}
              autoComplete="organization"
              placeholder={
                loadingCnpj
                  ? "Buscando..."
                  : cnpjLookupFailed
                    ? "Digite a razão social da empresa"
                    : "Preenchido automaticamente"
              }
              className={`${inputClass} ${cnpjLookupFailed ? "" : "pr-10 cursor-not-allowed opacity-90"}`}
              required
            />
            {!cnpjLookupFailed && (
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
            )}
          </div>
          {cnpjLookupFailed && (
            <div className="mt-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg px-3 py-2">
              <svg className="h-4 w-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>Não conseguimos buscar os dados automaticamente. Preencha a razão social manualmente.</span>
            </div>
          )}
        </div>

        {/* Ramo de Atuação (obrigatório) */}
        <div className="mb-4">
          <label htmlFor="ramoAtuacao" className={labelClass}>Ramo de Atuação</label>
          <select
            id="ramoAtuacao"
            name="ramoAtuacao"
            value={ramoAtuacao}
            onChange={(e) => setRamoAtuacao(e.target.value)}
            className={inputClass}
            required
          >
            <option value="" disabled>Selecione o ramo de atuação</option>
            {RAMOS_DE_ATUACAO.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Separador entre grupos */}
        <div className="my-6 border-t border-slate-200 dark:border-slate-700" aria-hidden="true" />

        {/* Grupo: Dados do Responsável */}
        <h3 className="text-[11px] font-bold tracking-[0.18em] uppercase text-slate-500 dark:text-slate-400 mb-3">
          Dados do Responsável
        </h3>

        {/* Responsável */}
        <div className="mb-4">
          <label htmlFor="nomeResponsavel" className={labelClass}>Nome do Responsável</label>
          <input
            id="nomeResponsavel"
            name="nomeResponsavel"
            type="text"
            value={responsavel}
            onChange={e => setResponsavel(e.target.value)}
            placeholder="Nome completo do responsável"
            autoComplete="name"
            className={inputClass}
            required
          />
        </div>

        {/* Cargo */}
        <div className="mb-4">
          <label htmlFor="cargoResponsavel" className={labelClass}>Cargo do Responsável</label>
          <input
            id="cargoResponsavel"
            name="cargoResponsavel"
            type="text"
            value={cargo}
            onChange={e => setCargo(e.target.value)}
            placeholder="Ex: Diretor, Gerente de RH"
            autoComplete="organization-title"
            className={inputClass}
            required
          />
        </div>

        {/* E-mail */}
        <div className="mb-4">
          <label htmlFor="emailCorporativo" className={labelClass}>E-mail Corporativo</label>
          <input
            id="emailCorporativo"
            name="emailCorporativo"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@suaempresa.com.br"
            autoComplete="email"
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
          <label htmlFor="senha" className={labelClass}>Senha</label>
          <div className="relative">
            <input
              id="senha"
              name="senha"
              type={showSenha ? "text" : "password"}
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="Crie uma senha segura"
              autoComplete="off"
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
          <label htmlFor="confirmarSenha" className={labelClass}>Confirmar Senha</label>
          <div className="relative">
            <input
              id="confirmarSenha"
              name="confirmarSenha"
              type={showConfirmar ? "text" : "password"}
              value={confirmarSenha}
              onChange={e => setConfirmarSenha(e.target.value)}
              onBlur={() => setConfirmarTouched(true)}
              placeholder="Repita a senha"
              autoComplete="off"
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

          {/* Painel direito: benefícios Premium (sticky em desktop, acima do form em mobile) */}
          <aside className="w-full lg:sticky lg:top-6 lg:self-start mb-6 lg:mb-0">
            <div className="rounded-2xl shadow-xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-br from-blue-700 to-blue-900 text-white p-8">
              <div className="inline-flex items-center gap-1.5 bg-white/15 text-white text-[11px] font-bold tracking-wider px-3 py-1 rounded-full">
                PLANO PREMIUM EMPRESA
              </div>
              <h3 className="mt-4 text-2xl font-bold leading-tight">
                Tenha o controle estratégico do clima da sua empresa
              </h3>
              <p className="mt-2 text-sm text-blue-100/90 leading-relaxed">
                Recursos exclusivos para gestores que querem decidir com base em dados reais.
              </p>

              <ul className="mt-6 space-y-3">
                {[
                  "Compare sua empresa com concorrentes em tempo real",
                  "Identifique tendências e riscos do setor",
                  "Relatórios executivos com oportunidades e ameaças",
                  "Benchmarks exclusivos e reputação de mercado",
                ].map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-400/20 text-emerald-300">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span className="text-sm text-white/95 leading-snug">{benefit}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 pt-6 border-t border-white/15">
                <div className="text-xs text-blue-100/80">A partir de</div>
                <div className="text-2xl font-extrabold tracking-tight">R$ 1.649,90<span className="text-sm font-semibold text-blue-100/80">/mês</span></div>
                <div className="text-xs text-blue-100/80 mt-1">Disponível a partir de 01/08/2026</div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
