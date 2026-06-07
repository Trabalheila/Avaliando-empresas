// src/components/ExperienceManagerModal.jsx
//
// Modal acionado pelo card "Minhas Experiências Profissionais" (MinhaConta).
// Permite:
//   1. Importar experiências previamente trazidas do LinkedIn (login social
//      OAuth2 já existente, exposto por LoginLinkedInButton + socialAuth).
//   2. Adicionar manualmente uma experiência (Empresa + Cargo/Função).
//
// Cada experiência fica gravada em `profile.resumeData.experiencesStructured`
// (Firestore + localStorage), com marcador `verified: true` para origem
// "linkedin" e `verified: false` para origem "manual".

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { saveUserProfile } from "../services/users";
import { extractLinkedInExperiences } from "../services/socialAuth";
import LoginLinkedInButton from "../LoginLinkedInButton";
import { getLinkedInRedirectUri } from "../utils/linkedinAuth";
import { buildApiUrl } from "../utils/apiBase";
import { normalizeCompanyName } from "../utils/companyMatching";

function normalizeKey(company, role) {
  return `${(company || "").trim().toLowerCase()}__${(role || "")
    .trim()
    .toLowerCase()}`;
}

function mergeIntoProfile(profile, newItems) {
  const current = Array.isArray(profile?.resumeData?.experiencesStructured)
    ? profile.resumeData.experiencesStructured
    : [];

  const seen = new Map(
    current.map((item) => [normalizeKey(item.company, item.role), item])
  );
  for (const item of newItems) {
    const key = normalizeKey(item.company, item.role);
    if (!seen.has(key)) seen.set(key, item);
  }

  const nextExperiences = Array.from(seen.values());
  const companyNames = nextExperiences
    .map((e) => (e.company || "").trim())
    .filter(Boolean);

  // Lista de empresas oriundas do LinkedIn, normalizada, para uso server-side
  // na verificação de autenticidade das avaliações. Não é segredo, mas não
  // deve ser exibida em público — mantenha as Firestore rules restringindo
  // leitura do doc users/{uid} ao próprio usuário.
  const linkedInCompaniesNormalized = Array.from(
    new Set(
      nextExperiences
        .filter((e) => e.source === "linkedin" || e.verified === true)
        .map((e) => normalizeCompanyName(e.company || ""))
        .filter(Boolean)
    )
  );

  return {
    ...profile,
    linkedInCompaniesNormalized,
    resumeData: {
      ...(profile?.resumeData || {}),
      experiencesStructured: nextExperiences,
      experiences: companyNames,
      updatedAt: new Date().toISOString(),
    },
  };
}

function persistLocalProfile(nextProfile) {
  try {
    localStorage.setItem("userProfile", JSON.stringify(nextProfile));
    window.dispatchEvent(new Event("trabalheiLa_user_updated"));
  } catch {
    /* sem localStorage */
  }
}

