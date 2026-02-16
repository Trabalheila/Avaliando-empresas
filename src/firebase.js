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

// Só pra confirmar no deploy (não expõe a chave, só o tamanho)
console.log("[firebase] apiKey length:", (firebaseConfig.apiKey || "").length);

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Analytics opcional (não deixa a app quebrar se não suportar)
export let analytics = null;
isSupported()
  .then((ok) => {
    if (ok) analytics = getAnalytics(app);
  })
  .catch(() => {});
