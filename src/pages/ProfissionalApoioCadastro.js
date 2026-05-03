// src/pages/ProfissionalApoioCadastro.js
//
// Página de cadastro do tipo de usuário "Profissional de Apoio"
// (userType: 'supportProfessional').
//
// Coleta dados básicos (nome, CPF com validação, e-mail, senha,
// especialidades multi-select, mini-bio, link opcional) e salva o
// perfil no Firestore na coleção `supportProfessionals`. A senha é
// usada para criar o usuário no Firebase Auth.

import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import AppHeader from "../components/AppHeader";

const SPECIALTY_OPTIONS = [
  { value: "psicologia", label: "Psicologia" },
  { value: "direito_trabalhista", label: "Direito Trabalhista" },
  { value: "coaching_carreira", label: "Coaching de Carreira" },
  { value: "mentoria_financeira", label: "Mentoria Financeira" },
  { value: "saude_ocupacional", label: "Saúde Ocupacional" },
  { value: "consultoria_rh", label: "Consultoria de RH" },
  { value: "recolocacao", label: "Recolocação Profissional" },
  { value: "diversidade_inclusao", label: "Diversidade e Inclusão" },
  { value: "lideranca", label: "Desenvolvimento de Liderança" },
  { value: "saude_mental", label: "Saúde Mental no Trabalho" },
  { value: "mediacao_conflitos", label: "Mediação de Conflitos" },
  { value: "outros", label: "Outros" },
];

const MAX_BIO = 600;