export default function ExperienceManagerModal({
  open,
  onClose,
  profile,
  onSaved,
}) {
  const [tab, setTab] = useState("linkedin");
  const [manualCompany, setManualCompany] = useState("");
  const [manualRole, setManualRole] = useState("");
  const [selected, setSelected] = useState({}); // key -> bool
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [linkedInBusy, setLinkedInBusy] = useState(false);
  const [cvBusy, setCvBusy] = useState(false);
  const [cvParsed, setCvParsed] = useState([]); // [{empresa, funcao, data_inicio, data_fim, _selected}]
  const cvInputRef = useRef(null);

  // Lista de experiências disponíveis no perfil que vieram do LinkedIn
  const linkedInAvailable = useMemo(() => {
    const raw = extractLinkedInExperiences(profile || {});
    const already = new Set(
      (profile?.resumeData?.experiencesStructured || []).map((e) =>
        normalizeKey(e.company, e.role)
      )
    );
    return raw.filter(
      (item) => !already.has(normalizeKey(item.company, item.role))
    );
  }, [profile]);

  // Resetar estado quando abre/fecha
  useEffect(() => {
    if (open) {
      setError("");
      setInfo("");
      setManualCompany("");
      setManualRole("");
      // Pré-selecionar todas as experiências LinkedIn disponíveis.
      const next = {};
      linkedInAvailable.forEach((item) => {
        next[normalizeKey(item.company, item.role)] = true;
      });
      setSelected(next);
    }
  }, [open, linkedInAvailable]);

  const handleImportLinkedIn = useCallback(async () => {
    setError("");
    setInfo("");
    const chosen = linkedInAvailable.filter(
      (item) => selected[normalizeKey(item.company, item.role)]
    );
    if (chosen.length === 0) {
      setError("Selecione ao menos uma experiência para importar.");
      return;
    }
    setBusy(true);
    try {
      const next = mergeIntoProfile(profile, chosen);
      const id = profile?.id || profile?.profileId || profile?.uid;
      if (!id) throw new Error("Perfil sem identificador.");
      await saveUserProfile({
        id,
        pseudonimo: profile?.pseudonimo || "",
        status: profile?.status,
        resumeData: next.resumeData,
        linkedInCompaniesNormalized: next.linkedInCompaniesNormalized,
      });
      persistLocalProfile(next);
      onSaved?.(next);
      setInfo(`${chosen.length} experiência(s) importada(s) do LinkedIn.`);
      setTimeout(() => onClose?.(), 600);
    } catch (err) {
      setError(err?.message || "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }, [linkedInAvailable, selected, profile, onSaved, onClose]);

  const handleAddManual = useCallback(async () => {
    setError("");
    setInfo("");
    const company = manualCompany.trim();
    const role = manualRole.trim();
    if (!company || !role) {
      setError("Preencha empresa e cargo.");
      return;
    }
    setBusy(true);
    try {
      const newItem = {
        company,
        role,
        source: "manual",
        verified: false,
        addedAt: new Date().toISOString(),
      };
      const next = mergeIntoProfile(profile, [newItem]);
      const id = profile?.id || profile?.profileId || profile?.uid;
      if (!id) throw new Error("Perfil sem identificador.");
      await saveUserProfile({
        id,
        pseudonimo: profile?.pseudonimo || "",
        status: profile?.status,
        resumeData: next.resumeData,
        linkedInCompaniesNormalized: next.linkedInCompaniesNormalized,
      });
      persistLocalProfile(next);
      onSaved?.(next);
      setInfo("Experiência adicionada.");
      setManualCompany("");
      setManualRole("");
      setTimeout(() => onClose?.(), 600);
    } catch (err) {
      setError(err?.message || "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }, [manualCompany, manualRole, profile, onSaved, onClose]);

  // Quando o LoginLinkedInButton terminar com code, chamamos /api/linkedin-auth
  // e mergeamos as experiências obtidas — tudo dentro do próprio modal,
  // sem sair da página /minha-conta.
  const handleLinkedInLogin = useCallback(
    async ({ code, profile: profileFromCallback }) => {
      setError("");
      setInfo("");
      setLinkedInBusy(true);
      try {
        let payload = profileFromCallback || null;
        if (!payload && code) {
          const resp = await fetch(buildApiUrl("/api/linkedin-auth"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code,
              redirectUri: getLinkedInRedirectUri(),
            }),
          });
          const txt = await resp.text();
          try {
            payload = txt ? JSON.parse(txt) : {};
          } catch {
            payload = { error: txt || `Erro HTTP ${resp.status}` };
          }
          if (!resp.ok && !payload?.error) {
            payload = { ...payload, error: `Erro HTTP ${resp.status}` };
          }
          if (payload?.error) throw new Error(payload.error);
        }

        const experiences = extractLinkedInExperiences(payload || {});
        if (experiences.length === 0) {
          setInfo(
            "LinkedIn conectado, porém não foi possível obter o histórico profissional. " +
              "A API pública do LinkedIn restringe o acesso ao histórico — você pode adicioná-lo manualmente."
          );
          return;
        }

        const already = new Set(
          (profile?.resumeData?.experiencesStructured || []).map((e) =>
            normalizeKey(e.company, e.role)
          )
        );
        const novos = experiences.filter(
          (e) => !already.has(normalizeKey(e.company, e.role))
        );

        if (novos.length === 0) {
          setInfo("Todas as experiências do LinkedIn já estavam importadas.");
          return;
        }

        const next = mergeIntoProfile(profile, novos);
        const id = profile?.id || profile?.profileId || profile?.uid;
        if (!id) throw new Error("Perfil sem identificador.");
        await saveUserProfile({
          id,
          pseudonimo: profile?.pseudonimo || "",
          status: profile?.status,
          resumeData: next.resumeData,
          linkedinExperiences: experiences,
          linkedInCompaniesNormalized: next.linkedInCompaniesNormalized,
        });
        persistLocalProfile({ ...next, linkedinExperiences: experiences });
        onSaved?.({ ...next, linkedinExperiences: experiences });
        setInfo(`${novos.length} experiência(s) importada(s) do LinkedIn.`);
        setTimeout(() => onClose?.(), 800);
      } catch (err) {
        setError(err?.message || "Falha ao importar do LinkedIn.");
      } finally {
        setLinkedInBusy(false);
      }
    },
    [profile, onSaved, onClose]
  );

  const handleLinkedInFailure = useCallback((err) => {
    setLinkedInBusy(false);
    setError(err?.message || "Falha ao conectar com LinkedIn.");
  }, []);

  // ---- Importar do CV (PDF/DOCX) via /api/parse-cv ----
  const handleCvFile = useCallback(async (event) => {
    const file = event?.target?.files?.[0];
    if (event?.target) event.target.value = "";
    if (!file) return;
    setError("");
    setInfo("");
    setCvParsed([]);

    const okMime =
      file.type === "application/pdf" ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      /\.(pdf|docx)$/i.test(file.name);
    if (!okMime) {
      setError("Envie um arquivo PDF ou DOCX.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Arquivo maior que 4MB.");
      return;
    }

    setCvBusy(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => {
          const result = String(reader.result || "");
          // dataURL: "data:<mime>;base64,XXXX"
          const i = result.indexOf(",");
          resolve(i >= 0 ? result.slice(i + 1) : result);
        };
        reader.readAsDataURL(file);
      });

      const resp = await fetch(buildApiUrl("/api/parse-cv"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          base64,
        }),
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(payload?.error || `Erro HTTP ${resp.status}`);
      }
      const list = Array.isArray(payload?.experiencias)
        ? payload.experiencias
        : [];
      if (!list.length) {
        setError(
          "A IA não encontrou experiências no documento. Tente outro arquivo."
        );
        return;
      }
      setCvParsed(list.map((e) => ({ ...e, _selected: true })));
      setInfo(`${list.length} experiência(s) extraída(s). Revise antes de salvar.`);
    } catch (err) {
      setError(err?.message || "Falha ao processar o currículo.");
    } finally {
      setCvBusy(false);
    }
  }, []);

  const handleSaveParsedCv = useCallback(async () => {
    setError("");
    setInfo("");
    const chosen = cvParsed.filter((e) => e._selected);
    if (!chosen.length) {
      setError("Selecione ao menos uma experiência para salvar.");
      return;
    }
    setBusy(true);
    try {
      const items = chosen.map((e) => ({
        company: e.empresa,
        role: e.funcao,
        startDate: e.data_inicio || "",
        endDate: e.data_fim || "",
        source: "cv",
        verified: false,
        addedAt: new Date().toISOString(),
      }));
      const next = mergeIntoProfile(profile, items);
      const id = profile?.id || profile?.profileId || profile?.uid;
      if (!id) throw new Error("Perfil sem identificador.");
      await saveUserProfile({
        id,
        pseudonimo: profile?.pseudonimo || "",
        status: profile?.status,
        resumeData: next.resumeData,
        linkedInCompaniesNormalized: next.linkedInCompaniesNormalized,
      });
      persistLocalProfile(next);
      onSaved?.(next);
      setInfo(`${items.length} experiência(s) salva(s).`);
      setCvParsed([]);
      setTimeout(() => onClose?.(), 700);
    } catch (err) {
      setError(err?.message || "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }, [cvParsed, profile, onSaved, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="experience-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy && !linkedInBusy) onClose?.();
      }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2
            id="experience-modal-title"
            className="text-lg font-bold text-blue-800 dark:text-blue-200"
          >
            Adicionar Experiência
          </h2>
          <button
            type="button"
            onClick={() => !busy && !linkedInBusy && onClose?.()}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-2xl leading-none"
            aria-label="Fechar"
            disabled={busy || linkedInBusy}
          >
            ×
          </button>
        </div>

        {/* Abas */}
        <div className="flex gap-2 px-5 sm:px-6 pt-4">
          <button
            type="button"
            onClick={() => setTab("linkedin")}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition ${
              tab === "linkedin"
                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700"
                : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            Importar do LinkedIn
          </button>
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition ${
              tab === "manual"
                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700"
                : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            Adicionar Manualmente
          </button>
          <button
            type="button"
            onClick={() => setTab("cv")}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition ${
              tab === "cv"
                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700"
                : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            ✨ Importar do Currículo
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-4">
          {tab === "linkedin" && (
            <div className="space-y-4">
              {linkedInAvailable.length > 0 ? (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Selecione as experiências do seu perfil LinkedIn que deseja
                    importar:
                  </p>
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {linkedInAvailable.map((item) => {
                      const key = normalizeKey(item.company, item.role);
                      return (
                        <li
                          key={key}
                          className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                        >
                          <input
                            type="checkbox"
                            id={`exp-${key}`}
                            className="mt-1 h-4 w-4 accent-blue-600"
                            checked={!!selected[key]}
                            onChange={(e) =>
                              setSelected((prev) => ({
                                ...prev,
                                [key]: e.target.checked,
                              }))
                            }
                          />
                          <label
                            htmlFor={`exp-${key}`}
                            className="flex-1 min-w-0 cursor-pointer"
                          >
                            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
                              {item.company || "—"}
                            </p>
                            {item.role && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {item.role}
                              </p>
                            )}
                          </label>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700">
                            LinkedIn
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    onClick={handleImportLinkedIn}
                    disabled={busy}
                    className="w-full px-4 py-2 rounded-xl bg-[#0077B5] text-white font-semibold hover:bg-[#005582] transition disabled:opacity-60"
                  >
                    {busy ? "Importando..." : "Importar selecionadas"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Conecte sua conta do LinkedIn para puxar automaticamente sua
                    lista de experiências profissionais.
                  </p>
                  <LoginLinkedInButton
                    onLoginSuccess={handleLinkedInLogin}
                    onLoginFailure={handleLinkedInFailure}
                    disabled={linkedInBusy}
                  />
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Observação: o LinkedIn restringe o acesso ao histórico de
                    cargos. Quando indisponível, você ainda pode adicionar suas
                    experiências manualmente na aba ao lado.
                  </p>
                </>
              )}
            </div>
          )}

          {tab === "manual" && (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="manual-company"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1"
                >
                  Empresa
                </label>
                <input
                  id="manual-company"
                  type="text"
                  value={manualCompany}
                  onChange={(e) => setManualCompany(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex.: Trabalhei Lá Ltda."
                  autoComplete="organization"
                />
              </div>
              <div>
                <label
                  htmlFor="manual-role"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1"
                >
                  Cargo/Função
                </label>
                <input
                  id="manual-role"
                  type="text"
                  value={manualRole}
                  onChange={(e) => setManualRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex.: Engenheira de Software"
                  autoComplete="organization-title"
                />
              </div>
              <button
                type="button"
                onClick={handleAddManual}
                disabled={busy}
                className="w-full px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60"
              >
                {busy ? "Salvando..." : "Salvar Experiência"}
              </button>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Experiências adicionadas manualmente são marcadas como{" "}
                <strong>Não Verificada</strong>.
              </p>
            </div>
          )}

          {tab === "cv" && (
            <div className="space-y-3">
              <input
                ref={cvInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleCvFile}
                className="hidden"
              />
              {cvBusy ? (
                <div className="rounded-2xl border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20 px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 animate-pulse">
                    A Inteligência Artificial está lendo seu currículo…
                  </p>
                </div>
              ) : cvParsed.length === 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => cvInputRef.current?.click()}
                    className="w-full rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-900/10 px-4 py-6 text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                  >
                    <p className="text-base font-bold text-blue-700 dark:text-blue-200">
                      ✨ Importar do Currículo (PDF ou DOCX)
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Selecione um arquivo até 4MB. A IA extrai automaticamente seu histórico profissional para você revisar.
                    </p>
                  </button>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    O conteúdo do currículo é enviado apenas para extração das experiências; nada é publicado sem sua aprovação.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Revise as experiências extraídas pela IA antes de salvar:
                  </p>
                  <ul className="space-y-2 max-h-64 overflow-y-auto">
                    {cvParsed.map((item, i) => (
                      <li
                        key={`${item.empresa}-${item.funcao}-${i}`}
                        className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-blue-600"
                          checked={!!item._selected}
                          onChange={(e) =>
                            setCvParsed((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, _selected: e.target.checked } : x
                              )
                            )
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
                            {item.empresa}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {item.funcao}
                            {(item.data_inicio || item.data_fim) && (
                              <span className="ml-1 text-slate-400">
                                · {item.data_inicio || "?"} — {item.data_fim || "?"}
                              </span>
                            )}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700">
                          IA
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCvParsed([]);
                        setInfo("");
                      }}
                      disabled={busy}
                      className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveParsedCv}
                      disabled={busy}
                      className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
                    >
                      {busy ? "Salvando…" : "Salvar selecionadas"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
              {info}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
