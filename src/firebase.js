// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Substitua pelas suas credenciais do Firebase
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_BUCKET.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID",
  measurementId: "G-MEASUREMENT_ID"  // Esse é opcional, se você não tiver, pode deixar de fora
};

// Inicializa o Firebase com a configuração
const app = initializeApp(firebaseConfig);

// Exporta as instâncias necessárias para serem usadas nos componentes
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
