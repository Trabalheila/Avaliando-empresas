import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: "trabalheila.firebaseapp.com",
  projectId: "trabalheila",
  storageBucket: "trabalheila.appspot.com",
  messagingSenderId: "338684255438",
  appId: "1:338684255438:web:88a03cf43a04adfe23449f",
  measurementId: "G-3H8CY15WLE",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// analytics (opcional)
export const analyticsPromise = isSupported().then((yes) =>
  yes ? getAnalytics(app) : null
);
