import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: (process.env.REACT_APP_FIREBASE_API_KEY || "").trim(),
  authDomain: (process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "").trim(),
  projectId: (process.env.REACT_APP_FIREBASE_PROJECT_ID || "").trim(),
  storageBucket: (process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "").trim(),
  messagingSenderId: (process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "").trim(),
  appId: (process.env.REACT_APP_FIREBASE_APP_ID || "").trim(),
};

// Inicializa (ou reutiliza) o app
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Falha rápida e com mensagem boa se o deploy não injetou as env vars
if (!firebaseConfig.apiKey) {
  throw new Error(
    "Firebase apiKey ausente. Defina REACT_APP_FIREBASE_API_KEY no ambiente de build/deploy (ou use firebaseConfig hardcoded)."
  );
}

// Ordem segura: Auth primeiro, depois Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
