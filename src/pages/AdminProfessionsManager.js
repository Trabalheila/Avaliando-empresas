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

/* ════════════════════════════════════════════════
   AdminProfessionsManager
   Gerencia a coleção `professions` do Firestore.
   Documentos: { name: string, createdAt, updatedAt }
   ════════════════════════════════════════════════ */
export default function AdminProfessionsManager({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const admin = useMemo(() => isAdmin(), []);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [professions, setProfessions] = useState([]);

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState(null);

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
        snap = await getDocs(query(collection(db, "professions"), orderBy("name", "asc")));
      } catch {
        snap = await getDocs(collection(db, "professions"));
      }
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" })
      );
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
      const norm = String(name || "").trim().toLowerCase();
      if (!norm) return false;
      return professions.some(
        (p) => p.id !== ignoreId && String(p.name || "").trim().toLowerCase() === norm
      );
    },
    [professions]
  );

  const handleAdd = useCallback(
    async (e) => {
      e?.preventDefault?.();
      const name = newName.trim();
      if (!name) {
        setErrorMsg("Informe o nome da profissão.");
        return;
      }
      if (isDuplicateName(name)) {
        setErrorMsg("Já existe uma profissão com esse nome.");
        return;
      }
      setAdding(true);
      setErrorMsg("");
      try {
        await addDoc(collection(db, "professions"), {
          name,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setNewName("");
        await load();
      } catch (err) {
        console.error("Falha ao adicionar profissão:", err);
        setErrorMsg("Não foi possível adicionar a profissão.");
      } finally {
        setAdding(false);
      }
    },
    [newName, isDuplicateName, load]
  );

  const startEdit = useCallback((p) => {
    setEditingId(p.id);
    setEditingName(p.name || "");
    setErrorMsg("");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingName("");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) {
      setErrorMsg("O nome da profissão não pode ficar vazio.");
      return;
    }
    if (isDuplicateName(name, editingId)) {
      setErrorMsg("Já existe uma profissão com esse nome.");
      return;
    }
    setSavingId(editingId);
    setErrorMsg("");
    try {
      await updateDoc(doc(db, "professions", editingId), {
        name,
        updatedAt: serverTimestamp(),
      });
      setEditingId(null);
      setEditingName("");
      await load();
    } catch (err) {
      console.error("Falha ao editar profissão:", err);
      setErrorMsg("Não foi possível salvar as alterações.");
    } finally {
      setSavingId(null);
    }
  }, [editingId, editingName, isDuplicateName, load]);

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

      <main className="w-full max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-white">
              Gerenciamento de Profissões/Especialidades
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Lista oficial usada nos cadastros de apoiadores.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm text-blue-700 dark:text-blue-300 hover:underline"
          >
            ← Voltar
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}

        {/* Form de adicionar */}
        <form
          onSubmit={handleAdd}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-blue-100 dark:border-slate-700 p-4 md:p-5 mb-6"
        >
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
            Nova profissão / especialidade
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={80}
              placeholder="Ex.: Coach de carreira"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
            />
            <button
              type="submit"
              disabled={adding || !newName.trim()}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold"
            >
              {adding ? "Adicionando…" : "Adicionar Nova Profissão"}
            </button>
          </div>
        </form>

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
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Nome</th>
                  <th className="text-right px-4 py-3 font-semibold w-56">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {professions.map((p) => {
                  const isEditing = editingId === p.id;
                  const isSaving = savingId === p.id;
                  return (
                    <tr key={p.id} className="text-slate-800 dark:text-slate-200">
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            maxLength={80}
                            autoFocus
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                          />
                        ) : (
                          <span className="font-medium">{p.name || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              disabled={isSaving}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold"
                            >
                              {isSaving ? "Salvando…" : "Salvar"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={isSaving}
                              className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-semibold"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
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
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
              <strong>{confirmDeleteOf.name}</strong>? Esta ação não pode ser desfeita.
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
                {deletingId === confirmDeleteOf.id ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
