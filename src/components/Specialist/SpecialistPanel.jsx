// src/components/Specialist/SpecialistPanel.jsx
//
// Painel completo do especialista (rota /apoiador/perfil). Implementa as
// funcionalidades antes marcadas como "Em breve":
//   • Minhas Mensagens  — conversas ativas com trabalhadores (sistema de chat).
//   • Meus Documentos   — upload de documentos por caso (Firebase Storage).
//   • Minhas Estatísticas Detalhadas — métricas do perfil (Firestore).
//   • Gerenciamento de Agenda — blocos de horário por dia da semana.
//   • Configurações de Notificações — toggles de e-mail / plataforma.
//
// Além disso, para o especialista PSICÓLOGO, exibe a seção
// "Clientes em busca de atendimento" (P4).
//
// Todas as seções são visíveis apenas para o especialista logado (a página
// /apoiador/perfil já é protegida por RequireAuth).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "../../firebase";
import { listConversationsForParticipant } from "../../services/chat";
import { buildApiUrl } from "../../utils/apiBase";
import {
  PROBLEM_CATEGORIES,
  detectProblemCategory,
  mentionsMentalHealth,
} from "../../data/occupationalDiseases";

const WEEK_DAYS = [
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

const NOTIFICATION_EVENTS = [
  { key: "novoContato", label: "Novo contato recebido" },
  { key: "novaMensagem", label: "Nova mensagem no chat" },
  { key: "novoAgendamento", label: "Novo agendamento" },
];

/* ── Wrapper de seção expansível ─────────────────────────────── */
function PanelSection({ titulo, desc, icon, children, onOpen }) {
  const [open, setOpen] = useState(false);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && onOpen) onOpen();
  };
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/50 p-3">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <span className="min-w-0">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <span aria-hidden="true">{icon}</span> {titulo}
          </span>
          <span className="block mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {desc}
          </span>
        </span>
        <span className="shrink-0 text-slate-400 dark:text-slate-500 text-xs">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

