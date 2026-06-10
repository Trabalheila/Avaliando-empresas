import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { isSupporter } from "../utils/rbac";

/**
 * ConflictDeclarationGate
 * --------------------------------------------------------------------------
 * Bloqueia o acesso de Apoiadores a páginas de avaliações de empresas
 * até que tenham aceitado a Declaração de Ausência de Conflito de Interesses.
 *
 * Comportamento:
 *  - Se o usuário NÃO é apoiador → renderiza children normalmente.
 *  - Se é apoiador e o documento dele em `apoiadores` já tem
 *    `hasAgreedConflictDeclaration === true` → renderiza children.
 *  - Caso contrário → renderiza children + overlay modal bloqueante.
 *
 * Props:
 *  - companyName?: string  Nome da empresa para personalizar o texto da
 *                          declaração. Quando omitido, usa frase genérica.
 *  - children: ReactNode
 */

function buildDeclarationText(companyName) {
  const target =
    (companyName || "").toString().trim() ||
    "qualquer empresa que eu venha a consultar na plataforma";
  return `Declaro, sob as penas da lei, que não possuo vínculo empregatício, societário ou de prestação de serviços (atual ou nos últimos 5 anos) com ${
    companyName ? `a empresa ${companyName}` : target
  } e que não represento seus interesses. Estou ciente de que a violação desta declaração resultará na suspensão imediata da minha conta e na remoção de qualquer conteúdo associado.`;
}

export default function ConflictDeclarationGate({ companyName, children = null }) {
  const navigate = useNavigate();
  const supporter = isSupporter();
  const [status, setStatus] = useState(supporter ? "loading" : "passthrough");
  // status: "loading" | "passthrough" | "agreed" | "needs_agreement" | "error"
  const [apoiadorRef, setApoiadorRef] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!supporter) {
      setStatus("passthrough");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
        const uid = auth.currentUser?.uid;
        if (!uid) {
          if (!cancelled) setStatus("needs_agreement");
          return;
        }
        const snap = await getDocs(
          query(collection(db, "apoiadores"), where("uid", "==", uid), limit(1))
        );
        if (cancelled) return;
        if (snap.empty) {
          // Apoiador marcado em localStorage mas sem doc no Firestore — não bloqueamos.
          setStatus("passthrough");
          return;
        }
        const docSnap = snap.docs[0];
        const data = docSnap.data() || {};
        setApoiadorRef(doc(db, "apoiadores", docSnap.id));
        if (data.hasAgreedConflictDeclaration === true) {
          setStatus("agreed");
        } else {
          setStatus("needs_agreement");
        }
      } catch (err) {
        console.error("Falha ao verificar declaração de conflito:", err);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supporter]);

  const handleConfirm = useCallback(async () => {
    if (!accepted || submitting) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      if (apoiadorRef) {
        await updateDoc(apoiadorRef, {
          hasAgreedConflictDeclaration: true,
          conflictDeclarationAgreedAt: serverTimestamp(),
        });
      }
      if (mountedRef.current) setStatus("agreed");
    } catch (err) {
      console.error("Falha ao salvar declaração de conflito:", err);
      if (mountedRef.current) {
        setErrorMsg(
          "Não foi possível registrar sua declaração agora. Tente novamente."
        );
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }, [accepted, submitting, apoiadorRef]);

  const handleCancel = useCallback(() => {
    navigate("/apoiadores");
  }, [navigate]);

  const blocked = status === "needs_agreement" || status === "loading";

  return (
    <>
      {children}
      {blocked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="conflict-declaration-title"
          className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-slate-900/70 backdrop-blur-sm p-0 sm:p-4"
        >
          <div className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-6 max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain">
            {status === "loading" ? (
              <p className="text-sm text-slate-600 dark:text-slate-300 text-center py-6">
                Verificando declaração de conformidade…
              </p>
            ) : (
              <>
                <h2
                  id="conflict-declaration-title"
                  className="text-lg font-extrabold text-slate-900 dark:text-white mb-2"
                >
                  Declaração de Ausência de Conflito de Interesses
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Antes de visualizar avaliações de empresas, você precisa
                  declarar formalmente que não possui vínculos com a empresa
                  consultada.
                </p>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 mb-4">
                  <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                    {buildDeclarationText(companyName)}
                  </p>
                </div>
                <label className="flex items-start gap-2 mb-4 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Li e concordo com a declaração acima.
                  </span>
                </label>

                {errorMsg && (
                  <p className="text-xs text-red-600 dark:text-red-400 mb-3">
                    {errorMsg}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition disabled:opacity-50"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!accepted || submitting}
                    className={`px-4 py-2 rounded-lg text-sm font-bold text-white transition ${
                      !accepted || submitting
                        ? "bg-blue-300 dark:bg-blue-900 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {submitting ? "Registrando…" : "Confirmar e Continuar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export { buildDeclarationText };
