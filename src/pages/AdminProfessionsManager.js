import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { isAdmin } from "../utils/rbac";
import AppHeader from "../components/AppHeader";
import AdminQuickAccess from "../components/AdminQuickAccess";

/* ════════════════════════════════════════════════
   AdminProfessionsManager
   Gerencia a coleção `professions` do Firestore.
   Documentos: {
     name: string,
     description: string,
     category: string,
     iconUrl: string,
     isActive: boolean,
     order: number,
     createdAt, updatedAt
   }
   ════════════════════════════════════════════════ */

const PREDEFINED_CATEGORIES = [
  "Jurídico",
  "Recursos Humanos",
  "Saúde",
  "Consultoria",
  "Outros",
];

const EMPTY_FORM = {
  name: "",
  description: "",
  category: "",
  customCategory: "",
  iconUrl: "",
  isActive: true,
  order: "",
};

/* Resolve a categoria final a partir do select + campo customizado */
function resolveCategory(form) {
  const cat = (form.category || "").trim();
  if (cat === "Outros") {
    const custom = (form.customCategory || "").trim();
    return custom || "Outros";
  }
  return cat;
}

/* Para edição: dado um documento existente, decide se a categoria é
   pré-definida ou se deve ser exibida como "Outros" + custom. */
function categoryToForm(category) {
  const cat = String(category || "");
  if (!cat) return { category: "", customCategory: "" };
  if (PREDEFINED_CATEGORIES.includes(cat) && cat !== "Outros") {
    return { category: cat, customCategory: "" };
  }
  return { category: "Outros", customCategory: cat === "Outros" ? "" : cat };
}

/* ── Toggle switch acessível ── */
function ToggleSwitch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
        checked ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-600"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/* ── Subform reutilizável de campos da profissão ── */
