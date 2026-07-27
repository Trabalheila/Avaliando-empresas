// src/services/pushNotifications.js
//
// Camada de cliente do Firebase Cloud Messaging (FCM) para o especialista.
//
// Responsabilidades:
//   • registerSpecialistPush({ apoiadorId }) — pede permissão de notificação,
//     obtém o token FCM do dispositivo e o salva em apoiadores/{apoiadorId}.
//     Chamado quando o especialista faz login / abre o painel.
//   • subscribeForegroundMessages(cb) — escuta mensagens FCM recebidas com o
//     app em primeiro plano e exibe uma notificação nativa (o Service Worker
//     cuida das mensagens em segundo plano).
//
// Todas as funções são best-effort: se o navegador não suporta FCM/Service
// Worker/Notification (ex.: WebView do Capacitor), elas simplesmente não
// fazem nada em vez de lançar.

import { getToken, onMessage } from "firebase/messaging";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, firebaseConfig, messagingPromise } from "../firebase";

// Chave pública VAPID do par de chaves Web Push do projeto (Console do
// Firebase → Cloud Messaging → Web Push certificates). Necessária para o
// getToken() gerar o token do navegador.
const VAPID_KEY = (process.env.REACT_APP_FIREBASE_VAPID_KEY || "").trim();

/** Verifica o suporte mínimo do ambiente para FCM Web. */
function isBrowserPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window &&
    "PushManager" in window
  );
}

/**
 * Registra o Service Worker do FCM (public/firebase-messaging-sw.js). O SW é
 * necessário tanto para receber mensagens em segundo plano quanto para
 * gerar o token no getToken().
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
async function registerServiceWorker() {
  try {
    // Passa a configuração de cliente do Firebase ao SW via query string —
    // ele precisa dela para inicializar o app e o messaging. São chaves
    // públicas de cliente (não segredos).
    const params = new URLSearchParams({
      apiKey: firebaseConfig.apiKey || "",
      projectId: firebaseConfig.projectId || "",
      messagingSenderId: firebaseConfig.messagingSenderId || "",
      appId: firebaseConfig.appId || "",
    });
    return await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${params.toString()}`
    );
  } catch (err) {
    console.warn("[push] Falha ao registrar o service worker do FCM:", err);
    return null;
  }
}

/**
 * Pede permissão de notificação, obtém o token FCM do dispositivo e o grava
 * no documento do perfil do especialista (apoiadores/{apoiadorId}.fcmToken).
 *
 * @param {object} args
 * @param {string} args.apoiadorId  id do doc em /apoiadores.
 * @returns {Promise<string|null>} token salvo ou null quando indisponível.
 */
export async function registerSpecialistPush({ apoiadorId }) {
  if (!apoiadorId) return null;
  if (!isBrowserPushSupported()) return null;
  if (!VAPID_KEY) {
    console.warn(
      "[push] REACT_APP_FIREBASE_VAPID_KEY ausente; token FCM não será gerado."
    );
    return null;
  }

  const messaging = await messagingPromise;
  if (!messaging) return null;

  // Só pede permissão se ainda não foi decidida — evita repetir o prompt.
  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      return null;
    }
  }
  if (permission !== "granted") return null;

  const registration = await registerServiceWorker();
  if (!registration) return null;

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

    await updateDoc(doc(db, "apoiadores", String(apoiadorId)), {
      fcmToken: token,
      fcmTokenUpdatedAt: serverTimestamp(),
    });
    return token;
  } catch (err) {
    console.warn("[push] Falha ao obter/salvar o token FCM:", err);
    return null;
  }
}

/**
 * Escuta mensagens FCM recebidas com o app em primeiro plano. Como o Service
 * Worker só exibe notificações quando o app está em segundo plano, aqui
 * mostramos uma notificação nativa manualmente. Retorna uma função de
 * cancelamento (no-op quando não suportado).
 *
 * @param {(payload: object) => void} [onReceive] callback opcional.
 * @returns {Promise<() => void>}
 */
export async function subscribeForegroundMessages(onReceive) {
  if (!isBrowserPushSupported()) return () => {};
  const messaging = await messagingPromise;
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    try {
      const title =
        payload?.notification?.title || "Nova mensagem";
      const body =
        payload?.notification?.body ||
        payload?.data?.body ||
        "Você recebeu uma nova mensagem.";
      if (Notification.permission === "granted") {
        // eslint-disable-next-line no-new
        new Notification(title, { body, icon: "/logo192.png" });
      }
    } catch {
      /* silencioso */
    }
    if (typeof onReceive === "function") onReceive(payload);
  });
}
