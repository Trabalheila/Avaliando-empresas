/**
 * Atualiza a senha do usuário advogado.teste@trabalheila.com.br
 * de "Teste12345" para "Teste12345?" usando o Web SDK
 * (sign in com a senha antiga + updatePassword).
 */

const fs = require('fs');
const path = require('path');

function loadEnvFile(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (_) {}
}
loadEnvFile(path.join(__dirname, '..', '.env.local'));
loadEnvFile(path.join(__dirname, '..', '.env'));

const { initializeApp } = require('firebase/app');
const {
  getAuth,
  signInWithEmailAndPassword,
  updatePassword,
} = require('firebase/auth');

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:
    process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'trabalheila.firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'trabalheila',
  storageBucket:
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'trabalheila.appspot.com',
  messagingSenderId:
    process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '338684255438',
  appId:
    process.env.REACT_APP_FIREBASE_APP_ID ||
    '1:338684255438:web:88a03cf43a04adfe23449f',
};

const EMAIL = process.argv[2] || 'advogado.teste@trabalheila.com.br';
const OLD_PASS = process.argv[3] || 'Teste12345';
const NEW_PASS = process.argv[4] || 'Teste12345?';

(async () => {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  console.log(`Atualizando senha de ${EMAIL}…`);
  const cred = await signInWithEmailAndPassword(auth, EMAIL, OLD_PASS);
  await updatePassword(cred.user, NEW_PASS);
  console.log('✓ Senha atualizada com sucesso.');
  process.exit(0);
})().catch((err) => {
  console.error('Falha:', err.code || err);
  process.exit(1);
});
