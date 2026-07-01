// src/pages/TrabalhadorCasosEspecialista.jsx
//
// Fase 2/3: página do TRABALHADOR que lista todos os "casos" (atendimentos)
// que ele possui com um ESPECIALISTA específico. Acessada ao clicar num
// especialista em "Contatos Liberados".
//
// Rota: /trabalhador/especialista/:apoiadorId/casos
//
// Recursos:
//   • Lista os casos individuais, com diferenciação (nome da empresa avaliada,
//     nomeDoCaso ou "Caso N") e status.
//   • "Abrir atendimento" leva à página do caso específico
//     (/trabalhador/especialista/:apoiadorId?caso=:casoId).
//   • "Criar novo caso" cria um novo atendimento com o mesmo especialista
//     (Fase 3), gerando uma thread de chat isolada por caso.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import AppHeader from "../components/AppHeader";
import {
  listWorkerCasosEnriched,
  casoLabel,
  especialistaKey,
} from "../services/workerCasos";
import { createCaso, CASO_STATUS } from "../services/casos";
import { buildCaseConversationId } from "../utils/chatId";

export default function TrabalhadorCasosEspecialista({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const { apoiadorId } = useParams();
  const uid = auth.currentUser?.uid || "";

  const [loading, setLoading] = useState(true);
  const [casos, setCasos] = useState([]);
  const [especialista, setEspecialista] = useState({
    nomeDoEspecialista: "Especialista",
    specialtyId: "",
    especialistaUid: "",
  });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!uid || !apoiadorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const all = await listWorkerCasosEnriched(uid).catch(() => []);
      const mine = all.filter(
        (c) => especialistaKey(c) === String(apoiadorId)
      );
      setCasos(mine);

      // Metadados do especialista: dos casos existentes ou do doc apoiadores.
      if (mine[0]) {
        setEspecialista({
          nomeDoEspecialista: mine[0].nomeDoEspecialista || "Especialista",
          specialtyId: mine[0].specialtyId || "",
          especialistaUid: mine[0].especialistaUid || "",
        });
      } else {
        try {
          const snap = await getDoc(doc(db, "apoiadores", String(apoiadorId)));
          if (snap.exists()) {
            const d = snap.data() || {};
            setEspecialista({
              nomeDoEspecialista: d.nome || d.displayName || "Especialista",
              specialtyId: d.tipo || d.profissao || "",
              especialistaUid: String(d.uid || d.authUid || d.userId || ""),
            });
          }
        } catch {
          /* silencioso */
        }
      }
    } finally {
      setLoading(false);
    }
  }, [uid, apoiadorId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCaso = (casoId) => {
    const params = casoId ? `?caso=${encodeURIComponent(casoId)}` : "";
    navigate(
      `/trabalhador/especialista/${encodeURIComponent(apoiadorId)}${params}`
    );
  };

  const handleCreateCaso = useCallback(async () => {
    if (!uid || !apoiadorId) return;
    const nome = window.prompt(
      "Nome do novo caso (ex.: \"Processo contra Empresa X\"):",
      ""
    );
    if (nome === null) return; // cancelou
    setCreating(true);
    try {
      const casoId = `caso_${uid}_${apoiadorId}_${Date.now()}`.replace(
        /[^a-zA-Z0-9_-]/g,
        ""
      );
      const conversationId = buildCaseConversationId(uid, apoiadorId, casoId);
      await createCaso({
        id: casoId,
        trabalhadorId: uid,
        especialistaId: String(apoiadorId),
        especialistaUid: especialista.especialistaUid,
        nomeDoEspecialista: especialista.nomeDoEspecialista,
        specialtyId: especialista.specialtyId,
        nomeDoCaso: String(nome || "").trim() || "Novo atendimento",
        status: CASO_STATUS.ATIVO,
        origem: "trabalhador",
        conversationId,
      });
      await load();
      openCaso(casoId);
    } catch (err) {
      console.error(err);
      alert("Não foi possível criar o caso. Tente novamente.");
    } finally {
      setCreating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, apoiadorId, especialista, load]);

  const headerTitle = useMemo(
    () => especialista.nomeDoEspecialista || "Especialista",
    [especialista]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Meus Casos" />

      <div className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => navigate("/minha-conta")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-200 hover:underline"
          >
            <span aria-hidden="true">←</span> Voltar à Minha Conta
          </button>
        </div>

        <header className="bg-white dark:bg-slate-900 rounded-2xl shadow p-4 sm:p-5 border border-blue-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-50 break-words">
              {headerTitle}
            </h1>
            {especialista.specialtyId && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                ⚖️ {especialista.specialtyId}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleCreateCaso}
            disabled={creating}
            className="self-stretch sm:self-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 min-h-[44px]"
          >
            {creating ? "Criando…" : "＋ Criar novo caso"}
          </button>
        </header>

        {!uid ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-8 text-center">
            <p className="text-slate-600 dark:text-slate-300">
              Você precisa estar logado para ver seus casos.
            </p>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="mt-4 px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
            >
              Entrar
            </button>
          </div>
        ) : loading ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-12 animate-pulse">
            Carregando casos…
          </p>
        ) : casos.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-10 text-center">
            <p className="text-4xl mb-2" aria-hidden="true">
              📁
            </p>
            <p className="text-slate-600 dark:text-slate-300 font-semibold">
              Você ainda não tem casos com este especialista.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Crie um novo caso para começar um atendimento.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {casos.map((c, idx) => (
              <li
                key={c.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 break-words">
                    {casoLabel(c, idx)}
                  </p>
                  <p className="text-xs font-semibold mt-0.5 text-emerald-700 dark:text-emerald-300">
                    ●{" "}
                    {c.status === "finalizado"
                      ? "Finalizado"
                      : c.status === "pendente"
                      ? "Pendente"
                      : "Ativo"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openCaso(c.casoId || c.id)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition shrink-0"
                >
                  Abrir atendimento →
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
