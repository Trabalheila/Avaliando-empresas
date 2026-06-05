// /api/admin.js
// Endpoint administrativo consolidado.
// Sub-rotas via query param `?op=delete` ou `?op=reviews`.
// - op=delete   : exclui documentos via Firebase Admin SDK (apenas ADMIN_UID).
// - op=reviews  : retorna agregados de avaliações por mês (acesso premium).

let _adminAppPromise = null;

async function ensureAdmin() {
  if (_adminAppPromise) return _adminAppPromise;
  _adminAppPromise = (async () => {
    const { initializeApp, getApps, cert } = await import("firebase-admin/app");
    const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        }),
      });
    }
    return { db: getFirestore(), FieldValue };
  })();
  return _adminAppPromise;
}

async function handleDelete(req, res) {
  const { uid, collectionName, docId } = req.body || {};

  if (!uid || !collectionName || !docId) {
    return res.status(400).json({ error: "uid, collectionName e docId são obrigatórios." });
  }

  const ALLOWED_COLLECTIONS = ["reviews", "comments", "consultores", "prestadores", "apoiadores"];
  if (!ALLOWED_COLLECTIONS.includes(collectionName)) {
    return res.status(400).json({ error: "Coleção não permitida." });
  }

  const adminUid = (process.env.REACT_APP_ADMIN_UID || process.env.ADMIN_UID || "").trim();
  if (!adminUid || uid !== adminUid) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }

  try {
    const { db } = await ensureAdmin();
    const docRef = db.collection(collectionName).doc(docId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return res.status(404).json({ error: "Documento não encontrado." });
    }
    await docRef.delete();
    return res.status(200).json({ success: true, deleted: docId });
  } catch (err) {
    console.error("[admin/delete] erro:", err);
    return res.status(500).json({ error: "Erro interno ao excluir documento." });
  }
}

async function handleReviews(req, res) {
  const { companySlug, is_premium, periodStart, periodEnd } = req.body || {};

  if (!is_premium) {
    return res.status(403).json({ error: "Acesso restrito ao plano premium." });
  }
  if (!companySlug) {
    return res.status(400).json({ error: "companySlug é obrigatório." });
  }

  try {
    const { db } = await ensureAdmin();
    const ref = db.collection("reviews");
    let q = ref.where("companySlug", "==", companySlug);
    if (periodStart) q = q.where("createdAt", ">=", new Date(periodStart));
    if (periodEnd) q = q.where("createdAt", "<=", new Date(periodEnd));

    const snap = await q.orderBy("createdAt", "asc").limit(500).get();
    const METRIC_KEYS = [
      "comunicacao", "etica", "salario", "cultura", "saudeBemEstar",
      "lideranca", "ambiente", "estimacaoOrganizacao", "desenvolvimento",
      "reconhecimento", "equilibrio", "diversidade", "rating",
    ];

    const byMonth = {};
    for (const d of snap.docs) {
      const data = d.data();
      const ts = data.createdAt?.toDate?.() || new Date(data.createdAt || "");
      if (!ts || isNaN(ts.getTime())) continue;
      const monthKey = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { count: 0, totals: Object.fromEntries(METRIC_KEYS.map((k) => [k, 0])) };
      }
      byMonth[monthKey].count += 1;
      for (const key of METRIC_KEYS) {
        byMonth[monthKey].totals[key] += Number(data[key]) || 0;
      }
    }

    const trend = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { count, totals }]) => ({
        month,
        count,
        averages: Object.fromEntries(
          METRIC_KEYS.map((key) => [key, count > 0 ? Number((totals[key] / count).toFixed(2)) : 0])
        ),
      }));

    return res.status(200).json({ trend, totalReviews: snap.size });
  } catch (err) {
    console.error("[admin/reviews] erro:", err);
    return res.status(500).json({ error: "Erro interno ao consultar avaliações." });
  }
}

/* ────────────────────────────────────────────────
   Helpers para op=users / op=update-plan
   ──────────────────────────────────────────────── */
function requireAdminUid(uid) {
  const adminUid = (process.env.REACT_APP_ADMIN_UID || process.env.ADMIN_UID || "").trim();
  return Boolean(adminUid) && uid === adminUid;
}

function classifyUserType(data = {}) {
  const role = String(data.role || data.userType || "").toLowerCase();
  if (
    role === "admin_empresa" ||
    data.isEmployer === true ||
    data.managedCompanyId
  ) {
    return "empresa";
  }
  if (
    role === "apoiador" ||
    role === "supporter" ||
    data.is_supporter === true ||
    Boolean(data.apoiadorId)
  ) {
    return "apoiador";
  }
  return "trabalhador";
}

function classifyPlanStatus(data = {}) {
  const isFreePremium = data.is_free_premium === true;
  const isPremium =
    data.is_premium === true ||
    data.is_premium_supporter === true ||
    data.is_premium_worker === true ||
    String(data.apoiadorPlano || data.plano || "").toLowerCase() === "premium";

  if (isFreePremium) return "premium_gratuito";
  if (isPremium) return "premium";
  return "gratuito";
}

function isVerifiedByLinkedIn(data = {}) {
  const provider = String(data.loginProvider || "").toLowerCase();
  if (provider === "linkedin") return true;
  if (data.linkedinProfile || data.linkedInUrl) return true;
  if (Array.isArray(data.linkedinExperiences) && data.linkedinExperiences.length > 0) return true;
  return false;
}

