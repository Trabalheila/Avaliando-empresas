// api/notify-new-message.js
//
// Envia uma notificação push (Firebase Cloud Messaging) ao ESPECIALISTA
// quando um trabalhador envia uma nova mensagem numa consulta ativa.
//
// Fluxo:
//   1. O cliente do trabalhador (src/services/chat.js) chama este endpoint
//      após gravar a mensagem, passando { conversationId, senderUid }.
//   2. Aqui resolvemos, via Admin SDK:
//        • o especialista da conversa (conversations/{id}.specialistDocId);
//        • o token FCM salvo em apoiadores/{specialistDocId}.fcmToken;
//        • o pseudônimo do trabalhador (conversations/{id}.peerNames[senderUid]
//          ou, em fallback, users/{senderUid}.pseudonimo).
//   3. Enviamos o push: "Você tem uma nova mensagem de <pseudônimo>".
//
// Best-effort: se o Admin SDK não estiver configurado, se não houver token
// FCM, ou se o remetente for o próprio especialista, retornamos 200 com
// `sent: false` (nunca derruba o envio da mensagem no cliente).
//
// Variáveis de ambiente:
//   FIREBASE_SERVICE_ACCOUNT  JSON da Service Account (já usado no projeto).
//   APP_BASE_URL              base URL pública (para o deep-link da notificação).

import { getAdminResources } from "./_firebaseAdmin.js";

const APP_BASE_URL = String(process.env.APP_BASE_URL || "").replace(/\/+$/, "");

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método não permitido" });
  }

  const body = req.body || {};
  const conversationId = String(body.conversationId || "").trim();
  const senderUid = String(body.senderUid || "").trim();

  if (!conversationId || !senderUid) {
    return res
      .status(400)
      .json({ ok: false, error: "conversationId e senderUid são obrigatórios." });
  }

  let db;
  try {
    ({ db } = await getAdminResources());
  } catch (err) {
    console.warn("[notify-new-message] Admin SDK indisponível:", err?.message);
    return res.status(200).json({ ok: true, sent: false, reason: "admin_unavailable" });
  }

  try {
    const convSnap = await db.collection("conversations").doc(conversationId).get();
    if (!convSnap.exists) {
      return res.status(200).json({ ok: true, sent: false, reason: "conversation_not_found" });
    }
    const conv = convSnap.data() || {};

    const participants = Array.isArray(conv.participants) ? conv.participants : [];
    if (!participants.includes(senderUid)) {
      return res.status(200).json({ ok: true, sent: false, reason: "not_a_participant" });
    }

    // Só notificamos o especialista quando quem enviou NÃO é o próprio
    // especialista (ou seja, a mensagem veio do trabalhador).
    const specialistUid = String(conv.specialistId || "");
    if (senderUid === specialistUid) {
      return res.status(200).json({ ok: true, sent: false, reason: "sender_is_specialist" });
    }

    // Resolve o documento do especialista em /apoiadores para obter o token.
    let specialistDocId = String(conv.specialistDocId || "");
    let fcmToken = "";
    if (specialistDocId) {
      const apoiadorSnap = await db.collection("apoiadores").doc(specialistDocId).get();
      if (apoiadorSnap.exists) fcmToken = String(apoiadorSnap.data()?.fcmToken || "");
    }
    // Fallback: localiza o apoiador pelo uid quando não há specialistDocId.
    if (!fcmToken && specialistUid) {
      const q = await db
        .collection("apoiadores")
        .where("uid", "==", specialistUid)
        .limit(1)
        .get();
      if (!q.empty) {
        specialistDocId = q.docs[0].id;
        fcmToken = String(q.docs[0].data()?.fcmToken || "");
      }
    }

    if (!fcmToken) {
      return res.status(200).json({ ok: true, sent: false, reason: "no_fcm_token" });
    }

    // Pseudônimo do trabalhador remetente.
    let pseudonym = String((conv.peerNames || {})[senderUid] || "").trim();
    if (!pseudonym) {
      const userSnap = await db.collection("users").doc(senderUid).get();
      if (userSnap.exists) {
        const u = userSnap.data() || {};
        pseudonym = String(u.pseudonimo || u.pseudonym || u.name || "").trim();
      }
    }
    if (!pseudonym) pseudonym = "um cliente";

    const deepLink = `${APP_BASE_URL}/chat/${encodeURIComponent(
      conversationId
    )}?peer=${encodeURIComponent(pseudonym)}&peerRole=trabalhador`;

    const { getMessaging } = await import("firebase-admin/messaging");
    try {
      await getMessaging().send({
        token: fcmToken,
        notification: {
          title: "Nova mensagem",
          body: `Você tem uma nova mensagem de ${pseudonym}`,
        },
        data: {
          conversationId,
          url: deepLink,
        },
        webpush: {
          fcmOptions: { link: deepLink },
          notification: { icon: "/logo192.png" },
        },
      });
    } catch (err) {
      // Token inválido/expirado: remove do perfil para não repetir o erro.
      const code = err?.errorInfo?.code || err?.code || "";
      if (
        specialistDocId &&
        (code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token")
      ) {
        try {
          const { FieldValue } = await getAdminResources();
          await db
            .collection("apoiadores")
            .doc(specialistDocId)
            .update({ fcmToken: FieldValue.delete() });
        } catch {
          /* ignore */
        }
      }
      console.warn("[notify-new-message] Falha ao enviar FCM:", code || err?.message);
      return res.status(200).json({ ok: true, sent: false, reason: "fcm_error" });
    }

    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error("[notify-new-message] Erro:", err?.message || err);
    return res.status(500).json({ ok: false, error: "Erro interno." });
  }
}
