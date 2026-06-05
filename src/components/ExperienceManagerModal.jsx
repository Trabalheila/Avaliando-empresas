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

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { saveUserProfile } from "../services/users";
import { extractLinkedInExperiences } from "../services/socialAuth";
import LoginLinkedInButton from "../LoginLinkedInButton";
import { getLinkedInRedirectUri } from "../utils/linkedinAuth";
import { buildApiUrl } from "../utils/apiBase";

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

  return {
    ...profile,
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
