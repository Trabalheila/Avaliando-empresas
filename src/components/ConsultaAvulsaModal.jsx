// src/components/ConsultaAvulsaModal.jsx
//
// Modal de "Consulta Avulsa" — exclusivo para trabalhadores Gratuitos.
// Permite escolher uma especialidade, ver profissionais disponíveis
// e enviar uma solicitação pontual (status "pending") ao especialista.
//
// A solicitação é registrada na coleção `consultas`, que já é consumida
// por ApoiadorRequisicoes e pelo NotificationsBell do especialista.

import React, { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { filterOutTestApoiadores } from "../utils/testAccounts";
import { buildApiUrl } from "../utils/apiBase";

/* Mesmas opções usadas em FindSpecialistPage para manter consistência. */
const SPECIALTY_OPTIONS = [
  { value: "", label: "Selecione uma especialidade" },
  { value: "advogado", label: "Direito Trabalhista (Advogado/a)" },
  { value: "psicologo", label: "Saúde Mental (Psicólogo/a)" },
  { value: "consultor_rh", label: "Carreira / RH (Consultor/a)" },
  { value: "recrutador", label: "Recrutamento" },
  { value: "medico", label: "Medicina do Trabalho" },
  { value: "contador", label: "Contabilidade" },
  { value: "engenheiro_seguranca", label: "Engenharia de Segurança" },
  { value: "fisioterapeuta_ocupacional", label: "Fisioterapia Ocupacional" },
  { value: "outro", label: "Outros" },
];

function normalizeTipo(v) {
  return String(v || "").toLowerCase().trim().replace(/-/g, "_");
}

export default function ConsultaAvulsaModal({ open, onClose, worker }) {
  const [specialty, setSpecialty] = useState("");
  const [loading, setLoading] = useState(false);
  const [specialists, setSpecialists] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  /* Reset ao abrir/fechar. */
  useEffect(() => {
    if (!open) {
      setSpecialty("");
      setSpecialists([]);
      setSelectedId("");
      setMessage("");
      setError("");
      setSuccess(false);
      setSubmitting(false);
    }
  }, [open]);

  /* Busca profissionais ativos quando a especialidade muda. */
  useEffect(() => {
    if (!specialty) {
      setSpecialists([]);
      setSelectedId("");
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        // Busca apoiadores ativos. Filtra `tipo` no cliente para tolerar
        // valores variantes ("psicologo", "Psicólogo", etc.).
        const snap = await getDocs(
          query(collection(db, "apoiadores"), where("status", "==", "ativo"))
        );
        const list = snap.docs
          .map((d) => {
            const data = d.data() || {};
            return {
              id: d.id,
              uid: data.uid || "",
              nome: data.nome || data.displayName || "Especialista",
              tipo: normalizeTipo(data.tipo || data.profissao),
              bio: data.bio || data.descricao || data.about || "",
              foto: data.foto || data.photoURL || data.avatar || "",
              isTest: data.isTest === true,
            };
          })
          .filter((s) => s.tipo === specialty);
        if (!cancelled) {
          setSpecialists(filterOutTestApoiadores(list));
          setSelectedId("");
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("Falha ao carregar especialistas:", err);
          setError("Não foi possível carregar profissionais agora.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [specialty]);

  const selected = useMemo(
    () => specialists.find((s) => s.id === selectedId) || null,
    [specialists, selectedId]
  );

  async function handleSubmit() {
    setError("");
    const workerId = auth.currentUser?.uid || worker?.uid || worker?.id || "";
    if (!workerId) {
      setError("Faça login para solicitar uma consulta.");
      return;
    }
    if (!selected) {
      setError("Selecione um profissional.");
      return;
    }
    if (!message.trim()) {
      setError("Descreva brevemente sua dúvida.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        // Identificadores principais (compatíveis com ApoiadorRequisicoes).
        workerId,
        workerNome: worker?.pseudonimo || worker?.nome || "Trabalhador",
        apoiadorId: selected.id,
        apoiadorUid: selected.uid || "",
        apoiadorNome: selected.nome,
        especialidade: selected.tipo,
        // Tipo da consulta — "avulsa" (sem follow-up nem acompanhamento).
        tipo: "avulsa",
        type: "avulsa",
        message: String(message).trim().slice(0, 2000),
        status: "pending",
        readByApoiador: false,
        createdAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "consultas"), payload);

      /* Best-effort: dispara o mesmo endpoint de notificação por e-mail
         usado pelos contactRequests. Ignora erro de rede. */
      try {
        await fetch(buildApiUrl("/api/send-contact-request"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: ref.id,
            kind: "consulta_avulsa",
            fromUid: workerId,
            fromCompanyName: payload.workerNome,
            toUid: selected.uid || selected.id,
            toPseudonym: selected.nome,
            message: payload.message,
            especialidade: selected.tipo,
          }),
        });
      } catch {
        /* silencioso — a solicitação já foi gravada no Firestore. */
      }

      setSuccess(true);
    } catch (err) {
      console.warn("ConsultaAvulsa:", err);
      setError(err?.message || "Não foi possível enviar a solicitação.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <>
            <h2 className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
              ✅ Solicitação enviada
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Sua solicitação de <strong>Consulta Avulsa</strong> foi enviada a{" "}
              {selected?.nome}. O profissional receberá uma notificação para
              <strong> aceitar ou recusar</strong> o pedido. Você será avisado
              quando houver resposta.
            </p>
            <div className="mt-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Para consulta com acompanhamento contínuo e escolha avançada
                de profissionais, assine o{" "}
                <strong>Plano Premium do Trabalhador</strong> (R$ 29,90/mês).
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                Fechar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] uppercase tracking-widest font-bold text-blue-700 dark:text-blue-300">
              Consulta Avulsa · Plano Gratuito
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-800 dark:text-slate-100">
              De quem você precisa de ajuda?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Para uma <strong>consulta com acompanhamento</strong> é
              necessário o <strong>plano Premium</strong>. No plano Gratuito,
              você pode solicitar uma <strong>consulta avulsa</strong>
              {" "}(interação pontual) com um profissional disponível.
            </p>

            <div className="mt-4">
              <label
                htmlFor="ca-specialty"
                className="text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                Especialidade
              </label>
              <select
                id="ca-specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
              >
                {SPECIALTY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {specialty && (
              <div className="mt-4">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                  Profissionais disponíveis
                </p>
                {loading ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-3 text-center">
                    Carregando...
                  </p>
                ) : specialists.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-3 text-center">
                    Nenhum profissional disponível nesta especialidade no
                    momento.
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {specialists.map((s) => (
                      <li key={s.id}>
                        <label
                          className={[
                            "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition",
                            selectedId === s.id
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                              : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800",
                          ].join(" ")}
                        >
                          <input
                            type="radio"
                            name="ca-specialist"
                            value={s.id}
                            checked={selectedId === s.id}
                            onChange={() => setSelectedId(s.id)}
                            className="mt-1"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
                              {s.nome}
                            </p>
                            {s.bio && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                {s.bio}
                              </p>
                            )}
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {selected && (
              <div className="mt-4">
                <label
                  htmlFor="ca-msg"
                  className="text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  Descreva sua dúvida (será enviada ao profissional)
                </label>
                <textarea
                  id="ca-msg"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                  placeholder="Ex.: Fui demitido sem justa causa e preciso entender meus direitos..."
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 text-right">
                  {message.length}/2000
                </p>
              </div>
            )}

            {error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !selected || !message.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold"
              >
                {submitting ? "Enviando..." : "Confirmar Solicitação"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
