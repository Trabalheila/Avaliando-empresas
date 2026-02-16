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

// Reutiliza o app se já existir (evita erro de "app already exists")
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Serviços que você já usa
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Analytics (opcional): inicializa só se o ambiente suportar
let analyticsInstance = null;

/**
 * Chame initAnalytics() apenas se você realmente for usar Analytics.
 * (Isso evita crash em alguns ambientes e mantém o bundle mais previsível.)
 */
export async function initAnalytics() {
  if (analyticsInstance) return analyticsInstance;

  try {
    const supported = await isSupported();
    if (!supported) return null;

    analyticsInstance = getAnalytics(app);
    return analyticsInstance;
  } catch {
    return null;
  }
}