/* ── Minhas Mensagens ────────────────────────────────────────── */
function MinhasMensagens({ apoiadorId }) {
  const [loading, setLoading] = useState(true);
  const [convs, setConvs] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await listConversationsForParticipant(apoiadorId, 50);
      if (!cancelled) {
        setConvs(Array.isArray(list) ? list : []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apoiadorId]);

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Carregando conversas…</p>;
  }
  if (convs.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Você ainda não tem conversas com trabalhadores.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {convs.map((c) => {
        const peerNames = c.peerNames || {};
        const peerId = (c.participants || []).find((p) => p !== apoiadorId);
        const peerName = peerNames[peerId] || c.clientAlias || "Trabalhador";
        const last = c.lastMessage?.text || "Abrir conversa";
        return (
          <li key={c.id}>
            <Link
              to={`/chat/${encodeURIComponent(c.id)}?peer=${encodeURIComponent(
                peerName
              )}&peerRole=trabalhador`}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {peerName}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                  {last}
                </span>
              </span>
              <span className="shrink-0 text-blue-600 dark:text-blue-300 text-sm font-bold">
                💬
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Meus Documentos ─────────────────────────────────────────── */
function MeusDocumentos({ apoiadorId }) {
  const [caseId, setCaseId] = useState("");
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "apoiadores", String(apoiadorId), "documentos"),
          orderBy("createdAt", "desc"),
          limit(50)
        )
      );
      setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      // orderBy pode falhar em documentos antigos sem createdAt — tenta sem ordenar.
      try {
        const snap = await getDocs(
          collection(db, "apoiadores", String(apoiadorId), "documentos")
        );
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch {
        setError("Não foi possível carregar os documentos.");
      }
    } finally {
      setLoading(false);
    }
  }, [apoiadorId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setError("");
    if (!caseId.trim()) {
      setError("Informe o ID do caso antes de enviar o documento.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("O arquivo excede o limite de 20 MB.");
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-160);
      const path = `specialistDocs/${encodeURIComponent(
        apoiadorId
      )}/${encodeURIComponent(caseId.trim())}/${Date.now()}_${safeName}`;
      const fRef = storageRef(storage, path);
      await uploadBytes(fRef, file, { contentType: file.type || undefined });
      const url = await getDownloadURL(fRef);
      await addDoc(collection(db, "apoiadores", String(apoiadorId), "documentos"), {
        name: file.name,
        url,
        storagePath: path,
        caseId: caseId.trim(),
        size: file.size,
        contentType: file.type || "",
        createdAt: serverTimestamp(),
      });
      await loadDocs();
    } catch (err) {
      setError(err?.message || "Falha no upload do documento.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            ID do caso
          </label>
          <input
            type="text"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            placeholder="Ex.: case_spec_...__u_..."
            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,image/*"
            onChange={handleUpload}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold disabled:opacity-60"
          >
            {uploading ? "Enviando…" : "📎 Enviar documento"}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando documentos…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhum documento enviado ainda.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
            >
              <span className="min-w-0">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 dark:text-blue-300 font-semibold hover:underline truncate block"
                >
                  📄 {d.name}
                </a>
                {d.caseId && (
                  <span className="block text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    Caso: {d.caseId}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Minhas Estatísticas Detalhadas ──────────────────────────── */
function MinhasEstatisticas({ apoiadorId }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "apoiadores", String(apoiadorId)));
        const d = snap.exists() ? snap.data() : {};
        if (!cancelled) {
          setStats({
            visualizacoes: Number(d.profileViews || d.visualizacoes || d.views || 0),
            contatos: Number(d.contatosRecebidos || d.contactsReceived || 0),
            consultas: Number(d.consultasRealizadas || d.consultationsCount || 0),
            avaliacoes: Number(d.totalAvaliacoes || d.reviewsCount || 0),
            nota: Number(d.rating || d.mediaAvaliacoes || 0),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apoiadorId]);

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Carregando estatísticas…</p>;
  }
  const cards = [
    { label: "Visualizações do perfil", value: stats.visualizacoes, icon: "👁️" },
    { label: "Contatos recebidos", value: stats.contatos, icon: "✉️" },
    { label: "Consultas realizadas", value: stats.consultas, icon: "✅" },
    { label: "Avaliações recebidas", value: stats.avaliacoes, icon: "⭐" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center"
        >
          <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">
            <span aria-hidden="true" className="mr-1 text-base">{c.icon}</span>
            {c.value}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{c.label}</p>
        </div>
      ))}
      {stats.avaliacoes > 0 && (
        <div className="col-span-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-center">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
            Nota média: {stats.nota.toFixed(1)}/5
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Gerenciamento de Agenda ─────────────────────────────────── */
function GerenciamentoAgenda({ apoiadorId }) {
  const [agenda, setAgenda] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState({}); // { seg: {inicio, fim}, ... }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "apoiadores", String(apoiadorId)));
        const d = snap.exists() ? snap.data() : {};
        if (!cancelled) setAgenda(d.agendaSemanal || {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apoiadorId]);

  const persist = async (next) => {
    setSaving(true);
    setMessage("");
    try {
      await setDoc(
        doc(db, "apoiadores", String(apoiadorId)),
        { agendaSemanal: next, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setMessage("Disponibilidade salva.");
    } catch {
      setMessage("Falha ao salvar a disponibilidade.");
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (dayKey) => {
    const draft = drafts[dayKey] || {};
    if (!draft.inicio || !draft.fim) return;
    const next = {
      ...agenda,
      [dayKey]: [...(agenda[dayKey] || []), { inicio: draft.inicio, fim: draft.fim }],
    };
    setAgenda(next);
    setDrafts((p) => ({ ...p, [dayKey]: { inicio: "", fim: "" } }));
    persist(next);
  };

  const removeBlock = (dayKey, idx) => {
    const next = {
      ...agenda,
      [dayKey]: (agenda[dayKey] || []).filter((_, i) => i !== idx),
    };
    setAgenda(next);
    persist(next);
  };

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Carregando agenda…</p>;
  }
  return (
    <div className="space-y-2">
      {WEEK_DAYS.map((day) => {
        const blocks = agenda[day.key] || [];
        const draft = drafts[day.key] || { inicio: "", fim: "" };
        return (
          <div
            key={day.key}
            className="rounded-lg border border-slate-200 dark:border-slate-700 p-2"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {day.label}
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="time"
                  value={draft.inicio}
                  onChange={(e) =>
                    setDrafts((p) => ({
                      ...p,
                      [day.key]: { ...draft, inicio: e.target.value },
                    }))
                  }
                  className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs"
                />
                <span className="text-slate-400 text-xs">até</span>
                <input
                  type="time"
                  value={draft.fim}
                  onChange={(e) =>
                    setDrafts((p) => ({
                      ...p,
                      [day.key]: { ...draft, fim: e.target.value },
                    }))
                  }
                  className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs"
                />
                <button
                  type="button"
                  onClick={() => addBlock(day.key)}
                  className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  + Adicionar
                </button>
              </div>
            </div>
            {blocks.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {blocks.map((b, i) => (
                  <span
                    key={`${b.inicio}-${b.fim}-${i}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  >
                    {b.inicio}–{b.fim}
                    <button
                      type="button"
                      onClick={() => removeBlock(day.key, i)}
                      className="ml-0.5 text-emerald-700 dark:text-emerald-300 hover:text-red-600"
                      aria-label="Remover bloco"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {(saving || message) && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {saving ? "Salvando…" : message}
        </p>
      )}
    </div>
  );
}

/* ── Configurações de Notificações ───────────────────────────── */
function ConfiguracoesNotificacoes({ apoiadorId }) {
  const [prefs, setPrefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "apoiadores", String(apoiadorId)));
        const d = snap.exists() ? snap.data() : {};
        if (!cancelled) setPrefs(d.notificationPrefs || {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apoiadorId]);

  const toggle = async (eventKey, channel) => {
    const current = prefs[eventKey] || {};
    const next = {
      ...prefs,
      [eventKey]: { ...current, [channel]: !current[channel] },
    };
    setPrefs(next);
    setMessage("");
    try {
      await setDoc(
        doc(db, "apoiadores", String(apoiadorId)),
        { notificationPrefs: next, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setMessage("Preferências atualizadas.");
    } catch {
      setMessage("Falha ao salvar preferências.");
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Carregando preferências…</p>;
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500">
        <span>Evento</span>
        <span className="w-14 text-center">E-mail</span>
        <span className="w-16 text-center">Plataforma</span>
      </div>
      {NOTIFICATION_EVENTS.map((ev) => {
        const p = prefs[ev.key] || {};
        return (
          <div
            key={ev.key}
            className="grid grid-cols-[1fr_auto_auto] gap-2 items-center p-2 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <span className="text-sm text-slate-700 dark:text-slate-200">{ev.label}</span>
            <label className="w-14 flex justify-center">
              <input
                type="checkbox"
                checked={Boolean(p.email)}
                onChange={() => toggle(ev.key, "email")}
              />
            </label>
            <label className="w-16 flex justify-center">
              <input
                type="checkbox"
                checked={Boolean(p.plataforma)}
                onChange={() => toggle(ev.key, "plataforma")}
              />
            </label>
          </div>
        );
      })}
      {message && (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">{message}</p>
      )}
    </div>
  );
}

/* ── Clientes em busca de atendimento (P4 — psicólogo) ───────── */
function extractReviewText(review) {
  const parts = [];
  if (review.generalComment) parts.push(review.generalComment);
  Object.keys(review).forEach((k) => {
    if (k.startsWith("comment") && typeof review[k] === "string") {
      parts.push(review[k]);
    }
  });
  return parts.filter(Boolean).join(" ").trim();
}

function ClientesEmBusca({ apoiadorId, apoiadorNome }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("");
  const [sending, setSending] = useState("");
  const [feedback, setFeedback] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let snap;
        try {
          snap = await getDocs(
            query(collection(db, "reviews"), orderBy("createdAt", "desc"), limit(120))
          );
        } catch {
          snap = await getDocs(query(collection(db, "reviews"), limit(120)));
        }
        const rows = [];
        snap.docs.forEach((docSnap) => {
          const r = docSnap.data() || {};
          const score = Number(r.rating || 0);
          const text = extractReviewText(r);
          const qualifies = score > 0 && score < 3.0;
          const mental = mentionsMentalHealth(text);
          if (!qualifies && !mental) return;
          rows.push({
            id: docSnap.id,
            uid: r.uid || "",
            pseudonym: r.isAnonymousAuthor ? "Anônimo" : r.pseudonym || "Trabalhador",
            company: r.company || r.companySlug || "Empresa avaliada",
            score,
            summary: text ? text.slice(0, 240) : "Avaliação com baixa satisfação.",
            category: detectProblemCategory(text),
          });
        });
        if (!cancelled) setItems(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = filter
    ? items.filter((i) => i.category === filter)
    : items;

  const handleContact = async (item) => {
    if (!item.uid) {
      setFeedback((f) => ({ ...f, [item.id]: "Trabalhador anônimo — sem contato." }));
      return;
    }
    setSending(item.id);
    setFeedback((f) => ({ ...f, [item.id]: "" }));
    try {
      const resp = await fetch(buildApiUrl("/api/send-contact-request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "especialista-interesse",
          toUid: item.uid,
          toPseudonym: item.pseudonym,
          specialistName: apoiadorNome || "Um especialista",
          specialistId: apoiadorId,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      setFeedback((f) => ({
        ...f,
        [item.id]: data?.emailed
          ? "Convite enviado por e-mail."
          : "Pedido registrado (e-mail indisponível).",
      }));
    } catch {
      setFeedback((f) => ({ ...f, [item.id]: "Falha ao enviar o convite." }));
    } finally {
      setSending("");
    }
  };

  return (
    <div className="space-y-3">
      {/* Filtros por categoria */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter("")}
          className={[
            "px-2.5 py-1 rounded-full text-xs font-bold border transition",
            filter === ""
              ? "bg-blue-600 text-white border-blue-600"
              : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300",
          ].join(" ")}
        >
          Todos
        </button>
        {PROBLEM_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setFilter(cat.value)}
            className={[
              "px-2.5 py-1 rounded-full text-xs font-bold border transition",
              filter === cat.value
                ? "bg-blue-600 text-white border-blue-600"
                : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300",
            ].join(" ")}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Buscando trabalhadores…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhum trabalhador encontrado para este filtro.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => {
            const catLabel =
              PROBLEM_CATEGORIES.find((c) => c.value === item.category)?.label || "Outros";
            return (
              <li
                key={item.id}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {item.pseudonym}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {item.company}
                    {item.score > 0 ? ` · ${item.score.toFixed(1)}/5` : ""}
                  </span>
                </div>
                <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  {catLabel}
                </span>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-3">
                  {item.summary}
                </p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleContact(item)}
                    disabled={sending === item.id || !item.uid}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                  >
                    {sending === item.id ? "Enviando…" : "✉️ Entrar em contato"}
                  </button>
                  {feedback[item.id] && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {feedback[item.id]}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── Painel principal ────────────────────────────────────────── */
export default function SpecialistPanel({ apoiadorId, apoiadorNome, tipo }) {
  if (!apoiadorId) return null;
  const isPsicologo = String(tipo || "").toLowerCase().includes("psic");

  return (
    <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 p-4 space-y-3">
      <p className="text-sm font-extrabold text-purple-800 dark:text-purple-200">
        Painel completo do especialista
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <PanelSection
          titulo="Minhas Mensagens"
          desc="Converse com trabalhadores que solicitaram atendimento."
          icon="💬"
        >
          <MinhasMensagens apoiadorId={apoiadorId} />
        </PanelSection>

        <PanelSection
          titulo="Meus Documentos"
          desc="Envie e organize documentos dos seus casos."
          icon="📁"
        >
          <MeusDocumentos apoiadorId={apoiadorId} />
        </PanelSection>

        <PanelSection
          titulo="Minhas Estatísticas Detalhadas"
          desc="Acompanhe visualizações, conversões e avaliações."
          icon="📊"
        >
          <MinhasEstatisticas apoiadorId={apoiadorId} />
        </PanelSection>

        <PanelSection
          titulo="Gerenciamento de Agenda"
          desc="Defina horários e organize seus compromissos."
          icon="🗓️"
        >
          <GerenciamentoAgenda apoiadorId={apoiadorId} />
        </PanelSection>

        <PanelSection
          titulo="Configurações de Notificações"
          desc="Escolha como e quando deseja ser avisado."
          icon="🔔"
        >
          <ConfiguracoesNotificacoes apoiadorId={apoiadorId} />
        </PanelSection>
      </div>

      {isPsicologo && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/50 p-3">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <span aria-hidden="true">🧑‍⚕️</span> Clientes em busca de atendimento
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Trabalhadores com avaliações de baixa satisfação ou relatos de saúde
            mental no trabalho.
          </p>
          <div className="mt-3">
            <ClientesEmBusca apoiadorId={apoiadorId} apoiadorNome={apoiadorNome} />
          </div>
        </div>
      )}
    </div>
  );
}
