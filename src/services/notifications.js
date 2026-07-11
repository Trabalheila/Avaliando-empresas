import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  query,
  where,
  limit,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { sendActivityEmailNotification } from "./email";

/**
 * Serviço de notificações de atividade (reações e respostas a comentários).
 *
 * Coleção `notifications`:
 *   {
 *     toUid,        // destinatário (autor do comentário original)
 *     fromUid,      // quem gerou a atividade (pode ser anônimo)
 *     type,         // "reaction" | "reply"
 *     reviewId,     // avaliação relacionada
 *     companySlug,
 *     companyName,
 *     itemKey,      // critério (opcional)
 *     itemLabel,    // rótulo do critério (opcional, usado no e-mail)
 *     message,      // texto exibido na notificação
 *     link,         // destino ao clicar
 *     read,         // boolean
 *     createdAt,    // serverTimestamp
 *   }
 */

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Cria uma notificação para o destinatário `toUid`. É best-effort: qualquer
 * falha (permissão, rede) é engolida para não quebrar o fluxo principal.
 * Não notifica quando o autor da ação é o próprio destinatário.
 */
export async function createNotification({
  toUid,
  fromUid = "",
  type,
  reviewId = "",
  companySlug = "",
  companyName = "",
  itemKey = "",
  itemLabel = "",
  message = "",
  link = "",
} = {}) {
  try {
    const recipient = (toUid || "").toString().trim();
    if (!recipient) return { created: false };

    const actor = (fromUid || auth.currentUser?.uid || "").toString().trim();
    // Não gera notificação para a própria pessoa.
    if (actor && actor === recipient) return { created: false };

    await addDoc(collection(db, "notifications"), {
      toUid: recipient,
      fromUid: actor,
      type: type || "activity",
      reviewId,
      companySlug,
      companyName,
      itemKey,
      message,
      link,
      read: false,
      createdAt: serverTimestamp(),
    });

    // Dispara também a notificação por E-MAIL logo após criar a in-app, no
    // mesmo fluxo. É assíncrono/best-effort: o backend resolve o e-mail do
    // autor a partir do reviewId (server-side), então o endereço nunca é
    // exposto ao cliente. Autores anônimos simplesmente não recebem e-mail.
    if (reviewId) {
      sendActivityEmailNotification({
        reviewId,
        activityType: type,
        companyName,
        itemLabel,
        link,
      });
    }

    return { created: true };
  } catch (err) {
    // Best-effort: notificação nunca deve interromper a ação do usuário.
    return { created: false, error: err };
  }
}

/**
 * Lista as notificações do usuário (mais recentes primeiro). Evita índice
 * composto: filtra por `toUid` e ordena no cliente.
 */
export async function listNotificationsForUser(uid, take = 30) {
  const recipient = (uid || "").toString().trim();
  if (!recipient) return [];

  try {
    const ref = collection(db, "notifications");
    const q = query(ref, where("toUid", "==", recipient), limit(take));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));
  } catch {
    return [];
  }
}

/** Marca uma notificação como lida. */
export async function markNotificationRead(notificationId) {
  const id = (notificationId || "").toString().trim();
  if (!id) return { updated: false };
  try {
    await updateDoc(doc(db, "notifications", id), { read: true });
    return { updated: true };
  } catch {
    return { updated: false };
  }
}
