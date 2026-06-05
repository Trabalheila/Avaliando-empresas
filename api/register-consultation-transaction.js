// api/register-consultation-transaction.js
//
// PLACEHOLDER — registra a transação financeira de uma consulta avulsa.
//
// Esta função NÃO processa pagamentos reais e NÃO realiza o repasse ao
// especialista. Ela apenas grava os valores recebidos do frontend em uma
// coleção auxiliar (/consultaTransactions) para que, no futuro, exista
// um histórico auditável quando o gateway real (Stripe / Mercado Pago) for
// integrado de ponta a ponta.
//
// Campos esperados no body:
//   userId, specialistId, consultationId,
//   originalAmount, discountApplied, finalAmountPaid,
//   platformCommission, amountDueToSpecialist,
//   paymentMeta? (opcional: { paymentMethodId, last4, brand })

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

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  const {
    userId,
    specialistId,
    consultationId,
    originalAmount,
    discountApplied,
    finalAmountPaid,
    platformCommission,
    amountDueToSpecialist,
    paymentMeta,
  } = req.body || {};

  // Validação mínima no boundary.
  if (!userId || !specialistId || !consultationId) {
    return res
      .status(400)
      .json({ error: "userId, specialistId e consultationId são obrigatórios." });
  }

  const original = toFiniteNumber(originalAmount);
  const discount = toFiniteNumber(discountApplied) ?? 0;
  const finalPaid = toFiniteNumber(finalAmountPaid);
  const commission = toFiniteNumber(platformCommission);
  const dueToSpecialist = toFiniteNumber(amountDueToSpecialist);

  if (original === null || finalPaid === null || commission === null || dueToSpecialist === null) {
    return res.status(400).json({
      error:
        "originalAmount, finalAmountPaid, platformCommission e amountDueToSpecialist devem ser numéricos.",
    });
  }

  try {
    const { db, FieldValue } = await ensureAdmin();

    const doc = {
      userId: String(userId),
      specialistId: String(specialistId),
      consultationId: String(consultationId),
      originalAmount: original,
      discountApplied: discount,
      finalAmountPaid: finalPaid,
      platformCommission: commission,
      amountDueToSpecialist: dueToSpecialist,
      currency: "BRL",
      // Status do registro: "recorded" — apenas registro. Quando o gateway
      // real estiver ativo, este valor passará a "captured" / "refunded" etc.
      status: "recorded",
      paymentMeta:
        paymentMeta && typeof paymentMeta === "object"
          ? {
              paymentMethodId: String(paymentMeta.paymentMethodId || ""),
              last4: String(paymentMeta.last4 || ""),
              brand: String(paymentMeta.brand || ""),
            }
          : null,
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("consultaTransactions").add(doc);

    // Best-effort: marca a consulta como paga (status="paid") para que o
    // dashboard do especialista distinga consultas pagas das avulsas
    // gratuitas legadas. Se a doc não existir, ignora.
    try {
      await db
        .collection("consultas")
        .doc(String(consultationId))
        .set(
          {
            paymentStatus: "paid",
            paymentTransactionId: ref.id,
            paidAmount: finalPaid,
            paidAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    } catch (err) {
      console.warn(
        "[register-consultation-transaction] não foi possível atualizar /consultas:",
        err?.message || err
      );
    }

    return res.status(200).json({
      success: true,
      transactionId: ref.id,
    });
  } catch (err) {
    console.error("[register-consultation-transaction] erro:", err);
    return res.status(500).json({ error: "Erro interno ao registrar transação." });
  }
}
