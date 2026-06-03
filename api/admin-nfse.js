// /api/admin-nfse.js
//
// Endpoint admin para listar e auditar as NFS-e emitidas pelo webhook
// (collection `nfse_emissoes` no Firestore) e, opcionalmente, consultar o
// status atual de uma nota direto na Focus NFe (que processa a emissao de
// forma assincrona).
//
// Subrotas (via querystring `?op=...`):
//   - op=list            (default)  -> lista paginada
//   - op=refresh                    -> GET /v2/nfse?ref=... na Focus NFe
//
// Acesso restrito ao ADMIN_UID (mesma regra usada em /api/admin).

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

function requireAdminUid(uid) {
  const adminUid = (process.env.REACT_APP_ADMIN_UID || process.env.ADMIN_UID || "").trim();
  return Boolean(adminUid) && uid === adminUid;
}

function getFocusBaseUrl() {
  const env = (process.env.FOCUS_NFE_ENV || "homologacao").toLowerCase();
  return env === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
}

function serializeDoc(doc) {
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
    raw: data.raw || null,
    createdAt,
  };
}

async function handleList(req, res) {
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

    const items = snap.docs.map(serializeDoc);
    return res.status(200).json({ items, count: items.length });
  } catch (err) {
    console.error("[admin-nfse/list] erro:", err);
    return res.status(500).json({ error: err?.message || "Erro ao listar NFS-e." });
  }
}

async function handleRefresh(req, res) {
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

  // Persiste o status atualizado no Firestore para refletir na proxima listagem.
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
    console.warn("[admin-nfse/refresh] falha ao persistir:", writeErr?.message || writeErr);
  }

  return res.status(response.status).json({
    ok: response.ok,
    status: response.status,
    data: json,
  });
}

export default async function handler(req, res) {
  const op = (req.query?.op || "list").toString();
  if (op === "list" && req.method === "GET") return handleList(req, res);
  if (op === "refresh" && req.method === "POST") return handleRefresh(req, res);
  return res.status(405).json({ error: "Operacao nao suportada." });
}
