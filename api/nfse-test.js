// api/nfse-test.js
// Endpoint manual para validar a emissao de NFS-e no Focus NFe sem depender
// do fluxo Mercado Pago. Protegido por uma chave secreta lida da env
// NFSE_TEST_KEY. Retorne 404 se a chave nao estiver configurada para
// nao expor o endpoint em producao por acidente.
//
// Uso:
//   POST /api/nfse-test?key=<NFSE_TEST_KEY>
//   body opcional: { amount, descricao, payerEmail, payerName, payerDocument, ref }
//
// Retorno: o resultado completo de emitNfse + tryEmitNfseForMercadoPagoPayment
// (com o doc gravado em /nfse_emissoes/{ref}).

import { tryEmitNfseForMercadoPagoPayment } from "./_nfse.js";

let adminResourcesPromise;
async function getAdminResources() {
  if (!adminResourcesPromise) {
    adminResourcesPromise = (async () => {
      const adminApp = await import("firebase-admin/app");
      const adminFirestore = await import("firebase-admin/firestore");
      const { initializeApp, getApps, cert } = adminApp;
      const { getFirestore, FieldValue } = adminFirestore;

      if (!getApps().length) {
        const hasCredentials =
          process.env.FIREBASE_PROJECT_ID &&
          process.env.FIREBASE_CLIENT_EMAIL &&
          process.env.FIREBASE_PRIVATE_KEY;
        if (!hasCredentials) {
          return { db: null, FieldValue: null };
        }
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
  }
  return adminResourcesPromise;
}

export default async function handler(req, res) {
  const expectedKey = (process.env.NFSE_TEST_KEY || "").trim();
  if (!expectedKey) {
    return res.status(404).json({ error: "Not found" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const providedKey = (req.query?.key || req.headers?.["x-nfse-test-key"] || "").toString().trim();
  if (providedKey !== expectedKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body || {};
  const amount = Number(body.amount || 1.0);
  const descricao = (body.descricao || "Teste manual de emissao NFS-e").toString();
  const payerEmail = (body.payerEmail || "teste@trabalheila.com.br").toString();
  const payerName = (body.payerName || "Cliente Teste").toString();
  const payerDocument = (body.payerDocument || "").toString();
  const ref = (body.ref || `manual_${Date.now()}`).toString();

  // Simula o payload que o webhook Mercado Pago entregaria a tryEmit...().
  const fakePayment = {
    id: ref,
    transaction_amount: amount,
    payer: {
      email: payerEmail,
      first_name: payerName,
      identification: payerDocument ? { number: payerDocument } : undefined,
    },
  };

  const { db, FieldValue } = await getAdminResources();

  try {
    const result = await tryEmitNfseForMercadoPagoPayment({
      payment: fakePayment,
      cnpj: null,
      companySlug: "teste-manual",
      apoiadorId: null,
      audience: "test",
      descricao,
      db,
      FieldValue,
      force: true,
    });

    return res.status(200).json({
      ref: `mp_${ref}`,
      sentTo: (process.env.FOCUS_NFE_ENV || "homologacao").toLowerCase(),
      result,
    });
  } catch (err) {
    console.error("[nfse-test] erro inesperado", err);
    return res.status(500).json({ error: err?.message || "erro inesperado" });
  }
}
