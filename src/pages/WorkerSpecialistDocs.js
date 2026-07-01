// src/pages/WorkerSpecialistDocs.js
//
// Página dedicada ao relacionamento entre um TRABALHADOR e um ESPECIALISTA
// contratado (fluxo Ad Exitum). Substitui a lista amontoada de "Meus
// Documentos para Especialistas": aqui o trabalhador vê o status do
// atendimento e envia documentos de forma organizada e otimizada para mobile.
//
// Rota: /trabalhador/especialista/:apoiadorId
//
// Recursos:
//   • Duas categorias: "Documentos do Cliente" (gerais) e "Documentos para o
//     Especialista" (específicos deste caso).
//   • Upload robusto: múltiplos arquivos, limite de 60 MB, barra de progresso
//     por arquivo (estilo Google Drive) e botão azul "Enviar" que só ativa
//     quando todos os arquivos chegam a 100%.
//   • Mensagem de confirmação após o envio + notificação ao especialista
//     (o commit publica uma mensagem no chat → sininho do especialista).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import AppHeader from "../components/AppHeader";
import { listAcceptedAdExitumForWorker } from "../services/contactRequests";
import { buildSpecialistConversationId } from "../utils/chatId";
import {
  listWorkerDocuments,
  stageWorkerDocument,
  commitWorkerDocuments,
  deleteWorkerDocument,
  MAX_FILE_SIZE_MB,
  WORKER_DOC_MAX_BYTES,
  DOC_CATEGORY_CLIENT,
  DOC_CATEGORY_PROCESS,
} from "../services/workerDocuments";

const ACCEPT_TYPES = "image/*,.pdf,audio/mpeg,video/mp4";

function readWorkerName() {
  let prof = {};
  try {
    prof = JSON.parse(localStorage.getItem("userProfile") || "{}");
  } catch {
    prof = {};
  }
  return (
    prof?.nomeReal ||
    prof?.fullName ||
    prof?.nomeCompleto ||
    prof?.pseudonimo ||
    prof?.nome ||
    auth.currentUser?.displayName ||
    "Trabalhador"
  );
}