// Computa o nível de verificação 3-tier para o painel admin.
// Retorna { level: "free"|"identity"|"proven", provider: "linkedin"|"google"|null }.
// "proven" só é elevado quando o usuário tem provenCompanies preenchido por
// upload de holerite/CTPS (lógica de upload é tratada em endpoint separado).
function computeVerificationLevel(data = {}) {
  const stored = String(data.verification_level || data.verificationLevel || "").toLowerCase();
  const storedProvider = String(data.verification_provider || "").toLowerCase();
  const provider = String(data.loginProvider || "").toLowerCase();

  let detectedProvider = null;
  if (provider === "linkedin" || data.linkedinProfile || data.linkedInUrl) {
    detectedProvider = "linkedin";
  } else if (provider === "google" || data.googleId || data.googleProfile) {
    detectedProvider = "google";
  } else if (Array.isArray(data.linkedinExperiences) && data.linkedinExperiences.length > 0) {
    detectedProvider = "linkedin";
  }

  const finalProvider = detectedProvider || (storedProvider === "google" || storedProvider === "linkedin" ? storedProvider : null);

  const hasProvenDocs = Array.isArray(data.provenCompanies) && data.provenCompanies.length > 0;
  if (stored === "proven" || hasProvenDocs) {
    return { level: "proven", provider: finalProvider };
  }
  if (stored === "identity" || detectedProvider) {
    return { level: "identity", provider: finalProvider };
  }
  return { level: "free", provider: null };
}

function getDisplayName(data = {}) {
  return (
    data.pseudonym ||
    data.name ||
    data.displayName ||
    data.email ||
    data.managedCompanyName ||
    ""
  );
}

function classifyApprovalStatus(data = {}) {
  // Mapeia o status de cadastro do usuário usando campos já existentes.
  // Buckets de saída: approved (ativo) | rejected (removido) | incomplete (sem pseudônimo nem e-mail)
  const raw = String(data.status || data.approvalStatus || "").toLowerCase();
  const hasPseudonym = Boolean((data.pseudonym || data.pseudonimo || "").toString().trim());
  const hasEmail = Boolean((data.email || "").toString().trim());
  if (raw === "approved" || raw === "aprovado" || raw === "ativo") return "approved";
  if (raw === "rejected" || raw === "reprovado" || raw === "rejeitado" || raw === "removido") return "rejected";
  if (raw === "incomplete" || raw === "incompleto" || raw === "pending" || raw === "pendente") {
    // Cadastro marcado como incompleto/pendente: se na verdade já tem
    // pseudônimo OU e-mail (etapa 1 mínima), eleva para ativo.
    return hasPseudonym || hasEmail ? "approved" : "incomplete";
  }
  // Fallback (docs antigos sem campo status): pseudônimo OU e-mail -> ativo.
  if (hasPseudonym || hasEmail) return "approved";
  if (data.emailVerified === true || data.companyVerifiedAt) return "approved";
  return "incomplete";
}

