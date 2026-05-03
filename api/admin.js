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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const op = String(req.query?.op || "").toLowerCase();
  if (op === "delete") return handleDelete(req, res);
  if (op === "reviews") return handleReviews(req, res);

  return res.status(400).json({ error: "Parâmetro 'op' inválido. Use ?op=delete ou ?op=reviews." });
}
