/**
 * Seed em lote: cria/atualiza 1 usuário Especialista de teste para CADA
 * tipo suportado no dashboard (`SPECIALIST_CONFIGS` em
 * src/pages/MyContactsApoiador.js).
 *
 * Usa o Firebase Web SDK (sem firebase-admin), lendo as variáveis
 * REACT_APP_FIREBASE_* do .env.local.
 *
 * Padrão de credenciais:
 *   email: {slug}.teste@trabalheila.com.br
 *   senha: Teste12345?
 *
 * Idempotente: se o e-mail já existir no Auth, faz login e apenas
 * atualiza o doc do apoiador / users / profiles.
 *
 * Como executar (raiz do projeto):
 *   node scripts/seed-test-especialistas-all.js
 *
 * Para executar somente um tipo:
 *   node scripts/seed-test-especialistas-all.js advogado
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
  signOut,
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

// ── 3. Catálogo de tipos × dados de teste ──────────────────────────────
// `slug`  → entra no e-mail (deve casar com regex de e-mail simples).
// `tipo`  → valor escrito no Firestore (deve casar com SPECIALIST_CONFIGS).
const TYPES = [
  {
    slug: 'advogado',
    tipo: 'advogado',
    nome: 'Dr. Advogado Teste',
    descricao:
      'Advogado trabalhista de teste — atuação em rescisões, horas extras e ' +
      'acordos individuais e coletivos.',
    nichos: ['Direito trabalhista', 'Negociação coletiva'],
    ramoEspecializacao: 'Direito trabalhista',
    credential: { number: '123456', stateOrRegion: 'SP' },
    extra: { oab: '123456', seccional: 'SP' },
  },
  {
    slug: 'consultor-rh',
    tipo: 'consultor_rh',
    nome: 'Consultora de RH Teste',
    descricao:
      'Consultora de RH de teste — desenho de políticas, cultura, clima e ' +
      'avaliação de desempenho.',
    nichos: ['Cultura organizacional', 'Avaliação de desempenho'],
    ramoEspecializacao: 'Consultoria em RH',
    credential: { number: 'CRA-SP-12345', stateOrRegion: 'SP' },
  },
  {
    slug: 'recrutador',
    tipo: 'recrutador',
    nome: 'Recrutadora Teste',
    descricao:
      'Headhunter de teste — busca ativa para posições de média e alta ' +
      'liderança em tecnologia e finanças.',
    nichos: ['Headhunting', 'Tech recruiting'],
    ramoEspecializacao: 'Recrutamento & Seleção',
    credential: { number: 'REC-001', stateOrRegion: 'SP' },
  },
  {
    slug: 'psicologo',
    tipo: 'psicologo',
    nome: 'Psicóloga Organizacional Teste',
    descricao:
      'Psicóloga organizacional de teste — avaliações, mapeamento ' +
      'comportamental e acompanhamento de saúde mental no trabalho.',
    nichos: ['Saúde mental no trabalho', 'Avaliação comportamental'],
    ramoEspecializacao: 'Psicologia organizacional',
    credential: { number: 'CRP-06/123456', stateOrRegion: 'SP' },
  },
  {
    slug: 'medico',
    tipo: 'medico',
    nome: 'Dr. Médico do Trabalho Teste',
    descricao:
      'Médico do trabalho de teste — PCMSO, ASOs admissionais, periódicos ' +
      'e demissionais.',
    nichos: ['PCMSO', 'Exames ocupacionais'],
    ramoEspecializacao: 'Medicina do trabalho',
    credential: { number: 'CRM-SP-123456', stateOrRegion: 'SP' },
  },
  {
    slug: 'contador',
    tipo: 'contador',
    nome: 'Contador Teste',
    descricao:
      'Contador de teste — folha de pagamento, obrigações acessórias e ' +
      'planejamento tributário para PMEs.',
    nichos: ['Folha de pagamento', 'Planejamento tributário'],
    ramoEspecializacao: 'Contabilidade',
    credential: { number: 'CRC-SP-1SP012345', stateOrRegion: 'SP' },
  },
  {
    slug: 'engenheiro-seguranca',
    tipo: 'engenheiro_seguranca',
    nome: 'Eng. de Segurança Teste',
    descricao:
      'Engenheiro de segurança do trabalho de teste — laudos PGR, LTCAT ' +
      'e treinamentos em NRs.',
    nichos: ['PGR', 'LTCAT', 'Treinamentos NR'],
    ramoEspecializacao: 'Engenharia de segurança',
    credential: { number: 'CREA-SP-123456', stateOrRegion: 'SP' },
  },
  {
    slug: 'fisioterapeuta-ocupacional',
    tipo: 'fisioterapeuta_ocupacional',
    nome: 'Fisioterapeuta Ocupacional Teste',
    descricao:
      'Fisioterapeuta ocupacional de teste — ginástica laboral, avaliações ' +
      'ergonômicas e programas de prevenção.',
    nichos: ['Ginástica laboral', 'Ergonomia'],
    ramoEspecializacao: 'Fisioterapia ocupacional',
    credential: { number: 'CREFITO-3/12345-F', stateOrRegion: 'SP' },
  },
  {
    slug: 'outro',
    tipo: 'outro',
    nome: 'Especialista Genérico Teste',
    descricao:
      'Especialista genérico de teste — usado para validar o fallback do ' +
      'dashboard quando o tipo não está mapeado.',
    nichos: ['Outros'],
    ramoEspecializacao: 'Outros',
    credential: { number: 'N/A', stateOrRegion: 'SP' },
  },
];

const PASSWORD = 'Teste12345?';
const EMAIL_DOMAIN = 'trabalheila.com.br';

// ── 4. Helpers ─────────────────────────────────────────────────────────
function buildEmail(slug) {
  return `${slug}.teste@${EMAIL_DOMAIN}`;
}
function buildApoiadorId(email) {
  return `apoiador_test_${email.replace(/[^a-z0-9]/gi, '_')}`;
}

async function provisionOne(auth, db, item) {
  const email = buildEmail(item.slug);
  const apoiadorId = buildApoiadorId(email);
  console.log(`\n── ${item.tipo.toUpperCase()} (${email}) ──`);

  let uid;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, PASSWORD);
    uid = cred.user.uid;
    console.log(`  + Auth criado (uid=${uid}).`);
  } catch (err) {
    if (err && err.code === 'auth/email-already-in-use') {
      try {
        const cred = await signInWithEmailAndPassword(auth, email, PASSWORD);
        uid = cred.user.uid;
        console.log(`  · E-mail já existia; login OK (uid=${uid}).`);
      } catch (loginErr) {
        console.error(
          `  ! E-mail existia mas a senha não bate (${loginErr.code || loginErr}). ` +
            'Resete manualmente no console do Firebase ou apague o usuário.'
        );
        return;
      }
    } else {
      console.error('  ! Falha ao criar/entrar no Auth:', err.code || err);
      return;
    }
  }

  const now = serverTimestamp();
  const apoiadorDoc = {
    tipo: item.tipo,
    nome: item.nome,
    email,
    telefone: '+5511999990000',
    whatsapp: '+5511999990000',
    descricao: item.descricao,
    foto: null,
    documentos: [],
    status: 'ativo',
    plano: 'premium',
    rating: 0,
    totalAvaliacoes: 0,
    visualizacoes: 0,
    cliquesContato: 0,
    portfolio: [],
    nichos: item.nichos,
    adExitum: true,
    servesAudiences: ['worker', 'employer'],
    ramoEspecializacao: item.ramoEspecializacao,
    credential: {
      number: item.credential.number,
      stateOrRegion: item.credential.stateOrRegion,
      portfolioUrl: '',
      certifications: '',
      proof: null,
    },
    ...(item.extra || {}),
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
    // Marca de conta seed — usada por src/utils/testAccounts.js para
    // ocultar essas contas de listagens públicas.
    isTest: true,
  };
  await setDoc(doc(db, 'apoiadores', apoiadorId), apoiadorDoc, { merge: true });
  console.log(`  + /apoiadores/${apoiadorId} gravado (tipo=${item.tipo}).`);

  await setDoc(
    doc(db, 'users', uid),
    {
      uid,
      userType: 'apoiador',
      name: item.nome,
      email,
      apoiadorId,
      role: 'supporter',
      isPremium: true,
      is_premium: true,
      updatedAt: now,
      createdAt: now,
    },
    { merge: true }
  );
  console.log(`  + /users/${uid} gravado.`);

  await setDoc(
    doc(db, 'profiles', uid),
    {
      uid,
      name: item.nome,
      email,
      userType: 'apoiador',
      apoiadorId,
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
  console.log(`  + /profiles/${uid} gravado.`);
}

// ── 5. Execução ────────────────────────────────────────────────────────
(async () => {
  const filter = (process.argv[2] || '').toLowerCase();
  const queue = filter
    ? TYPES.filter((t) => t.slug === filter || t.tipo === filter)
    : TYPES;

  if (queue.length === 0) {
    console.error(
      `Tipo "${filter}" não encontrado. Use um destes:\n  ` +
        TYPES.map((t) => t.slug).join(', ')
    );
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  console.log(`Project: ${firebaseConfig.projectId}`);
  console.log(`Senha padrão para todos: ${PASSWORD}`);

  for (const item of queue) {
    await provisionOne(auth, db, item);
    try {
      await signOut(auth);
    } catch (_) {
      // ignora
    }
  }

  console.log('\n✓ Concluído. Resumo:');
  for (const item of queue) {
    console.log(`  • ${item.tipo.padEnd(28)} → ${buildEmail(item.slug)}`);
  }
  process.exit(0);
})().catch((err) => {
  console.error('Erro inesperado no seed:', err);
  process.exit(1);
});
