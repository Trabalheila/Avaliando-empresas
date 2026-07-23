import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate, Navigate, useLocation } from "react-router-dom";
import { db, storage, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
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
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getUserRole, isPremium, isAdmin } from "../utils/rbac";
import { resolveProfileId } from "../utils/profileIdentity";
import { findUnifiedProfile } from "../services/users";
import LoginLinkedInButton from "../LoginLinkedInButton";
import { getLinkedInRedirectUri } from "../utils/linkedinAuth";
import { buildApiUrl } from "../utils/apiBase";
import AppHeader from "../components/AppHeader";
import WorkerProfessionalContactSettings from "../components/WorkerProfessionalContactSettings";
import WorkerCasesSection from "../components/Worker/WorkerCasesSection";
import ConsultaAvulsaModal from "../components/ConsultaAvulsaModal";
import ConsultaAvulsaIntroModal from "../components/ConsultaAvulsaIntroModal";
import VerifyIdentitySection from "../components/VerifyIdentitySection";
import ExperienceManagerModal from "../components/ExperienceManagerModal";
import EditProfileModal from "../components/EditProfileModal";
import { buildVideoCallLink, formatStartsIn } from "../utils/videoCall";
import {
  listWorkerCasosEnriched,
  groupCasosByEspecialista,
  casoLabel,
} from "../services/workerCasos";
/* ════════════════════════════════════════════════
   MinhaConta — Página privada "Minha conta"
   ════════════════════════════════════════════════ */

// Comprime/redimensiona a imagem no cliente ANTES do upload.
// Avatares não precisam de mais de ~256px; reduzir o arquivo de vários MB
// (foto de câmera de celular) para ~30-80KB é o que evita os timeouts de
// envio. Retorna { blob, dataUrl } — o blob vai para o Storage e o dataUrl
// serve de fallback (gravável direto no doc do Firestore, < 1MB).
async function compressImage(file, maxDim = 256, quality = 0.82) {
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("read-failed"));
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("decode-failed"));
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
  const w = Math.max(1, Math.round((img.width || 1) * scale));
  const h = Math.max(1, Math.round((img.height || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const outDataUrl = canvas.toDataURL("image/jpeg", quality);
  const blob = await new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    } else {
      resolve(null);
    }
  });
  return { blob, dataUrl: outDataUrl };
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  const ms = toMillis(value);
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getPlanLabel(profile) {
  const role = getUserRole();
  const premium = isPremium();
  if (isAdmin()) return "Administrador";
  if (role === "admin_empresa") return "Premium Empresa (Fundador)";
  if (premium) return "Premium Trabalhador";
  return "Gratuito";
}

function getPlanColor(profile) {
  const role = getUserRole();
  const premium = isPremium();
  if (isAdmin()) return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700";
  if (role === "admin_empresa") return "text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700";
  if (premium) return "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700";
  return "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700";
}

// Determina se o perfil já está conectado/validado pelo LinkedIn. Cobre os
// diferentes campos que o fluxo social grava ao longo do tempo.
function isLinkedInConnected(p) {
  if (!p) return false;
  if (p.loginProvider === "linkedin") return true;
  if (p.verification_provider === "linkedin") return true;
  if (p.verifiedProfileBadgeSource === "linkedin") return true;
  if (Array.isArray(p.linkedinExperiences) && p.linkedinExperiences.length > 0) return true;
  if (Array.isArray(p.linkedAccounts) && p.linkedAccounts.some((a) => a?.provider === "linkedin")) return true;
  return false;
}

