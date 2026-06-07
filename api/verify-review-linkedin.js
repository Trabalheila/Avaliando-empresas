// api/verify-review-linkedin.js
// Endpoint serverless — verifica server-side se o autor de uma avaliação
// trabalhou na empresa avaliada de acordo com seu histórico LinkedIn
// (gravado em users/{uid}.linkedInCompaniesNormalized).
//
// Privacidade:
//   - O array de empresas do LinkedIn fica em users/{uid} e NÃO é
//     lido pelo cliente (regra do Firestore deve restringir leitura
//     ao próprio uid OU a admin). Este endpoint usa firebase-admin
//     bypassando as rules, faz a checagem e só grava um booleano
//     no doc da review (`isVerifiedLinkedIn`). Nada do perfil
//     LinkedIn vaza para a review pública.
//
// Contrato:
//   POST /api/verify-review-linkedin
//   body JSON: { reviewId: string, uid: string }
//   resp 200: { verified: boolean }
//   resp 4xx: { error: string }

// Normalização local (espelho de src/utils/companyMatching.js).
// Mantida inline para evitar atravessar a fronteira /api -> /src no bundle Vercel.
const SUFFIXES = [
  "s a", "s/a", "sa", "ltda", "ltd", "me", "epp", "eireli",
  "inc", "llc", "corp", "co", "company",
];
function normalizeCompanyName(value) {
  if (!value && value !== 0) return "";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((tok, _i, arr) => !(arr.length > 1 && SUFFIXES.includes(tok)))
    .join(" ")
    .trim();
}
function buildCompanyKeys(value) {
  const norm = normalizeCompanyName(value);
  if (!norm) return [];
  return Array.from(new Set([norm, norm.replace(/\s+/g, "-")]));
}

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
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(
            /\\n/g,
            "\n"
          ),
        }),
      });
    }
    return { db: getFirestore() };
  })();
  return _adminAppPromise;
}

function readJsonBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

function matches(targetSlug, candidates) {
  const targetKeys = new Set(buildCompanyKeys(targetSlug));
  if (!targetKeys.size) return false;
  for (const c of candidates || []) {
    for (const k of buildCompanyKeys(c)) {
      if (targetKeys.has(k)) return true;
    }
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { reviewId, uid } = readJsonBody(req);
  if (!reviewId || !uid) {
    return res
      .status(400)
      .json({ error: "reviewId e uid são obrigatórios." });
  }

  try {
    const { db } = await ensureAdmin();

    const reviewRef = db.collection("reviews").doc(reviewId);
    const reviewSnap = await reviewRef.get();
    if (!reviewSnap.exists) {
      return res.status(404).json({ error: "Review não encontrada." });
    }
    const review = reviewSnap.data() || {};
    if (review.uid !== uid) {
      // Só o autor pode disparar a verificação.
      return res.status(403).json({ error: "UID não corresponde à review." });
    }

    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const candidates = Array.isArray(userData?.linkedInCompaniesNormalized)
      ? userData.linkedInCompaniesNormalized
      : [];

    const targetSlug =
      review.companySlug || normalizeCompanyName(review.company || "");
    const verified = matches(targetSlug, candidates);

    if (verified) {
      await reviewRef.update({
        isVerifiedLinkedIn: true,
        verificationSource: "linkedin",
        verifiedAt: new Date().toISOString(),
      });
    }

    return res.status(200).json({ verified });
  } catch (err) {
    console.error("verify-review-linkedin falhou:", err);
    return res.status(500).json({ error: "Falha na verificação." });
  }
}
