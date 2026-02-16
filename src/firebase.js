import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: (process.env.REACT_APP_FIREBASE_API_KEY || "").trim(),
  authDomain: (process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "").trim(),
  projectId: (process.env.REACT_APP_FIREBASE_PROJECT_ID || "").trim(),
  storageBucket: (process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "").trim(),
  messagingSenderId: (process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "").trim(),
  appId: (process.env.REACT_APP_FIREBASE_APP_ID || "").trim(),
};

// Diagnóstico seguro (não vaza a key)
console.log("[firebase] apiKey length:", firebaseConfig.apiKey.length);

// Falha com mensagem clara se env não chegou no build
if (!firebaseConfig.apiKey) {
  throw new Error(
    "Firebase apiKey ausente. Verifique as variáveis REACT_APP_FIREBASE_* no ambiente de build/deploy."
  );
}

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