export default function MinhaConta({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const location = useLocation();
  const linkedInClientId = process.env.REACT_APP_LINKEDIN_CLIENT_ID;
  const linkedInRedirectUri = getLinkedInRedirectUri();
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);
  // `authResolved` = onAuthStateChanged ja respondeu pelo menos uma vez.
  // Sem isso, o primeiro render (antes do Firebase restaurar a sessao do
  // IndexedDB) considerava user=null e renderizava o cadeado por uma fracao
  // de segundo, causando o bug "volta da Home -> cadeado pisca".
  const [authResolved, setAuthResolved] = useState(false);
  const [authUid, setAuthUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [consultaAvulsaOpen, setConsultaAvulsaOpen] = useState(false);
  const [consultaIntroOpen, setConsultaIntroOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [experienceModalOpen, setExperienceModalOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [avatarError, setAvatarError] = useState("");
  const [linkedInError, setLinkedInError] = useState("");
  const avatarInputRef = useRef(null);

  // Carregar dados
  useEffect(() => {
    let cancelled = false;

    async function load(uid) {
      // Sem uid resolvido: nao tente carregar. RequireAuth ja redireciona
      // usuarios anonimos para /login, entao se chegamos aqui sem uid e
      // porque o Firebase ainda esta restaurando a sessao.
      if (!uid) {
        if (!cancelled) setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
        // Ordem de preferência para localizar o doc do usuário no Firestore:
        // 1) profileId já persistido (canonical); 2) resolveProfileId via
        // email/id do perfil em cache; 3) uid do Firebase Auth (cobre o
        // caso em que o cache local sumiu mas o usuário continua logado).
        const profileId =
          stored?.profileId ||
          resolveProfileId(stored, { persistGeneratedId: false }) ||
          uid;

        if (!profileId) {
          if (!cancelled) {
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        // Buscar perfil do Firestore — tenta pelo profileId resolvido e,
        // se não existir, tenta também pelo uid do Auth como fallback.
        let userSnap = await getDoc(doc(db, "users", profileId));
        let resolvedId = profileId;
        if (!userSnap.exists() && uid && uid !== profileId) {
          const altSnap = await getDoc(doc(db, "users", uid));
          if (altSnap.exists()) {
            userSnap = altSnap;
            resolvedId = uid;
          }
        }

        // Fallback adicional: especialistas (advogados, psicólogos etc.) tem
        // o perfil persistido em `apoiadores` (legado) — campo `uid` aponta
        // para o Firebase Auth UID. Sem este fallback, o login do tipo
        // "Sou Especialista" cai na tela "Você precisa criar um perfil".
        let apoiadorData = null;
        if (!userSnap.exists() && uid) {
          try {
            const apoSnap = await getDocs(
              query(collection(db, "apoiadores"), where("uid", "==", uid), limit(1))
            );
            if (!apoSnap.empty) {
              const d = apoSnap.docs[0];
              apoiadorData = { id: d.id, ...(d.data() || {}) };
              resolvedId = d.id;
            }
          } catch { /* ignore */ }
        }

        // Fallback final por email: cobre o cenario em que o doc de users/
        // foi criado com id alternativo (ex.: "email:foo@bar") e o cache
        // local nao tem profileId — caso classico do bug em que o usuario
        // clica em "Minha Conta" no mobile e e jogado em /pseudonym mesmo
        // logado (sessao Firebase ok via IndexedDB).
        let unifiedByEmail = null;
        if (!userSnap.exists() && !apoiadorData) {
          const authEmail = (auth.currentUser?.email || stored?.email || "").toString().trim();
          if (authEmail) {
            try {
              unifiedByEmail = await findUnifiedProfile({ email: authEmail });
              if (unifiedByEmail) resolvedId = unifiedByEmail.id || resolvedId;
            } catch { /* ignore */ }
          }
        }

        if (!userSnap.exists() && !apoiadorData && !unifiedByEmail && !stored?.pseudonimo && !stored?.pseudonym && !stored?.email) {
          // Nenhuma fonte forneceu perfil — pode ser perfil legitimo
          // invisivel ao cliente (rules de users/{uid} bloqueiam leituras
          // por id alternativo `email:xxx` e por `where("email","==",x)`)
          // ou cache local apagado pelo mobile sob pressao de memoria.
          // NAO redireciona para /pseudonym (causava loop em mobile):
          // sintetiza profile minimo a partir de `auth.currentUser` para
          // que o painel renderize. O usuario logado nunca fica preso.
          if (!cancelled) {
            const cu = auth.currentUser || {};
            setProfile({
              id: cu.uid || uid,
              uid: cu.uid || uid,
              email: cu.email || "",
              pseudonimo: "",
              avatar: cu.photoURL || "",
              picture: cu.photoURL || "",
              photoURL: cu.photoURL || "",
              nomeReal: cu.displayName || "",
              fullName: cu.displayName || "",
            });
            setLoading(false);
          }
          return;
        }

        const userData = userSnap.exists()
          ? { id: userSnap.id, ...userSnap.data() }
          : apoiadorData
            ? {
                ...apoiadorData,
                // Normaliza campos esperados por esta página.
                pseudonimo: apoiadorData.pseudonimo || apoiadorData.nome || stored?.pseudonym || "",
                userType: "apoiador",
                isApoiador: true,
              }
            : unifiedByEmail
              ? { ...unifiedByEmail }
              : { id: resolvedId, ...stored };

        if (!cancelled) setProfile(userData);

        // Buscar avaliações. A leitura primária é por `authorProfileId`
        // (campo canônico gravado no momento da avaliação). Como em alguns
        // cenários o `authorProfileId` pode ter sido salvo vazio (perfil sem
        // profileId canônico no momento da avaliação) enquanto o doc carrega
        // o `uid` do Firebase Auth (sempre gravado por `saveReview`),
        // executamos também uma busca por `uid` e mesclamos os resultados,
        // deduplicando pelo id do documento. Sem isso, avaliações válidas
        // ficavam invisíveis no "Histórico de Avaliações".
        //
        // Caso adicional crítico: a avaliação pode ter sido gravada enquanto
        // o usuário estava autenticado ANONIMAMENTE (saveReview faz
        // signInAnonymously quando não há sessão). Nesse caso o `uid` salvo
        // no doc é o uid anônimo — diferente do uid real após o login — e o
        // `authorProfileId` ficou vazio. O único elo confiável é o
        // `pseudonym` (identidade pública). Por isso buscamos também por
        // `pseudonym == <pseudônimo do perfil>` e mesclamos.
        const profilePseudonym = (
          userData?.pseudonimo ||
          userData?.pseudonym ||
          stored?.pseudonimo ||
          stored?.pseudonym ||
          ""
        ).toString().trim();
        const reviewsRef = collection(db, "reviews");
        const reviewQueries = [
          query(reviewsRef, where("authorProfileId", "==", resolvedId), limit(200)),
        ];
        if (uid && uid !== resolvedId) {
          reviewQueries.push(query(reviewsRef, where("uid", "==", uid), limit(200)));
        }
        if (profilePseudonym) {
          reviewQueries.push(query(reviewsRef, where("pseudonym", "==", profilePseudonym), limit(200)));
        }
        const reviewSnaps = await Promise.all(
          reviewQueries.map((rq) => getDocs(rq).catch(() => ({ docs: [] })))
        );
        const reviewsById = new Map();
        for (const snap of reviewSnaps) {
          for (const d of snap.docs) {
            if (!reviewsById.has(d.id)) {
              reviewsById.set(d.id, { id: d.id, ...d.data() });
            }
          }
        }
        const userReviews = Array.from(reviewsById.values())
          .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
        if (!cancelled) setReviews(userReviews);
      } catch (err) {
        console.warn("Erro ao carregar conta:", err);
        // Se a leitura no Firestore falhou (ex.: permission-denied em
        // users/{uid} com id alternativo, ou rede), NÃO deixe `profile`
        // nulo — isso quebrava a renderização (profile.pseudonimo) e
        // resultava em TELA CINZA. Sintetiza um perfil mínimo a partir do
        // usuário autenticado para que o painel sempre renderize.
        if (!cancelled) {
          setProfile((prev) => {
            if (prev) return prev;
            const cu = auth.currentUser || {};
            return {
              id: cu.uid || uid,
              uid: cu.uid || uid,
              email: cu.email || "",
              pseudonimo: "",
              avatar: cu.photoURL || "",
              picture: cu.photoURL || "",
              photoURL: cu.photoURL || "",
              nomeReal: cu.displayName || "",
              fullName: cu.displayName || "",
            };
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Aguarda o Firebase Auth resolver para podermos usar o uid como
    // fallback quando o cache do localStorage não tem profileId.
    const unsub = onAuthStateChanged(auth, (user) => {
      if (cancelled) return;
      const uid = user?.uid || "";
      setAuthUid(uid);
      setAuthResolved(true);
      load(uid);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Ao chegar com o hash #experiencias (ex.: vindo da tela de conclusão de
  // cadastro), rola suavemente até a seção de experiências profissionais.
  useEffect(() => {
    if (loading) return;
    if (location.hash !== "#experiencias") return;
    const el = document.getElementById("experiencias");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, location.hash]);

  // Resumo
  const summary = useMemo(() => {
    const totalCompanies = new Set(reviews.map((r) => r.companySlug).filter(Boolean)).size;
    const ratings = reviews.map((r) => Number(r.rating)).filter((v) => v >= 1 && v <= 5);
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";
    return { totalCompanies, avgRating, totalReviews: reviews.length };
  }, [reviews]);

  // Ao conectar o LinkedIn, re-dispara a verificação das avaliações JÁ
  // existentes (best-effort). O endpoint compara a empresa avaliada com o
  // histórico profissional do LinkedIn e marca `isVerifiedLinkedIn=true` nas
  // reviews correspondentes. Roda uma vez por sessão para não repetir.
  useEffect(() => {
    if (!isLinkedInConnected(profile)) return;
    if (!Array.isArray(reviews) || reviews.length === 0) return;
    const uid = auth.currentUser?.uid || profile?.uid || profile?.id || "";
    if (!uid) return;
    const flagKey = `linkedin_reviews_reverified_${uid}`;
    try {
      if (sessionStorage.getItem(flagKey)) return;
      sessionStorage.setItem(flagKey, "1");
    } catch {
      /* ignore storage failures */
    }
    reviews.forEach((review) => {
      if (!review?.id || review?.isVerifiedLinkedIn) return;
      try {
        fetch(buildApiUrl("/api/verify-review-linkedin"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewId: review.id, uid }),
          keepalive: true,
        }).catch(() => {
          /* best-effort */
        });
      } catch {
        /* ignore */
      }
    });
  }, [profile, reviews]);

  // Avatar
  const avatarDisplay = useMemo(() => {
    const av = profile?.avatar || profile?.picture || profile?.photoURL || "";
    if (av && (av.startsWith("data:") || av.startsWith("http"))) {
      return <img src={av} alt="avatar" className="h-20 w-20 rounded-full object-cover border-2 border-blue-200 dark:border-slate-600" referrerPolicy="no-referrer" />;
    }
    if (av && av.length <= 4) {
      return <span className="text-5xl">{av}</span>;
    }
    return <span className="h-20 w-20 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-4xl">👤</span>;
  }, [profile]);

  const handleViewPublicProfile = useCallback(() => {
    const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
    const pid = stored?.profileId || resolveProfileId(stored, { persistGeneratedId: false });
    if (pid) navigate(`/perfil/${encodeURIComponent(pid)}`);
  }, [navigate]);

  // Upload de avatar (Firebase Storage -> users/{uid}.avatar)
  const handleAvatarFile = useCallback(async (event) => {
    const file = event?.target?.files?.[0];
    if (event?.target) event.target.value = "";
    if (!file) return;
    setAvatarError("");

    if (!file.type.startsWith("image/")) {
      setAvatarError("Selecione um arquivo de imagem (JPG, PNG, WEBP…).");
      return;
    }
    const MAX_BYTES = 10 * 1024 * 1024; // 10MB de entrada — comprimimos depois
    if (file.size > MAX_BYTES) {
      setAvatarError("Imagem muito grande (máximo 10MB). Tente outra foto.");
      return;
    }

    const authUid = auth.currentUser?.uid || "";
    const docId = profile?.id || authUid;
    // Para o Firebase Storage usamos SEMPRE o uid do Auth, porque as regras
    // padr\u00e3o (avatars/{uid}) checam `request.auth.uid == uid`. Usar o
    // profileId (que pode ser `email:xxx`) gera permission-denied silencioso.
    const storageUid = authUid || docId;
    if (!docId || !storageUid) {
      setAvatarError("Perfil n\u00e3o identificado. Fa\u00e7a login novamente.");
      return;
    }

    setUploadingAvatar(true);
    setUploadProgress(0);

    // 1) Comprime no cliente ANTES de enviar. Reduz drasticamente o tamanho
    //    (foto de celular de 4-8MB → ~30-80KB), que é a causa real dos
    //    timeouts. Também produz um dataUrl usado como fallback.
    let compressed = null;
    try {
      compressed = await compressImage(file, 256, 0.82);
    } catch (err) {
      console.warn("Falha ao comprimir avatar; tentando enviar original:", err);
    }
    const uploadBlob = compressed?.blob || file;
    const fallbackDataUrl = compressed?.dataUrl || "";

    // Persiste a URL final (Storage ou dataURL) no Firestore + cache local.
    const persistAvatar = async (url) => {
      // setDoc(merge) em vez de updateDoc: updateDoc lança "No document to
      // update" quando o doc ainda não existe (perfil recém-criado / id
      // alternativo), fazendo a foto NÃO persistir. Carimbamos `uid`/`email`
      // para satisfazer as regras do Firestore (ownsUserDoc) e gravamos tanto
      // `avatar` quanto `photoURL` para manter o campo consistente em toda a app.
      const cu = auth.currentUser || {};
      await setDoc(
        doc(db, "users", docId),
        {
          avatar: url,
          photoURL: url,
          ...(cu.uid ? { uid: cu.uid } : {}),
          ...(cu.email ? { email: cu.email } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setProfile((prev) => (prev ? { ...prev, avatar: url, photoURL: url } : prev));
      try {
        const stored = JSON.parse(localStorage.getItem("userProfile") || "{}");
        localStorage.setItem(
          "userProfile",
          JSON.stringify({ ...stored, avatar: url, photoURL: url })
        );
        window.dispatchEvent(new Event("trabalheiLa_user_updated"));
      } catch {
        /* ignore */
      }
    };

    try {
      const ref = storageRef(storage, `avatars/${storageUid}/avatar-${Date.now()}.jpg`);

      // uploadBytesResumable + Promise expl\u00edcito: emite progresso e permite
      // anexar um timeout de seguran\u00e7a (45s, suficiente para um arquivo j\u00e1
      // comprimido) para n\u00e3o deixar a UI presa em "enviando".
      const task = uploadBytesResumable(ref, uploadBlob, { contentType: "image/jpeg" });
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          try { task.cancel(); } catch { /* ignore */ }
          reject(new Error("timeout"));
        }, 45000);
        task.on(
          "state_changed",
          (snap) => {
            if (snap.totalBytes > 0) {
              setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
            }
          },
          (err) => { clearTimeout(timeoutId); reject(err); },
          () => { clearTimeout(timeoutId); resolve(); }
        );
      });

      const url = await getDownloadURL(ref);
      await persistAvatar(url);
    } catch (err) {
      console.error("Falha no upload do avatar via Storage:", err);

      // Fallback: se o Storage falhar (timeout, CORS, regras, rede), grava a
      // imagem comprimida como dataURL direto no doc do usu\u00e1rio. Como ela j\u00e1
      // foi reduzida para ~256px JPEG, cabe folgadamente no limite de 1MB do
      // Firestore — e o usu\u00e1rio consegue salvar a foto mesmo assim.
      if (fallbackDataUrl && fallbackDataUrl.length < 900 * 1024) {
        try {
          await persistAvatar(fallbackDataUrl);
          setAvatarError("");
          setUploadingAvatar(false);
          setUploadProgress(0);
          return;
        } catch (fallbackErr) {
          console.error("Fallback de avatar (dataURL) tamb\u00e9m falhou:", fallbackErr);
        }
      }

      const code = err?.code || err?.message || "";
      let msg = "N\u00e3o foi poss\u00edvel enviar a imagem. Tente novamente.";
      if (/timeout/i.test(code)) {
        msg = "O envio demorou demais. Verifique sua conex\u00e3o e tente de novo.";
      } else if (/unauthorized|permission/i.test(code)) {
        msg = "Sem permiss\u00e3o para enviar a imagem. Fa\u00e7a login novamente.";
      } else if (/quota/i.test(code)) {
        msg = "Cota do armazenamento excedida. Tente mais tarde.";
      } else if (/network|retry-limit|canceled/i.test(code)) {
        msg = "Falha de rede ao enviar a imagem. Tente novamente.";
      }
      setAvatarError(msg);
    } finally {
      setUploadingAvatar(false);
      setUploadProgress(0);
    }
  }, [profile]);

  // Loading: espera o Firebase Auth resolver E o load() terminar.
  // Importante: NUNCA renderize o cadeado enquanto authResolved=false,
  // sen\u00e3o vai piscar a tela "Crie um perfil" antes do Firebase restaurar
  // a sess\u00e3o do IndexedDB.
  if (loading || !authResolved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
        <AppHeader theme={theme} toggleTheme={toggleTheme} />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div
            aria-hidden="true"
            className="h-10 w-10 rounded-full border-2 border-blue-200 dark:border-slate-700 border-t-blue-600 dark:border-t-blue-400 animate-spin"
          />
          <div className="text-slate-500 dark:text-slate-400 text-sm">Carregando seu painel…</div>
        </div>
      </div>
    );
  }

  // Auth confirmou que n\u00e3o h\u00e1 usu\u00e1rio: deveria j\u00e1 estar redirecionado por
  // RequireAuth, mas como guarda redundante mandamos para /login em vez
  // de mostrar o cadeado (que era ambiguo \u2014 podia significar tanto "n\u00e3o
  // logado" quanto "sem perfil").
  if (!authUid) {
    return <Navigate to="/login" replace state={{ from: "/minha-conta" }} />;
  }

  // Guarda defensivo: em nenhuma hipótese renderize com `profile` nulo —
  // acessar `profile.pseudonimo` abaixo lançaria "Cannot read properties of
  // null" e produziria a TELA CINZA. Se chegamos aqui autenticados mas sem
  // profile (ex.: exceção no carregamento), sintetiza o mínimo a partir do
  // usuário do Firebase Auth.
  const safeProfile =
    profile || {
      id: auth.currentUser?.uid || authUid,
      uid: auth.currentUser?.uid || authUid,
      email: auth.currentUser?.email || "",
      pseudonimo: "",
      avatar: auth.currentUser?.photoURL || "",
      picture: auth.currentUser?.photoURL || "",
      photoURL: auth.currentUser?.photoURL || "",
      nomeReal: auth.currentUser?.displayName || "",
      fullName: auth.currentUser?.displayName || "",
    };

  // Nunca cair em `profile.name` aqui: esse campo pode ter sido um dia
  // populado com o nome real vindo do Google/LinkedIn. Pseudônimo só
  // a partir de `profile.pseudonimo`.
  const pseudonym = safeProfile.pseudonimo || "Anônimo";
  const memberSince = formatDate(safeProfile.createdAt || safeProfile.updatedAt);
  const planLabel = getPlanLabel(safeProfile);
  const planColor = getPlanColor(safeProfile);
  const experiences = safeProfile?.resumeData?.experiencesStructured || [];
  const credibility = safeProfile?.credibilityIndex || "—";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-slate-900 flex flex-col">
      <AppHeader theme={theme} toggleTheme={toggleTheme} title="Minha Conta" />

      <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ══════ Meus Casos (somente leitura) ══════ */}
        <WorkerCasesSection workerUid={authUid} />

        {/* ══════ Dados do Perfil ══════ */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="flex flex-col items-center gap-2">
              {avatarDisplay}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline disabled:opacity-60 disabled:no-underline"
              >
                {uploadingAvatar
                  ? uploadProgress > 0
                    ? `Enviando… ${uploadProgress}%`
                    : "Enviando…"
                  : "Trocar foto"}
              </button>
              {uploadingAvatar && (
                <div
                  className="w-28 h-1.5 rounded-full bg-blue-100 dark:bg-slate-700 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-200"
                    style={{ width: `${Math.max(8, uploadProgress)}%` }}
                  />
                </div>
              )}
              {!uploadingAvatar && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center max-w-[10rem]">
                  JPG, PNG ou WEBP · até 10MB
                </p>
              )}
              {avatarError && (
                <p className="text-xs text-red-600 dark:text-red-400 max-w-[10rem] text-center">{avatarError}</p>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-extrabold text-blue-800 dark:text-blue-200 tracking-wide">
                {pseudonym}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Membro desde {memberSince}
              </p>
              {safeProfile?.email && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {safeProfile.email}
                </p>
              )}
              {credibility && credibility !== "—" && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Índice de credibilidade: <span className="font-semibold capitalize">{credibility === "confiavel" ? "Confiável" : credibility === "neutro" ? "Neutro" : credibility === "atencao" ? "Atenção" : credibility}</span>
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditProfileOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Meu perfil profissional
              </button>
              <button
                type="button"
                onClick={handleViewPublicProfile}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Ver perfil público
              </button>
            </div>
          </div>
        </section>

        {/* ══════ Plano Atual ══════ */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Plano Atual
          </h2>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold ${planColor}`}>
            {planLabel}
          </div>
          {!isPremium() && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate("/escolha-perfil?planos=1")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Fazer upgrade
              </button>
              <div className="relative inline-flex items-center group">
                <button
                  type="button"
                  onClick={() => setConsultaIntroOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900 text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Consulta Avulsa
                </button>
                <span
                  tabIndex={0}
                  role="button"
                  aria-label="Sobre Consulta Avulsa"
                  className="ml-1.5 inline-flex items-center justify-center h-6 w-6 rounded-full text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/40 cursor-help focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 z-20 w-64 max-w-[80vw] px-3 py-2 rounded-xl bg-slate-900 text-white text-xs leading-snug shadow-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition"
                  >
                    Agende um atendimento individual com um especialista para tirar dúvidas pontuais ou enviar provas de forma segura. Pagamento processado pela plataforma.
                  </span>
                </span>
              </div>
            </div>
          )}
          {!isPremium() && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              <strong>Consulta Avulsa</strong> é uma interação pontual com um
              especialista (sujeita a aceite do profissional). A
              <strong> consulta com acompanhamento</strong> e a escolha
              avançada de profissionais são exclusivas do Plano Premium.
            </p>
          )}
        </section>

        {/* ══════ Validar avaliações com o LinkedIn ══════ */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-[#0A66C2]" aria-hidden="true">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
            </svg>
            Validar avaliações com o LinkedIn
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
            Conecte sua conta do LinkedIn para dar mais credibilidade às suas
            avaliações. Quando o nome de uma empresa avaliada corresponder a uma
            experiência do seu perfil, a avaliação recebe o selo{" "}
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              ✓ Profissional Verificado via LinkedIn
            </span>
            . Seus dados do LinkedIn permanecem privados — apenas o selo é exibido.
          </p>

          {isLinkedInConnected(safeProfile) ? (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-4 py-3">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-[#0A66C2] shrink-0" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  LinkedIn conectado
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Suas avaliações são validadas automaticamente pelo seu histórico profissional.
                </p>
              </div>
            </div>
          ) : !linkedInClientId ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              A integração com o LinkedIn não está configurada no momento.
            </p>
          ) : (
            <div className="max-w-xs">
              <LoginLinkedInButton
                clientId={linkedInClientId}
                redirectUri={linkedInRedirectUri}
                onLoginSuccess={({ code } = {}) => {
                  // O fluxo padrão retorna à Home (/?linkedin_code=...), onde a
                  // conexão é finalizada. Se, por algum caminho de popup, o code
                  // chegar aqui, encaminhamos para a Home concluir.
                  if (code) navigate(`/?linkedin_code=${encodeURIComponent(code)}`);
                }}
                onLoginFailure={(err) =>
                  setLinkedInError(err?.message || "Falha ao conectar com o LinkedIn.")
                }
              />
              {linkedInError && (
                <p className="text-red-600 text-xs mt-2">{linkedInError}</p>
              )}
            </div>
          )}
        </section>

        <ConsultaAvulsaIntroModal
          open={consultaIntroOpen}
          onClose={() => setConsultaIntroOpen(false)}
          onContinue={() => {
            setConsultaIntroOpen(false);
            setConsultaAvulsaOpen(true);
          }}
        />

        <ConsultaAvulsaModal
          open={consultaAvulsaOpen}
          onClose={() => setConsultaAvulsaOpen(false)}
          worker={safeProfile}
        />

        <EditProfileModal
          open={editProfileOpen}
          onClose={() => setEditProfileOpen(false)}
          profile={safeProfile}
          onSaved={(next) => setProfile(next)}
        />

        {/* ══════ GRADE DE 2 COLUNAS (DESKTOP) — usa CSS columns para preencher
            os espaços vazios em masonry; cada card evita quebra interna. No
            mobile permanece em coluna única. ══════ */}
        <div className="lg:columns-2 lg:gap-6 [&>*]:break-inside-avoid [&>*]:mb-6">

        {/* ══════ Próxima Videochamada (Premium) ══════ */}
        <NextVideoCallSection profile={safeProfile} navigate={navigate} />

        {/* ══════ Atendimentos Ativos ══════ */}
        <ActiveServicesSection profile={safeProfile} navigate={navigate} />

        {/* ══════ Contatos Liberados ══════ */}
        <ReleasedContactsSection profile={safeProfile} />

        {/* ══════ Minhas Experiências Profissionais ══════ */}
        <section id="experiencias" className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Minhas Experiências Profissionais
            </h2>
            <button
              type="button"
              onClick={() => setExperienceModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Adicionar Experiência
            </button>
          </div>

          {experiences.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-6">
              Nenhuma experiência profissional adicionada.
            </p>
          ) : (
            <ul className="space-y-2">
              {experiences.map((exp, i) => {
                const isVerified = exp.verified || exp.source === "linkedin";
                return (
                  <li
                    key={`${exp.company}-${exp.role}-${i}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
                        {exp.company || "—"}
                      </p>
                      {exp.role && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {exp.role}
                        </p>
                      )}
                    </div>
                    {isVerified ? (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700"
                        title="Experiência verificada via LinkedIn"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Verificada
                      </span>
                    ) : (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600"
                        title="Adicionada manualmente — não verificada"
                      >
                        Não verificada
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <ExperienceManagerModal
          open={experienceModalOpen}
          onClose={() => setExperienceModalOpen(false)}
          profile={safeProfile}
          onSaved={(next) => setProfile(next)}
        />

        {/* ══════ Histórico de Avaliações ══════ */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Histórico de Avaliações
          </h2>

          {reviews.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-6">
              Você ainda não avaliou nenhuma empresa.
            </p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <button
                  key={review.id}
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (review.company) params.set("name", review.company);
                    if (review.companySlug) params.set("slug", review.companySlug);
                    navigate(`/empresa?${params.toString()}`);
                  }}
                  className="w-full text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 transition p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 truncate">
                      {review.company || review.companySlug}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-sm ${star <= Number(review.rating) ? "text-amber-400" : "text-slate-300 dark:text-slate-600"}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {formatDate(review.createdAt)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ══════ Resumo ══════ */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Resumo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-blue-100 dark:border-slate-700 bg-blue-50 dark:bg-slate-800 p-4 text-center">
              <p className="text-3xl font-extrabold text-blue-700 dark:text-blue-300">{summary.totalCompanies}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Empresas avaliadas</p>
            </div>
            <div className="rounded-2xl border border-blue-100 dark:border-slate-700 bg-blue-50 dark:bg-slate-800 p-4 text-center">
              <p className="text-3xl font-extrabold text-blue-700 dark:text-blue-300">{summary.avgRating}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Média das notas</p>
            </div>
            <div className="rounded-2xl border border-blue-100 dark:border-slate-700 bg-blue-50 dark:bg-slate-800 p-4 text-center">
              <p className="text-3xl font-extrabold text-blue-700 dark:text-blue-300">{summary.totalReviews}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Avaliações realizadas</p>
            </div>
          </div>
        </section>

        {/* ══════ Contato por profissionais (Premium Trabalhador) ══════ */}
        <WorkerProfessionalContactSettings
          profileId={safeProfile?.id}
          isPremium={isPremium() && getUserRole() !== "admin_empresa"}
          onUpgradeClick={() => navigate("/escolha-perfil?planos=1")}
        />

        {/* ══════ Verificar identidade (CPF opcional) ══════ */}
        <VerifyIdentitySection profile={safeProfile} onUpdated={setProfile} />

        {/* ══════ Ações ══════ */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
          <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4">Ações</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate("/escolha-perfil?planos=1")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700"
            >
              Ver planos e benefícios
            </button>
            <button
              type="button"
              onClick={() => navigate("/excluir-dados")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/40 transition border border-red-200 dark:border-red-800"
            >
              Excluir meus dados
            </button>
          </div>
        </section>

        </div>

      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   ReleasedContactsSection
   ────────────────────────────────────────────────
   Lista os contatos de especialistas liberados ao trabalhador
   após o pagamento aprovado de uma consulta. Lê a subcoleção
   users/{uid}/releasedContacts (gravada pelo webhook do
   Mercado Pago). Exibe e-mail e WhatsApp do especialista.
   ════════════════════════════════════════════════ */
function ReleasedContactsSection({ profile }) {
  const navigate = useNavigate();
  const uid = auth.currentUser?.uid || profile?.uid || profile?.id || "";
  const [specialists, setSpecialists] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [snap, casos] = await Promise.all([
          getDocs(collection(db, "users", uid, "releasedContacts")).catch(
            () => ({ docs: [] })
          ),
          listWorkerCasosEnriched(uid).catch(() => []),
        ]);
        if (cancelled) return;

        // Diretório único por especialista. Chave = especialistaId (id do doc
        // apoiadores/{id}); mescla dados dos casos e dos contatos liberados.
        const byEspecialista = new Map();
        const ensure = (key) => {
          const k = String(key || "");
          if (!k) return null;
          if (!byEspecialista.has(k)) {
            byEspecialista.set(k, {
              especialistaId: k,
              nomeDoEspecialista: "Especialista",
              specialtyId: "",
              email: "",
              whatsapp: "",
              casosCount: 0,
            });
          }
          return byEspecialista.get(k);
        };

        // 1) A partir dos casos (agrupados por especialista).
        for (const group of groupCasosByEspecialista(casos)) {
          const entry = ensure(group.especialistaId);
          if (!entry) continue;
          entry.nomeDoEspecialista = group.nomeDoEspecialista;
          entry.specialtyId = group.specialtyId;
          entry.casosCount = group.casos.length;
        }

        // 2) A partir dos contatos liberados (e-mail/WhatsApp).
        const released = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        for (const c of released) {
          const entry = ensure(c.apoiadorId);
          if (!entry) continue;
          if (c.apoiadorNome) entry.nomeDoEspecialista = c.apoiadorNome;
          if (c.especialidade && !entry.specialtyId)
            entry.specialtyId = c.especialidade;
          if (c.especialistaEmail) entry.email = c.especialistaEmail;
          if (c.especialistaWhatsapp) entry.whatsapp = c.especialistaWhatsapp;
        }

        setSpecialists(Array.from(byEspecialista.values()));
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
      <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Contatos Liberados
      </h2>

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">
          Carregando contatos…
        </p>
      ) : specialists.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhum contato liberado ainda. Ao contratar uma consulta ou ter um
          pedido aceito por um especialista, ele aparece aqui — uma entrada por
          especialista, com todos os seus casos reunidos.
        </p>
      ) : (
        <ul className="space-y-3">
          {specialists.map((s) => {
            const waDigits = String(s.whatsapp || "").replace(/\D/g, "");
            return (
              <li
                key={s.especialistaId}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 break-words">
                      {s.nomeDoEspecialista}
                    </p>
                    {s.specialtyId && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ⚖️ {s.specialtyId}
                      </p>
                    )}
                    {s.casosCount > 0 && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold mt-0.5">
                        {s.casosCount} caso{s.casosCount === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/trabalhador/especialista/${encodeURIComponent(
                          s.especialistaId
                        )}/casos`
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition shrink-0"
                  >
                    Ver casos →
                  </button>
                </div>

                {(s.email || s.whatsapp) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.email && (
                      <a
                        href={`mailto:${s.email}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30 break-all"
                      >
                        📧 {s.email}
                      </a>
                    )}
                    {s.whatsapp && (
                      <a
                        href={`https://wa.me/${waDigits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                      >
                        📱 {s.whatsapp}
                      </a>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════
   ActiveServicesSection
   ────────────────────────────────────────────────
   Card "Atendimentos Ativos". Lista os especialistas com
   contato ativo (pedidos Ad Exitum aceitos). Cada item traz
   um botão que leva à página dedicada do especialista
   (/trabalhador/especialista/:apoiadorId), onde o trabalhador
   acompanha o caso e envia documentos (pessoais e do processo).
   ════════════════════════════════════════════════ */
function ActiveServicesSection({ profile, navigate }) {
  const uid = auth.currentUser?.uid || profile?.uid || profile?.id || "";
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!uid) return undefined;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const casos = await listWorkerCasosEnriched(uid).catch(() => []);
        // "Atendimentos Ativos": exclui apenas os finalizados.
        const ativos = casos.filter((c) => c.status !== "finalizado");
        if (!cancelled) setGroups(groupCasosByEspecialista(ativos));
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const openCaso = (especialistaId, casoId) => {
    const params = casoId
      ? `?caso=${encodeURIComponent(casoId)}`
      : "";
    navigate(
      `/trabalhador/especialista/${encodeURIComponent(especialistaId)}${params}`
    );
  };

  const totalCasos = groups.reduce((acc, g) => acc + g.casos.length, 0);

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
      <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-3-6.65" />
        </svg>
        Atendimentos Ativos
        {totalCasos > 0 && (
          <span className="ml-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            ({totalCasos} caso{totalCasos === 1 ? "" : "s"})
          </span>
        )}
      </h2>

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">
          Carregando atendimentos…
        </p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Você ainda não tem atendimentos ativos. Quando um especialista aceitar
          o seu pedido, cada caso aparecerá aqui — agrupado por especialista —
          com uma página dedicada para acompanhar e enviar documentos.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.especialistaId}>
              {/* Cabeçalho do especialista */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 break-words">
                    {g.nomeDoEspecialista}
                  </p>
                  {g.specialtyId && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ⚖️ {g.specialtyId}
                    </p>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                  {g.casos.length} caso{g.casos.length === 1 ? "" : "s"}
                </span>
              </div>

              {/* Casos individuais do especialista */}
              <ul className="space-y-2">
                {g.casos.map((c, idx) => (
                  <li
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">
                        {casoLabel(c, idx)}
                      </p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold mt-0.5">
                        ● {c.status === "pendente" ? "Pendente" : "Ativo"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCaso(g.especialistaId, c.casoId || c.id)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition shrink-0"
                    >
                      Abrir atendimento →
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}



/* ════════════════════════════════════════════════
   NextVideoCallSection
   ────────────────────────────────────────────────
   Lista as consultas aceitas pelo especialista para este
   trabalhador. Para cada consulta exibe os dados básicos
   (especialidade, data, formato) e:
   - Trabalhador Premium: botão "Acessar Videochamada"
     abrindo a sala única daquela consulta + contagem
     "Começa em X minutos" quando próximo do horário.
   - Trabalhador Gratuito/Essencial: oculta o botão e
     exibe upgrade com link para /trabalhador/beneficios.
   ════════════════════════════════════════════════ */
function NextVideoCallSection({ profile, navigate }) {
  const workerIsPremium = isPremium();
  const workerId = profile?.id || profile?.profileId || "";
  const [consultas, setConsultas] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workerId) return undefined;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const q1 = query(
          collection(db, "consultas"),
          where("workerId", "==", workerId),
          where("status", "in", ["accepted", "in_progress"]),
          limit(20)
        );
        const snap = await getDocs(q1);
        if (!cancelled) {
          setConsultas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        }
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workerId]);

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 border border-blue-100 dark:border-slate-700">
      <h2 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Minhas Videochamadas
      </h2>

      {!workerIsPremium ? (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            🔒 Acesso a videochamadas é um benefício exclusivo do{" "}
            <strong>Plano Premium</strong>. Faça upgrade para se conectar com
            seu especialista por vídeo.
          </p>
          <button
            type="button"
            onClick={() => navigate("/trabalhador/beneficios")}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition"
          >
            Conhecer o Plano Premium
          </button>
        </div>
      ) : loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">
          Carregando agenda…
        </p>
      ) : consultas.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nenhuma videochamada agendada no momento.
        </p>
      ) : (
        <ul className="space-y-3">
          {consultas.map((c) => {
            const link = buildVideoCallLink(c.id, c.videoCallLink);
            const startsIn = formatStartsIn(c.scheduledFor);
            const when =
              c.scheduledFor?.toDate?.().toLocaleString("pt-BR") ||
              c.createdAt?.toDate?.().toLocaleString("pt-BR") ||
              "";
            return (
              <li
                key={c.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                    {c.apoiadorNome || c.especialidade || "Consulta agendada"}
                  </p>
                  {c.especialidade && c.apoiadorNome && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {c.especialidade}
                    </p>
                  )}
                  {when && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {when}
                    </p>
                  )}
                  {startsIn && (
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {startsIn}
                    </p>
                  )}
                </div>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition shrink-0"
                >
                  🎥 Acessar Videochamada
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}



