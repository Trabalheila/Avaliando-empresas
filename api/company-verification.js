// api/company-verification.js
//
// Verificação de propriedade/identidade de empresas em 3 camadas:
//
//   1) CNPJ:      consulta BrasilAPI/ReceitaWS para confirmar existência do CNPJ,
//                 capturar razão social, nome fantasia e situação cadastral.
//   2) E-mail corporativo: rejeita domínios públicos (gmail, hotmail, etc.) e
//                 verifica se o domínio do e-mail tem afinidade com a razão
//                 social / nome fantasia (similaridade de slug). Em seguida
//                 envia um código de 6 dígitos via Resend.
//   3) Manual:    pedidos com tier Premium ou que falham na heurística de
//                 domínio entram em status `pending_manual` e ficam visíveis
//                 ao admin para aprovação/rejeição com anotações.
//
// Sub-rotas (querystring `?op=`):
//   POST ?op=request          — body { uid, cnpj, corporateEmail, pseudonym?, tier? }
//                               cria/atualiza /companyVerifications/{id}, envia código.
//   POST ?op=confirm          — body { requestId, code }
//                               valida código, atualiza usuário (admin_empresa) e
//                               /companies/{cnpj}.verified = true (se sem etapa manual).
//   POST ?op=resend           — body { requestId } reenvia código (rate-limit simples).
//   POST ?op=list             — admin: lista solicitações por status.
//   POST ?op=manual-decision  — admin: { requestId, action: approve|reject, notes }.

import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { Resend } from "resend";

// ──────────────────────────────────────────────────────────
// Inicialização lazy do Firebase Admin SDK
// ──────────────────────────────────────────────────────────
let _initTried = false;
function ensureAdmin() {
  if (_initTried) return;
  _initTried = true;
  if (admin.apps.length) return;
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error("Firebase Admin não configurado.");
  }
  let pk = process.env.FIREBASE_PRIVATE_KEY.replace(/^\uFEFF/, "").trim();
  if ((pk.startsWith('"') && pk.endsWith('"')) || (pk.startsWith("'") && pk.endsWith("'"))) {
    pk = pk.slice(1, -1);
  }
  pk = pk.replace(/\\n/g, "\n").replace(/\r/g, "");
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: pk,
    }),
  });
}

function requireAdminUid(uid) {
  const adminUid = (process.env.REACT_APP_ADMIN_UID || process.env.ADMIN_UID || "").trim();
  return Boolean(adminUid) && uid === adminUid;
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com",
  "yahoo.com", "yahoo.com.br", "icloud.com", "me.com", "aol.com",
  "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br", "globo.com",
  "r7.com", "zipmail.com.br", "msn.com", "proton.me", "protonmail.com",
]);

function normalizeForMatch(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const COMPANY_TYPE_TOKENS = new Set([
  "ltda", "sa", "eireli", "me", "epp", "mei", "company", "co", "corp",
  "inc", "group", "grupo", "holding", "do", "da", "de", "dos", "das",
  "brasil", "br", "tecnologia", "tech",
]);

function tokensFromName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !COMPANY_TYPE_TOKENS.has(t));
}

function domainAffinityScore(domain, companyNames) {
  const d = normalizeForMatch(domain.split(".")[0]);
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
        situacao_cadastral:
          (data.descricao_situacao_cadastral || data.situacao_cadastral || "").toString().toUpperCase(),
        uf: data.uf || "",
        municipio: data.municipio || "",
        source: "brasilapi",
      };
    }
  } catch (err) {
    console.warn("[company-verification] BrasilAPI falhou:", err?.message || err);
  }
  return null;
}

