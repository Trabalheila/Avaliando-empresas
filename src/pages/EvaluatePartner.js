// src/pages/EvaluatePartner.js
//
// Página "Avaliar Fornecedor ou Cliente".
//
// Acesso restrito a usuários autenticados com perfil Empresa (role
// `admin_empresa` em /users/{uid} ou managedCompanyId vinculado em
// /companies/{id}). O fluxo é:
//
//   1) Empresa logada digita o CNPJ do parceiro a avaliar.
//   2) Consultamos o endpoint interno /api/cnpj?op=info (BrasilAPI +
//      fallback ReceitaWS) e exibimos razão social, situação cadastral,
//      porte e data de abertura do CNPJ avaliado.
//   3) Empresa preenche 5 notas (1–5) e um comentário opcional.
//   4) Salvamos em /companyReviews com cnpjAvaliado, cnpjAvaliador,
//      notas, comentario, verified=true (pois o CNPJ avaliador foi
//      confirmado via API ao logar) e timestamp.
//
// A lista de avaliações públicas (com nome da empresa avaliadora,
// notas detalhadas e comentário) só é renderizada para usuários com
// plano "founder" ou "premium". Usuários free veem apenas a média geral.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import AppHeader from "../components/AppHeader";

const CRITERIA = [
  { key: "pontualidadePagamento", label: "Pontualidade de pagamento" },
  { key: "qualidadeProdutoServico", label: "Qualidade do produto ou serviço" },
  { key: "transparenciaNegociacao", label: "Transparência na negociação" },
  { key: "cumprimentoContratos", label: "Cumprimento de contratos" },
  { key: "relacionamentoComercial", label: "Relacionamento comercial" },
];

function onlyDigits(v) {
  return String(v || "").replace(/\D+/g, "");
}

