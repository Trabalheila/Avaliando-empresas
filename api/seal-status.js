// /api/seal-status
// Calcula se uma empresa atende aos critérios do "Selo Trabalhei Lá de
// Excelência" e atualiza o documento da empresa em /companies/{cnpj}.
//
// Critérios:
//   - averageScore >= 4.5
//   - numberOfEvaluations >= 10
//
// Uso:
//   POST /api/seal-status   { cnpj: "35804638000160" }
//   GET  /api/seal-status?cnpj=35804638000160     (somente cálculo, idempotente)
//
// Em ambos os casos retorna:
//   {
//     cnpj, averageScore, numberOfEvaluations, hasSeal,
//     thresholds: { minAverage: 4.5, minEvaluations: 10 },
//     sealGrantedDate: <ISO|null>
//   }
//
// O endpoint é seguro para ser chamado pelo próprio frontend logo após
// uma nova avaliação ser criada — recalcula em O(N) sobre evaluations.

import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const MIN_AVERAGE = 4.5;
const MIN_EVALUATIONS = 10;

function pickScore(doc) {
  // Aceita docs com `averageScore` (gravado pelo seed) ou objeto `scores`
  // (avaliações criadas pela UI). Ignora docs sem nota numérica.
  if (typeof doc.averageScore === 'number' && Number.isFinite(doc.averageScore)) {
    return doc.averageScore;
  }
  if (doc.scores && typeof doc.scores === 'object') {
    const values = Object.values(doc.scores).filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (!values.length) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  if (typeof doc.rating === 'number' && Number.isFinite(doc.rating)) {
    return doc.rating;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const cnpjRaw = (req.method === 'GET' ? req.query?.cnpj : req.body?.cnpj) || '';
  const cnpj = String(cnpjRaw).replace(/\D/g, '');
  if (cnpj.length !== 14) {
    return res.status(400).json({ error: 'CNPJ inválido. Deve ter 14 dígitos.' });
  }

  try {
    const firestore = getFirestore();

    const snap = await firestore
      .collection('evaluations')
      .where('companyCnpj', '==', cnpj)
      .get();

    let sum = 0;
    let count = 0;
    snap.forEach((doc) => {
      const s = pickScore(doc.data());
      if (s != null) {
        sum += s;
        count += 1;
      }
    });

    const averageScore = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
    const hasSeal = averageScore >= MIN_AVERAGE && count >= MIN_EVALUATIONS;

    const companyRef = firestore.collection('companies').doc(cnpj);
    const update = {
      averageScore,
      numberOfEvaluations: count,
      hasSeal,
    };
    if (hasSeal) {
      // Só seta a data se ainda não houver — preserva a data original de concessão.
      const current = await companyRef.get();
      if (!current.exists || !current.data()?.sealGrantedDate) {
        update.sealGrantedDate = admin.firestore.FieldValue.serverTimestamp();
      }
    } else {
      update.sealGrantedDate = null;
    }

    await companyRef.set(update, { merge: true });

    // Lê de volta para devolver a data normalizada.
    const after = (await companyRef.get()).data() || {};
    const grantedTs = after.sealGrantedDate;
    const sealGrantedDate =
      grantedTs && typeof grantedTs.toDate === 'function'
        ? grantedTs.toDate().toISOString()
        : null;

    return res.status(200).json({
      cnpj,
      averageScore,
      numberOfEvaluations: count,
      hasSeal,
      sealGrantedDate,
      thresholds: { minAverage: MIN_AVERAGE, minEvaluations: MIN_EVALUATIONS },
    });
  } catch (err) {
    console.error('[seal-status] erro:', err?.message || err);
    return res.status(500).json({ error: 'Erro ao calcular o selo.' });
  }
}
