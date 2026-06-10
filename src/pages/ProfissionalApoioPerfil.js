// src/pages/ProfissionalApoioPerfil.js
//
// Perfil público básico do "Profissional de Apoio" (userType:
// 'supportProfessional'). Exibe nome, especialidades e mini-bio,
// com link opcional. Esta versão é a base para o futuro matching
// com trabalhadores.

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import AppHeader from "../components/AppHeader";

/* ──────────────────────────────────────────────────────────────
 * Mapeamento de profissão → campos de credencial específicos.
 *
 *   key:           valor canônico salvo em `profile.profession`
 *                  (também aceitamos as chaves de `profile.tipo`
 *                  usadas em /apoiadores: "advogado", "medico"…).
 *   labels:        rótulos exibidos no perfil.
 *   numberFields:  campos do Firestore que podem conter o número
 *                  do registro (ordem de prioridade).
 *   stateFields:   campos que podem conter UF/região do conselho.
 *
 * Para adicionar uma nova profissão regulamentada, basta inserir
 * um item nesta lista — o perfil renderiza automaticamente.
 * ────────────────────────────────────────────────────────────── */
const PROFESSION_CREDENTIALS = [
  {
    keys: ["Advogado", "advogado"],
    label: "OAB",
    sectionTitle: "Credenciais — Advogado",
    numberFields: ["oabNumber", "oab"],
    stateFields: ["oabState", "oabUf", "seccional"],
  },
  {
    keys: ["Médico", "Medico", "medico"],
    label: "CRM",
    sectionTitle: "Credenciais — Médico",
    numberFields: ["crmNumber", "crm"],
    stateFields: ["crmState", "crmUf"],
  },
  {
    keys: ["Psicólogo", "Psicologo", "psicologo"],
    label: "CRP",
    sectionTitle: "Credenciais — Psicólogo",
    numberFields: ["crpNumber", "crp"],
    stateFields: ["crpRegion", "crpState"],
  },
  {
    keys: ["Assistente Social", "assistente_social"],
    label: "CRESS",
    sectionTitle: "Credenciais — Assistente Social",
    numberFields: ["cressNumber", "cress"],
    stateFields: ["cressRegion", "cressState"],
  },
  {
    keys: ["Contador", "contador"],
    label: "CRC",
    sectionTitle: "Credenciais — Contador",
    numberFields: ["crcNumber", "crc"],
    stateFields: ["crcState", "crcUf"],
  },
  {
    keys: [
      "Engenheiro de Segurança do Trabalho",
      "engenheiro_seguranca",
    ],
    label: "CREA",
    sectionTitle: "Credenciais — Engenheiro de Segurança",
    numberFields: ["creaNumber", "crea"],
    stateFields: ["creaState", "creaUf"],
  },
  {
    keys: [
      "Fisioterapeuta Ocupacional",
      "fisioterapeuta_ocupacional",
    ],
    label: "CREFITO",
    sectionTitle: "Credenciais — Fisioterapeuta",
    numberFields: ["crefitoNumber", "crefito"],
    stateFields: ["crefitoRegion", "crefitoState"],
  },
];

/** Resolve a configuração de credencial a partir do perfil. */
function resolveCredentialConfig(profile) {
  if (!profile) return null;
  const profession = profile.profession || profile.tipo || "";
  if (!profession) return null;
  return (
    PROFESSION_CREDENTIALS.find((p) =>
      p.keys.some((k) => k === profession)
    ) || null
  );
}

