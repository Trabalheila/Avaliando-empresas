/**
 * Script de seed (one-shot) para criar um usuário de teste com perfil de
 * "apoiador Premium" no Firebase Auth e nas coleções `profiles` e `supporters`.
 *
 * E-mail:  apoiador.teste@trabalheila.com
 * Senha:   senha123
 *
 * Como executar (PowerShell, na raiz do projeto):
 *   $env:FIREBASE_PROJECT_ID="seu-project-id"
 *   $env:FIREBASE_CLIENT_EMAIL="firebase-adminsdk@...iam.gserviceaccount.com"
 *   $env:FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *   node scripts/seed-test-supporter.js
 *
 * Alternativa: defina GOOGLE_APPLICATION_CREDENTIALS apontando para um JSON
 * de service account e o Admin SDK inicializa sozinho.
 *
 * Após rodar o script, faça login na plataforma com:
 *   E-mail: apoiador.teste@trabalheila.com
 *   Senha:  senha123
 *
 * AVISO: Use apenas em ambiente de desenvolvimento/teste. O script é
 * idempotente: se o usuário já existir, atualiza a senha e os documentos.
 */

const admin = require('firebase-admin');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TEST_EMAIL = 'apoiador.teste@trabalheila.com';
const TEST_PASSWORD = 'senha123';
const TEST_NAME = 'Apoiador Teste';
const TEST_WHATSAPP = '+5511987654321';
const TEST_SPECIALTIES = ['Advogado (Trabalhista)', 'Psicólogo'];

// ---------------------------------------------------------------------------
// 1. Inicialização do Firebase Admin SDK
// ---------------------------------------------------------------------------
function initializeAdmin() {
  if (admin.apps.length) return;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    return;
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

// ---------------------------------------------------------------------------
// 2. Cria/atualiza o usuário no Firebase Auth
// ---------------------------------------------------------------------------
async function upsertAuthUser() {
  const auth = admin.auth();
  try {
    const existing = await auth.getUserByEmail(TEST_EMAIL);
    console.log(`→ Usuário já existia (uid=${existing.uid}). Atualizando senha e displayName…`);
    await auth.updateUser(existing.uid, {
      password: TEST_PASSWORD,
      displayName: TEST_NAME,
      emailVerified: true,
      disabled: false,
    });
    return existing.uid;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const created = await auth.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      displayName: TEST_NAME,
      emailVerified: true,
      disabled: false,
    });
    console.log(`→ Usuário criado (uid=${created.uid}).`);
    return created.uid;
  }
}

// ---------------------------------------------------------------------------
// 3. Cria/atualiza documentos em /profiles e /supporters
// ---------------------------------------------------------------------------
async function upsertFirestoreDocs(uid) {
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const baseDoc = {
    uid,
    name: TEST_NAME,
    email: TEST_EMAIL,
    whatsapp: TEST_WHATSAPP,
    specialties: TEST_SPECIALTIES,
    status: 'Ativo',
    isSupporter: true,
    isPremium: true,
    is_premium: true, // compatibilidade com flags em snake_case usadas no rbac
    role: 'supporter',
    updatedAt: now,
  };

  // /profiles/{uid}
  const profileRef = db.collection('profiles').doc(uid);
  const profileSnap = await profileRef.get();
  if (profileSnap.exists) {
    await profileRef.update(baseDoc);
    console.log(`→ /profiles/${uid} atualizado.`);
  } else {
    await profileRef.set({ ...baseDoc, createdAt: now });
    console.log(`→ /profiles/${uid} criado.`);
  }

  // /supporters/{uid}
  const supporterRef = db.collection('supporters').doc(uid);
  const supporterSnap = await supporterRef.get();
  if (supporterSnap.exists) {
    await supporterRef.update(baseDoc);
    console.log(`→ /supporters/${uid} atualizado.`);
  } else {
    await supporterRef.set({ ...baseDoc, createdAt: now });
    console.log(`→ /supporters/${uid} criado.`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  try {
    initializeAdmin();
    console.log('Firebase Admin SDK inicializado.');

    const uid = await upsertAuthUser();
    await upsertFirestoreDocs(uid);

    console.log('\n✓ Apoiador de teste pronto.');
    console.log('  E-mail:  ' + TEST_EMAIL);
    console.log('  Senha:   ' + TEST_PASSWORD);
    console.log('  UID:     ' + uid);
    console.log('\nFaça login na plataforma para testar a experiência Premium do apoiador.');
    process.exit(0);
  } catch (err) {
    console.error('Falha ao executar seed:', err);
    process.exit(1);
  }
})();
