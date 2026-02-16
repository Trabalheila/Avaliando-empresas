import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCA4gSq_TLazbEMBSN_87aUKP9LA9AvsFk",
  authDomain: "trabalheila.firebaseapp.com",
  projectId: "trabalheila",
  storageBucket: "trabalheila.firebasestorage.app",
  messagingSenderId: "338684255438",
  appId: "1:338684255438:web:88a03cf43a04adfe23449f",
  measurementId: "G-3H8CY15WLE",
};

// diagnóstico leve (não imprime a chave, só o tamanho)
console.log("[firebase] apiKey length:", (firebaseConfig.apiKey || "").length);

// inicializa uma vez
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// serviços
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// analytics opcional (não quebra se não suportar)
export let analytics = null;
isSupported()
  .then((ok) => {
    if (ok) analytics = getAnalytics(app);
  })
  .catch(() => {});
