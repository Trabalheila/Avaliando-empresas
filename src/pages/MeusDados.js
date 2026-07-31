// src/pages/MeusDados.js
//
// Página "Meus Dados" — permite ao usuário logado ver e editar seus dados
// básicos (nome completo, e-mail, telefone/WhatsApp e tipo de perfil) e
// gravá-los no Firestore, na coleção correta conforme o tipo de perfil:
//   • trabalhador            → users/{uid}
//   • apoiador/especialista  → apoiadores/{apoiadorId||uid} (+ espelho em users)
//
// O campo `email` é garantido no documento do especialista/apoiador porque é
// usado pelo backend (resolveEmail em api/send-contact-request.js) para enviar
// as notificações por e-mail.
//
// Não cria coleções novas: reutiliza `users` e `apoiadores` já existentes e o
// mesmo `uid` do Firebase Auth adotado no restante do projeto.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import AppHeader from "../components/AppHeader";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function MeusDados({ theme, toggleTheme }) {
  const navigate = useNavigate();

  const profile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userProfile") || "{}");
    } catch {
      return {};
    }
  }, []);

  const uid = profile?.uid || profile?.id || auth.currentUser?.uid || "";

  const [apoiadorId, setApoiadorId] = useState(profile?.apoiadorId || "");
  const [tipoPerfil, setTipoPerfil] = useState("trabalhador");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /* Carrega os dados atuais do usuário (apoiador tem prioridade quando existe). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Documento de trabalhador em users/{uid}.
        let workerData = null;
        if (uid) {
          const uSnap = await getDoc(doc(db, "users", String(uid)));
          if (uSnap.exists()) workerData = uSnap.data() || {};
        }

        // Documento de especialista em apoiadores/{id} — por apoiadorId do
        // perfil e, como fallback, buscando por uid.
        let apData = null;
        let apId = apoiadorId;
        if (apId) {
          const aSnap = await getDoc(doc(db, "apoiadores", String(apId)));
          if (aSnap.exists()) apData = aSnap.data() || {};
        }
        if (!apData && uid) {
          const qs = await getDocs(
            query(collection(db, "apoiadores"), where("uid", "==", uid), limit(1))
          );
          if (!qs.empty) {
            apId = qs.docs[0].id;
            apData = qs.docs[0].data() || {};
          }
        }

        if (cancelled) return;
        if (apId) setApoiadorId(apId);

        const isApoiador =
          Boolean(apData) ||
          String(workerData?.userType || profile?.userType || "").toLowerCase() ===
            "apoiador";
        setTipoPerfil(isApoiador ? "apoiador" : "trabalhador");

        // Preenche os campos priorizando o doc do especialista quando existe,
        // caindo para o doc do trabalhador e, por fim, para o localStorage.
        const src = apData || workerData || {};
        setNome(
          src.nome ||
            src.fullName ||
            src.nomeReal ||
            profile?.fullName ||
            profile?.nomeReal ||
            ""
        );
        setEmail(
          String(
            src.email || profile?.email || auth.currentUser?.email || ""
          ).toLowerCase()
        );
        setTelefone(
          src.whatsapp ||
            src.telefone ||
            profile?.whatsapp ||
            profile?.telefone ||
            ""
        );
      } catch (err) {
        console.error("[MeusDados] Falha ao carregar dados:", err);
        if (!cancelled) setError("Não foi possível carregar seus dados.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const nomeTrim = nome.trim();
    const emailTrim = email.trim().toLowerCase();
    const telTrim = telefone.trim();

    if (!uid) {
      setError("Sessão inválida. Faça login novamente.");
      return;
    }
    if (!nomeTrim) {
      setError("Informe seu nome completo.");
      return;
    }
    if (emailTrim && !EMAIL_RE.test(emailTrim)) {
      setError("Informe um e-mail válido (ex.: voce@email.com).");
      return;
    }

    setSaving(true);
    try {
      const isApoiador = tipoPerfil === "apoiador";

      // Documento do usuário em users/{uid}. Usa merge para não sobrescrever
      // outros campos (status, pseudônimo, etc.).
      await setDoc(
        doc(db, "users", String(uid)),
        {
          uid,
          fullName: nomeTrim,
          nomeReal: nomeTrim,
          email: emailTrim,
          telefone: telTrim,
          whatsapp: telTrim,
          userType: isApoiador ? "apoiador" : "trabalhador",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Especialista/apoiador: grava também no doc de apoiadores. O campo
      // `email` aqui é o que o backend usa em resolveEmail para notificar.
      let savedApoiadorId = apoiadorId;
      if (isApoiador) {
        savedApoiadorId = apoiadorId || uid;
        await setDoc(
          doc(db, "apoiadores", String(savedApoiadorId)),
          {
            uid,
            nome: nomeTrim,
            email: emailTrim,
            telefone: telTrim,
            whatsapp: telTrim,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        setApoiadorId(savedApoiadorId);
      }

      // Sincroniza o localStorage para que AppHeader e demais telas reflitam
      // os novos dados imediatamente.
      try {
        const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
        const merged = {
          ...stored,
          uid,
          fullName: nomeTrim,
          nomeReal: nomeTrim,
          email: emailTrim,
          telefone: telTrim,
          whatsapp: telTrim,
          userType: isApoiador ? "apoiador" : "trabalhador",
          ...(isApoiador ? { apoiadorId: savedApoiadorId } : {}),
        };
        localStorage.setItem("userProfile", JSON.stringify(merged));
        window.dispatchEvent(new Event("trabalheiLa_user_updated"));
      } catch {
        /* silencioso */
      }

      setMessage("Dados salvos com sucesso!");
    } catch (err) {
      console.error("[MeusDados] Falha ao salvar:", err);
      setError("Não foi possível salvar seus dados. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass =
    "block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Meus Dados" />

      <div className="max-w-xl mx-auto px-4 py-6">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-1">
          Meus Dados
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Atualize seus dados pessoais. Eles ficam salvos com segurança na sua
          conta.
        </p>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Carregando seus dados…
          </p>
        ) : (
          <form
            onSubmit={handleSave}
            className="space-y-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm p-5"
          >
            <div>
              <label htmlFor="md-nome" className={labelClass}>
                Nome completo
              </label>
              <input
                id="md-nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={inputClass}
                placeholder="Seu nome completo"
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="md-email" className={labelClass}>
                E-mail
              </label>
              <input
                id="md-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="voce@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="md-telefone" className={labelClass}>
                Telefone / WhatsApp
              </label>
              <input
                id="md-telefone"
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className={inputClass}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
              />
            </div>

            <div>
              <label htmlFor="md-tipo" className={labelClass}>
                Tipo de perfil
              </label>
              <select
                id="md-tipo"
                value={tipoPerfil}
                onChange={(e) => setTipoPerfil(e.target.value)}
                className={inputClass}
              >
                <option value="trabalhador">Trabalhador</option>
                <option value="apoiador">Apoiador / Especialista</option>
              </select>
            </div>

            {error && (
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            {message && (
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {message}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold transition"
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold transition"
              >
                Voltar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