export default function WorkerSpecialistDocs({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const { apoiadorId } = useParams();
  const uid = auth.currentUser?.uid || "";
  const myName = useMemo(() => readWorkerName(), []);

  const [loading, setLoading] = useState(true);
  const [spec, setSpec] = useState(null); // { name, specialtyId, receiverUid, conversationId }
  const [apoiadorInfo, setApoiadorInfo] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const [category, setCategory] = useState(DOC_CATEGORY_PROCESS);
  const [docs, setDocs] = useState([]); // documentos já enviados (todas categorias)
  const [staged, setStaged] = useState([]); // { id, name, percent, error, meta }
  const [uploadError, setUploadError] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingId, setDeletingId] = useState("");
  const fileInputRef = useRef(null);

  // Descobre o especialista (a partir dos pedidos Ad Exitum aceitos) e os
  // dados públicos do apoiador (nome, disponibilidade, plano).
  useEffect(() => {
    if (!uid || !apoiadorId) {
      setLoading(false);
      setNotFound(true);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const accepted = await listAcceptedAdExitumForWorker(uid).catch(() => []);
        const match = accepted.find(
          (r) =>
            String(r.toApoiadorId) === String(apoiadorId) ||
            String(r.toApoiadorUid) === String(apoiadorId)
        );
        if (!match) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const conversationId =
          match.conversationId ||
          buildSpecialistConversationId(uid, match.toApoiadorId);
        const specData = {
          name: match.toApoiadorName || "Especialista",
          specialtyId: match.specialtyId || "",
          receiverUid: match.toApoiadorUid || "",
          conversationId,
        };
        if (!cancelled) setSpec(specData);

        // Dados públicos do apoiador (best-effort).
        try {
          const snap = await getDoc(doc(db, "apoiadores", String(match.toApoiadorId)));
          if (!cancelled && snap.exists()) setApoiadorInfo(snap.data());
        } catch {
          /* silencioso */
        }

        // Documentos já enviados.
        const existing = await listWorkerDocuments(conversationId).catch(() => []);
        if (!cancelled) setDocs(Array.isArray(existing) ? existing : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, apoiadorId]);

  const reloadDocs = useCallback(async () => {
    if (!spec?.conversationId) return;
    const existing = await listWorkerDocuments(spec.conversationId).catch(() => []);
    setDocs(Array.isArray(existing) ? existing : []);
  }, [spec]);

  const patchStaged = useCallback((id, patch) => {
    setStaged((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  // Seleção de arquivos → inicia o upload (fase 1) com barra de progresso.
  const handleFiles = async (event) => {
    const files = Array.from(event?.target?.files || []);
    if (event?.target) event.target.value = "";
    if (files.length === 0 || !spec?.conversationId) return;
    setUploadError("");
    setConfirmMsg("");

    const queued = files.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: file.name,
      percent: 0,
      error: "",
      meta: null,
      file,
    }));
    setStaged((prev) => [
      ...prev,
      ...queued.map(({ file, ...rest }) => rest),
    ]);

    for (const item of queued) {
      const { file, id } = item;
      if (file.size > WORKER_DOC_MAX_BYTES) {
        patchStaged(id, { error: `Excede o limite de ${MAX_FILE_SIZE_MB} MB.` });
        continue;
      }
      try {
        const meta = await stageWorkerDocument({
          conversationId: spec.conversationId,
          file,
          senderUid: uid,
          senderName: myName,
          peerName: spec.name,
          onProgress: (percent) => patchStaged(id, { percent }),
        });
        patchStaged(id, { percent: 100, meta });
      } catch (err) {
        patchStaged(id, {
          error:
            err?.code === "FILE_TOO_LARGE"
              ? `Excede o limite de ${MAX_FILE_SIZE_MB} MB.`
              : "Falha no envio. Tente novamente.",
        });
      }
    }
  };

  const removeStaged = (id) => {
    setStaged((prev) => prev.filter((s) => s.id !== id));
  };

  // Itens prontos (100% e sem erro) e se o botão "Enviar" pode ativar.
  const readyStaged = staged.filter((s) => !s.error && s.meta && s.percent >= 100);
  const anyUploading = staged.some((s) => !s.error && s.percent < 100);
  const canSend =
    !sending && staged.length > 0 && !anyUploading && readyStaged.length > 0;

  // Botão "Enviar": grava metadados (fase 2) e notifica o especialista.
  const handleSend = async () => {
    if (!canSend || !spec?.conversationId) return;
    setSending(true);
    setUploadError("");
    try {
      await commitWorkerDocuments({
        conversationId: spec.conversationId,
        docs: readyStaged.map((s) => s.meta),
        senderUid: uid,
        senderName: myName,
        receiverUid: spec.receiverUid,
        category,
      });
      setStaged([]);
      await reloadDocs();
      setConfirmMsg(
        `Documentos enviados com sucesso! ${spec.name} foi notificado(a).`
      );
    } catch (err) {
      console.warn("Falha ao enviar documentos:", err);
      setUploadError("Não foi possível concluir o envio. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.docId);
    try {
      await deleteWorkerDocument({
        conversationId: spec.conversationId,
        docId: confirmDelete.docId,
        storagePath: confirmDelete.storagePath,
      });
      setDocs((prev) => prev.filter((d) => d.id !== confirmDelete.docId));
      setConfirmDelete(null);
    } catch (err) {
      console.warn("Falha ao apagar documento:", err);
      setConfirmDelete((prev) =>
        prev ? { ...prev, error: "Não foi possível apagar. Tente novamente." } : prev
      );
    } finally {
      setDeletingId("");
    }
  };

  // Documentos filtrados pela categoria selecionada (docs antigos sem
  // `category` contam como "processo" para compatibilidade).
  const visibleDocs = docs.filter(
    (d) => String(d.category || DOC_CATEGORY_PROCESS) === category
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Meus documentos" />

      <main className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
        >
          ← Voltar
        </button>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">
            Carregando…
          </p>
        ) : notFound || !spec ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5">
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Não encontramos um atendimento ativo com este especialista. Ele
              precisa aceitar o seu pedido Ad Exitum no chat antes de você poder
              enviar documentos.
            </p>
            <button
              type="button"
              onClick={() => navigate("/minha-conta")}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"
            >
              Voltar para Minha Conta
            </button>
          </div>
        ) : (
          <>
            {/* Cabeçalho: informações do tratamento com o profissional */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide font-bold text-blue-700 dark:text-blue-300">
                    Atendimento com especialista
                  </p>
                  <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100 break-words">
                    {spec.name}
                  </h1>
                  {spec.specialtyId && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      ⚖️ {spec.specialtyId}
                    </p>
                  )}
                </div>
                <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200">
                  ● Contato ativo
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">
                    Modelo
                  </p>
                  <p className="text-slate-800 dark:text-slate-100">
                    Ad Exitum — honorários só em caso de êxito
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">
                    Disponibilidade
                  </p>
                  <p className="text-slate-800 dark:text-slate-100">
                    {apoiadorInfo?.disponibilidade || "Informada no chat do caso"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/chat/${encodeURIComponent(
                      spec.conversationId
                    )}?peer=${encodeURIComponent(
                      spec.name
                    )}&peerRole=especialista&adExitum=1`
                  )
                }
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30"
              >
                💬 Abrir chat do caso
              </button>
            </section>

            {/* Seletor de categoria */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCategory(DOC_CATEGORY_CLIENT)}
                className={[
                  "px-3 py-2.5 rounded-xl text-sm font-bold border transition min-h-[44px]",
                  category === DOC_CATEGORY_CLIENT
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700",
                ].join(" ")}
              >
                🪪 Documentos do Cliente
              </button>
              <button
                type="button"
                onClick={() => setCategory(DOC_CATEGORY_PROCESS)}
                className={[
                  "px-3 py-2.5 rounded-xl text-sm font-bold border transition min-h-[44px]",
                  category === DOC_CATEGORY_PROCESS
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700",
                ].join(" ")}
              >
                📁 Documentos para o Especialista
              </button>
            </div>

            {/* Área de upload */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Enviar{" "}
                {category === DOC_CATEGORY_CLIENT
                  ? "documentos do cliente"
                  : "documentos para o especialista"}
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Vários arquivos permitidos · até {MAX_FILE_SIZE_MB} MB cada.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT_TYPES}
                className="hidden"
                onChange={handleFiles}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 min-h-[44px]"
              >
                📎 Selecionar arquivos
              </button>

              {uploadError && (
                <p className="mt-3 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  {uploadError}
                </p>
              )}

              {/* Barras de progresso (estilo Google Drive) */}
              {staged.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {staged.map((s) => (
                    <li key={s.id}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs text-slate-600 dark:text-slate-300 truncate min-w-0">
                          📎 {s.name}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={
                              "text-[11px] font-semibold " +
                              (s.error
                                ? "text-red-600 dark:text-red-400"
                                : s.percent >= 100
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-blue-600 dark:text-blue-300")
                            }
                          >
                            {s.error
                              ? "Erro"
                              : s.percent >= 100
                              ? "Pronto ✓"
                              : `${s.percent}%`}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeStaged(s.id)}
                            className="text-slate-400 hover:text-red-500 text-sm leading-none"
                            aria-label="Remover"
                            title="Remover"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={
                            "h-full rounded-full transition-all duration-200 " +
                            (s.error
                              ? "bg-red-500"
                              : s.percent >= 100
                              ? "bg-emerald-500"
                              : "bg-blue-600")
                          }
                          style={{ width: `${s.error ? 100 : s.percent}%` }}
                        />
                      </div>
                      {s.error && (
                        <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                          {s.error}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {/* Botão azul "Enviar" — só ativa quando tudo chega a 100% */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
              >
                {sending
                  ? "Enviando…"
                  : anyUploading
                  ? "Aguardando upload…"
                  : `Enviar${readyStaged.length ? ` (${readyStaged.length})` : ""}`}
              </button>

              {confirmMsg && (
                <p className="mt-3 text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                  ✅ {confirmMsg}
                </p>
              )}
            </section>

            {/* Documentos já enviados nesta categoria */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-5">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Enviados
              </h2>
              {visibleDocs.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Nenhum documento enviado nesta categoria ainda.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {visibleDocs.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-2"
                    >
                      <span className="text-sm text-slate-700 dark:text-slate-200 truncate min-w-0">
                        📎 {d.name}
                      </span>
                      <div className="flex items-center gap-3 shrink-0">
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={d.name}
                          className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline"
                        >
                          Visualizar
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDelete({
                              docId: d.id,
                              name: d.name,
                              storagePath: d.storagePath,
                            })
                          }
                          disabled={deletingId === d.id}
                          className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline disabled:opacity-60"
                        >
                          Apagar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => deletingId === "" && setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Apagar documento
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Tem certeza que deseja apagar este documento?
            </p>
            {confirmDelete.name && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 break-words">
                📎 {confirmDelete.name}
              </p>
            )}
            {confirmDelete.error && (
              <p className="mt-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {confirmDelete.error}
              </p>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deletingId !== ""}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId !== ""}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-60"
              >
                {deletingId !== "" ? "Apagando…" : "Apagar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