function formatCnpj(v) {
  const d = onlyDigits(v).slice(0, 14);
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(
    8,
    12
  )}-${d.slice(12, 14)}`;
}

function formatDateBR(v) {
  if (!v) return "—";
  try {
    // BrasilAPI devolve "YYYY-MM-DD"; ReceitaWS devolve "DD/MM/YYYY".
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const [y, m, d] = s.slice(0, 10).split("-");
      return `${d}/${m}/${y}`;
    }
    return s;
  } catch {
    return "—";
  }
}

function StarRow({ value = 0 }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Nota ${v.toFixed(1)} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          className={`h-4 w-4 ${n <= Math.round(v) ? "text-amber-500" : "text-slate-300 dark:text-slate-600"}`}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

function StarPicker({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0);
  const v = Number(value) || 0;
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover || v) >= n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={v === n}
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange?.(n)}
            className={`h-7 w-7 rounded transition ${
              disabled ? "opacity-60 cursor-not-allowed" : "hover:scale-110"
            }`}
          >
            <svg
              className={`h-6 w-6 ${active ? "text-amber-500" : "text-slate-300 dark:text-slate-600"}`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
            </svg>
          </button>
        );
      })}
      <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        {v ? `${v}/5` : "Selecione"}
      </span>
    </div>
  );
}

export default function EvaluatePartner({ theme, toggleTheme }) {
  const navigate = useNavigate();

  // Auth + identificação da empresa avaliadora.
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [companyAvaliadora, setCompanyAvaliadora] = useState(null); // doc da empresa logada

  // Lookup do CNPJ avaliado.
  const [cnpjInput, setCnpjInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [avaliado, setAvaliado] = useState(null); // { cnpj, razaoSocial, situacao, porte, dataAbertura }

  // Formulário.
  const initialNotas = useMemo(
    () => Object.fromEntries(CRITERIA.map((c) => [c.key, 0])),
    []
  );
  const [notas, setNotas] = useState(initialNotas);
  const [comentario, setComentario] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Avaliações anteriores do CNPJ avaliado.
  const [existingReviews, setExistingReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // ── Auth ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // ── Carrega a empresa logada (cnpjAvaliador) ───────────────────────────
  const loadCompany = useCallback(async (currentUser) => {
    setLoadingCompany(true);
    try {
      // 1) Lê /users/{uid} para obter managedCompanyId.
      let userData = null;
      try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        userData = snap.exists() ? snap.data() : null;
      } catch (err) {
        console.warn("[EvaluatePartner] erro ao ler /users/{uid}", err);
      }

      let companyDoc = null;
      const managedId = userData?.managedCompanyId;
      if (managedId) {
        try {
          const snap = await getDoc(doc(db, "companies", managedId));
          if (snap.exists()) {
            companyDoc = { id: snap.id, ...snap.data() };
          }
        } catch (err) {
          console.warn("[EvaluatePartner] erro ao ler /companies/{id}", err);
        }
      }

      // 2) Fallback: busca por ownerUid ou email.
      if (!companyDoc) {
        try {
          const q1 = query(
            collection(db, "companies"),
            where("ownerUid", "==", currentUser.uid)
          );
          const snap = await getDocs(q1);
          const best = snap.docs[0];
          if (best) companyDoc = { id: best.id, ...best.data() };
        } catch {
          /* segue */
        }
      }
      if (!companyDoc && currentUser.email) {
        try {
          const q2 = query(
            collection(db, "companies"),
            where("email", "==", currentUser.email)
          );
          const snap = await getDocs(q2);
          const best = snap.docs[0];
          if (best) companyDoc = { id: best.id, ...best.data() };
        } catch {
          /* segue */
        }
      }

      setCompanyAvaliadora(companyDoc);
    } finally {
      setLoadingCompany(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setLoadingCompany(false);
      setCompanyAvaliadora(null);
      return;
    }
    loadCompany(user);
  }, [authReady, user, loadCompany]);

  // Gate visual: somente empresa autenticada.
  const isEmployer = useMemo(() => {
    if (!user) return false;
    if (companyAvaliadora?.cnpj) return true;
    try {
      const stored = JSON.parse(localStorage.getItem("userProfile") || "null");
      return (
        stored?.role === "admin_empresa" ||
        stored?.isEmployer === true ||
        !!stored?.managedCompanyId
      );
    } catch {
      return false;
    }
  }, [user, companyAvaliadora]);

  // ── Lookup do CNPJ na Receita Federal ──────────────────────────────────
  const handleLookup = useCallback(async () => {
    setLookupError("");
    setAvaliado(null);
    setSubmitSuccess(false);
    const digits = onlyDigits(cnpjInput);
    if (digits.length !== 14) {
      setLookupError("Informe um CNPJ válido com 14 dígitos.");
      return;
    }
    if (
      companyAvaliadora?.cnpj &&
      onlyDigits(companyAvaliadora.cnpj) === digits
    ) {
      setLookupError("Você não pode avaliar a própria empresa.");
      return;
    }
    setLookupLoading(true);
    try {
      const r = await fetch(`/api/cnpj?op=info&cnpj=${digits}`);
      if (!r.ok) {
        throw new Error(`Falha na consulta (HTTP ${r.status}).`);
      }
      const data = await r.json();
      const razaoSocial =
        data?.razao_social || data?.nome || data?.fantasia || "";
      if (!razaoSocial) {
        throw new Error("Não foi possível identificar a empresa para este CNPJ.");
      }
      const situacao =
        data?.descricao_situacao_cadastral ||
        data?.situacao_cadastral ||
        data?.situacao ||
        "—";
      const porte =
        data?.porte?.descricao ||
        data?.porte ||
        data?.descricao_porte ||
        "—";
      const dataAbertura =
        data?.data_inicio_atividade ||
        data?.abertura ||
        data?.data_abertura ||
        "";
      setAvaliado({
        cnpj: digits,
        razaoSocial,
        situacao: String(situacao),
        porte: String(porte),
        dataAbertura: formatDateBR(dataAbertura),
      });
    } catch (err) {
      console.error("[EvaluatePartner] lookup falhou:", err);
      setLookupError(
        err?.message ||
          "Não foi possível consultar o CNPJ agora. Tente novamente em instantes."
      );
    } finally {
      setLookupLoading(false);
    }
  }, [cnpjInput, companyAvaliadora]);

  // ── Carrega avaliações públicas existentes do CNPJ avaliado ────────────
  useEffect(() => {
    if (!avaliado?.cnpj) {
      setExistingReviews([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setReviewsLoading(true);
      try {
        let snap;
        try {
          snap = await getDocs(
            query(
              collection(db, "companyReviews"),
              where("cnpjAvaliado", "==", avaliado.cnpj),
              orderBy("timestamp", "desc"),
              limit(50)
            )
          );
        } catch {
          // Se faltar índice composto, cai para query simples.
          snap = await getDocs(
            query(
              collection(db, "companyReviews"),
              where("cnpjAvaliado", "==", avaliado.cnpj),
              limit(50)
            )
          );
        }
        if (cancelled) return;
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setExistingReviews(list);
      } catch (err) {
        console.warn("[EvaluatePartner] erro ao carregar avaliações:", err);
        if (!cancelled) setExistingReviews([]);
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [avaliado?.cnpj]);

  // ── Submissão ──────────────────────────────────────────────────────────
  const allCriteriaFilled = CRITERIA.every((c) => Number(notas[c.key]) > 0);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setSubmitError("");
    setSubmitSuccess(false);
    if (!avaliado?.cnpj) {
      setSubmitError("Consulte um CNPJ válido antes de enviar a avaliação.");
      return;
    }
    if (!companyAvaliadora?.cnpj) {
      setSubmitError(
        "Sua empresa não está vinculada a um CNPJ confirmado. Conclua o cadastro da empresa antes de avaliar parceiros."
      );
      return;
    }
    if (!allCriteriaFilled) {
      setSubmitError("Atribua uma nota de 1 a 5 para todos os critérios.");
      return;
    }
    setSubmitting(true);
    try {
      const cnpjAvaliador = onlyDigits(companyAvaliadora.cnpj);
      const notasSanitized = Object.fromEntries(
        CRITERIA.map((c) => [c.key, Number(notas[c.key]) || 0])
      );
      const values = Object.values(notasSanitized);
      const notaGeral =
        values.reduce((a, b) => a + b, 0) / (values.length || 1);
      const payload = {
        cnpjAvaliado: avaliado.cnpj,
        cnpjAvaliador,
        razaoSocialAvaliada: avaliado.razaoSocial || null,
        razaoSocialAvaliadora:
          companyAvaliadora.razaoSocial ||
          companyAvaliadora.nomeFantasia ||
          companyAvaliadora.name ||
          null,
        notas: notasSanitized,
        notaGeral,
        comentario: (comentario || "").trim(),
        verified: true,
        timestamp: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "companyReviews"), payload);
      setExistingReviews((prev) => [
        { id: ref.id, ...payload, timestamp: { toDate: () => new Date() } },
        ...prev,
      ]);
      setNotas(initialNotas);
      setComentario("");
      setSubmitSuccess(true);
    } catch (err) {
      console.error("[EvaluatePartner] erro ao salvar avaliação:", err);
      setSubmitError(
        "Não foi possível publicar a avaliação agora. Tente novamente."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Visibilidade de avaliações detalhadas (Fundador/Premium) ──────────
  // Considera empresa logada com plan === "premium" ou planos Fundador
  // (campos isFounderPlan/founder). Free vê só nota geral.
  const viewerCanSeeDetails = useMemo(() => {
    const c = companyAvaliadora || {};
    if (c.plan === "premium") return true;
    if (c.plan === "founder" || c.isFounderPlan === true || c.founder === true)
      return true;
    if (c.isPremiumTrialActive === true) {
      const end = c.premiumTrialEndDate;
      try {
        const endMs =
          typeof end?.toMillis === "function"
            ? end.toMillis()
            : end?.seconds
            ? end.seconds * 1000
            : end
            ? new Date(end).getTime()
            : 0;
        if (endMs > Date.now()) return true;
      } catch {
        /* ignore */
      }
    }
    return false;
  }, [companyAvaliadora]);

  const averageOverall = useMemo(() => {
    if (!existingReviews.length) return 0;
    const total = existingReviews.reduce(
      (acc, r) => acc + (Number(r.notaGeral) || 0),
      0
    );
    return total / existingReviews.length;
  }, [existingReviews]);

  // ── Render ─────────────────────────────────────────────────────────────
  if (!authReady || loadingCompany) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
        <AppHeader theme={theme} toggleTheme={toggleTheme} />
        <main className="max-w-3xl mx-auto px-4 py-12 text-center text-slate-600 dark:text-slate-300">
          Carregando…
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
        <AppHeader theme={theme} toggleTheme={toggleTheme} />
        <main className="max-w-3xl mx-auto px-4 py-12">
          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Acesso restrito
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Faça login com uma conta de empresa para avaliar fornecedores ou clientes.
            </p>
            <button
              type="button"
              onClick={() => navigate("/login")}
              style={{ backgroundColor: "#1a237e" }}
              className="mt-6 h-11 px-5 rounded-lg font-bold text-white hover:brightness-110 transition"
            >
              Ir para login
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (!isEmployer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
        <AppHeader theme={theme} toggleTheme={toggleTheme} />
        <main className="max-w-3xl mx-auto px-4 py-12">
          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Recurso exclusivo de empresas
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Esta página é restrita a contas autenticadas com perfil Empresa.
              Cadastre sua empresa para liberar o acesso.
            </p>
            <button
              type="button"
              onClick={() => navigate("/empresa/cadastro")}
              style={{ backgroundColor: "#1a237e" }}
              className="mt-6 h-11 px-5 rounded-lg font-bold text-white hover:brightness-110 transition"
            >
              Cadastrar empresa
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Cabeçalho */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <div className="text-sm font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            Avaliar Fornecedor ou Cliente
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
            Avalie um parceiro de negócio
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Informe o CNPJ do fornecedor ou cliente que deseja avaliar.
            Consultamos a Receita Federal para confirmar a empresa e publicamos
            sua avaliação em nome de{" "}
            <b>
              {companyAvaliadora?.razaoSocial ||
                companyAvaliadora?.nomeFantasia ||
                companyAvaliadora?.name ||
                "sua empresa"}
            </b>
            .
          </p>

          {/* Lookup do CNPJ */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="flex-1">
              <label className="block mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                CNPJ do parceiro
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={cnpjInput}
                onChange={(e) => setCnpjInput(formatCnpj(e.target.value))}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                disabled={lookupLoading}
                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <button
              type="button"
              onClick={handleLookup}
              disabled={lookupLoading}
              style={{ backgroundColor: lookupLoading ? undefined : "#1a237e" }}
              className={`h-12 px-5 rounded-lg font-bold text-white transition ${
                lookupLoading
                  ? "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed"
                  : "hover:brightness-110"
              }`}
            >
              {lookupLoading ? "Consultando…" : "Consultar CNPJ"}
            </button>
          </div>
          {lookupError && (
            <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">
              {lookupError}
            </p>
          )}

          {/* Dados retornados */}
          {avaliado && (
            <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Empresa identificada na Receita Federal
              </div>
              <div className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">
                {avaliado.razaoSocial}
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-700 dark:text-slate-200">
                <div>
                  <span className="text-slate-400 dark:text-slate-500">CNPJ:</span>{" "}
                  {formatCnpj(avaliado.cnpj)}
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500">Situação:</span>{" "}
                  {avaliado.situacao}
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500">Porte:</span>{" "}
                  {avaliado.porte}
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500">Abertura:</span>{" "}
                  {avaliado.dataAbertura}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Formulário de avaliação */}
        {avaliado && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Sua avaliação
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Atribua nota de 1 a 5 para cada critério. O comentário é opcional.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {CRITERIA.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4 flex-wrap"
                >
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {c.label}
                  </div>
                  <StarPicker
                    value={notas[c.key]}
                    onChange={(n) =>
                      setNotas((prev) => ({ ...prev, [c.key]: n }))
                    }
                    disabled={submitting}
                  />
                </div>
              ))}

              <div>
                <label className="block mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                  Comentário (opcional)
                </label>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={4}
                  maxLength={1500}
                  disabled={submitting}
                  placeholder="Conte detalhes da sua experiência comercial com este parceiro."
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <div className="mt-1 text-right text-xs text-slate-400">
                  {comentario.length}/1500
                </div>
              </div>

              {submitError && (
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  {submitError}
                </p>
              )}
              {submitSuccess && (
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Avaliação publicada com sucesso.
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !allCriteriaFilled}
                  style={{
                    backgroundColor:
                      submitting || !allCriteriaFilled ? undefined : "#1a237e",
                  }}
                  className={`h-11 px-5 rounded-lg font-bold text-white transition ${
                    submitting || !allCriteriaFilled
                      ? "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed"
                      : "hover:brightness-110"
                  }`}
                >
                  {submitting ? "Publicando…" : "Publicar avaliação"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Avaliações existentes do CNPJ consultado */}
        {avaliado && (
          <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  Avaliações deste parceiro
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {existingReviews.length === 0
                    ? "Este CNPJ ainda não recebeu avaliações."
                    : `${existingReviews.length} avaliação(ões) publicada(s).`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StarRow value={averageOverall} />
                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {averageOverall ? averageOverall.toFixed(1) : "—"}
                </span>
              </div>
            </div>

            {reviewsLoading ? (
              <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                Carregando avaliações…
              </p>
            ) : viewerCanSeeDetails ? (
              <ul className="mt-6 space-y-4">
                {existingReviews.map((r) => {
                  const ts = r.timestamp;
                  let when = "";
                  try {
                    const d =
                      typeof ts?.toDate === "function"
                        ? ts.toDate()
                        : ts
                        ? new Date(ts)
                        : null;
                    if (d && !Number.isNaN(d.getTime())) {
                      when = d.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      });
                    }
                  } catch {
                    /* ignore */
                  }
                  return (
                    <li
                      key={r.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {r.razaoSocialAvaliadora || "Empresa avaliadora"}
                            {r.verified && (
                              <span className="ml-2 inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full align-middle">
                                CNPJ VERIFICADO
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {when}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StarRow value={r.notaGeral} />
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {Number(r.notaGeral || 0).toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                        {CRITERIA.map((c) => (
                          <div key={c.key} className="flex items-center justify-between gap-2">
                            <span className="text-slate-500 dark:text-slate-400">
                              {c.label}
                            </span>
                            <span className="font-semibold">
                              {Number(r.notas?.[c.key] || 0)}/5
                            </span>
                          </div>
                        ))}
                      </div>
                      {r.comentario && (
                        <p className="mt-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">
                          {r.comentario}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-6 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-5 text-sm text-amber-900 dark:text-amber-100">
                <b>Apenas a nota geral está disponível no plano gratuito.</b>{" "}
                Assine o Plano Fundador ou Premium para ver as notas detalhadas,
                comentários e identificação das empresas avaliadoras.
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
