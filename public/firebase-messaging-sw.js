/* public/firebase-messaging-sw.js
 *
 * Service Worker do Firebase Cloud Messaging (FCM). Recebe as notificações
 * push do especialista quando o app está em SEGUNDO PLANO (aba fechada ou
 * sem foco) e as exibe como notificação nativa do sistema.
 *
 * A configuração de cliente do Firebase é passada via query string no
 * registro (ver src/services/pushNotifications.js) — são chaves públicas de
 * cliente, não segredos.
 */

/* eslint-disable no-undef */
importScripts(
  "https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js"
);

// Lê a configuração da query string do próprio SW.
const params = new URL(self.location).searchParams;
const firebaseConfig = {
  apiKey: params.get("apiKey") || "",
  projectId: params.get("projectId") || "trabalheila",
  messagingSenderId: params.get("messagingSenderId") || "338684255438",
  appId:
    params.get("appId") ||
    "1:338684255438:web:88a03cf43a04adfe23449f",
};

if (firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

// Mensagens recebidas com o app em segundo plano.
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "Nova mensagem";
  const options = {
    body:
      (payload.notification && payload.notification.body) ||
      "Você recebeu uma nova mensagem.",
    icon: "/logo192.png",
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

// Ao clicar na notificação, abre/foca a conversa (quando a URL vier em data).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
        return undefined;
      })
  );
});