/** Lê o primeiro valor truthy entre os campos da lista. */
function pickField(profile, fields) {
  if (!profile) return "";
  for (const f of fields) {
    const v = profile?.[f];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  // Fallback: shape "credential" usado em /apoiadores.
  const cred = profile?.credential || {};
  if (fields.some((f) => /number|oab|crm|crp|crc|crea|crefito/i.test(f))) {
    if (cred.number && String(cred.number).trim()) return String(cred.number).trim();
  }
  if (fields.some((f) => /state|uf|region|seccional/i.test(f))) {
    if (cred.stateOrRegion && String(cred.stateOrRegion).trim()) {
      return String(cred.stateOrRegion).trim();
    }
  }
  return "";
}

/**
 * Bloco genérico de credencial. Renderiza apenas se houver número.
 */
function CredentialBlock({ profile, config }) {
  if (!config) return null;
  const number = pickField(profile, config.numberFields);
  if (!number) return null;
  const stateOrRegion = pickField(profile, config.stateFields);
  const verified =
    profile?.verificationStatus === "verified" || profile?.verified === true;

  return (
    <div className="mt-6 rounded-xl border border-blue-100 dark:border-slate-700 bg-blue-50/40 dark:bg-slate-800/40 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xs uppercase tracking-wider font-bold text-blue-700 dark:text-blue-300">
          {config.sectionTitle}
        </h2>
        {verified && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            ✓ Verificado
          </span>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
            Número {config.label}
          </dt>
          <dd className="mt-0.5 font-bold text-slate-800 dark:text-slate-100">
            {number}
          </dd>
        </div>
        {stateOrRegion && (
          <div>
            <dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              UF / Região
            </dt>
            <dd className="mt-0.5 font-bold text-slate-800 dark:text-slate-100">
              {stateOrRegion}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export default function ProfissionalApoioPerfil({ theme, toggleTheme }) {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "supportProfessionals", id));
        if (cancelled) return;
        if (!snap.exists()) {
          setNotFound(true);
        } else {
          setProfile({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        console.error("Erro ao carregar perfil de apoio:", e);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (id) load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const credentialConfig = resolveCredentialConfig(profile);
  const professionLabel = profile?.profession || profile?.tipo || "";
  const isPremiumApoiador =
    String(profile?.apoiadorPlano || profile?.plano || "").toLowerCase() === "premium";
  const isAvailableForContact = profile?.isAvailableForContact === true;
  const avatarSrc = profile?.avatar || profile?.foto || profile?.photoURL || "";
  const avatarIsImg =
    avatarSrc && (avatarSrc.startsWith("data:") || avatarSrc.startsWith("http"));
  const displayName = profile?.fullName || profile?.nome || "Profissional";
  const initial = String(displayName).trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900">
      <AppHeader theme={theme} toggleTheme={toggleTheme} />
      <div className="max-w-3xl mx-auto px-4 py-10">
        {loading && (
          <div className="text-center text-slate-600 dark:text-slate-300">Carregando...</div>
        )}

        {!loading && notFound && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Perfil não encontrado
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Este perfil não existe ou foi removido.
            </p>
            <Link
              to="/"
              className="mt-6 inline-block px-5 py-2.5 rounded-lg font-semibold text-blue-700 dark:text-blue-300 border border-blue-700 dark:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
            >
              Voltar para a página inicial
            </Link>
          </div>
        )}

        {!loading && profile && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 md:p-10">
            {/* Cabeçalho com avatar + selos */}
            <div className="flex items-start gap-4 flex-wrap">
              {avatarIsImg ? (
                <img
                  src={avatarSrc}
                  alt={displayName}
                  className="h-20 w-20 rounded-full object-cover border-2 border-blue-100 dark:border-slate-700 shadow"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white text-2xl font-bold flex items-center justify-center border-2 border-blue-100 dark:border-slate-700 shadow"
                  aria-hidden="true"
                >
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                    Profissional de Apoio
                  </span>
                  {professionLabel && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 capitalize">
                      {professionLabel.replace(/_/g, " ")}
                    </span>
                  )}
                  {isPremiumApoiador && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow">
                      ⭐ Especialista Premium
                    </span>
                  )}
                  {isPremiumApoiador && isAvailableForContact && (
                    <span
                      title="Disponível para contato"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                    >
                      🔔 Disponível para contato
                    </span>
                  )}
                  {(profile.verified ||
                    profile.verificationStatus === "verified") && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                      ✓ Verificado
                    </span>
                  )}
                </div>
                <h1 className="mt-3 text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
                  {displayName}
                </h1>
              </div>
            </div>

            {/* Credenciais específicas da profissão (renderização condicional) */}
            <CredentialBlock profile={profile} config={credentialConfig} />

            {Array.isArray(profile.specialties) && profile.specialties.length > 0 && (
              <div className="mt-6">
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                  Especialidades
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.specialties.map((s) => (
                    <span
                      key={s.value || s.label}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                    >
                      {s.label || s.value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.ramoEspecializacao && (
              <div className="mt-6">
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                  Ramo de Especialização
                </h2>
                <p className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                  {profile.ramoEspecializacao}
                </p>
              </div>
            )}

            {(profile.bio || profile.descricao) && (
              <div className="mt-6">
                <h2 className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                  Sobre
                </h2>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                  {profile.bio || profile.descricao}
                </p>
              </div>
            )}

            {profile.profileLink && (
              <div className="mt-6">
                <a
                  href={profile.profileLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                >
                  Perfil profissional externo →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
