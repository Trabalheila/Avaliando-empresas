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
    const { getFirestore } = await import("firebase-admin/firestore");
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        }),
      });
    }
    return { db: getFirestore() };
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

async function handleListUsers(req, res) {
  const {
    uid,
    userType = "todos",
    planStatus = "todos",
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
        return {
          id: d.id,
          name: getDisplayName(data),
          email: data.email || "",
          userType: classifyUserType(data),
          planStatus: classifyPlanStatus(data),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
        };
      })
      .filter((item) => {
        if (userType !== "todos" && item.userType !== userType) return false;
        if (planStatus !== "todos" && item.planStatus !== planStatus) return false;
        if (searchLower) {
          const haystack = `${item.name} ${item.email}`.toLowerCase();
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const op = String(req.query?.op || "").toLowerCase();
  if (op === "delete") return handleDelete(req, res);
  if (op === "reviews") return handleReviews(req, res);
  if (op === "users") return handleListUsers(req, res);
  if (op === "update-plan") return handleUpdatePlan(req, res);
  if (op === "restricted") return handleListRestricted(req, res);
  if (op === "moderate-segment") return handleModerateSegment(req, res);

  return res.status(400).json({
    error:
      "Parâmetro 'op' inválido. Use ?op=delete, ?op=reviews, ?op=users, ?op=update-plan, ?op=restricted ou ?op=moderate-segment.",
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

