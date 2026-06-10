import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { isAdmin } from "../utils/rbac";
import AppHeader from "../components/AppHeader";
import AdminQuickAccess from "../components/AdminQuickAccess";

/* ──────────────────────────────────────────────
   Constantes
   ────────────────────────────────────────────── */
const STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "Pendente", label: "Pendentes" },
  { value: "Ativo", label: "Ativos" },
  { value: "Inativo", label: "Inativos" },
];

const STATUS_BADGE = {
  Ativo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  Pendente: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Inativo: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */
function formatDate(value) {
  if (!value) return "—";
  try {
    const d =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
        ? value
        : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

function whatsappLink(num) {
  if (!num) return null;
  const digits = String(num).replace(/\D+/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}`;
}

/* ════════════════════════════════════════════════
   AdminSupportersDashboard
   ════════════════════════════════════════════════ */
export default function AdminSupportersDashboard({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const admin = useMemo(() => isAdmin(), []);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [supporters, setSupporters] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");

  const [detailsOf, setDetailsOf] = useState(null);
  const [editingOf, setEditingOf] = useState(null);
  const [confirmDeleteOf, setConfirmDeleteOf] = useState(null);
  const [busyId, setBusyId] = useState(null);

  /* Proteção de rota: somente admin */
  useEffect(() => {
    if (!admin) navigate("/", { replace: true });
  }, [admin, navigate]);

  /* Carrega coleção `supporters` */
  const loadSupporters = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      let snap;
      try {
        snap = await getDocs(query(collection(db, "supporters"), orderBy("createdAt", "desc")));
      } catch {
        // Em casos onde createdAt não está indexado/presente, faz fallback simples.
        snap = await getDocs(collection(db, "supporters"));
      }
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setSupporters(list);
    } catch (err) {
      console.error("Falha ao carregar apoiadores:", err);
      setErrorMsg("Não foi possível carregar a lista de especialistas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) loadSupporters();
  }, [admin, loadSupporters]);

  /* Lista única de especialidades */
  const allSpecialties = useMemo(() => {
    const set = new Set();
    supporters.forEach((s) => {
      const arr = Array.isArray(s.specialties) ? s.specialties : [];
      arr.forEach((sp) => {
        const t = String(sp || "").trim();
        if (t) set.add(t);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [supporters]);

  /* Aplica filtros */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return supporters.filter((s) => {
      if (statusFilter !== "all" && (s.status || "Pendente") !== statusFilter) return false;
      if (specialtyFilter !== "all") {
        const arr = Array.isArray(s.specialties) ? s.specialties : [];
        if (!arr.map((x) => String(x).trim()).includes(specialtyFilter)) return false;
      }
      if (term) {
        const haystack = `${s.name || ""} ${s.email || ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [supporters, search, statusFilter, specialtyFilter]);

  /* Ações */
  async function toggleStatus(s) {
    const current = s.status || "Pendente";
    const next = current === "Ativo" ? "Inativo" : "Ativo";
    setBusyId(s.id);
    try {
      await updateDoc(doc(db, "supporters", s.id), { status: next });
      setSupporters((prev) => prev.map((x) => (x.id === s.id ? { ...x, status: next } : x)));
    } catch (err) {
      console.error("Falha ao atualizar status:", err);
      alert("Não foi possível atualizar o status do especialista.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveEdit(updated) {
    if (!editingOf) return;
    setBusyId(editingOf.id);
    try {
      const payload = {
        name: updated.name?.trim() || "",
        email: updated.email?.trim() || "",
        whatsapp: updated.whatsapp?.trim() || "",
        specialties: updated.specialtiesText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        status: updated.status || "Pendente",
      };
      await updateDoc(doc(db, "supporters", editingOf.id), payload);
      setSupporters((prev) => prev.map((x) => (x.id === editingOf.id ? { ...x, ...payload } : x)));
      setEditingOf(null);
    } catch (err) {
      console.error("Falha ao editar:", err);
      alert("Não foi possível salvar as alterações.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!confirmDeleteOf) return;
    setBusyId(confirmDeleteOf.id);
    try {
      await deleteDoc(doc(db, "supporters", confirmDeleteOf.id));
      setSupporters((prev) => prev.filter((x) => x.id !== confirmDeleteOf.id));
      setConfirmDeleteOf(null);
    } catch (err) {
      console.error("Falha ao excluir:", err);
      alert("Não foi possível excluir o especialista.");
    } finally {
      setBusyId(null);
    }
  }

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />
      <AdminQuickAccess />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Cabeçalho */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Dashboard de Apoiadores
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Gerencie cadastros, status e especialidades dos apoiadores parceiros.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/apoiadores/cadastro")}
            style={{ backgroundColor: "#1a237e" }}
            className="h-11 px-5 rounded-lg font-bold text-white hover:brightness-110"
          >
            + Adicionar Novo Apoiador
          </button>
        </header>

        {/* Filtros */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-slate-200 dark:border-slate-700 p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="h-11 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm"
              disabled={allSpecialties.length === 0}
            >
              <option value="all">Todas as especialidades</option>
              {allSpecialties.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {filtered.length} de {supporters.length} apoiador(es) exibidos
          </div>
        </section>

        {/* Tabela */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-slate-200 dark:border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Carregando...</div>
          ) : errorMsg ? (
            <div className="p-10 text-center text-sm text-rose-600 dark:text-rose-300">{errorMsg}</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Nenhum apoiador encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">E-mail</th>
                    <th className="px-4 py-3">Especialidades</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">WhatsApp</th>
                    <th className="px-4 py-3">Cadastro</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((s) => {
                    const status = s.status || "Pendente";
                    const wa = whatsappLink(s.whatsapp);
                    const specs = Array.isArray(s.specialties) ? s.specialties : [];
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">
                          {s.name || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 break-all">{s.email || "—"}</td>
                        <td className="px-4 py-3">
                          {specs.length === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {specs.slice(0, 3).map((sp, i) => (
                                <span
                                  key={`${s.id}-sp-${i}`}
                                  className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 text-xs"
                                >
                                  {sp}
                                </span>
                              ))}
                              {specs.length > 3 && (
                                <span className="text-xs text-slate-500">+{specs.length - 3}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                              STATUS_BADGE[status] || STATUS_BADGE.Pendente
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 dark:text-emerald-300 hover:underline"
                            >
                              {s.whatsapp}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(s.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setDetailsOf(s)}
                              className="px-2.5 py-1 text-xs font-bold rounded border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              Detalhes
                            </button>
                            <button
                              type="button"
                              disabled={busyId === s.id}
                              onClick={() => toggleStatus(s)}
                              className={`px-2.5 py-1 text-xs font-bold rounded text-white ${
                                status === "Ativo"
                                  ? "bg-amber-600 hover:bg-amber-700"
                                  : "bg-emerald-600 hover:bg-emerald-700"
                              } disabled:opacity-50`}
                            >
                              {status === "Ativo" ? "Desativar" : "Ativar"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingOf(s)}
                              className="px-2.5 py-1 text-xs font-bold rounded bg-blue-700 hover:bg-blue-800 text-white"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteOf(s)}
                              className="px-2.5 py-1 text-xs font-bold rounded bg-rose-600 hover:bg-rose-700 text-white"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Modal Detalhes */}
      {detailsOf && (
        <Modal title="Detalhes do especialista" onClose={() => setDetailsOf(null)}>
          <DetailRow label="Nome" value={detailsOf.name} />
          <DetailRow label="E-mail" value={detailsOf.email} />
          <DetailRow label="WhatsApp" value={detailsOf.whatsapp} />
          <DetailRow label="Status" value={detailsOf.status || "Pendente"} />
          <DetailRow
            label="Especialidades"
            value={(Array.isArray(detailsOf.specialties) ? detailsOf.specialties : []).join(", ") || "—"}
          />
          <DetailRow label="Cadastro" value={formatDate(detailsOf.createdAt)} />
          <DetailRow label="ID" value={detailsOf.id} />
          {detailsOf.bio && <DetailRow label="Bio" value={detailsOf.bio} />}
        </Modal>
      )}

      {/* Modal Edição */}
      {editingOf && (
        <EditModal
          supporter={editingOf}
          busy={busyId === editingOf.id}
          onClose={() => setEditingOf(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Modal Confirmar Exclusão */}
      {confirmDeleteOf && (
        <Modal title="Excluir especialista" onClose={() => setConfirmDeleteOf(null)}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Tem certeza que deseja excluir{" "}
            <strong>{confirmDeleteOf.name || confirmDeleteOf.email || confirmDeleteOf.id}</strong>? Esta ação não pode
            ser desfeita.
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmDeleteOf(null)}
              className="h-10 px-4 rounded-lg font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busyId === confirmDeleteOf.id}
              onClick={handleDelete}
              className="h-10 px-4 rounded-lg font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
            >
              {busyId === confirmDeleteOf.id ? "Excluindo..." : "Excluir definitivamente"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────
   Subcomponentes
   ────────────────────────────────────────────── */
function Modal({ title, onClose, children }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-h-[92dvh] sm:max-h-[90dvh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 grid grid-cols-3 gap-2">
      <div className="col-span-1 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
      <div className="col-span-2 text-sm text-slate-800 dark:text-slate-100 break-words">{value || "—"}</div>
    </div>
  );
}

function EditModal({ supporter, busy, onClose, onSave }) {
  const [form, setForm] = useState({
    name: supporter.name || "",
    email: supporter.email || "",
    whatsapp: supporter.whatsapp || "",
    status: supporter.status || "Pendente",
    specialtiesText: (Array.isArray(supporter.specialties) ? supporter.specialties : []).join(", "),
  });

  const setField = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <Modal title="Editar especialista" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nome">
          <input
            value={form.name}
            onChange={setField("name")}
            className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm"
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            value={form.email}
            onChange={setField("email")}
            className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm"
          />
        </Field>
        <Field label="WhatsApp">
          <input
            value={form.whatsapp}
            onChange={setField("whatsapp")}
            placeholder="+55 11 99999-9999"
            className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm"
          />
        </Field>
        <Field label="Especialidades (separadas por vírgula)">
          <input
            value={form.specialtiesText}
            onChange={setField("specialtiesText")}
            placeholder="RH, Cultura, Liderança"
            className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm"
          />
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            onChange={setField("status")}
            className="h-10 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm"
          >
            <option value="Pendente">Pendente</option>
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </select>
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-4 rounded-lg font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(form)}
          style={{ backgroundColor: busy ? undefined : "#1a237e" }}
          className={`h-10 px-4 rounded-lg font-bold text-white ${
            busy ? "bg-slate-400 dark:bg-slate-700 opacity-70 cursor-not-allowed" : "hover:brightness-110"
          }`}
        >
          {busy ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
