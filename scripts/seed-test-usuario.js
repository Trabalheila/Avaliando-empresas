/**
 * Script de seed (one-shot) para criar um USUÁRIO-TESTE (trabalhador) com
 * histórico de consultas, permitindo testar o card "Ver detalhes" e o botão
 * "Ver nota fiscal ou recibo" (download em PDF) na página Minha Conta.
 *
 * E-mail:  usuario-teste@trabalheila.com.br
 * Senha:   senha123
 *
 * Cria:
 *   - Firebase Auth: usuário com o e-mail acima
 *   - /users/{uid}: perfil de trabalhador (com profileId = uid)
 *   - /consultas/*: 2 consultas concluídas
 *        1) Psicólogo(a) Organizacional  → recibo
 *        2) Advogado(a) Trabalhista      → nota fiscal
 *
 * Como executar (PowerShell, na raiz do projeto):
 *   $env:FIREBASE_PROJECT_ID="seu-project-id"
 *   $env:FIREBASE_CLIENT_EMAIL="firebase-adminsdk@...iam.gserviceaccount.com"
 *   $env:FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *   node scripts/seed-test-usuario.js
 *
 * Alternativa: defina GOOGLE_APPLICATION_CREDENTIALS apontando para um JSON
 * de service account e o Admin SDK inicializa sozinho.
 *
 * AVISO: Use apenas em ambiente de desenvolvimento/teste. O script é
 * idempotente: se o usuário/consultas já existirem, são atualizados.
 */

const admin = require('firebase-admin');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TEST_EMAIL = 'usuario-teste@trabalheila.com.br';
const TEST_PASSWORD = 'senha123';
const TEST_NAME = 'Usuário Teste';
const TEST_PSEUDONYM = 'Colaborador Anônimo';

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
// 3. Cria/atualiza o documento em /users/{uid}
// ---------------------------------------------------------------------------
async function upsertUserDoc(uid) {
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const userDoc = {
    uid,
    profileId: uid,
    name: TEST_NAME,
    pseudonym: TEST_PSEUDONYM,
    email: TEST_EMAIL,
    emailVerified: true,
    role: 'worker',
    isWorker: true,
    status: 'Ativo',
    updatedAt: now,
  };

  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.update(userDoc);
    console.log(`→ /users/${uid} atualizado.`);
  } else {
    await ref.set({ ...userDoc, createdAt: now });
    console.log(`→ /users/${uid} criado.`);
  }
}

// ---------------------------------------------------------------------------
// 4. Cria/atualiza as consultas de teste em /consultas
// ---------------------------------------------------------------------------
async function upsertConsultas(uid) {
  const db = admin.firestore();
  const { Timestamp } = admin.firestore;

  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return Timestamp.fromDate(d);
  };

  const consultas = [
    {
      id: `teste-psicologo-${uid}`,
      data: {
        workerId: uid,
        workerNome: TEST_PSEUDONYM,
        apoiadorNome: 'Dra. Helena Martins',
        especialidade: 'Psicólogo(a) Organizacional',
        tipo: 'Consulta psicológica',
        modalidade: 'video',
        formato: 'video',
        status: 'completed',
        valor: 180,
        tipoDocumento: 'recibo',
        reciboNumero: 'REC-2026-0001',
        scheduledFor: daysAgo(14),
        createdAt: daysAgo(15),
      },
    },
    {
      id: `teste-advogado-${uid}`,
      data: {
        workerId: uid,
        workerNome: TEST_PSEUDONYM,
        apoiadorNome: 'Dr. Rafael Souza',
        especialidade: 'Advogado(a) Trabalhista',
        tipo: 'Consultoria jurídica trabalhista',
        modalidade: 'chat',
        formato: 'chat',
        status: 'completed',
        valor: 250,
        tipoDocumento: 'nota_fiscal',
        reciboNumero: 'NF-2026-0042',
        scheduledFor: daysAgo(5),
        createdAt: daysAgo(6),
      },
    },
  ];

  for (const c of consultas) {
    const ref = db.collection('consultas').doc(c.id);
    await ref.set(c.data, { merge: true });
    console.log(`→ /consultas/${c.id} (${c.data.especialidade}) gravada.`);
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
    await upsertUserDoc(uid);
    await upsertConsultas(uid);

    console.log('\n✓ Usuário-teste pronto.');
    console.log('  E-mail:  ' + TEST_EMAIL);
    console.log('  Senha:   ' + TEST_PASSWORD);
    console.log('  UID:     ' + uid);
    console.log('\nFaça login e acesse Minha Conta para ver o "Histórico de Consultas",');
    console.log('clicar em "Ver detalhes" e baixar o recibo/nota fiscal em PDF.');
    process.exit(0);
  } catch (err) {
    console.error('Falha ao executar seed:', err);
    process.exit(1);
  }
})();
