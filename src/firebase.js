import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  getMessaging,
  isSupported as isMessagingSupported,
} from "firebase/messaging";

const runtimeEnv = typeof window !== "undefined" && window._env_ ? window._env_ : {};
const getEnv = (key, fallback = "") => {
  const runtimeValue = runtimeEnv[key];
  const envValue = runtimeValue ?? process.env[key] ?? fallback;
  return typeof envValue === "string" ? envValue.trim() : String(envValue || "").trim();
};

const firebaseConfig = {
  apiKey: getEnv("REACT_APP_FIREBASE_API_KEY"),
  authDomain: getEnv("REACT_APP_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("REACT_APP_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("REACT_APP_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("REACT_APP_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("REACT_APP_FIREBASE_APP_ID"),
  measurementId: getEnv("REACT_APP_FIREBASE_MEASUREMENT_ID")
};

// Reexportado para que o Service Worker do FCM (public/firebase-messaging-sw.js)
// possa ser inicializado com a mesma configuração — os valores são passados a
// ele via query string no momento do registro (chaves de cliente não são
// segredos.
export { firebaseConfig };

const requiredKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);
if (missingKeys.length > 0) {
  console.error(
    "[firebase] Configuração incompleta. Defina as variáveis REACT_APP_FIREBASE_<KEY>:",
    missingKeys
  );
}

const isFirebaseConfigured = missingKeys.length === 0;
export const firebaseInitError = isFirebaseConfigured
  ? null
  : new Error(`Firebase não está configurado: ${missingKeys.join(", ")}`);

export const app = (() => {
  if (!isFirebaseConfigured) {
    return null;
  }

  try {
    return getApps().length ? getApp() : initializeApp(firebaseConfig);
  } catch (error) {
    console.error("[firebase] Falha ao inicializar o app do Firebase:", error);
    return null;
  }
})();

// Persistência do Firebase Auth.
//
// Bug que isto corrige: usuários logados, depois de algumas horas, ao clicar
// em "Buscar ajuda" / "Minha conta" eram jogados para /login — mesmo a Home
// ainda mostrando "Bem-vindo(a), ...". Causa raiz: a Home deriva o estado de
// login do `localStorage.userProfile` (que sobrevive indefinidamente),
// enquanto RequireAuth/MinhaConta usam `onAuthStateChanged` (a sessão REAL do
// Auth). Por padrão o SDK guarda essa sessão no IndexedDB, que o WebView do
// Capacitor (Android) e alguns navegadores mobile despejam sob pressão de
// memória após horas — enquanto o localStorage permanece intacto. Resultado:
// a Home "mente" (localStorage vivo) e as rotas protegidas redirecionam
// (sessão do IndexedDB sumiu).
//
// Solução: forçar `browserLocalPersistence` (localStorage) como armazenamento
// PRIMÁRIO da sessão, co-localizando-a no mesmo storage durável do
// `userProfile`. IndexedDB fica como fallback. Na inicialização o SDK migra
// qualquer sessão pré-existente para o localStorage.
//
// `browserPopupRedirectResolver` é obrigatório ao usar `initializeAuth`
// porque o app faz login do Google via `signInWithPopup`; sem ele o popup
// quebraria com `auth/argument-error`.
let authInstance = null;
if (app) {
  try {
    authInstance = initializeAuth(app, {
      persistence: [browserLocalPersistence, indexedDBLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch (error) {
    // `initializeAuth` lança se o Auth já foi inicializado (HMR / múltiplos
    // imports). Nesse caso reaproveitamos a instância existente.
    try {
      authInstance = getAuth(app);
    } catch (authError) {
      console.error("[firebase] Falha ao inicializar o auth do Firebase:", authError);
    }
  }
} else {
  console.error("[firebase] Auth não inicializado porque o app do Firebase está indisponível.");
}

export const auth = authInstance;
export const db = app ? getFirestore(app) : null;
export const storage = app ? getStorage(app) : null;
export const googleProvider = new GoogleAuthProvider();

// Aguarda o SDK terminar a restauração da sessão persistida antes de
// qualquer decisão que dependa de `auth.currentUser`.
//
// Bug que isto corrige: no mount da Home, efeitos de leitura faziam
// `if (!auth.currentUser) signInAnonymously(auth)`. Como a restauração da
// sessão é ASSÍNCRONA, logo após um reload / navegação de volta para "/"
// o `auth.currentUser` ainda é `null` por alguns milissegundos — então o
// login anônimo disparava e SUBSTITUÍA a sessão real do usuário por uma
// anônima. Em seguida a reconciliação da Home via `onAuthStateChanged`
// via um usuário anônimo, rebaixava a Home para "deslogado" e limpava o
// `localStorage.userProfile` — fazendo a tela de "Escolha seu perfil"
// reaparecer para um usuário que já estava logado e com perfil definido.
//
// `authStateReady()` (Firebase v9.16+) resolve somente após a primeira
// determinação do estado de auth, garantindo que a sessão persistida já
// foi restaurada. Só então faz sentido checar `auth.currentUser`.
export async function ensureAuthReady() {
  try {
    if (authInstance && typeof authInstance.authStateReady === "function") {
      await authInstance.authStateReady();
    }
  } catch {
    /* segue mesmo assim — o caller ainda checa auth.currentUser */
  }
  return authInstance ? authInstance.currentUser : null;
}


// analytics (opcional)
export const analyticsPromise = isSupported().then((yes) =>
  yes && app ? getAnalytics(app) : null
);

// Firebase Cloud Messaging (FCM) — usado para enviar notificações push ao
// especialista quando ele recebe uma nova mensagem de um cliente.
//
// `getMessaging` só funciona em contextos com suporte a Service Worker e à
// API Notification. Em navegadores/WebViews sem suporte, `isMessagingSupported()`
// resolve `false` — por isso o messaging é carregado de forma preguiçosa e
// GUARDADA, resolvendo para `null` quando indisponível (nunca lança).
export const messagingPromise = isMessagingSupported()
  .then((yes) => (yes && app ? getMessaging(app) : null))
  .catch(() => null);
