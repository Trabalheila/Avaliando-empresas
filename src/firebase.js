import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// analytics (opcional)
export const analyticsPromise = isSupported().then((yes) =>
  yes ? getAnalytics(app) : null
);