function pickCreatedAt(data = {}) {
  // Não há um campo `createdAt` garantido em todos os docs de `users`, então
  // fazemos best-effort com os timestamps já presentes.
  const ts =
    data.createdAt ||
    data.emailVerifiedAt ||
    data.companyVerifiedAt ||
    data.freePremiumGrantedAt ||
    data.updatedAt ||
    null;
  if (!ts) return null;
  try {
    if (typeof ts.toDate === "function") return ts.toDate();
    if (ts instanceof Date) return ts;
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

async function handleListUsers(req, res) {
  const {
    uid,
    userType = "todos",
    planStatus = "todos",
    approvalStatus = "todos",
    search = "",
    pageSize = 50,
    cursor = null,
  } = req.body || {};

  if (!requireAdminUid(uid)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }

  try {
    const { db } = await ensureAdmin();
    const limitNum = Math.min(Math.max(parseInt(pageSize, 10) || 50, 1), 200);

    // Busca o lote ordenado por documentId. Os filtros de tipo/plano/busca
    // são aplicados em memória porque dependem de campos heterogêneos.
    let q = db.collection("users").orderBy("__name__").limit(limitNum + 1);
    if (cursor) q = q.startAfter(String(cursor));
    const snap = await q.get();

    const docs = snap.docs.slice(0, limitNum);
    const hasMore = snap.docs.length > limitNum;
    const nextCursor = hasMore ? docs[docs.length - 1].id : null;

    const searchLower = String(search || "").trim().toLowerCase();

    const items = docs
      .map((d) => {
        const data = d.data() || {};
        const created = pickCreatedAt(data);
        const verification = computeVerificationLevel(data);
        return {
          id: d.id,
          name: getDisplayName(data),
          pseudonym: data.pseudonym || "",
          email: data.email || "",
          userType: classifyUserType(data),
          planStatus: classifyPlanStatus(data),
          approvalStatus: classifyApprovalStatus(data),
          verifiedByLinkedIn: isVerifiedByLinkedIn(data),
          verificationLevel: verification.level,
          verificationProvider: verification.provider,
          createdAt: created ? created.toISOString() : null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
        };
      })
      .filter((item) => {
        if (userType !== "todos" && item.userType !== userType) return false;
        if (planStatus !== "todos" && item.planStatus !== planStatus) return false;
        if (approvalStatus !== "todos" && item.approvalStatus !== approvalStatus) return false;
        if (searchLower) {
          const haystack = `${item.name} ${item.pseudonym} ${item.email}`.toLowerCase();
          if (!haystack.includes(searchLower)) return false;
        }
        return true;
      });

    return res.status(200).json({ items, nextCursor, hasMore });
  } catch (err) {
    console.error("[admin/users] erro:", err);
    return res.status(500).json({ error: "Erro interno ao listar usuários." });
  }
}

async function handleGrowthStats(req, res) {
  const { uid } = req.body || {};
  if (!requireAdminUid(uid)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }

  try {
    const { db } = await ensureAdmin();

    // Faz varredura completa em lotes para não estourar memória.
    const PAGE = 500;
    let cursor = null;
    const totals = {
      total: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      incomplete: 0,
      linkedinVerified: 0,
      verificationFree: 0,
      verificationIdentity: 0,
      verificationProven: 0,
      plan: { gratuito: 0, premium: 0, premium_gratuito: 0 },
      premiumByType: { trabalhador: 0, empresa: 0, apoiador: 0 },
    };
    const byMonth = new Map(); // "YYYY-MM" → contagem

    /* eslint-disable no-await-in-loop */
    while (true) {
      let q = db.collection("users").orderBy("__name__").limit(PAGE);
      if (cursor) q = q.startAfter(cursor);
      const snap = await q.get();
      if (snap.empty) break;

      snap.docs.forEach((d) => {
        const data = d.data() || {};
        totals.total += 1;

        const approval = classifyApprovalStatus(data);
        totals[approval] = (totals[approval] || 0) + 1;

        if (isVerifiedByLinkedIn(data)) {
          totals.linkedinVerified += 1;
        }

        const v = computeVerificationLevel(data);
        if (v.level === "proven") totals.verificationProven += 1;
        else if (v.level === "identity") totals.verificationIdentity += 1;
        else totals.verificationFree += 1;

        const plan = classifyPlanStatus(data);
        totals.plan[plan] = (totals.plan[plan] || 0) + 1;

        // Recorta o plano Premium (pago) por tipo de usuário.
        if (plan === "premium" || plan === "premium_gratuito") {
          const type = classifyUserType(data);
          totals.premiumByType[type] = (totals.premiumByType[type] || 0) + 1;
        }

        const created = pickCreatedAt(data);
        if (created) {
          const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(
            2,
            "0"
          )}`;
          byMonth.set(key, (byMonth.get(key) || 0) + 1);
        }
      });

      if (snap.docs.length < PAGE) break;
      cursor = snap.docs[snap.docs.length - 1].id;
    }
    /* eslint-enable no-await-in-loop */

    // Garante 12 meses contíguos terminando no mês atual (preenche zeros).
    const now = new Date();
    const monthly = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly.push({ month: key, count: byMonth.get(key) || 0 });
    }

    // Conta visitas anônimas (sessões signInAnonymously) listando o Firebase Auth.
    // É best-effort: se falhar (cota/permissão), devolvemos null.
    let anonymousVisits = null;
    try {
      const { getAuth } = await import("firebase-admin/auth");
      const auth = getAuth();
      let pageToken;
      let count = 0;
      /* eslint-disable no-await-in-loop */
      do {
        const result = await auth.listUsers(1000, pageToken);
        for (const u of result.users) {
          const providers = Array.isArray(u.providerData) ? u.providerData : [];
          if (providers.length === 0) count += 1;
        }
        pageToken = result.pageToken;
      } while (pageToken);
      /* eslint-enable no-await-in-loop */
      anonymousVisits = count;
    } catch (err) {
      console.warn("[admin/growth-stats] visitas anônimas indisponíveis:", err?.message || err);
    }

    // Funil de cadastro: total iniciados e total abandonos (sem concluido=true).
    // Best-effort: se a coleção não existir ou as regras bloquearem, devolvemos null.
    let registrationStarted = null;
    let registrationAbandoned = null;
    let registrationCompleted = null;
    try {
      const startedSnap = await db.collection("cadastros_iniciados").get();
      registrationStarted = startedSnap.size;
      let completed = 0;
      // Considera abandono apenas docs criados há mais de 24h sem concluido=true.
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      let abandoned = 0;
      startedSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        if (data.concluido === true) {
          completed += 1;
          return;
        }
        const started = data.startedAt;
        const startedMs =
          started && typeof started.toMillis === "function"
            ? started.toMillis()
            : started instanceof Date
            ? started.getTime()
            : 0;
        if (!startedMs || startedMs <= cutoff) abandoned += 1;
      });
      registrationCompleted = completed;
      registrationAbandoned = abandoned;
    } catch (err) {
      console.warn("[admin/growth-stats] funil de cadastros indisponível:", err?.message || err);
    }

    // Total de avaliações de empresas submetidas (coleção /reviews).
    // Usa a agregação count() do Firestore para evitar trazer todos os docs.
    let reviewsSubmitted = null;
    try {
      const countSnap = await db.collection("reviews").count().get();
      reviewsSubmitted = countSnap.data().count;
    } catch (err) {
      console.warn(
        "[admin/growth-stats] contagem de avaliações indisponível:",
        err?.message || err
      );
    }

    return res.status(200).json({
      totals,
      monthly,
      anonymousVisits,
      registrationStarted,
      registrationCompleted,
      registrationAbandoned,
      reviewsSubmitted,
    });
  } catch (err) {
    console.error("[admin/growth-stats] erro:", err);
    return res.status(500).json({ error: "Erro interno ao calcular métricas." });
  }
}

async function handleUpdateUserStatus(req, res) {
  const { uid, targetUserId, status } = req.body || {};
  if (!requireAdminUid(uid)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }
  if (!targetUserId || typeof targetUserId !== "string") {
    return res.status(400).json({ error: "targetUserId é obrigatório." });
  }
  const allowed = ["approved", "rejected", "pending", "ativo", "incompleto", "removido"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "status inválido." });
  }

  try {
    const { db, FieldValue } = await ensureAdmin();
    const ref = db.collection("users").doc(targetUserId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const payload = {
      status,
      statusUpdatedAt: FieldValue.serverTimestamp(),
      statusUpdatedBy: uid,
    };
    await ref.set(payload, { merge: true });

    const updated = await ref.get();
    const data = updated.data() || {};
    const created = pickCreatedAt(data);
    const verification = computeVerificationLevel(data);
    return res.status(200).json({
      success: true,
      user: {
        id: updated.id,
        name: getDisplayName(data),
        pseudonym: data.pseudonym || "",
        email: data.email || "",
        userType: classifyUserType(data),
        planStatus: classifyPlanStatus(data),
        approvalStatus: classifyApprovalStatus(data),
        verifiedByLinkedIn: isVerifiedByLinkedIn(data),
        verificationLevel: verification.level,
        verificationProvider: verification.provider,
        createdAt: created ? created.toISOString() : null,
      },
    });
  } catch (err) {
    console.error("[admin/update-user-status] erro:", err);
    return res.status(500).json({ error: "Erro interno ao atualizar status." });
  }
}

async function handleUpdatePlan(req, res) {
  const { uid, targetUserId, action } = req.body || {};

  if (!requireAdminUid(uid)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }
  if (!targetUserId || typeof targetUserId !== "string") {
    return res.status(400).json({ error: "targetUserId é obrigatório." });
  }
  if (!["grant_free_premium", "revoke_free_premium"].includes(action)) {
    return res.status(400).json({ error: "Ação inválida." });
  }

  try {
    const { db } = await ensureAdmin();
    const ref = db.collection("users").doc(targetUserId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const now = new Date();
    let payload;

    if (action === "grant_free_premium") {
      payload = {
        is_free_premium: true,
        is_premium: true,
        is_premium_supporter: true,
        is_premium_worker: true,
        apoiadorPlano: "premium",
        freePremiumGrantedAt: now,
        freePremiumGrantedBy: uid,
      };
    } else {
      // revoke_free_premium: remove apenas o premium concedido gratuitamente.
      // Se o usuário tem um plano pago real, ele deve permanecer (mas hoje
      // não distinguimos a fonte do premium — então removemos as flags).
      payload = {
        is_free_premium: false,
        is_premium: false,
        is_premium_supporter: false,
        is_premium_worker: false,
        apoiadorPlano: "gratuito",
        freePremiumGrantedAt: null,
        freePremiumGrantedBy: null,
        freePremiumRevokedAt: now,
        freePremiumRevokedBy: uid,
      };
    }

    await ref.set(payload, { merge: true });

    const updated = await ref.get();
    const data = updated.data() || {};
    return res.status(200).json({
      success: true,
      user: {
        id: updated.id,
        name: getDisplayName(data),
        email: data.email || "",
        userType: classifyUserType(data),
        planStatus: classifyPlanStatus(data),
      },
    });
  } catch (err) {
    console.error("[admin/update-plan] erro:", err);
    return res.status(500).json({ error: "Erro interno ao atualizar o plano." });
  }
}

export default async function handler(req, res) {
  const op = String(req.query?.op || "").toLowerCase();

  // op=nfse-list permite GET (consulta read-only). As demais exigem POST.
  if (op === "nfse-list" && req.method === "GET") return handleNfseList(req, res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (op === "delete") return handleDelete(req, res);
  if (op === "reviews") return handleReviews(req, res);
  if (op === "users") return handleListUsers(req, res);
  if (op === "update-plan") return handleUpdatePlan(req, res);
  if (op === "growth-stats") return handleGrowthStats(req, res);
  if (op === "update-user-status") return handleUpdateUserStatus(req, res);
  if (op === "restricted") return handleListRestricted(req, res);
  if (op === "moderate-segment") return handleModerateSegment(req, res);
  if (op === "verify-request") return handleVerifyRequest(req, res);
  if (op === "verify-confirm") return handleVerifyConfirm(req, res);
  if (op === "verify-resend") return handleVerifyResend(req, res);
  if (op === "verify-list") return handleVerifyList(req, res);
  if (op === "verify-decision") return handleVerifyDecision(req, res);
  if (op === "nfse-list") return handleNfseList(req, res);
  if (op === "nfse-refresh") return handleNfseRefresh(req, res);

  return res.status(400).json({
    error:
      "Parâmetro 'op' inválido. Ops válidas: delete, reviews, users, update-plan, growth-stats, update-user-status, restricted, moderate-segment, verify-request, verify-confirm, verify-resend, verify-list, verify-decision.",
  });
}

/* ────────────────────────────────────────────────
   op=restricted / op=moderate-segment
   ──────────────────────────────────────────────── */

// Mapeamento criterionKey → campo de comentário no documento de review.
const CRITERION_COMMENT_FIELD = {
  comunicacao: "commentComunicacao",
  etica: "commentEtica",
  cultura: "commentCultura",
  saudeBemEstar: "commentSaudeBemEstar",
  lideranca: "commentLideranca",
  ambiente: "commentAmbiente",
  estimacaoOrganizacao: "commentEstimacaoOrganizacao",
  desenvolvimento: "commentDesenvolvimento",
  reconhecimento: "commentReconhecimento",
  equilibrio: "commentEquilibrio",
  diversidade: "commentDiversidade",
  inovacao: "commentInovacao",
  oportunidades: "commentOportunidades",
  reputacao: "commentReputacao",
  impactoSocial: "commentImpactoSocial",
  discriminacao: "commentDiscriminacao",
  cargaHoraria: "commentCargaHoraria",
  crescimento: "commentCrescimento",
};

const CRITERION_LABEL = {
  comunicacao: "Recrutamento",
  etica: "Proposta salarial",
  cultura: "Cultura",
  saudeBemEstar: "Saúde e bem-estar",
  lideranca: "Liderança",
  ambiente: "Ambiente",
  estimacaoOrganizacao: "Estima da organização",
  desenvolvimento: "Desenvolvimento",
  reconhecimento: "Reconhecimento",
  equilibrio: "Equilíbrio",
  diversidade: "Diversidade",
  inovacao: "Inovação",
  oportunidades: "Oportunidades",
  reputacao: "Reputação",
  impactoSocial: "Impacto social",
  discriminacao: "Discriminação",
  cargaHoraria: "Carga horária",
  crescimento: "Crescimento",
};

function buildSegmentItems(reviewDoc) {
  const data = reviewDoc.data() || {};
  const out = [];
  const baseMeta = {
    reviewId: reviewDoc.id,
    companySlug: data.companySlug || "",
    company: data.company || data.companyName || "",
    pseudonym:
      data.pseudonym || data.pseudonimo || data.userName || data.authorName || "",
    createdAt:
      data.createdAt?.toDate?.()?.toISOString?.() ||
      (typeof data.createdAt === "string" ? data.createdAt : null),
  };

  const generalText = typeof data.generalComment === "string" ? data.generalComment : "";
  const generalSegs = Array.isArray(data.restrictedSegments) ? data.restrictedSegments : [];
  generalSegs.forEach((seg, idx) => {
    if (!seg || typeof seg !== "object") return;
    const start = Number(seg.start);
    const end = Number(seg.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    out.push({
      ...baseMeta,
      source: "general",
      sourceLabel: "Comentário geral",
      segmentIndex: idx,
      start,
      end,
      summary: String(seg.summary || ""),
      excerpt: generalText.slice(start, end),
      fullText: generalText,
    });
  });

  const criterionMap =
    data.criterionRestrictedSegments && typeof data.criterionRestrictedSegments === "object"
      ? data.criterionRestrictedSegments
      : {};
  for (const [key, segs] of Object.entries(criterionMap)) {
    if (!Array.isArray(segs)) continue;
    const fieldName = CRITERION_COMMENT_FIELD[key];
    const text = fieldName ? (typeof data[fieldName] === "string" ? data[fieldName] : "") : "";
    segs.forEach((seg, idx) => {
      if (!seg || typeof seg !== "object") return;
      const start = Number(seg.start);
      const end = Number(seg.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
      out.push({
        ...baseMeta,
        source: key,
        sourceLabel: CRITERION_LABEL[key] || key,
        segmentIndex: idx,
        start,
        end,
        summary: String(seg.summary || ""),
        excerpt: text.slice(start, end),
        fullText: text,
      });
    });
  }

  return out;
}

async function handleListRestricted(req, res) {
  const { uid, pageSize = 50, cursor = null, search = "" } = req.body || {};

  if (!requireAdminUid(uid)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }

  try {
    const { db } = await ensureAdmin();
    const limitNum = Math.min(Math.max(parseInt(pageSize, 10) || 50, 1), 200);

    let q = db.collection("reviews").orderBy("createdAt", "desc").limit(limitNum + 1);
    if (cursor) {
      const cursorSnap = await db.collection("reviews").doc(String(cursor)).get();
      if (cursorSnap.exists) q = q.startAfter(cursorSnap);
    }
    const snap = await q.get();

    const docs = snap.docs.slice(0, limitNum);
    const hasMore = snap.docs.length > limitNum;
    const nextCursor = hasMore ? docs[docs.length - 1].id : null;

    const searchLower = String(search || "").trim().toLowerCase();
    const items = [];
    for (const d of docs) {
      const segs = buildSegmentItems(d);
      for (const seg of segs) {
        if (searchLower) {
          const hay =
            `${seg.excerpt} ${seg.summary} ${seg.pseudonym} ${seg.companySlug} ${seg.sourceLabel}`.toLowerCase();
          if (!hay.includes(searchLower)) continue;
        }
        items.push(seg);
      }
    }

    return res.status(200).json({ items, nextCursor, hasMore });
  } catch (err) {
    console.error("[admin/restricted] erro:", err);
    return res.status(500).json({ error: "Erro interno ao listar trechos restritos." });
  }
}

async function handleModerateSegment(req, res) {
  const {
    uid,
    reviewId,
    source,
    segmentIndex,
    action,
    summary,
    replacementText,
  } = req.body || {};

  if (!requireAdminUid(uid)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }
  if (!reviewId || typeof reviewId !== "string") {
    return res.status(400).json({ error: "reviewId é obrigatório." });
  }
  if (typeof source !== "string" || !source) {
    return res.status(400).json({ error: "source inválido." });
  }
  if (!Number.isInteger(segmentIndex) || segmentIndex < 0) {
    return res.status(400).json({ error: "segmentIndex inválido." });
  }
  if (!["approve", "reject", "edit"].includes(action)) {
    return res.status(400).json({ error: "action inválido." });
  }

  try {
    const { db } = await ensureAdmin();
    const ref = db.collection("reviews").doc(reviewId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Review não encontrada." });

    const data = snap.data() || {};
    const isGeneral = source === "general";
    const textField = isGeneral ? "generalComment" : CRITERION_COMMENT_FIELD[source];
    if (!textField) return res.status(400).json({ error: "source desconhecido." });

    const segsField = isGeneral ? "restrictedSegments" : null;
    let segments = isGeneral
      ? Array.isArray(data.restrictedSegments)
        ? [...data.restrictedSegments]
        : []
      : Array.isArray(data.criterionRestrictedSegments?.[source])
        ? [...data.criterionRestrictedSegments[source]]
        : [];

    if (segmentIndex >= segments.length) {
      return res.status(404).json({ error: "Trecho não encontrado." });
    }
    const target = { ...segments[segmentIndex] };
    const text = typeof data[textField] === "string" ? data[textField] : "";
    const start = Number(target.start);
    const end = Number(target.end);

    const update = {};

    if (action === "approve") {
      // Remove o trecho da lista de restritos (texto fica público).
      segments.splice(segmentIndex, 1);
    } else if (action === "reject") {
      // Substitui o trecho no texto-fonte por placeholder e remove segmento.
      const placeholder = "[removido pela moderação]";
      const newText = text.slice(0, start) + placeholder + text.slice(end);
      const delta = placeholder.length - (end - start);
      // Ajusta segmentos posteriores (no mesmo campo) que dependam de índices.
      segments = segments
        .filter((_, idx) => idx !== segmentIndex)
        .map((s) => {
          const sStart = Number(s.start);
          const sEnd = Number(s.end);
          if (sStart >= end) {
            return { ...s, start: sStart + delta, end: sEnd + delta };
          }
          return s;
        });
      update[textField] = newText;
    } else if (action === "edit") {
      const newSummary = typeof summary === "string" ? summary.trim() : null;
      const newExcerpt =
        typeof replacementText === "string" ? replacementText : null;
      if (newSummary !== null) target.summary = newSummary;
      if (newExcerpt !== null) {
        const newText = text.slice(0, start) + newExcerpt + text.slice(end);
        const delta = newExcerpt.length - (end - start);
        target.end = start + newExcerpt.length;
        segments = segments.map((s, idx) => {
          if (idx === segmentIndex) return target;
          const sStart = Number(s.start);
          const sEnd = Number(s.end);
          if (sStart >= end) {
            return { ...s, start: sStart + delta, end: sEnd + delta };
          }
          return s;
        });
        update[textField] = newText;
      } else {
        segments[segmentIndex] = target;
      }
    }

    if (isGeneral) {
      update[segsField] = segments;
    } else {
      const map = {
        ...(data.criterionRestrictedSegments && typeof data.criterionRestrictedSegments === "object"
          ? data.criterionRestrictedSegments
          : {}),
      };
      if (segments.length === 0) delete map[source];
      else map[source] = segments;
      update.criterionRestrictedSegments = map;
    }

    update.updatedAt = new Date();
    update.lastModerationBy = uid;
    update.lastModerationAt = new Date();

    await ref.set(update, { merge: true });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[admin/moderate-segment] erro:", err);
    return res.status(500).json({ error: "Erro interno ao moderar trecho." });
  }
}


// ════════════════════════════════════════════════════════════════
// Verificação de empresas (CNPJ + e-mail corporativo + manual)
// ════════════════════════════════════════════════════════════════

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com",
  "yahoo.com", "yahoo.com.br", "icloud.com", "me.com", "aol.com",
  "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br", "globo.com",
  "r7.com", "zipmail.com.br", "msn.com", "proton.me", "protonmail.com",
]);

const COMPANY_TYPE_TOKENS = new Set([
  "ltda", "sa", "eireli", "me", "epp", "mei", "company", "co", "corp",
  "inc", "group", "grupo", "holding", "do", "da", "de", "dos", "das",
  "brasil", "br", "tecnologia", "tech",
]);

function normalizeForMatch(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function tokensFromName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !COMPANY_TYPE_TOKENS.has(t));
}

function domainAffinityScore(domain, companyNames) {
  const d = normalizeForMatch(String(domain || "").split(".")[0]);
  if (!d) return 0;
  let best = 0;
  for (const name of companyNames) {
    const flat = normalizeForMatch(name);
    if (!flat) continue;
    if (flat.includes(d) || d.includes(flat)) best = Math.max(best, 1);
    for (const tok of tokensFromName(name)) {
      if (d.includes(tok) || tok.includes(d)) best = Math.max(best, 0.8);
    }
  }
  return best;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function hashCode(code) {
  const { createHash } = await import("crypto");
  const salt = process.env.EMAIL_VERIFICATION_SECRET || "trabalheila";
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

async function fetchCnpjData(digits) {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      headers: { "User-Agent": "TrabalheiLa/1.0", Accept: "application/json" },
    });
    if (r.ok) {
      const data = await r.json();
      return {
        razao_social: data.razao_social || data.nome || "",
        nome_fantasia: data.nome_fantasia || data.fantasia || "",
        situacao_cadastral: (
          data.descricao_situacao_cadastral ||
          data.situacao_cadastral ||
          ""
        )
          .toString()
          .toUpperCase(),
      };
    }
  } catch (err) {
    console.warn("[admin/verify] BrasilAPI falhou:", err?.message || err);
  }
  return null;
}

async function sendCodeEmail({ email, code, razaoSocial }) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!resendKey || !fromAddress) {
    throw new Error("Serviço de e-mail não configurado.");
  }
  const { Resend } = await import("resend");
  const resend = new Resend(resendKey);
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#1d4ed8;">Verificação de empresa</h2>
      <p>Use o código abaixo para confirmar que você representa <strong>${escapeHtml(
        razaoSocial || ""
      )}</strong> no <strong>Trabalhei Lá</strong>:</p>
      <p style="text-align:center;margin:24px 0;">
        <span style="display:inline-block;background:#1d4ed8;color:#fff;padding:14px 28px;border-radius:10px;font-size:28px;letter-spacing:8px;font-weight:bold;">
          ${escapeHtml(code)}
        </span>
      </p>
      <p style="font-size:12px;color:#475569;">Este código expira em 30 minutos.</p>
    </div>
  `;
  const text = `Seu código de verificação é: ${code}\nExpira em 30 minutos.`;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: email,
    subject: "Código de verificação — Trabalhei Lá",
    html,
    text,
  });
  if (error) throw new Error(error.message || "Falha ao enviar código.");
}

async function applyVerificationSideEffects(db, FieldValue, data) {
  const { uid, cnpj, corporateEmail, razaoSocial, nomeFantasia } = data;
  const batch = db.batch();
  batch.set(
    db.collection("users").doc(uid),
    {
      role: "admin_empresa",
      isEmployer: true,
      managedCompanyCnpj: cnpj,
      corporateEmail,
      companyVerifiedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  batch.set(
    db.collection("companies").doc(cnpj),
    {
      cnpj,
      razaoSocial: razaoSocial || null,
      nomeFantasia: nomeFantasia || null,
      verified: true,
      verifiedAt: FieldValue.serverTimestamp(),
      verifiedBy: corporateEmail,
      verifiedByUid: uid,
    },
    { merge: true }
  );
  await batch.commit();
}

async function handleVerifyRequest(req, res) {
  const { uid, cnpj, corporateEmail, pseudonym = "", tier = "free" } = req.body || {};
  if (!uid || typeof uid !== "string") {
    return res.status(400).json({ error: "uid obrigatório." });
  }
  const digits = String(cnpj || "").replace(/\D/g, "");
  if (digits.length !== 14) {
    return res.status(400).json({ error: "CNPJ inválido." });
  }
  if (!isValidEmail(corporateEmail)) {
    return res.status(400).json({ error: "E-mail inválido." });
  }
  const emailLower = String(corporateEmail).trim().toLowerCase();
  const domain = emailLower.split("@")[1] || "";
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return res.status(400).json({
      error:
        "Use um e-mail corporativo (com domínio próprio da empresa). Domínios públicos como Gmail/Hotmail não são aceitos.",
      reason: "public_domain",
    });
  }

  const cnpjData = await fetchCnpjData(digits);
  if (!cnpjData) {
    return res.status(404).json({ error: "CNPJ não encontrado nas bases públicas." });
  }
  if (cnpjData.situacao_cadastral && cnpjData.situacao_cadastral !== "ATIVA") {
    return res.status(400).json({
      error: `CNPJ com situação cadastral '${cnpjData.situacao_cadastral}'. Não é possível verificar.`,
      reason: "inactive_cnpj",
    });
  }

  const affinity = domainAffinityScore(domain, [
    cnpjData.razao_social,
    cnpjData.nome_fantasia,
  ]);
  const requiresManual = tier === "premium" || affinity < 0.8;

  try {
    const { db, FieldValue } = await ensureAdmin();
    const requestId = `${uid}_${digits}`;
    const code = generateCode();
    const codeHashValue = await hashCode(code);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await db.collection("companyVerifications").doc(requestId).set(
      {
        uid,
        cnpj: digits,
        corporateEmail: emailLower,
        pseudonym: String(pseudonym || "").slice(0, 80),
        tier,
        razaoSocial: cnpjData.razao_social,
        nomeFantasia: cnpjData.nome_fantasia,
        domainAffinity: affinity,
        requiresManual,
        status: "pending_email",
        codeHash: codeHashValue,
        codeAttempts: 0,
        codeExpiresAt: expiresAt,
        lastCodeSentAt: new Date(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await sendCodeEmail({
      email: emailLower,
      code,
      razaoSocial: cnpjData.razao_social,
    });

    return res.status(200).json({
      ok: true,
      requestId,
      requiresManual,
      domainAffinity: affinity,
      razaoSocial: cnpjData.razao_social,
      nomeFantasia: cnpjData.nome_fantasia,
    });
  } catch (err) {
    console.error("[admin/verify-request] erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao iniciar verificação." });
  }
}

async function handleVerifyConfirm(req, res) {
  const { requestId, code } = req.body || {};
  if (!requestId || !code) {
    return res.status(400).json({ error: "requestId e code obrigatórios." });
  }
  try {
    const { db, FieldValue } = await ensureAdmin();
    const ref = db.collection("companyVerifications").doc(String(requestId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Solicitação não encontrada." });
    const data = snap.data() || {};

    if (data.status === "verified" || data.status === "approved") {
      return res.status(200).json({ ok: true, status: data.status, alreadyVerified: true });
    }
    if (data.status === "rejected") {
      return res.status(403).json({ error: "Solicitação rejeitada pelo administrador." });
    }

    const expires = data.codeExpiresAt?.toDate?.() || new Date(data.codeExpiresAt || 0);
    if (!expires || expires.getTime() < Date.now()) {
      return res.status(400).json({ error: "Código expirado. Solicite um novo." });
    }
    if ((data.codeAttempts || 0) >= 5) {
      return res.status(429).json({ error: "Muitas tentativas. Solicite um novo código." });
    }

    const candidateHash = await hashCode(String(code).trim());
    if (candidateHash !== data.codeHash) {
      await ref.update({
        codeAttempts: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return res.status(400).json({ error: "Código incorreto." });
    }

    const nextStatus = data.requiresManual ? "pending_manual" : "verified";
    await ref.update({
      status: nextStatus,
      emailVerifiedAt: FieldValue.serverTimestamp(),
      codeHash: null,
      codeAttempts: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (nextStatus === "verified") {
      await applyVerificationSideEffects(db, FieldValue, data);
    }

    return res.status(200).json({
      ok: true,
      status: nextStatus,
      requiresManual: Boolean(data.requiresManual),
    });
  } catch (err) {
    console.error("[admin/verify-confirm] erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao confirmar." });
  }
}

async function handleVerifyResend(req, res) {
  const { requestId } = req.body || {};
  if (!requestId) return res.status(400).json({ error: "requestId obrigatório." });
  try {
    const { db, FieldValue } = await ensureAdmin();
    const ref = db.collection("companyVerifications").doc(String(requestId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Solicitação não encontrada." });
    const data = snap.data() || {};
    if (data.status === "verified" || data.status === "approved") {
      return res.status(400).json({ error: "Já verificado." });
    }
    const last = data.lastCodeSentAt?.toDate?.() || new Date(data.lastCodeSentAt || 0);
    if (last && Date.now() - last.getTime() < 60_000) {
      return res.status(429).json({ error: "Aguarde 1 minuto antes de pedir um novo código." });
    }
    const code = generateCode();
    const codeHashValue = await hashCode(code);
    await ref.update({
      codeHash: codeHashValue,
      codeAttempts: 0,
      codeExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      lastCodeSentAt: new Date(),
      status: "pending_email",
      updatedAt: FieldValue.serverTimestamp(),
    });
    await sendCodeEmail({
      email: data.corporateEmail,
      code,
      razaoSocial: data.razaoSocial,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[admin/verify-resend] erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao reenviar." });
  }
}

async function handleVerifyList(req, res) {
  const { uid, status = "pending_manual" } = req.body || {};
  if (!requireAdminUid(uid)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }
  try {
    const { db } = await ensureAdmin();
    // Evita exigir índice composto (status + updatedAt): filtra no servidor
    // sem orderBy quando há where, e ordena em memória.
    let q;
    if (status && status !== "todos") {
      q = db
        .collection("companyVerifications")
        .where("status", "==", status)
        .limit(500);
    } else {
      q = db
        .collection("companyVerifications")
        .orderBy("updatedAt", "desc")
        .limit(200);
    }
    const snap = await q.get();
    const docs = snap.docs.slice();
    if (status && status !== "todos") {
      docs.sort((a, b) => {
        const ta = a.data()?.updatedAt?.toMillis?.() || 0;
        const tb = b.data()?.updatedAt?.toMillis?.() || 0;
        return tb - ta;
      });
    }
    const items = docs.slice(0, 200).map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        uid: data.uid,
        cnpj: data.cnpj,
        corporateEmail: data.corporateEmail,
        pseudonym: data.pseudonym,
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia,
        tier: data.tier,
        domainAffinity: data.domainAffinity,
        status: data.status,
        notes: data.notes || "",
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
      };
    });
    return res.status(200).json({ items });
  } catch (err) {
    console.error("[admin/verify-list] erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao listar." });
  }
}

async function handleVerifyDecision(req, res) {
  const { uid, requestId, action, notes = "" } = req.body || {};
  if (!requireAdminUid(uid)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }
  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ error: "action inválido." });
  }
  try {
    const { db, FieldValue } = await ensureAdmin();
    const ref = db.collection("companyVerifications").doc(String(requestId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Solicitação não encontrada." });
    const data = snap.data() || {};
    const update = {
      notes: String(notes || "").slice(0, 1000),
      decidedBy: uid,
      decidedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      status: action === "approve" ? "verified" : "rejected",
    };
    await ref.update(update);
    if (action === "approve") {
      await applyVerificationSideEffects(db, FieldValue, data);
    }
    return res.status(200).json({ ok: true, status: update.status });
  } catch (err) {
    console.error("[admin/verify-decision] erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao decidir." });
  }
}

/* ────────────────────────────────────────────────
   op=nfse-list / op=nfse-refresh
   Auditoria das emissoes automaticas (collection `nfse_emissoes`).
   ──────────────────────────────────────────────── */

function getFocusBaseUrl() {
  const env = (process.env.FOCUS_NFE_ENV || "homologacao").toLowerCase();
  return env === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
}

function serializeNfseDoc(doc) {
  const data = doc.data() || {};
  const createdAt = data.createdAt?.toDate?.()?.toISOString?.() || null;
  return {
    id: doc.id,
    ref: data.ref || doc.id,
    paymentId: data.paymentId || null,
    amount: data.amount ?? null,
    cnpj: data.cnpj || null,
    companySlug: data.companySlug || null,
    apoiadorId: data.apoiadorId || null,
    audience: data.audience || null,
    ok: !!data.ok,
    skipped: !!data.skipped,
    reason: data.reason || null,
    status: data.status || null,
    message: data.message || null,
    env: data.env || null,
    provider: data.provider || null,
    focusStatus: data.focusStatus || null,
    focusUrlPdf: data.focusUrlPdf || null,
    focusNumeroNfse: data.focusNumeroNfse || null,
    createdAt,
  };
}

async function handleNfseList(req, res) {
  const uid = (req.query?.uid || req.body?.uid || "").toString().trim();
  if (!requireAdminUid(uid)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }
  const limit = Math.min(Number(req.query?.limit || 50) || 50, 200);

  try {
    const { db } = await ensureAdmin();
    const snap = await db
      .collection("nfse_emissoes")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    const items = snap.docs.map(serializeNfseDoc);
    return res.status(200).json({ items, count: items.length });
  } catch (err) {
    console.error("[admin/nfse-list] erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao listar NFS-e." });
  }
}

async function handleNfseRefresh(req, res) {
  const body = req.body || {};
  const uid = (body.uid || req.query?.uid || "").toString().trim();
  if (!requireAdminUid(uid)) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }

  const ref = (body.ref || req.query?.ref || "").toString().trim();
  if (!ref) {
    return res.status(400).json({ error: "Parametro 'ref' obrigatorio." });
  }

  const token = (process.env.FOCUS_NFE_TOKEN || "").trim();
  if (!token) {
    return res.status(503).json({ error: "FOCUS_NFE_TOKEN nao configurado." });
  }

  const url = `${getFocusBaseUrl()}/v2/nfse?ref=${encodeURIComponent(ref)}`;
  const basicAuth = Buffer.from(`${token}:`).toString("base64");

  let response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Basic ${basicAuth}` },
    });
  } catch (err) {
    return res.status(502).json({ error: err?.message || "Falha de rede" });
  }

  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  try {
    const { db, FieldValue } = await ensureAdmin();
    await db.collection("nfse_emissoes").doc(ref).set(
      {
        ref,
        lastRefreshAt: FieldValue.serverTimestamp(),
        focusStatus: json?.status || null,
        focusUrlPdf: json?.url_danfse || json?.caminho_xml_nota_fiscal || null,
        focusUrlXml: json?.caminho_xml_nota_fiscal || null,
        focusNumeroNfse: json?.numero || null,
        focusRaw: json,
      },
      { merge: true }
    );
  } catch (writeErr) {
    console.warn("[admin/nfse-refresh] falha ao persistir:", writeErr?.message || writeErr);
  }

  return res.status(response.status).json({
    ok: response.ok,
    status: response.status,
    data: json,
  });
}
