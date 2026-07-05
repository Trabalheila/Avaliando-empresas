/**
 * commissions.js
 * --------------------------------------------------------------
 * Serviços para o pagamento de comissão "Ad Exitum".
 *
 * Modelo: quando um processo Ad Exitum (exclusivo de advogados) é
 * finalizado / entra em fase de pagamento, o especialista informa o
 * valor total do processo (valor da causa) e o percentual cobrado do
 * cliente. A plataforma calcula os honorários do advogado (percentual
 * sobre o valor da causa), o valor que o trabalhador recebe (causa −
 * honorários) e a comissão de 10% sobre os honorários, registrando a
 * intenção de pagamento no Firestore.
 *
 * Coleção no Firestore:
 *   commissions/{id}
 *     workerId           string  (trabalhador associado ao processo)
 *     specialistId       string  (apoiadorId do especialista)
 *     specialistUid      string  (uid do especialista — usado nas rules)
 *     processId          string  (id do processo / caso, se houver)
 *     totalProcessValue  number  (valor total da causa, em R$)
 *     receivedValue      number  (valor recebido pelo trabalhador, em R$)
 *     feePercent         number  (percentual cobrado do cliente, em %)
 *     feeValue           number  (honorários do advogado, em R$)
 *     commissionValue    number  (10% sobre feeValue, em R$)
 *     paymentDate        ISO string
 *     status             "pending"
 *     createdAtServer    serverTimestamp
 */

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

// Percentual da comissão devida à plataforma sobre o valor recebido.
export const COMMISSION_RATE = 0.1;

/** Calcula a comissão (10%) sobre o valor recebido pelo trabalhador.
 *  Retorna 0 para entradas inválidas. */
export function computeCommission(receivedValue) {
  const v = Number(receivedValue);
  if (!Number.isFinite(v) || v <= 0) return 0;
  // Arredonda para centavos para evitar dízimas de ponto flutuante.
  return Math.round(v * COMMISSION_RATE * 100) / 100;
}

/**
 * Registra a intenção de pagamento da comissão Ad Exitum no Firestore e,
 * quando houver um pedido associado (`requestId` em contactRequestsApoiador),
 * marca o processo como "comissão registrada / pendente de pagamento".
 *
 * @returns {Promise<string>} id do documento criado em `commissions`.
 */
export async function registerAdExitumCommission({
  workerId,
  specialistId,
  specialistUid,
  processId = "",
  totalProcessValue,
  receivedValue,
  feePercent = 0,
  feeValue = 0,
  requestId = "",
}) {
  const total = Number(totalProcessValue);
  const received = Number(receivedValue);
  const percent = Number(feePercent) || 0;
  const fee = Number(feeValue) || 0;

  if (!specialistUid) throw new Error("specialistUid obrigatório.");
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("Valor total do processo inválido.");
  }
  if (!Number.isFinite(received) || received <= 0) {
    throw new Error("Valor recebido pelo trabalhador inválido.");
  }

  const commissionValue = computeCommission(fee > 0 ? fee : received);

  const payload = {
    workerId: String(workerId || ""),
    specialistId: String(specialistId || ""),
    specialistUid: String(specialistUid),
    processId: String(processId || ""),
    totalProcessValue: total,
    receivedValue: received,
    feePercent: percent,
    feeValue: fee,
    commissionValue,
    paymentDate: new Date().toISOString(),
    status: "pending",
    createdAtServer: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "commissions"), payload);

  // Atualiza o status do processo Ad Exitum, quando vinculado a um pedido.
  if (requestId) {
    try {
      await updateDoc(doc(db, "contactRequestsApoiador", String(requestId)), {
        commissionStatus: "registered",
        commissionId: ref.id,
        commissionValue,
        commissionRegisteredAt: new Date().toISOString(),
      });
    } catch {
      /* silencioso — a comissão já foi registrada em /commissions */
    }
  }

  return ref.id;
}

/**
 * Lê o registro de valores do processo (Ad Exitum) mais recente de um
 * trabalhador — usado no perfil do trabalhador para exibir o valor do
 * processo, o valor cobrado pelo advogado (honorários) e o valor que ele
 * receberá. A consulta é por `workerId` (o trabalhador só enxerga os próprios
 * registros, conforme as regras do Firestore); o filtro por especialista é
 * aplicado em memória para dispensar índice composto.
 *
 * @param {string} workerUid       UID do trabalhador (Firebase Auth).
 * @param {string} [specialistId]  apoiadorId do especialista (opcional).
 * @returns {Promise<object|null>} registro mais recente ou null.
 */
export async function getWorkerAdExitumSummary(workerUid, specialistId = "") {
  if (!workerUid) return null;
  try {
    const q = query(
      collection(db, "commissions"),
      where("workerId", "==", String(workerUid))
    );
    const snap = await getDocs(q);
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (specialistId) {
      items = items.filter(
        (it) => String(it.specialistId || "") === String(specialistId)
      );
    }
    items.sort((a, b) =>
      String(b.paymentDate || "").localeCompare(String(a.paymentDate || ""))
    );
    return items[0] || null;
  } catch (err) {
    console.warn("Falha ao carregar valores do processo (Ad Exitum):", err);
    return null;
  }
}
