// /api/admin-reviews.js
// Endpoint premium: retorna avaliações detalhadas por quesito e período.
// Protegido pelo campo is_premium enviado no corpo.
// Em produção, substitua a verificação de is_premium por validação de JWT/Firebase Admin SDK.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { companySlug, is_premium, periodStart, periodEnd } = req.body;

  // Guarda de acesso: rejeita chamadas sem is_premium.
  if (!is_premium) {
    return res.status(403).json({ error: "Acesso restrito ao plano premium." });
  }

  if (!companySlug) {
    return res.status(400).json({ error: "companySlug é obrigatório." });
  }

  // Importações dinâmicas compatíveis com Vercel Edge/Serverless.
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

  const db = getFirestore();
  const ref = db.collection("reviews");
  let q = ref.where("companySlug", "==", companySlug);

  if (periodStart) {
    q = q.where("createdAt", ">=", new Date(periodStart));
  }
  if (periodEnd) {
    q = q.where("createdAt", "<=", new Date(periodEnd));
  }

  const snap = await q.orderBy("createdAt", "asc").limit(500).get();
  const METRIC_KEYS = [
    "comunicacao", "etica", "salario", "cultura", "saudeBemEstar",
    "lideranca", "ambiente", "estimacaoOrganizacao", "desenvolvimento",
    "reconhecimento", "equilibrio", "diversidade", "rating",
  ];

  // Agrupa notas por mês para gráfico de tendência.
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

  // Converte para array ordenado por mês com médias por quesito.
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
}
