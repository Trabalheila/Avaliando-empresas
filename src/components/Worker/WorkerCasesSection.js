// src/components/Worker/WorkerCasesSection.js
//
// Seção "Meus Casos" (somente leitura) para a página do trabalhador. Exibe os
// casos vinculados ao UID do trabalhador com status, dados do processo,
// histórico, checklist (com barra de progresso), documentos visíveis e status
// do repasse. As notas privadas do advogado NUNCA aparecem aqui.

import React, { useEffect, useState } from "react";
import {
  listWorkerCases,
  listWorkerCaseHistory,
  listWorkerVisibleDocuments,
  listWorkerCaseDeadlines,
} from "../../services/workerCaseView";

function formatDateTime(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
    if (!d || Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}

function formatBRL(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const cls =
    s === "pago"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {status || "pendente"}
    </span>
  );
}

/** Card somente leitura de um caso do trabalhador. */
function WorkerCaseCard({ caseItem }) {
  const { specialistId, caseId } = caseItem;
  const details = caseItem.processDetails || {};
  const checklist = Array.isArray(caseItem.checklist) ? caseItem.checklist : [];
  const [history, setHistory] = useState([]);
  const [docs, setDocs] = useState([]);
  const [deadlines, setDeadlines] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [h, d, dl] = await Promise.all([
        listWorkerCaseHistory(specialistId, caseId),
        listWorkerVisibleDocuments(specialistId, caseId),
        listWorkerCaseDeadlines(specialistId, caseId),
      ]);
      if (cancelled) return;
      setHistory(h);
      setDocs(d);
      setDeadlines(dl);
    })();
    return () => {
      cancelled = true;
    };
  }, [specialistId, caseId]);

  const doneCount = checklist.filter((i) => i.done).length;
  const pct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : 0;

  // Parcelas do repasse (registradas no histórico como kind repasse_parcela).
  const parcelas = history.filter((h) => h.kind === "repasse_parcela");

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
          {caseItem.nomeDoCaso || caseItem.caseType || "Meu processo"}
        </h3>
        <StatusBadge status={details.status || caseItem.status} />
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[11px] uppercase font-semibold text-slate-400">Número do processo</div>
          <div className="text-slate-700 dark:text-slate-200">{details.processNumber || "—"}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase font-semibold text-slate-400">Instância / Vara</div>
          <div className="text-slate-700 dark:text-slate-200">{details.court || "—"}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-[11px] uppercase font-semibold text-slate-400">Próxima ação / Prazo</div>
          <div className="text-slate-700 dark:text-slate-200">
            {details.nextActionText || "—"}
            {details.nextActionDate ? ` · ${new Date(details.nextActionDate).toLocaleDateString("pt-BR")}` : ""}
          </div>
        </div>
      </div>

      {/* Checklist somente leitura */}
      {checklist.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Checklist do processo</span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{pct}%</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {checklist.map((it) => (
              <li key={it.id} className="flex items-center gap-2">
                <span aria-hidden="true">{it.done ? "✅" : "⬜"}</span>
                <span className={it.done ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"}>
                  {it.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Documentos visíveis */}
      {docs.length > 0 && (
        <div className="mt-4">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Documentos disponíveis</span>
          <ul className="mt-1 space-y-1 text-sm">
            {docs.map((d) => (
              <li key={d.id}>
                <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-700 dark:text-blue-300 hover:underline">
                  📄 {d.name}
                </a>
                {d.description ? <span className="text-slate-400 text-xs"> — {d.description}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prazos */}
      {deadlines.length > 0 && (
        <div className="mt-4">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Prazos</span>
          <ul className="mt-1 space-y-1 text-sm">
            {deadlines.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span className={d.status === "concluido" ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"}>
                  {d.description}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {d.dueDate ? new Date(d.dueDate).toLocaleDateString("pt-BR") : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Status do repasse */}
      {(caseItem.repasseStatus || caseItem.repasseAmount) && (
        <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Repasse</span>
            <StatusBadge status={caseItem.repasseStatus} />
          </div>
          <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            {formatBRL(caseItem.repasseAmount)}
            {caseItem.repasseInstallments > 1 ? ` — parcelado em ${caseItem.repasseInstallments}x` : " — à vista"}
          </div>
          {parcelas.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {parcelas.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span>Parcela {p.parcela} de {p.totalParcelas}</span>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Histórico de atualizações */}
      {history.filter((h) => h.kind !== "repasse_parcela").length > 0 && (
        <div className="mt-4">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Histórico de atualizações</span>
          <ol className="mt-1 space-y-1.5">
            {history
              .filter((h) => h.kind !== "repasse_parcela")
              .map((h) => (
                <li key={h.id} className="flex gap-2 text-sm">
                  <span className="shrink-0 text-[11px] font-semibold text-blue-700 dark:text-blue-300 w-28">
                    {formatDateTime(h.createdAt)}
                  </span>
                  <span className="text-slate-700 dark:text-slate-200">{h.text}</span>
                </li>
              ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function WorkerCasesSection({ workerUid }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!workerUid) {
        setLoading(false);
        return;
      }
      try {
        const list = await listWorkerCases(workerUid);
        if (!cancelled) setCases(list);
      } catch {
        if (!cancelled) setCases([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workerUid]);

  if (loading) return null;
  if (!cases.length) return null;

  return (
    <section className="mt-6">
      <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <span aria-hidden="true">⚖️</span> Meus Casos
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Acompanhe o andamento dos seus processos. As informações são atualizadas
        pelo especialista responsável.
      </p>
      <div className="mt-4 space-y-4">
        {cases.map((c) => (
          <WorkerCaseCard key={`${c.specialistId}_${c.caseId}`} caseItem={c} />
        ))}
      </div>
    </section>
  );
}
