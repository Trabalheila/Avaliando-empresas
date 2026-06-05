// src/services/socialAuth.js
//
// Camada única de autenticação social do Trabalhei Lá.
//
// Cobre os 3 requisitos do fluxo de Lazy Registration:
//
//   1. Autenticação Google via Firebase popup (captura e-mail e foto).
//   2. Autenticação LinkedIn via /api/linkedin-auth (Authorization Code flow):
//      retorna o perfil + experiências quando o provider permite. Expõe
//      validação de empresa contra histórico (validateCompanyAgainstHistory).
//   3. Após qualquer login social, drena a avaliação pendente armazenada em
//      localStorage (pendingReview) e a envia ao Firestore vinculada ao
//      novo usuário (UID anônimo herdado via linkWithCredential quando
//      possível, mantendo o backfill de reviews anônimas).
//
// IMPORTANTE — limitações reais do LinkedIn:
//   O endpoint oficial OpenID Connect (/v2/userinfo) NÃO retorna histórico
//   profissional para apps sem aprovação especial. Tratamos as experiências
//   como OPCIONAIS: quando estão presentes (parceiros aprovados ou enriquecimento
//   futuro), validamos a empresa avaliada contra elas. Quando não estão,
//   mantemos o login com Selo de Perfil Verificado, mas sem
//   "linkedInVerifiedExperience" marcado na review.

import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

import { auth, db, googleProvider } from "../firebase";
import { buildApiUrl } from "../utils/apiBase";
import { resolveProfileId } from "../utils/profileIdentity";
import {
  saveUserProfile,
  getUserProfileByEmail,
  findUnifiedProfile,
} from "./users";
import { linkAnonymousReviewsToPseudonym, saveReview } from "./reviews";
import { loadPendingReview, clearPendingReview } from "../utils/pendingReview";

// ─────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────

