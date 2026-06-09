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

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "trabalheila.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "trabalheila",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "trabalheila.appspot.com",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "338684255438",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:338684255438:web:88a03cf43a04adfe23449f",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-3H8CY15WLE",
};

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
  console.warn(
    "Firebase não está totalmente configurado. Defina as variáveis de ambiente REACT_APP_FIREBASE_<KEY>:",
    missingKeys
  );
}

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

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
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: [browserLocalPersistence, indexedDBLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch {
  // `initializeAuth` lança se o Auth já foi inicializado (HMR / múltiplos
  // imports). Nesse caso reaproveitamos a instância existente.
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);
export const storage = getStorage(app);
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
    if (typeof authInstance.authStateReady === "function") {
      await authInstance.authStateReady();
    }
  } catch {
    /* segue mesmo assim — o caller ainda checa auth.currentUser */
  }
  return authInstance.currentUser;
}


// analytics (opcional)
export const analyticsPromise = isSupported().then((yes) =>
  yes ? getAnalytics(app) : null
);