function maskCpf(value) {
  const d = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function isValidCpfDigits(input) {
  const c = String(input || "").replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(c[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(c[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(c[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(c[10]);
}

function validarSenha(s) {
  return {
    tamanho: s.length >= 8,
    maiuscula: /[A-Z]/.test(s),
    numero: /\d/.test(s),
    especial: /[@#$%&*!]/.test(s),
  };
}

export default function ProfissionalApoioCadastro({ theme, toggleTheme }) {
  const navigate = useNavigate();

  const [cpf, setCpf] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [birthdateError, setBirthdateError] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [specialties, setSpecialties] = useState([]);
  const [bio, setBio] = useState("");
  const [profileLink, setProfileLink] = useState("");

  const [cpfLoading, setCpfLoading] = useState(false);
  const [cpfError, setCpfError] = useState("");
  const [cpfNotice, setCpfNotice] = useState("");
  const [cpfVerified, setCpfVerified] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const senhaChecks = useMemo(() => validarSenha(password), [password]);
  const senhaValida =
    senhaChecks.tamanho && senhaChecks.maiuscula && senhaChecks.numero && senhaChecks.especial;
  const senhasCoincidem = password.length > 0 && password === confirmPassword;
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const cpfDigits = cpf.replace(/\D/g, "");
  const cpfCompleto = cpfDigits.length === 11 && isValidCpfDigits(cpfDigits);

  const formValido =
    cpfCompleto &&
    /^\d{4}-\d{2}-\d{2}$/.test(birthdate) &&
    !birthdateError &&
    fullName.trim().length >= 3 &&
    emailValido &&
    senhaValida &&
    senhasCoincidem &&
    specialties.length > 0 &&
    bio.trim().length >= 20;

  const handleCpfBlur = useCallback(async () => {
    const digits = cpf.replace(/\D/g, "");
    setCpfError("");
    setCpfNotice("");
    if (!digits) {
      setCpfVerified(false);
      return;
    }
    if (digits.length !== 11) {
      setCpfError("CPF deve conter 11 dígitos.");
      setCpfVerified(false);
      return;
    }
    if (!isValidCpfDigits(digits)) {
      setCpfError("CPF inválido.");
      setCpfVerified(false);
      return;
    }
    setCpfLoading(true);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const qs = new URLSearchParams({ cpf: digits });
      if (birthdate) qs.set("birthdate", birthdate);
      qs.set("_t", Date.now().toString());
      const resp = await fetch(`/api/consulta-cpf?${qs.toString()}`, {
        signal: ctrl.signal,
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      clearTimeout(t);
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.valid) {
        setCpfError(data?.error || "CPF inválido.");
        setCpfVerified(false);
        return;
      }
      if (data?.fullName) {
        setFullName(data.fullName);
        setCpfVerified(true);
      } else if (data?.reason === "birthdate_required") {
        setCpfNotice("Informe a data de nascimento abaixo para verificar o CPF automaticamente.");
        setCpfVerified(false);
      } else if (data?.reason === "lookup_unavailable") {
        setCpfNotice(
          "CPF v\u00e1lido. Servi\u00e7o de autocompletar indispon\u00edvel no momento \u2014 preencha o nome manualmente."
        );
        setCpfVerified(false);
      } else if (data?.reason === "not_found") {
        const errs = Array.isArray(data?.providerErrors) ? data.providerErrors.join("; ") : "";
        const extra = errs
          ? ` (${errs})`
          : data?.providerMessage
          ? ` (${data.providerMessage})`
          : "";
        setCpfNotice(
          `CPF v\u00e1lido, mas n\u00e3o foi poss\u00edvel localizar o nome na Receita${extra}. Confira a data de nascimento e preencha o nome manualmente se necess\u00e1rio.`
        );
        setCpfVerified(false);
      } else {
        setCpfNotice("CPF v\u00e1lido. Preencha o nome manualmente.");
        setCpfVerified(false);
      }
    } catch {
      setCpfNotice("CPF v\u00e1lido. N\u00e3o foi poss\u00edvel consultar agora \u2014 preencha o nome manualmente.");
      setCpfVerified(false);
    } finally {
      setCpfLoading(false);
    }
  }, [cpf, birthdate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!formValido) {
      setError("Preencha todos os campos obrigatórios corretamente.");
      return;
    }
    setSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;

      const profile = {
        uid,
        userType: "supportProfessional",
        fullName: fullName.trim(),
        cpf: cpfDigits,
        birthdate: birthdate || null,
        email: email.trim().toLowerCase(),
        specialties: specialties.map((s) => ({ value: s.value, label: s.label })),
        bio: bio.trim(),
        profileLink: profileLink.trim() || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "active",
        verified: false,
      };

      await setDoc(doc(db, "supportProfessionals", uid), profile);
      setSuccess(true);
      setTimeout(() => navigate(`/profissionais-apoio/${uid}`), 1200);
    } catch (err) {
      console.error("Erro no cadastro do profissional de apoio:", err);
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        setError("Este e-mail já está em uso.");
      } else if (code === "auth/weak-password") {
        setError("A senha não atende aos requisitos de segurança.");
      } else {
        setError(err?.message || "Erro ao cadastrar. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";
  const labelClass =
    "block mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200";

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
        <AppHeader theme={theme} toggleTheme={toggleTheme} />
        <div className="flex items-center justify-center px-4 py-16">
          <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <svg
                className="h-9 w-9 text-emerald-600 dark:text-emerald-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="mt-5 text-2xl font-bold text-slate-800 dark:text-slate-100">
              Cadastro concluído!
            </h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Estamos redirecionando você para o seu perfil...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 md:p-10">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
            Cadastro de Profissional de Apoio
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Crie seu perfil para conectar-se a trabalhadores que precisam do seu suporte
            especializado.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {/* CPF antes do nome */}
            <div>
              <label htmlFor="prof-cpf" className={labelClass}>
                CPF <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <input
                  id="prof-cpf"
                  name="cpf"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  value={cpf}
                  onChange={(e) => {
                    setCpf(maskCpf(e.target.value));
                    setCpfError("");
                    setCpfNotice("");
                    setCpfVerified(false);
                  }}
                  onBlur={handleCpfBlur}
                  placeholder="000.000.000-00"
                  className={inputClass + " pr-10"}
                />
                {cpfLoading && (
                  <span
                    aria-hidden="true"
                    className="absolute right-3 top-1/2 -translate-y-1/2 inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
                  />
                )}
                {!cpfLoading && cpfVerified && (
                  <span
                    aria-label="CPF verificado"
                    title="CPF verificado"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 text-lg"
                  >
                    ✓
                  </span>
                )}
              </div>
              {cpfError && (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{cpfError}</p>
              )}
              {!cpfError && cpfNotice && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{cpfNotice}</p>
              )}
            </div>

            {/* Data de nascimento (necessária para validação de CPF via Receita Federal). */}
            <div>
              <label htmlFor="prof-birthdate" className={labelClass}>
                Data de Nascimento <span className="text-rose-600">*</span>
              </label>
              <input
                id="prof-birthdate"
                type="date"
                value={birthdate}
                max={new Date().toISOString().slice(0, 10)}
                required
                onChange={(e) => {
                  setBirthdateError("");
                  setBirthdate(e.target.value);
                }}
                onBlur={() => {
                  const v = (birthdate || "").trim();
                  if (!v) {
                    setBirthdateError("");
                    return;
                  }
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                    setBirthdateError("Data inválida.");
                    return;
                  }
                  const bd = new Date(v + "T00:00:00");
                  if (isNaN(bd.getTime())) {
                    setBirthdateError("Data inválida.");
                    return;
                  }
                  const today = new Date();
                  let age = today.getFullYear() - bd.getFullYear();
                  const m = today.getMonth() - bd.getMonth();
                  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
                  if (age < 18) {
                    setBirthdateError("É necessário ter pelo menos 18 anos.");
                  } else {
                    setBirthdateError("");
                    // Reconsulta CPF se já estiver válido para tentar preencher o nome.
                    if (cpfDigits.length === 11 && isValidCpfDigits(cpfDigits)) {
                      handleCpfBlur();
                    }
                  }
                }}
                className={inputClass}
              />
              {birthdateError ? (
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{birthdateError}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Necessária para validação automática do CPF na Receita Federal.
                </p>
              )}
            </div>

            {/* Nome completo */}
            <div>
              <label htmlFor="prof-nome" className={labelClass}>
                Nome completo <span className="text-rose-600">*</span>
                {cpfVerified && (
                  <span className="ml-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-full px-2 py-0.5">
                    Verificado pelo CPF
                  </span>
                )}
              </label>
              <input
                id="prof-nome"
                name="fullName"
                required
                readOnly={cpfVerified}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Como aparece no seu documento"
                className={
                  inputClass +
                  (cpfVerified ? " bg-slate-100 dark:bg-slate-700 cursor-not-allowed" : "")
                }
              />
            </div>

            {/* E-mail */}
            <div>
              <label htmlFor="prof-email" className={labelClass}>
                E-mail <span className="text-rose-600">*</span>
              </label>
              <input
                id="prof-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@dominio.com"
                className={inputClass}
              />
            </div>

            {/* Senha + Confirmar */}
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="prof-senha" className={labelClass}>
                  Senha <span className="text-rose-600">*</span>
                </label>
                <input
                  id="prof-senha"
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
                <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                  <li className={senhaChecks.tamanho ? "text-emerald-600" : "text-slate-500"}>
                    {senhaChecks.tamanho ? "✓" : "•"} Mínimo 8 caracteres
                  </li>
                  <li className={senhaChecks.maiuscula ? "text-emerald-600" : "text-slate-500"}>
                    {senhaChecks.maiuscula ? "✓" : "•"} Uma letra maiúscula
                  </li>
                  <li className={senhaChecks.numero ? "text-emerald-600" : "text-slate-500"}>
                    {senhaChecks.numero ? "✓" : "•"} Um número
                  </li>
                  <li className={senhaChecks.especial ? "text-emerald-600" : "text-slate-500"}>
                    {senhaChecks.especial ? "✓" : "•"} Um especial (@#$%&*!)
                  </li>
                </ul>
              </div>
              <div>
                <label htmlFor="prof-confirma" className={labelClass}>
                  Confirmar senha <span className="text-rose-600">*</span>
                </label>
                <input
                  id="prof-confirma"
                  name="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                />
                {confirmPassword.length > 0 && (
                  <p
                    className={
                      "mt-1 text-[11px] " +
                      (senhasCoincidem ? "text-emerald-600" : "text-rose-600")
                    }
                  >
                    {senhasCoincidem ? "✓ Senhas coincidem" : "Senhas não coincidem"}
                  </p>
                )}
              </div>
            </div>

            {/* Especialidades (multi-select) */}
            <div>
              <label htmlFor="prof-esp" className={labelClass}>
                Especialidades <span className="text-rose-600">*</span>
                <span className="text-xs font-normal text-slate-500"> (selecione uma ou mais)</span>
              </label>
              <Select
                inputId="prof-esp"
                isMulti
                options={SPECIALTY_OPTIONS}
                value={specialties}
                onChange={(v) => setSpecialties(v || [])}
                placeholder="Escolha suas áreas de atuação..."
                classNamePrefix="rs"
                styles={{
                  control: (base) => ({ ...base, minHeight: 48, borderRadius: 8 }),
                }}
              />
            </div>

            {/* Mini-bio */}
            <div>
              <label htmlFor="prof-bio" className={labelClass}>
                Mini-biografia / Descrição <span className="text-rose-600">*</span>
              </label>
              <textarea
                id="prof-bio"
                name="bio"
                required
                rows={4}
                maxLength={MAX_BIO}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Conte brevemente sua experiência, formação e abordagem (mínimo 20 caracteres)."
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {bio.length}/{MAX_BIO} caracteres
              </p>
            </div>

            {/* Link profissional opcional */}
            <div>
              <label htmlFor="prof-link" className={labelClass}>
                Link para perfil profissional <span className="text-xs font-normal text-slate-500">(opcional)</span>
              </label>
              <input
                id="prof-link"
                name="profileLink"
                type="url"
                value={profileLink}
                onChange={(e) => setProfileLink(e.target.value)}
                placeholder="https://www.linkedin.com/in/seu-perfil"
                className={inputClass}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/30 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!formValido || submitting}
              className="w-full h-12 rounded-lg font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition"
            >
              {submitting ? "Cadastrando..." : "Concluir Cadastro"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