async function sendCodeEmail({ email, code, razaoSocial }) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!resendKey || !fromAddress) {
    throw new Error("Serviço de e-mail não configurado.");
  }
  const resend = new Resend(resendKey);
  const subject = "Código de verificação — Trabalhei Lá";
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
      <p style="font-size:12px;color:#475569;">Este código expira em 30 minutos. Se você não solicitou, ignore este e-mail.</p>
    </div>
  `;
  const text = `Seu código de verificação é: ${code}\nExpira em 30 minutos.`;
  const { error } = await resend.emails.send({
    from: fromAddress,
    to: email,
    subject,
    html,
    text,
  });
  if (error) throw new Error(error.message || "Falha ao enviar código.");
}

// ──────────────────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────────────────
async function handleRequest(req, res) {
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
  const emailLower = corporateEmail.trim().toLowerCase();
  const domain = emailLower.split("@")[1] || "";
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return res.status(400).json({
      error:
        "Use um e-mail corporativo (com domínio próprio da empresa). Domínios públicos como Gmail/Hotmail não são aceitos.",
      reason: "public_domain",
    });
  }

  // 1) Consulta CNPJ
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

  // 2) Heurística de afinidade de domínio
  const affinity = domainAffinityScore(domain, [
    cnpjData.razao_social,
    cnpjData.nome_fantasia,
  ]);

  // 3) Determina próximo passo
  // - Premium: sempre passa por verificação manual após o e-mail.
  // - Sem afinidade: também vai para manual.
  // - Com afinidade alta + tier free: aprova após confirmação do código.
  const requiresManual = tier === "premium" || affinity < 0.8;

  // 4) Cria/atualiza requisição
  ensureAdmin();
  const db = getFirestore();
  const requestId = `${uid}_${digits}`;
  const code = generateCode();
  const codeHash = await hashCode(code);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30min

  await db.collection("companyVerifications").doc(requestId).set(
    {
      uid,
      cnpj: digits,
      corporateEmail: emailLower,
      pseudonym: pseudonym.slice(0, 80),
      tier,
      razaoSocial: cnpjData.razao_social,
      nomeFantasia: cnpjData.nome_fantasia,
      domainAffinity: affinity,
      requiresManual,
      status: "pending_email",
      codeHash,
      codeAttempts: 0,
      codeExpiresAt: expiresAt,
      lastCodeSentAt: now,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // 5) Envia código
  try {
    await sendCodeEmail({
      email: emailLower,
      code,
      razaoSocial: cnpjData.razao_social,
    });
  } catch (err) {
    console.error("[company-verification/request] Falha ao enviar código:", err);
    return res.status(500).json({ error: "Falha ao enviar código de verificação." });
  }

  return res.status(200).json({
    ok: true,
    requestId,
    requiresManual,
    domainAffinity: affinity,
    razaoSocial: cnpjData.razao_social,
    nomeFantasia: cnpjData.nome_fantasia,
  });
}

async function hashCode(code) {
  const { createHash } = await import("crypto");
  const salt = process.env.EMAIL_VERIFICATION_SECRET || "trabalheila";
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

async function handleConfirm(req, res) {
  const { requestId, code } = req.body || {};
  if (!requestId || !code) {
    return res.status(400).json({ error: "requestId e code obrigatórios." });
  }
  ensureAdmin();
  const db = getFirestore();
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
      codeAttempts: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.status(400).json({ error: "Código incorreto." });
  }

  // Código correto — promove status.
  const nextStatus = data.requiresManual ? "pending_manual" : "verified";
  await ref.update({
    status: nextStatus,
    emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    codeHash: null,
    codeAttempts: 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (nextStatus === "verified") {
    await applyVerificationSideEffects(db, data);
  }

  return res.status(200).json({
    ok: true,
    status: nextStatus,
    requiresManual: Boolean(data.requiresManual),
  });
}

async function applyVerificationSideEffects(db, data) {
  const { uid, cnpj, corporateEmail, razaoSocial, nomeFantasia } = data;
  const batch = db.batch();
  const userRef = db.collection("users").doc(uid);
  batch.set(
    userRef,
    {
      role: "admin_empresa",
      isEmployer: true,
      managedCompanyCnpj: cnpj,
      corporateEmail,
      companyVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  const companyRef = db.collection("companies").doc(cnpj);
  batch.set(
    companyRef,
    {
      cnpj,
      razaoSocial: razaoSocial || null,
      nomeFantasia: nomeFantasia || null,
      verified: true,
      verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedBy: corporateEmail,
      verifiedByUid: uid,
    },
    { merge: true }
  );
  await batch.commit();
}

async function handleResend(req, res) {
  const { requestId } = req.body || {};
  if (!requestId) return res.status(400).json({ error: "requestId obrigatório." });
  ensureAdmin();
  const db = getFirestore();
  const ref = db.collection("companyVerifications").doc(String(requestId));
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Solicitação não encontrada." });
  const data = snap.data() || {};
  if (data.status === "verified" || data.status === "approved") {
    return res.status(400).json({ error: "Já verificado." });
  }

  // Rate-limit simples: 60s entre reenvios.
  const last = data.lastCodeSentAt?.toDate?.() || new Date(data.lastCodeSentAt || 0);
  if (last && Date.now() - last.getTime() < 60_000) {
    return res.status(429).json({ error: "Aguarde 1 minuto antes de pedir um novo código." });
  }

  const code = generateCode();
  const codeHash = await hashCode(code);
  const expires = new Date(Date.now() + 30 * 60 * 1000);
  await ref.update({
    codeHash,
    codeAttempts: 0,
    codeExpiresAt: expires,
    lastCodeSentAt: new Date(),
    status: "pending_email",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  try {
    await sendCodeEmail({
      email: data.corporateEmail,
      code,
      razaoSocial: data.razaoSocial,
    });
  } catch (err) {
    console.error("[company-verification/resend] erro:", err);
    return res.status(500).json({ error: "Falha ao reenviar código." });
  }
  return res.status(200).json({ ok: true });
}

async function handleList(req, res) {
  const { uid, status = "pending_manual" } = req.body || {};
  if (!requireAdminUid(uid)) {
    return res.status(403).json({ error: "Acesso restrito." });
  }
  ensureAdmin();
  const db = getFirestore();
  let q = db.collection("companyVerifications").orderBy("updatedAt", "desc").limit(200);
  if (status && status !== "todos") {
    q = db
      .collection("companyVerifications")
      .where("status", "==", status)
      .orderBy("updatedAt", "desc")
      .limit(200);
  }
  try {
    const snap = await q.get();
    const items = snap.docs.map((d) => {
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
    console.error("[company-verification/list] erro:", err);
    return res.status(500).json({ error: "Erro ao listar solicitações." });
  }
}

async function handleManualDecision(req, res) {
  const { uid, requestId, action, notes = "" } = req.body || {};
  if (!requireAdminUid(uid)) {
    return res.status(403).json({ error: "Acesso restrito." });
  }
  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ error: "action inválido." });
  }
  ensureAdmin();
  const db = getFirestore();
  const ref = db.collection("companyVerifications").doc(String(requestId));
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: "Solicitação não encontrada." });
  const data = snap.data() || {};

  const update = {
    notes: String(notes || "").slice(0, 1000),
    decidedBy: uid,
    decidedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (action === "approve") {
    update.status = "verified";
    await ref.update(update);
    await applyVerificationSideEffects(db, data);
  } else {
    update.status = "rejected";
    await ref.update(update);
  }

  return res.status(200).json({ ok: true, status: update.status });
}

// ──────────────────────────────────────────────────────────
// Entry
// ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }
  const op = String(req.query?.op || "").toLowerCase();
  try {
    if (op === "request") return await handleRequest(req, res);
    if (op === "confirm") return await handleConfirm(req, res);
    if (op === "resend") return await handleResend(req, res);
    if (op === "list") return await handleList(req, res);
    if (op === "manual-decision") return await handleManualDecision(req, res);
    return res.status(400).json({ error: "Parâmetro 'op' inválido." });
  } catch (err) {
    console.error("[company-verification] erro inesperado:", err);
    return res.status(500).json({ error: err?.message || "Erro interno." });
  }
}
