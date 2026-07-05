/**
 * commissions.js
 * --------------------------------------------------------------
 * Serviços para o pagamento de comissão "Ad Exitum".
 *
 * Modelo: quando um processo Ad Exitum (exclusivo de advogados) é
 * finalizado / entra em fase de pagamento, o especialista informa o
 * valor total do processo e o valor efetivamente recebido pelo
 * trabalhador. A plataforma calcula a comissão de 10% sobre o valor
 * recebido e registra a intenção de pagamento no Firestore.
 *
 * Coleção no Firestore:
 *   commissions/{id}
 *     workerId           string  (trabalhador associado ao processo)
 *     specialistId       string  (apoiadorId do especialista)
 *     specialistUid      string  (uid do especialista — usado nas rules)
 *     processId          string  (id do processo / caso, se houver)
 *     totalProcessValue  number  (valor total da causa, em R$)
 *     receivedValue      number  (valor recebido pelo trabalhador, em R$)
 *     commissionValue    number  (10% sobre receivedValue, em R$)
 *     paymentDate        ISO string
 *     status             "pending"
 *     createdAtServer    serverTimestamp
 */

import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
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

  const commissionValue = computeCommission(received);

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
