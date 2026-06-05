import React, { useCallback, useEffect, useMemo, useState } from "react";
import { saveUserProfile, getUserProfileByCpf } from "../services/users";
import { resolveProfileId } from "../utils/profileIdentity";

/*
 * VerifyIdentitySection — coleta OPCIONAL de CPF para verificação de identidade.
 *
 * Esse fluxo foi propositalmente removido da criação de pseudônimo (lazy
 * registration) para reduzir abandono. O usuário só fornece o CPF se quiser
 * desbloquear recursos que exigem maior autenticidade (tornar-se especialista,
 * acessar relatórios sensíveis etc.).
 *
 * Boas práticas aplicadas:
 *   - Coleta é opt-in com consentimento explícito (checkbox).
 *   - CPF é validado localmente (dígitos verificadores) antes do envio.
 *   - Verifica unicidade (impede colar CPF de outra conta).
 *   - Persiste apenas no doc /users/{id}, nunca em campos públicos.
 */

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

export default function VerifyIdentitySection({ profile, onUpdated }) {
  const initialCpf = (profile?.cpf || "").toString();
  const [expanded, setExpanded] = useState(Boolean(initialCpf));
  const [cpf, setCpf] = useState(maskCpf(initialCpf));
  const [consent, setConsent] = useState(Boolean(initialCpf));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setCpf(maskCpf((profile?.cpf || "").toString()));
  }, [profile?.cpf]);

  const alreadyVerified = useMemo(() => {
    const digits = (profile?.cpf || "").toString().replace(/\D/g, "");
    return digits.length === 11 && isValidCpfDigits(digits);
  }, [profile?.cpf]);

  const handleSave = useCallback(async () => {
    setError("");
    setSuccess("");
    const digits = cpf.replace(/\D/g, "");

    if (!digits) {
      setError("Informe um CPF ou clique em cancelar.");
      return;
    }
    if (digits.length !== 11) {
      setError("CPF deve conter 11 dígitos.");
      return;
    }
    if (!isValidCpfDigits(digits)) {
      setError("CPF inválido.");
      return;
    }
    if (!consent) {
      setError("Você precisa autorizar o uso do CPF para verificação de identidade.");
      return;
    }

    const accountId =
      profile?.profileId ||
      profile?.id ||
      resolveProfileId(profile || {}, { persistGeneratedId: false });
    if (!accountId) {
      setError("Não foi possível identificar sua conta. Recarregue a página e tente novamente.");
      return;
    }

    setSaving(true);
    try {
      // Garante que o CPF não está vinculado a OUTRA conta.
      try {
        const owner = await getUserProfileByCpf(digits);
        const ownerId = (owner?.id || "").toString().trim();
        if (owner && ownerId && ownerId !== accountId.toString().trim()) {
          setError("Este CPF já está cadastrado em outra conta.");
          setSaving(false);
          return;
        }
      } catch (lookupErr) {
        console.warn("[verifyIdentity] Falha ao consultar unicidade de CPF:", lookupErr);
      }

      const nextProfile = {
        ...profile,
        id: accountId,
        cpf: digits,
        cpfConsentAt: new Date().toISOString(),
        identityVerification: {
          ...(profile?.identityVerification || {}),
          cpfSubmitted: true,
          cpfSubmittedAt: new Date().toISOString(),
          consent: true,
          purpose:
            "Verificação opcional de identidade para desbloquear recursos avançados (especialista, relatórios sensíveis).",
        },
      };

      await saveUserProfile(nextProfile);

      // Mantém o localStorage sincronizado com o novo perfil.
      try {
        const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
        localStorage.setItem(
          "userProfile",
          JSON.stringify({
            ...stored,
            cpf: digits,
            cpfConsentAt: nextProfile.cpfConsentAt,
            identityVerification: nextProfile.identityVerification,
          })
        );
        window.dispatchEvent(new Event("trabalheiLa_user_updated"));
      } catch {
        // ignora — best-effort
      }

      setSuccess("CPF salvo com sucesso. Sua identidade ficou registrada para futuras verificações.");
      if (typeof onUpdated === "function") onUpdated(nextProfile);
    } catch (saveErr) {
      console.warn("[verifyIdentity] Falha ao salvar CPF:", saveErr);
      setError("Não foi possível salvar o CPF agora. Tente novamente em alguns instantes.");
    } finally {
      setSaving(false);
    }
  }, [cpf, consent, profile, onUpdated]);

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
      <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Verificar identidade
        {alreadyVerified && (
          <span className="ml-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-full px-2 py-0.5">
            CPF cadastrado
          </span>
        )}
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        O CPF é <strong>opcional</strong> e usado apenas para verificação interna de
        identidade. Ele <strong>nunca</strong> aparece nas avaliações nem é exibido
        em nenhum local público da plataforma. Você pode adicioná-lo se quiser
        desbloquear recursos que exigem maior autenticidade — por exemplo,
        tornar-se um especialista ou acessar relatórios mais sensíveis.
      </p>

      {!expanded ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
          >
            {alreadyVerified ? "Atualizar CPF" : "Adicionar CPF para verificação"}
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <label htmlFor="verify-cpf" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            CPF
          </label>
          <input
            id="verify-cpf"
            value={cpf}
            onChange={(e) => {
              setError("");
              setSuccess("");
              setCpf(maskCpf(e.target.value));
            }}
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          />

          <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setError("");
                setConsent(e.target.checked);
              }}
              className="mt-0.5"
            />
            <span>
              Autorizo o uso do meu CPF <strong>exclusivamente</strong> para verificação
              interna de identidade. Entendi que o dado é armazenado de forma privada e
              que posso solicitar sua exclusão a qualquer momento em{" "}
              <em>Excluir meus dados</em>.
            </span>
          </label>

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{error}</p>
          )}
          {success && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">{success}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar CPF"}
            </button>
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setError("");
                setSuccess("");
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
