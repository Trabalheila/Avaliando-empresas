import React, { useEffect, useState, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

/* ════════════════════════════════════════════════
   WorkerProfessionalContactSettings
   Seção "Ser Contatado por Profissionais Especializados"
   Premium-only. Persiste em `profiles/{profileId}`:
     - canBeContactedByProfessionals: boolean
     - contactPreferences: string[]
     - contactPreferencesOther: string (quando "Outros")
   ════════════════════════════════════════════════ */

const PROFESSIONAL_OPTIONS = [
  { value: "Advogado", label: "Advogado (Trabalhista)" },
  { value: "Psicólogo", label: "Psicólogo" },
  { value: "Médico", label: "Médico" },
  { value: "Outros", label: "Outros" },
];

export default function WorkerProfessionalContactSettings({
  profileId,
  isPremium,
  onUpgradeClick,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [allow, setAllow] = useState(false);
  const [selected, setSelected] = useState([]);
  const [otherText, setOtherText] = useState("");

  /* Carrega preferências existentes */
  useEffect(() => {
    if (!isPremium || !profileId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const ref = doc(db, "profiles", profileId);
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() || {};
          setAllow(Boolean(data.canBeContactedByProfessionals));
          setSelected(Array.isArray(data.contactPreferences) ? data.contactPreferences : []);
          setOtherText(typeof data.contactPreferencesOther === "string" ? data.contactPreferencesOther : "");
        }
      } catch (err) {
        console.warn("Falha ao carregar preferências de contato:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, isPremium]);

  const toggleOption = useCallback((value) => {
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }, []);

  const handleSave = useCallback(async () => {
    if (!profileId) {
      setErrorMsg("Não foi possível identificar o seu perfil.");
      return;
    }
    setErrorMsg("");
    setSaving(true);
    try {
      const payload = {
        canBeContactedByProfessionals: allow,
        contactPreferences: allow ? selected : [],
        contactPreferencesOther: allow && selected.includes("Outros") ? otherText.trim() : "",
        contactPreferencesUpdatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "profiles", profileId), payload, { merge: true });
      setSavedAt(Date.now());
    } catch (err) {
      console.error("Erro ao salvar preferências:", err);
      setErrorMsg("Não foi possível salvar suas preferências. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }, [profileId, allow, selected, otherText]);

  /* ─── Não Premium: convite ao upgrade ─── */
  if (!isPremium) {
    return (
      <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <div className="inline-flex items-center gap-1.5 bg-amber-500 text-white text-[11px] font-bold tracking-wider px-2.5 py-0.5 rounded-full">
              EXCLUSIVO PREMIUM
            </div>
            <h2 className="mt-2 text-lg font-bold text-slate-800 dark:text-slate-100">
              Ser Contatado por Profissionais Especializados
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Faça upgrade para o <strong>Plano Trabalhador Premium</strong> e permita que advogados,
              psicólogos e médicos parceiros do Trabalhei Lá entrem em contato de forma prioritária,
              com base em suas necessidades.
            </p>
          </div>
          {onUpgradeClick && (
            <button
              type="button"
              onClick={onUpgradeClick}
              className="h-10 px-4 rounded-lg font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors"
            >
              Fazer upgrade para Premium
            </button>
          )}
        </div>
      </section>
    );
  }

  /* ─── Premium ─── */
  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
      <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
        <span aria-hidden="true">🤝</span>
        Ser Contatado por Profissionais Especializados
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Ative esta opção para permitir que advogados, psicólogos e médicos parceiros do Trabalhei Lá
        entrem em contato com você, de forma prioritária e com base em suas necessidades, para
        oferecer suporte e soluções.
      </p>

      {/* Toggle principal */}
      <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">Permitir contato de profissionais</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Você pode desativar a qualquer momento.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={allow}
          onClick={() => setAllow((v) => !v)}
          disabled={loading}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
            allow ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
          } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              allow ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Seleção de profissionais (visível apenas se ativado) */}
      {allow && (
        <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Quero ser contatado por:
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PROFESSIONAL_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggleOption(opt.value)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-200">{opt.label}</span>
              </label>
            ))}
          </div>
          {selected.includes("Outros") && (
            <div className="mt-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Especifique outro tipo de profissional
              </label>
              <input
                type="text"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Ex.: Coach de carreira"
                maxLength={120}
                className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      )}

      {/* Aviso de privacidade */}
      <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 p-3">
        Ao ativar esta funcionalidade, você concorda que profissionais parceiros do Trabalhei Lá
        (Especialistas Premium) possam ter acesso a informações anonimizadas sobre suas necessidades
        (baseadas em suas avaliações e perfil) para entrar em contato. Sua identidade real nunca
        será revelada sem seu consentimento explícito.
      </p>

      {/* Mensagens de status */}
      {errorMsg && (
        <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">{errorMsg}</p>
      )}
      {savedAt && !errorMsg && (
        <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-300">
          ✅ Preferências salvas com sucesso.
        </p>
      )}

      {/* Botão Salvar */}
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading || (allow && selected.length === 0)}
          style={{ backgroundColor: saving || loading || (allow && selected.length === 0) ? undefined : "#1a237e" }}
          className={`h-10 px-5 rounded-lg font-bold text-white transition ${
            saving || loading || (allow && selected.length === 0)
              ? "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed"
              : "hover:brightness-110"
          }`}
        >
          {saving ? "Salvando..." : "Salvar Preferências"}
        </button>
      </div>
    </section>
  );
}
