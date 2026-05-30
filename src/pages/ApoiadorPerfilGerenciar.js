// src/pages/ApoiadorPerfilGerenciar.js
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInAnonymously } from "firebase/auth";
import { db, storage, auth } from "../firebase";
import AppHeader from "../components/AppHeader";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Página de gerenciamento do perfil do Especialista (Apoiador).
 * Rota: /apoiador/perfil
 *
 * Permite editar campos básicos do doc `apoiadores/{id}` usados em
 * exibição (descrição, áreas de atuação, nichos e disponibilidade)
 * e visualizar a foto atual. Carrega o `apoiadorId` do localStorage
 * (`userProfile`), padrão usado pelas demais páginas do especialista.
 */
export default function ApoiadorPerfilGerenciar({ theme, toggleTheme }) {
  const navigate = useNavigate();

  const profile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch {
      return {};
    }
  }, []);
  const apoiadorId =
    profile?.apoiadorId || profile?.uid || profile?.id || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [foto, setFoto] = useState("");
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const fileInputRef = useRef(null);
  const [descricao, setDescricao] = useState("");
  const [areasText, setAreasText] = useState("");
  const [nichosText, setNichosText] = useState("");
  const [disponibilidade, setDisponibilidade] = useState("");

  /* Carrega o doc atual do apoiador. */
  useEffect(() => {
    if (!apoiadorId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "apoiadores", apoiadorId));
        if (cancelled) return;
        if (snap.exists()) {
          const d = snap.data();
          setFoto(d.foto || "");
          setDescricao(d.descricao || "");
          const areas = Array.isArray(d.areas)
            ? d.areas
            : Array.isArray(d.areasDeAtuacao)
            ? d.areasDeAtuacao
            : [];
          setAreasText(areas.join(", "));
          const nichos = Array.isArray(d.nichos)
            ? d.nichos
            : Array.isArray(d.segmentos)
            ? d.segmentos
            : [];
          setNichosText(nichos.join(", "));
          setDisponibilidade(d.disponibilidade || "");
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Erro ao carregar perfil.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apoiadorId]);

  const handleFotoChange = useCallback((e) => {
    setError("");
    setMessage("");
    const file = e?.target?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem válido.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("A imagem não pode passar de 5MB.");
      e.target.value = "";
      return;
    }
    setFotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setFotoPreview(String(reader.result || ""));
    reader.readAsDataURL(file);
  }, []);

  const handleSave = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (!apoiadorId) return;
      setSaving(true);
      setError("");
      setMessage("");
      try {
        // Garante usuário autenticado (anônimo se necessário) ANTES de
        // qualquer escrita — regras do Firestore exigem request.auth != null.
        if (!auth.currentUser) {
          try { await signInAnonymously(auth); } catch (authErr) {
            console.warn("[ApoiadorPerfil] signInAnonymously falhou:", authErr);
          }
        }
        const areas = areasText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const nichos = nichosText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        const updates = {
          descricao: descricao.trim(),
          areas,
          nichos,
          disponibilidade: disponibilidade.trim(),
        };

        // Upload da foto (se houve seleção de novo arquivo).
        if (fotoFile) {
          let url = "";
          try {
            const safeName = (fotoFile.name || "foto").replace(/[^\w.\-]+/g, "_");
            const path = `apoiadores/${apoiadorId}/${Date.now()}-${safeName}`;
            const sRef = storageRef(storage, path);
            await uploadBytes(sRef, fotoFile, {
              contentType: fotoFile.type || "image/*",
            });
            url = await getDownloadURL(sRef);
          } catch (storageErr) {
            // Fallback: se o Storage falhar (regras/CORS), salva como dataURL
            // no próprio doc para não bloquear o usuário.
            console.warn("[ApoiadorPerfil] falha no Storage; usando dataURL", storageErr);
            const reader = new FileReader();
            url = await new Promise((resolve, reject) => {
              reader.onload = () => resolve(String(reader.result || ""));
              reader.onerror = reject;
              reader.readAsDataURL(fotoFile);
            });
          }
          updates.foto = url;
          updates.photoURL = url;
          setFoto(url);
          setFotoFile(null);
          setFotoPreview("");
        }

        await setDoc(
          doc(db, "apoiadores", apoiadorId),
          { ...updates, updatedAt: serverTimestamp() },
          { merge: true }
        );
        setMessage("Perfil atualizado com sucesso.");
      } catch (err) {
        console.error("[ApoiadorPerfil] erro ao salvar:", err);
        const code = err?.code ? ` (${err.code})` : "";
        setError((err?.message || "Erro ao salvar.") + code);
      } finally {
        setSaving(false);
      }
    },
    [apoiadorId, descricao, areasText, nichosText, disponibilidade, fotoFile]
  );

  if (!apoiadorId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
        <AppHeader theme={theme} toggleTheme={toggleTheme} title="Gerenciar Perfil" />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-slate-600 dark:text-slate-300">
            Você precisa estar logado como Especialista para gerenciar seu perfil.
          </p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Gerenciar Perfil" />

      <main className="flex-1 w-full max-w-3xl mx-auto px-3 sm:px-6 py-5 sm:py-8">
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100">
            Gerenciar Meu Perfil de Especialista
          </h1>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
          >
            ← Voltar
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500 dark:text-slate-400 animate-pulse py-12 text-center">
            Carregando seu perfil…
          </p>
        ) : (
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow border border-blue-100 dark:border-slate-700 p-4 sm:p-6 space-y-5"
          >
            {/* Foto */}
            <section className="flex items-center gap-4 flex-wrap">
              {fotoPreview || foto ? (
                <img
                  src={fotoPreview || foto}
                  alt="Foto de perfil"
                  className="h-20 w-20 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-3xl">
                  👤
                </div>
              )}
              <div className="flex-1 min-w-[180px]">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Foto de perfil
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  JPG, PNG ou WebP até 5MB. Aparece na sua página pública e nos resultados de busca.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFotoChange}
                  className="hidden"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                    className="inline-flex items-center min-h-[40px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    {fotoFile ? "Trocar arquivo" : "Escolher foto"}
                  </button>
                  {fotoFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setFotoFile(null);
                        setFotoPreview("");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      disabled={saving}
                      className="inline-flex items-center min-h-[40px] px-3 py-2 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    >
                      Remover seleção
                    </button>
                  )}
                </div>
                {fotoFile && (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Selecionado: {fotoFile.name} · {(fotoFile.size / 1024).toFixed(0)} KB
                  </p>
                )}
              </div>
            </section>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Descrição profissional
              </label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Conte resumidamente sua trajetória, especialidades e diferenciais."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {descricao.length}/1000
              </p>
            </div>

            {/* Áreas de atuação */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Áreas de atuação
              </label>
              <input
                type="text"
                value={areasText}
                onChange={(e) => setAreasText(e.target.value)}
                placeholder="Ex.: Direito trabalhista, Compliance, Negociações coletivas"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Separe múltiplas áreas por vírgula.
              </p>
            </div>

            {/* Nichos de mercado */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Nichos de mercado
              </label>
              <input
                type="text"
                value={nichosText}
                onChange={(e) => setNichosText(e.target.value)}
                placeholder="Ex.: Tecnologia, Indústria, Varejo"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Separe múltiplos nichos por vírgula.
              </p>
            </div>

            {/* Disponibilidade */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Disponibilidade
              </label>
              <textarea
                value={disponibilidade}
                onChange={(e) => setDisponibilidade(e.target.value)}
                rows={3}
                maxLength={400}
                placeholder="Ex.: Atendimento de seg. a sex., 9h–18h. Reuniões online ou presenciais em SP."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Feedback */}
            {message && (
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {message}
              </p>
            )}
            {error && (
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              ID do perfil: <code>{apoiadorId}</code>
              {auth.currentUser?.uid ? <> · auth: <code>{auth.currentUser.uid}</code></> : <> · sem auth firebase</>}
            </p>

            {/* Ações */}
            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                disabled={saving}
                className="min-h-[44px] px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {saving && (
                  <span
                    aria-hidden="true"
                    className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
                  />
                )}
                {saving
                  ? fotoFile
                    ? "Enviando foto…"
                    : "Salvando…"
                  : "Salvar alterações"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