function ProfessionFormFields({ form, onChange, idPrefix = "pf" }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="md:col-span-2">
        <label
          htmlFor={`${idPrefix}-name`}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
        >
          Nome da Profissão *
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          maxLength={80}
          placeholder="Ex.: Coach de carreira"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
        />
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor={`${idPrefix}-description`}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
        >
          Descrição <span className="font-normal text-slate-500">(opcional)</span>
        </label>
        <textarea
          id={`${idPrefix}-description`}
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          maxLength={400}
          rows={3}
          placeholder="Breve descrição do que faz este profissional…"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
        />
        <p className="text-[10px] text-slate-500 mt-0.5">
          {(form.description || "").length}/400
        </p>
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-category`}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
        >
          Categoria
        </label>
        <select
          id={`${idPrefix}-category`}
          value={form.category}
          onChange={(e) => onChange({ ...form, category: e.target.value })}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
        >
          <option value="">Selecione…</option>
          {PREDEFINED_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {form.category === "Outros" && (
          <input
            type="text"
            value={form.customCategory}
            onChange={(e) =>
              onChange({ ...form, customCategory: e.target.value })
            }
            maxLength={60}
            placeholder="Categoria personalizada"
            className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
          />
        )}
      </div>

      <div>
        <label
          htmlFor={`${idPrefix}-order`}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
        >
          Ordem de Exibição{" "}
          <span className="font-normal text-slate-500">(opcional)</span>
        </label>
        <input
          id={`${idPrefix}-order`}
          type="number"
          inputMode="numeric"
          value={form.order}
          onChange={(e) => onChange({ ...form, order: e.target.value })}
          placeholder="Ex.: 10"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
        />
      </div>

      <div className="md:col-span-2">
        <label
          htmlFor={`${idPrefix}-iconUrl`}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
        >
          URL do Ícone{" "}
          <span className="font-normal text-slate-500">(opcional)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`${idPrefix}-iconUrl`}
            type="url"
            value={form.iconUrl}
            onChange={(e) => onChange({ ...form, iconUrl: e.target.value })}
            placeholder="https://…/icone.svg"
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
          />
          {form.iconUrl ? (
            <img
              src={form.iconUrl}
              alt=""
              className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-600 object-contain bg-white"
              onError={(ev) => {
                ev.currentTarget.style.visibility = "hidden";
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="md:col-span-2 flex items-center gap-3">
        <ToggleSwitch
          checked={!!form.isActive}
          onChange={(v) => onChange({ ...form, isActive: v })}
          label="Ativa"
        />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {form.isActive ? "Ativa" : "Inativa"}
        </span>
      </div>
    </div>
  );
}

export default function AdminProfessionsManager({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const admin = useMemo(() => isAdmin(), []);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [professions, setProfessions] = useState([]);

  /* Form de adicionar */
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  /* Edição inline */
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [savingId, setSavingId] = useState(null);

  /* Confirmação de exclusão */
  const [confirmDeleteOf, setConfirmDeleteOf] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  /* Proteção de rota */
  useEffect(() => {
    if (!admin) navigate("/", { replace: true });
  }, [admin, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      let snap;
      try {
        snap = await getDocs(
          query(collection(db, "professions"), orderBy("order", "asc"))
        );
      } catch {
        snap = await getDocs(collection(db, "professions"));
      }
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Ordena por order (numérico) e, em empate, por nome.
      list.sort((a, b) => {
        const oa = Number.isFinite(Number(a.order))
          ? Number(a.order)
          : Number.MAX_SAFE_INTEGER;
        const ob = Number.isFinite(Number(b.order))
          ? Number(b.order)
          : Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        return String(a.name || "").localeCompare(
          String(b.name || ""),
          "pt-BR",
          { sensitivity: "base" }
        );
      });
      setProfessions(list);
    } catch (err) {
      console.error("Falha ao carregar profissões:", err);
      setErrorMsg("Não foi possível carregar a lista de profissões.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) load();
  }, [admin, load]);

  const isDuplicateName = useCallback(
    (name, ignoreId = null) => {
      const norm = String(name || "")
        .trim()
        .toLowerCase();
      if (!norm) return false;
      return professions.some(
        (p) =>
          p.id !== ignoreId &&
          String(p.name || "")
            .trim()
            .toLowerCase() === norm
      );
    },
    [professions]
  );

  /* Validação centralizada */
  const validate = useCallback(
    (form, ignoreId = null) => {
      const name = String(form.name || "").trim();
      if (!name) return "Informe o nome da profissão.";
      if (isDuplicateName(name, ignoreId))
        return "Já existe uma profissão com esse nome.";
      if (
        form.category === "Outros" &&
        !String(form.customCategory || "").trim()
      ) {
        return "Informe a categoria personalizada (ou escolha outra opção).";
      }
      if (form.order !== "" && form.order !== null && form.order !== undefined) {
        const n = Number(form.order);
        if (!Number.isFinite(n)) return "A ordem de exibição deve ser numérica.";
      }
      if (form.iconUrl) {
        try {
          // eslint-disable-next-line no-new
          new URL(form.iconUrl);
        } catch {
          return "URL do ícone inválida.";
        }
      }
      return "";
    },
    [isDuplicateName]
  );

  /* Monta o payload pronto para gravar */
  const buildPayload = (form) => ({
    name: form.name.trim(),
    description: (form.description || "").trim(),
    category: resolveCategory(form),
    iconUrl: (form.iconUrl || "").trim(),
    isActive: !!form.isActive,
    order:
      form.order === "" || form.order === null || form.order === undefined
        ? null
        : Number(form.order),
  });

  const handleAdd = useCallback(
    async (e) => {
      e?.preventDefault?.();
      const err = validate(addForm);
      if (err) {
        setErrorMsg(err);
        return;
      }
      setAdding(true);
      setErrorMsg("");
      try {
        await addDoc(collection(db, "professions"), {
          ...buildPayload(addForm),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setAddForm(EMPTY_FORM);
        setShowAddForm(false);
        await load();
      } catch (err2) {
        console.error("Falha ao adicionar profissão:", err2);
        setErrorMsg("Não foi possível adicionar a profissão.");
      } finally {
        setAdding(false);
      }
    },
    [addForm, validate, load]
  );

  const startEdit = useCallback((p) => {
    const catParts = categoryToForm(p.category);
    setEditingId(p.id);
    setEditForm({
      name: p.name || "",
      description: p.description || "",
      category: catParts.category,
      customCategory: catParts.customCategory,
      iconUrl: p.iconUrl || "",
      isActive: p.isActive !== false,
      order:
        p.order === null || p.order === undefined || p.order === ""
          ? ""
          : String(p.order),
    });
    setErrorMsg("");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    const err = validate(editForm, editingId);
    if (err) {
      setErrorMsg(err);
      return;
    }
    setSavingId(editingId);
    setErrorMsg("");
    try {
      await updateDoc(doc(db, "professions", editingId), {
        ...buildPayload(editForm),
        updatedAt: serverTimestamp(),
      });
      setEditingId(null);
      setEditForm(EMPTY_FORM);
      await load();
    } catch (err2) {
      console.error("Falha ao editar profissão:", err2);
      setErrorMsg("Não foi possível salvar as alterações.");
    } finally {
      setSavingId(null);
    }
  }, [editingId, editForm, validate, load]);

  const handleDelete = useCallback(async () => {
    if (!confirmDeleteOf) return;
    setDeletingId(confirmDeleteOf.id);
    setErrorMsg("");
    try {
      await deleteDoc(doc(db, "professions", confirmDeleteOf.id));
      setConfirmDeleteOf(null);
      await load();
    } catch (err) {
      console.error("Falha ao excluir profissão:", err);
      setErrorMsg("Não foi possível excluir a profissão.");
    } finally {
      setDeletingId(null);
    }
  }, [confirmDeleteOf, load]);

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />
      <AdminQuickAccess />

      <main className="w-full max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white">
              Gerenciamento de Profissões/Especialidades
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Lista oficial usada nos cadastros de apoiadores.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-sm text-blue-700 dark:text-blue-300 hover:underline"
            >
              ← Voltar
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {/* Form de adicionar */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-blue-100 dark:border-slate-700 p-4 md:p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
              Nova profissão / especialidade
            </label>
            {!showAddForm && (
              <button
                type="button"
                onClick={() => {
                  setAddForm(EMPTY_FORM);
                  setShowAddForm(true);
                  setErrorMsg("");
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                + Adicionar Nova Profissão
              </button>
            )}
          </div>

          {showAddForm && (
            <form onSubmit={handleAdd} className="space-y-3">
              <ProfessionFormFields
                form={addForm}
                onChange={setAddForm}
                idPrefix="add"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddForm(EMPTY_FORM);
                    setErrorMsg("");
                  }}
                  disabled={adding}
                  className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={adding || !addForm.name.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold"
                >
                  {adding ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Tabela */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-blue-100 dark:border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Carregando profissões…
            </div>
          ) : professions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Nenhuma profissão cadastrada ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Nome</th>
                    <th className="text-left px-4 py-3 font-semibold">
                      Categoria
                    </th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-right px-4 py-3 font-semibold w-56">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {professions.map((p) => {
                    const isEditing = editingId === p.id;
                    const isSaving = savingId === p.id;
                    const isActive = p.isActive !== false;

                    if (isEditing) {
                      return (
                        <tr
                          key={p.id}
                          className="bg-blue-50/40 dark:bg-slate-900/30"
                        >
                          <td colSpan={4} className="px-4 py-4">
                            <ProfessionFormFields
                              form={editForm}
                              onChange={setEditForm}
                              idPrefix={`edit-${p.id}`}
                            />
                            <div className="flex justify-end gap-2 pt-3">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={isSaving}
                                className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-semibold"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold"
                              >
                                {isSaving ? "Salvando…" : "Salvar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr
                        key={p.id}
                        className="text-slate-800 dark:text-slate-200"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {p.iconUrl ? (
                              <img
                                src={p.iconUrl}
                                alt=""
                                className="h-6 w-6 rounded object-contain bg-white border border-slate-200 dark:border-slate-600"
                                onError={(ev) => {
                                  ev.currentTarget.style.visibility = "hidden";
                                }}
                              />
                            ) : null}
                            <span className="font-medium">
                              {p.name || "—"}
                            </span>
                          </div>
                          {p.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                              {p.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {p.category ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200">
                              {p.category}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                              isActive
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                                : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                            }`}
                          >
                            {isActive ? "Ativa" : "Inativa"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(p)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteOf(p)}
                              disabled={deletingId === p.id}
                              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold"
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
        </div>
      </main>

      {/* Modal de confirmação de exclusão */}
      {confirmDeleteOf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
              Excluir profissão
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              Tem certeza que deseja excluir{" "}
              <strong>{confirmDeleteOf.name}</strong>? Esta ação não pode ser
              desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOf(null)}
                disabled={deletingId === confirmDeleteOf.id}
                className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletingId === confirmDeleteOf.id}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {deletingId === confirmDeleteOf.id
                  ? "Excluindo…"
                  : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