function normalizeForCompanyMatch(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function persistLocalProfile(profile) {
  try {
    const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const merged = { ...stored, ...profile };
    localStorage.setItem("userProfile", JSON.stringify(merged));
    if (profile?.pseudonimo) {
      localStorage.setItem("userPseudonym", profile.pseudonimo);
    }
    window.dispatchEvent(new Event("trabalheiLa_user_updated"));
  } catch {
    /* ambiente sem localStorage */
  }
}

// ─────────────────────────────────────────────────────────────────────
// LinkedIn — parsing e validação de empresa
// ─────────────────────────────────────────────────────────────────────

/**
 * Normaliza o array `linkedinExperiences` do payload do /api/linkedin-auth
 * para o formato { company, role, startDate?, endDate?, source: "linkedin" }.
 */
export function extractLinkedInExperiences(profile) {
  const raw =
    profile?.linkedinExperiences ||
    profile?.experiences ||
    profile?.positions ||
    profile?.linkedin?.experiences ||
    profile?.linkedin?.positions ||
    [];
  if (!Array.isArray(raw)) return [];
  const items = raw
    .map((item) => {
      if (!item) return null;
      const role =
        (item?.title || item?.role || item?.position || item?.occupation || "")
          .toString()
          .trim();
      const company =
        (item?.company ||
          item?.companyName ||
          item?.organization ||
          item?.employer ||
          "")
          .toString()
          .trim();
      if (!company && !role) return null;
      return {
        company,
        role,
        startDate: item?.startDate || item?.start || null,
        endDate: item?.endDate || item?.end || null,
        source: "linkedin",
        verified: true,
      };
    })
    .filter(Boolean);
  // Dedup por (company+role).
  const seen = new Map();
  for (const item of items) {
    const key = `${item.company.toLowerCase()}__${item.role.toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, item);
  }
  return Array.from(seen.values());
}

/**
 * Verifica se uma empresa avaliada bate com alguma experiência do LinkedIn.
 * Retorna { matched: boolean, match: {company, role, startDate, endDate} | null }.
 *
 * Estratégia: comparação case+accent-insensitive, exigindo que o nome da
 * empresa avaliada esteja contido no texto normalizado da experiência ou
 * vice-versa (cobre "Camargo Corrêa" vs "Camargo Correa Construções").
 */
export function validateCompanyAgainstHistory(companyName, experiences) {
  const target = normalizeForCompanyMatch(companyName);
  if (!target) return { matched: false, match: null };
  const list = Array.isArray(experiences) ? experiences : [];
  for (const item of list) {
    const expCompany = normalizeForCompanyMatch(item?.company || "");
    if (!expCompany) continue;
    if (expCompany === target) return { matched: true, match: item };
    if (expCompany.includes(target) || target.includes(expCompany)) {
      return { matched: true, match: item };
    }
  }
  return { matched: false, match: null };
}

// ─────────────────────────────────────────────────────────────────────
// Pending review (Lazy Registration)
// ─────────────────────────────────────────────────────────────────────

/**
 * Drena o buffer de avaliação pendente e envia ao Firestore associada
 * ao novo perfil. Se houver `linkedinExperiences`, marca a review com
 * `linkedInVerifiedExperience: true` quando a empresa avaliada confere.
 *
 * Retorno: { drained, company?, validated? }
 */
export async function processPendingReviewAfterLogin({
  uid,
  pseudonym,
  authorProfileId,
  linkedinExperiences = null,
} = {}) {
  if (!pseudonym) return { drained: false };
  const wrapped = loadPendingReview();
  if (!wrapped?.payload) return { drained: false };

  const stored = wrapped.payload;
  const enriched = {
    ...stored,
    pseudonym,
    authorProfileId: authorProfileId || stored.authorProfileId || uid,
  };

  let validated = false;
  if (Array.isArray(linkedinExperiences) && linkedinExperiences.length > 0) {
    const result = validateCompanyAgainstHistory(stored.company, linkedinExperiences);
    if (result.matched) {
      validated = true;
      enriched.linkedInVerifiedExperience = true;
      enriched.linkedInVerifiedExperienceAt = new Date().toISOString();
      enriched.linkedInVerifiedExperienceSnapshot = {
        company: result.match?.company || stored.company,
        role: result.match?.role || "",
      };
    }
  }

  try {
    await saveReview(enriched);
    clearPendingReview();
    // Sincroniza dedup local da empresa.
    try {
      const evalsKey = `evaluations_${stored.company}`;
      const raw = localStorage.getItem(evalsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          delete parsed.__anon_pending__;
          parsed[pseudonym] = enriched;
          localStorage.setItem(evalsKey, JSON.stringify(parsed));
        }
      }
    } catch {
      /* ignore */
    }
    return { drained: true, company: stored.company, validated };
  } catch (err) {
    console.warn("[socialAuth] Falha ao drenar pending review:", err?.message || err);
    return { drained: false, error: err };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Persistência canônica do perfil pós-login
// ─────────────────────────────────────────────────────────────────────

/**
 * Persiste o perfil no Firestore, no localStorage, marca o funil como
 * concluído, vincula reviews anônimas e drena o buffer pendente.
 *
 * Centraliza TODO o pós-login para garantir comportamento idêntico entre
 * Google / LinkedIn / e-mail+senha.
 */
export async function finalizeSocialLogin({
  uid,
  pseudonym,
  email,
  providerLabel = "email",
  extra = {},
  linkedinExperiences = null,
}) {
  if (!uid) throw new Error("finalizeSocialLogin: uid obrigatório.");
  if (!pseudonym) throw new Error("finalizeSocialLogin: pseudonym obrigatório.");

  const profileBase = {
    ...extra,
    id: uid,
    uid,
    pseudonimo: pseudonym,
    name: pseudonym,
    email: email || extra?.email || "",
    loginProvider: providerLabel,
    status: "ativo",
    fallback: false,
  };
  const profileId =
    resolveProfileId(profileBase, { persistGeneratedId: false }) || uid;
  const persisted = { ...profileBase, profileId };

  await saveUserProfile(persisted);
  persistLocalProfile(persisted);

  // Funil concluído.
  try {
    await setDoc(
      doc(db, "cadastros_iniciados", uid),
      {
        uid,
        concluido: true,
        concluidoAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        provider: providerLabel,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("[socialAuth] Falha ao marcar funil:", err?.message || err);
  }

  // Backfill de reviews anônimas com o mesmo UID.
  try {
    await linkAnonymousReviewsToPseudonym({
      uid,
      pseudonym,
      authorProfileId: profileId,
    });
  } catch (err) {
    console.warn("[socialAuth] Backfill de reviews anônimas falhou:", err?.message || err);
  }

  // Drena buffer pendente (Lazy Registration, Etapa 1).
  let pending = { drained: false };
  try {
    pending = await processPendingReviewAfterLogin({
      uid,
      pseudonym,
      authorProfileId: profileId,
      linkedinExperiences,
    });
  } catch (err) {
    console.warn("[socialAuth] Falha ao processar pending review:", err?.message || err);
  }

  // Limpa flag de prompt pós-avaliação.
  try {
    sessionStorage.removeItem("trabalheiLa_postReviewPseudonymPrompt");
  } catch {
    /* ignore */
  }

  return { uid, profileId, pending };
}

// ─────────────────────────────────────────────────────────────────────
// 1. Google
// ─────────────────────────────────────────────────────────────────────

/**
 * Abre o popup do Google e devolve { user, email, displayName, picture,
 * existingProfile }. NÃO finaliza o cadastro — o caller decide se precisa
 * coletar um pseudônimo antes de chamar `finalizeSocialLogin`.
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result?.user;
  if (!user) {
    throw new Error("Google login não retornou usuário.");
  }
  const email = (user.email || "").toLowerCase();
  const displayName = user.displayName || "";
  const picture = user.photoURL || "";

  // Procura perfil pré-existente para detectar usuário recorrente.
  let existingProfile = null;
  try {
    if (email) {
      existingProfile = await findUnifiedProfile({ email });
    }
  } catch (err) {
    console.warn("[socialAuth] findUnifiedProfile(google) falhou:", err?.message || err);
  }

  return {
    provider: "google",
    user,
    uid: user.uid,
    email,
    displayName,
    picture,
    existingProfile,
  };
}

// ─────────────────────────────────────────────────────────────────────
// 2. LinkedIn
// ─────────────────────────────────────────────────────────────────────

/**
 * Troca o `code` retornado pelo OAuth do LinkedIn por um perfil
 * autenticado (chama a rota serverless /api/linkedin-auth).
 *
 * Retorna { provider, uid, email, displayName, picture, profile,
 *           linkedinExperiences, existingProfile, sealVerified }.
 *
 * `sealVerified` indica que o usuário ganhou o Selo de Perfil Verificado
 * pelo LinkedIn (independente de termos ou não as experiências detalhadas).
 */
export async function authenticateLinkedInCode({ code, redirectUri } = {}) {
  if (!code) throw new Error("authenticateLinkedInCode: code obrigatório.");
  const resolvedRedirect =
    redirectUri ||
    process.env.REACT_APP_LINKEDIN_REDIRECT_URI ||
    `${window.location.origin}/auth/auth/`;

  const resp = await fetch(buildApiUrl("/api/linkedin-auth"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirectUri: resolvedRedirect }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.error) {
    throw new Error(json?.error || `Erro HTTP ${resp.status}`);
  }

  const email = (json?.email || "").toLowerCase();
  const displayName =
    json?.name ||
    [json?.localizedFirstName, json?.localizedLastName].filter(Boolean).join(" ") ||
    "";
  const picture = json?.picture || json?.avatar || "";
  const linkedinExperiences = extractLinkedInExperiences(json);

  // UID: preferimos o do Firebase Anonymous Auth (para herdar reviews
  // anônimas via backfill). Se não houver sessão Firebase, caímos no id
  // retornado pelo LinkedIn.
  const uid =
    auth?.currentUser?.uid || json?.id || json?.sub || "";

  let existingProfile = null;
  try {
    if (email) {
      existingProfile = await findUnifiedProfile({ email });
    }
  } catch (err) {
    console.warn("[socialAuth] findUnifiedProfile(linkedin) falhou:", err?.message || err);
  }

  return {
    provider: "linkedin",
    uid,
    email,
    displayName,
    picture,
    profile: json,
    linkedinExperiences,
    existingProfile,
    sealVerified: true,
  };
}

/**
 * Atalho que combina Google login + finalização quando já há pseudônimo
 * (ou um pseudônimo passado pelo caller). Útil para callers que não
 * precisam exibir uma view intermediária.
 */
export async function loginWithGoogleAndFinalize({ pseudonym } = {}) {
  const session = await signInWithGoogle();
  const existingPseudo = (
    session.existingProfile?.pseudonimo ||
    session.existingProfile?.pseudonym ||
    ""
  ).toString().trim();
  const chosen = (pseudonym || existingPseudo || "").toString().trim();
  if (!chosen) {
    return { session, finalized: false, requiresPseudonym: true };
  }
  const finalize = await finalizeSocialLogin({
    uid: session.uid,
    pseudonym: chosen,
    email: session.email,
    providerLabel: "google",
    extra: {
      picture: session.picture,
      avatar: session.picture,
      nomeReal: session.existingProfile?.nomeReal || session.displayName,
      fullName: session.existingProfile?.fullName || session.displayName,
    },
  });
  return { session, finalized: true, ...finalize };
}

/**
 * Idem para LinkedIn: troca o code, faz login e — se já houver pseudônimo —
 * finaliza tudo num único call. Caso contrário devolve a sessão para que
 * o caller mostre uma view de coleta de pseudônimo.
 */
export async function loginWithLinkedInAndFinalize({ code, redirectUri, pseudonym } = {}) {
  const session = await authenticateLinkedInCode({ code, redirectUri });
  const existingPseudo = (
    session.existingProfile?.pseudonimo ||
    session.existingProfile?.pseudonym ||
    ""
  ).toString().trim();
  const chosen = (pseudonym || existingPseudo || "").toString().trim();
  if (!chosen) {
    return { session, finalized: false, requiresPseudonym: true };
  }
  const finalize = await finalizeSocialLogin({
    uid: session.uid,
    pseudonym: chosen,
    email: session.email,
    providerLabel: "linkedin",
    extra: {
      picture: session.picture,
      avatar: session.picture,
      nomeReal: session.existingProfile?.nomeReal || session.displayName,
      fullName: session.existingProfile?.fullName || session.displayName,
      linkedInUrl: session.profile?.linkedInUrl || "",
      linkedInId: session.profile?.id || session.profile?.sub || "",
      linkedinExperiences: session.linkedinExperiences,
      verifiedProfileBadge: true,
      verifiedProfileBadgeSource: "linkedin",
    },
    linkedinExperiences: session.linkedinExperiences,
  });
  return { session, finalized: true, ...finalize };
}

// ─────────────────────────────────────────────────────────────────────
// 3. E-mail + senha (caminho manual)
// ─────────────────────────────────────────────────────────────────────

/**
 * Cria a conta com e-mail/senha. Quando o usuário já estava autenticado
 * anonimamente (signInAnonymously do boot), promove a conta via
 * linkWithCredential para preservar o mesmo UID — isso garante que as
 * reviews anônimas existentes serão vinculadas no backfill.
 *
 * Retorna { uid } pronto para ser passado a `finalizeSocialLogin`.
 */
export async function signUpWithEmailPassword({ email, password }) {
  const normalizedEmail = (email || "").toString().trim().toLowerCase();
  if (!normalizedEmail) throw new Error("E-mail obrigatório.");
  if (!password || password.length < 6) {
    throw new Error("Senha precisa de pelo menos 6 caracteres.");
  }

  // Bloqueia se o e-mail já tem um perfil de outra conta.
  try {
    const byEmail = await getUserProfileByEmail(normalizedEmail);
    if (byEmail && byEmail.id && byEmail.id !== auth?.currentUser?.uid) {
      const err = new Error("Este e-mail já está cadastrado.");
      err.code = "trabalheila/email-already-in-use";
      throw err;
    }
  } catch (lookupErr) {
    // Não bloqueia por falha de lookup; só por colisão real.
    if (lookupErr?.code === "trabalheila/email-already-in-use") throw lookupErr;
  }

  const current = auth?.currentUser;
  let uid = current?.uid;
  if (current && current.isAnonymous) {
    const credential = EmailAuthProvider.credential(normalizedEmail, password);
    const linked = await linkWithCredential(current, credential);
    uid = linked?.user?.uid || uid;
  } else {
    const created = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    uid = created?.user?.uid || uid;
  }

  if (!uid) throw new Error("Não foi possível obter UID após cadastro.");
  return { uid, email: normalizedEmail };
}
