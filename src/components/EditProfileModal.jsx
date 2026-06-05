// src/components/EditProfileModal.jsx
//
// Modal acionado pelo botão "Editar perfil" da página MinhaConta.
// Permite editar campos básicos do perfil (pseudônimo, nome completo,
// e-mail, telefone, escolaridade, avatar) sem mandar o usuário para a
// página de login.
//
// Persiste via saveUserProfile (Firestore) + localStorage e dispara o
// evento "trabalheiLa_user_updated" para outras partes do app
// (AppHeader, etc.) re-renderizarem.

import React, { useEffect, useState, useCallback } from "react";
import { saveUserProfile } from "../services/users";

const PREDEFINED_AVATARS = [
  "🧑", "🧑‍💼", "🧑‍🔧", "🧑‍💻", "🧑‍🔬",
  "👩‍🏫", "👨‍🍳", "👩‍⚕️", "👨‍🚀", "👩‍🎨",
];

const EDUCATION_OPTIONS = [
  "",
  "Fundamental",
  "Médio",
  "Técnico",
  "Superior incompleto",
  "Superior completo",
  "Pós-graduação",
  "Mestrado",
  "Doutorado",
];

function persistLocalProfile(nextProfile) {
  try {
    localStorage.setItem("userProfile", JSON.stringify(nextProfile));
    if (nextProfile?.pseudonimo) {
      localStorage.setItem("userPseudonym", nextProfile.pseudonimo);
    }
    window.dispatchEvent(new Event("trabalheiLa_user_updated"));
  } catch {
    /* sem localStorage */
  }
}

function isValidEmail(value) {
  if (!value) return true; // vazio é permitido (pode ser anônimo)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function EditProfileModal({ open, onClose, profile, onSaved }) {
  const [pseudonimo, setPseudonimo] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [education, setEducation] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (!open) return;
    setPseudonimo(profile?.pseudonimo || "");
    setFullName(profile?.fullName || profile?.name || "");
    setEmail(profile?.email || "");
    setPhone(profile?.phone || "");
    setEducation(profile?.education || "");
    setAvatar(profile?.avatar || profile?.picture || "");
    setError("");
    setInfo("");
  }, [open, profile]);

  const handleSave = useCallback(async () => {
    setError("");
    setInfo("");
    const trimmedEmail = (email || "").trim();
    if (!isValidEmail(trimmedEmail)) {
      setError("E-mail inválido.");
      return;
    }
    const id = profile?.id || profile?.profileId || profile?.uid;
    if (!id) {
      setError("Perfil sem identificador. Recarregue a página e tente novamente.");
      return;
    }
    setBusy(true);
    try {
      const update = {
        id,
        pseudonimo: pseudonimo.trim(),
        fullName: fullName.trim(),
        name: fullName.trim() || pseudonimo.trim(),
        email: trimmedEmail,
        phone: phone.trim(),
        education: education,
        avatar,
        picture: avatar && (avatar.startsWith("http") || avatar.startsWith("data:"))
          ? avatar
          : profile?.picture || "",
      };
      const persisted = await saveUserProfile(update);
      const nextProfile = { ...(profile || {}), ...update, ...persisted };
      persistLocalProfile(nextProfile);
      onSaved?.(nextProfile);
      setInfo("Perfil atualizado.");
      setTimeout(() => onClose?.(), 600);
    } catch (err) {
      setError(err?.message || "Não foi possível salvar o perfil.");
    } finally {
      setBusy(false);
    }
  }, [
    pseudonimo,
    fullName,
    email,
    phone,
    education,
    avatar,
    profile,
    onSaved,
    onClose,
  ]);

  if (!open) return null;

  const avatarPreview = (() => {
    if (avatar && (avatar.startsWith("http") || avatar.startsWith("data:"))) {
      return (
        <img
          src={avatar}
          alt="avatar"
          className="h-16 w-16 rounded-full object-cover border-2 border-blue-200 dark:border-slate-600"
          referrerPolicy="no-referrer"
        />
      );
    }
    if (avatar && avatar.length <= 4) {
      return <span className="text-4xl">{avatar}</span>;
    }
    return (
      <span className="h-16 w-16 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-3xl">
        👤
      </span>
    );
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2
            id="edit-profile-title"
            className="text-lg font-bold text-blue-800 dark:text-blue-200"
          >
            Editar perfil
          </h2>
          <button
            type="button"
            onClick={() => !busy && onClose?.()}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-2xl leading-none"
            aria-label="Fechar"
            disabled={busy}
          >
            ×
          </button>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            {avatarPreview}
            <div className="flex flex-wrap gap-1">
              {PREDEFINED_AVATARS.map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={`text-2xl p-1 rounded-lg transition ${
                    avatar === a
                      ? "bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                  aria-label={`Selecionar avatar ${a}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label
              htmlFor="edit-avatar-url"
              className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1"
            >
              ou cole a URL de uma imagem
            </label>
            <input
              id="edit-avatar-url"
              type="url"
              value={avatar && (avatar.startsWith("http") || avatar.startsWith("data:")) ? avatar : ""}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Pseudônimo */}
          <div>
            <label
              htmlFor="edit-pseudonym"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1"
            >
              Pseudônimo (apelido público)
            </label>
            <input
              id="edit-pseudonym"
              type="text"
              value={pseudonimo}
              onChange={(e) => setPseudonimo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Como você quer ser identificado nas avaliações"
              maxLength={60}
            />
          </div>

          {/* Nome completo */}
          <div>
            <label
              htmlFor="edit-fullname"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1"
            >
              Nome completo (privado)
            </label>
            <input
              id="edit-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Seu nome real"
              autoComplete="name"
            />
          </div>

          {/* E-mail */}
          <div>
            <label
              htmlFor="edit-email"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1"
            >
              E-mail
            </label>
            <input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="voce@exemplo.com"
              autoComplete="email"
            />
          </div>

          {/* Telefone */}
          <div>
            <label
              htmlFor="edit-phone"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1"
            >
              Telefone
            </label>
            <input
              id="edit-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="(11) 99999-9999"
              autoComplete="tel"
            />
          </div>

          {/* Escolaridade */}
          <div>
            <label
              htmlFor="edit-education"
              className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1"
            >
              Escolaridade
            </label>
            <select
              id="edit-education"
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EDUCATION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt || "Selecione..."}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2">
              {info}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <button
              type="button"
              onClick={() => !busy && onClose?.()}
              disabled={busy}
              className="flex-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60"
            >
              {busy ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
