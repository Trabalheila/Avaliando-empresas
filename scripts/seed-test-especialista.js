/**
 * Seed (one-shot) para criar um Especialista de teste usando o Firebase
 * Web SDK (não precisa de service account / firebase-admin).
 *
 * Lê as credenciais públicas do .env.local (REACT_APP_FIREBASE_*) e:
 *   1. Cria o usuário no Firebase Auth (email/senha).
 *   2. Cria o documento `apoiadores/{id}` (Especialista Premium ativo).
 *   3. Espelha em `users/{uid}` com userType="apoiador" + apoiadorId.
 *
 * Como executar (PowerShell ou CMD, na raiz do projeto):
 *   node scripts/seed-test-especialista.js
 *
 * Para sobrescrever email/senha:
 *   node scripts/seed-test-especialista.js email@x.com Senha12345
 *
 * Idempotente: se o usuário já existir no Auth, faz login e atualiza o
 * apoiador associado (em vez de criar duplicado).
 */

const fs = require('fs');
const path = require('path');

// ── 1. Carrega .env.local (e .env como fallback) ───────────────────────
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
  } catch (_) {
    // arquivo opcional
  }
}
loadEnvFile(path.join(__dirname, '..', '.env.local'));
loadEnvFile(path.join(__dirname, '..', '.env'));

// ── 2. Firebase Web SDK ────────────────────────────────────────────────
const { initializeApp } = require('firebase/app');
const {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} = require('firebase/auth');
const {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} = require('firebase/firestore');

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

if (!firebaseConfig.apiKey) {
  console.error(
    'REACT_APP_FIREBASE_API_KEY ausente. Verifique o arquivo .env.local.'
  );
  process.exit(1);
}

// ── 3. Parâmetros ──────────────────────────────────────────────────────
const TEST_EMAIL = (process.argv[2] || 'advogado.teste@trabalheila.com.br').trim();
const TEST_PASSWORD = process.argv[3] || 'Teste12345';
const TEST_NAME = 'Dr. Advogado Teste';
const TEST_WHATSAPP = '+5511999990000';
const APOIADOR_ID = `apoiador_test_${TEST_EMAIL.replace(/[^a-z0-9]/gi, '_')}`;

// ── 4. Execução ────────────────────────────────────────────────────────
(async () => {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log(`Project: ${firebaseConfig.projectId}`);
  console.log(`E-mail:  ${TEST_EMAIL}`);

  let uid;
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      TEST_EMAIL,
      TEST_PASSWORD
    );
    uid = cred.user.uid;
    console.log(`→ Usuário criado no Firebase Auth (uid=${uid}).`);
  } catch (err) {
    if (err && err.code === 'auth/email-already-in-use') {
      console.log('→ E-mail já existia. Fazendo login para obter o uid…');
      const cred = await signInWithEmailAndPassword(
        auth,
        TEST_EMAIL,
        TEST_PASSWORD
      );
      uid = cred.user.uid;
      console.log(`→ Login OK (uid=${uid}).`);
    } else {
      console.error('Falha ao criar/entrar no Firebase Auth:', err);
      process.exit(1);
    }
  }

  const now = serverTimestamp();

  // 4.1 — documento principal em /apoiadores/{id}
  const apoiadorDoc = {
    tipo: 'advogado',
    nome: TEST_NAME,
    email: TEST_EMAIL,
    telefone: TEST_WHATSAPP,
    whatsapp: TEST_WHATSAPP,
    descricao:
      'Advogado trabalhista de teste, criado via seed para validação da ' +
      'experiência de Especialista Premium na plataforma Trabalhei Lá.',
    foto: null,
    documentos: [],
    status: 'ativo',
    plano: 'premium',
    rating: 0,
    totalAvaliacoes: 0,
    visualizacoes: 0,
    cliquesContato: 0,
    portfolio: [],
    nichos: ['Direito trabalhista', 'Recrutamento', 'Outros'],
    adExitum: true,
    servesAudiences: ['worker', 'employer'],
    ramoEspecializacao: 'Direito trabalhista',
    credential: {
      number: '123456',
      stateOrRegion: 'SP',
      portfolioUrl: '',
      certifications: '',
      proof: null,
    },
    oab: '123456',
    seccional: 'SP',
    isAvailableForContact: true,
    uid,
    apoiadorPlano: 'premium',
    isPremium: true,
    is_premium: true,
    verificationStatus: 'verified',
    isCouncilVerified: true,
    isDiplomaVerified: false,
    hasDiplomaUploaded: false,
    hasAgreedConflictDeclaration: true,
    conflictDeclarationAgreedAt: now,
    createdAt: now,
    updatedAt: now,
    welcomeModalShown: true,
  };
  await setDoc(doc(db, 'apoiadores', APOIADOR_ID), apoiadorDoc, {
    merge: true,
  });
  console.log(`→ /apoiadores/${APOIADOR_ID} gravado.`);

  // 4.2 — espelho em /users/{uid}
  await setDoc(
    doc(db, 'users', uid),
    {
      uid,
      userType: 'apoiador',
      name: TEST_NAME,
      email: TEST_EMAIL,
      apoiadorId: APOIADOR_ID,
      role: 'supporter',
      isPremium: true,
      is_premium: true,
      updatedAt: now,
      createdAt: now,
    },
    { merge: true }
  );
  console.log(`→ /users/${uid} gravado (userType=apoiador).`);

  // 4.3 — profile espelhado para o painel admin / rbac
  await setDoc(
    doc(db, 'profiles', uid),
    {
      uid,
      name: TEST_NAME,
      email: TEST_EMAIL,
      userType: 'apoiador',
      apoiadorId: APOIADOR_ID,
      role: 'supporter',
      isSupporter: true,
      isPremium: true,
      is_premium: true,
      status: 'Ativo',
      updatedAt: now,
      createdAt: now,
    },
    { merge: true }
  );
  console.log(`→ /profiles/${uid} gravado.`);

  console.log('\n✓ Especialista de teste pronto.');
  console.log(`  E-mail:      ${TEST_EMAIL}`);
  console.log(`  Senha:       ${TEST_PASSWORD}`);
  console.log(`  UID Auth:    ${uid}`);
  console.log(`  Apoiador ID: ${APOIADOR_ID}`);
  console.log('\nFaça login na plataforma para testar a experiência do Especialista.');
  process.exit(0);
})().catch((err) => {
  console.error('Erro inesperado no seed:', err);
  process.exit(1);
});
