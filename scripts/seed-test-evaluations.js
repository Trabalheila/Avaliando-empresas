/**
 * Script de seed (one-shot) para popular a plataforma "Trabalhei Lá" com
 * dados de teste realistas: cria 3 usuários no Firebase Auth (cada um
 * representando uma persona) e gera 5 avaliações por persona para uma
 * empresa de teste.
 *
 * Como executar (PowerShell):
 *   $env:FIREBASE_PROJECT_ID="seu-project-id"
 *   $env:FIREBASE_CLIENT_EMAIL="firebase-adminsdk@...iam.gserviceaccount.com"
 *   $env:FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *   node scripts/seed-test-evaluations.js
 *
 * Alternativamente, defina GOOGLE_APPLICATION_CREDENTIALS apontando para
 * um JSON de service account e o Admin SDK inicializa sozinho.
 *
 * AVISO: Use apenas em ambiente de desenvolvimento/teste. Senhas padrão
 * estão em texto puro neste script para facilitar testes manuais.
 */

const admin = require('firebase-admin');

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

  // Fallback: GOOGLE_APPLICATION_CREDENTIALS ou metadata server.
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

// ---------------------------------------------------------------------------
// 2. Configuração: empresa, critérios e personas
// ---------------------------------------------------------------------------
const COMPANY_CNPJ_FORMATTED = '35.804.638/0001-60';
const COMPANY_CNPJ = COMPANY_CNPJ_FORMATTED.replace(/\D/g, '');
const DEFAULT_PASSWORD = 'senhaPadrao123';
const REVIEWS_PER_PERSONA = 5;

const CRITERIA = [
  'Salário e Remuneração',
  'Benefícios (saúde, alimentação, etc.)',
  'Cultura Organizacional',
  'Liderança e Gestão',
  'Oportunidades de Crescimento',
  'Diversidade e Inclusão',
  'Equilíbrio Vida Pessoal/Profissional',
  'Ambiente de Trabalho',
  'Reconhecimento e Recompensa',
  'Comunicação Interna',
  'Segurança no Emprego',
  'Autonomia e Flexibilidade',
  'Ferramentas e Recursos',
  'Treinamento e Desenvolvimento',
  'Ética e Valores da Empresa',
  'Inovação',
  'Processos e Burocracia',
  'Impacto Social/Ambiental',
];

const PERSONAS = [
  {
    key: 'otimista',
    pseudonym: 'OtimistaProfissional',
    email: 'otimista@trabalheila.com.br',
    // Distribuição ponderada: maioria 4-5, com 1-2 notas 3.
    scoreWeights: { 1: 0, 2: 0, 3: 2, 4: 5, 5: 5 },
    comments: [
      'Ambiente colaborativo, gestores acessíveis e benefícios bem estruturados.',
      'Cresci muito profissionalmente, com oportunidades reais de promoção.',
      'Cultura forte, valores claros e equipe engajada.',
      'Reconhecimento frequente e plano de carreira transparente.',
      'Empresa investe em treinamento e respeita o tempo das pessoas.',
    ],
  },
  {
    key: 'observador',
    pseudonym: 'AnalistaNeutro',
    email: 'observador@trabalheila.com.br',
    // Maioria 3, com 2 e 4 ocasionais.
    scoreWeights: { 1: 0, 2: 2, 3: 6, 4: 2, 5: 0 },
    comments: [
      'Tem prós e contras como qualquer empresa: benefícios ok, mas processos lentos.',
      'Salário na média do mercado, gestão depende muito do líder direto.',
      'Cultura razoável; algumas áreas são exemplares, outras precisam evoluir.',
      'Bons recursos técnicos, porém comunicação interna poderia ser melhor.',
      'Equilíbrio aceitável entre vida pessoal e profissional, sem destaques.',
    ],
  },
  {
    key: 'descontente',
    pseudonym: 'CriticoRealista',
    email: 'descontente@trabalheila.com.br',
    // Maioria 1-2 com 1-2 notas 3.
    scoreWeights: { 1: 5, 2: 5, 3: 2, 4: 0, 5: 0 },
    comments: [
      'Salário abaixo do mercado e benefícios fracos para a carga de trabalho.',
      'Liderança ausente e pouquíssima oportunidade de crescimento real.',
      'Burocracia excessiva e processos engessados travam qualquer iniciativa.',
      'Comunicação interna confusa e reconhecimento praticamente inexistente.',
      'Ambiente desgastante, alta rotatividade e pouca preocupação com pessoas.',
    ],
  },
];

// ---------------------------------------------------------------------------
// 3. Geração de notas pseudo-aleatórias respeitando a tendência da persona
// ---------------------------------------------------------------------------
function pickWeightedScore(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  let r = Math.random() * total;
  for (const [score, w] of entries) {
    r -= w;
    if (r <= 0) return Number(score);
  }
  return Number(entries[entries.length - 1][0]);
}

function buildScores(weights) {
  const scores = {};
  for (const criterion of CRITERIA) {
    scores[criterion] = pickWeightedScore(weights);
  }
  return scores;
}

function average(scores) {
  const values = Object.values(scores);
  if (!values.length) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

// ---------------------------------------------------------------------------
// 4. Cria/recupera o usuário no Firebase Auth (idempotente)
// ---------------------------------------------------------------------------
async function ensureAuthUser({ email, pseudonym }) {
  try {
    const user = await admin.auth().createUser({
      email,
      password: DEFAULT_PASSWORD,
      displayName: pseudonym,
      emailVerified: true,
    });
    console.log(`  + Usuário criado no Auth: ${email} (uid=${user.uid})`);
    return user;
  } catch (err) {
    if (err && err.code === 'auth/email-already-exists') {
      const existing = await admin.auth().getUserByEmail(email);
      // Garante a senha padrão para reexecuções de teste.
      await admin.auth().updateUser(existing.uid, {
        password: DEFAULT_PASSWORD,
        displayName: pseudonym,
        emailVerified: true,
      });
      console.log(`  ~ Usuário já existia, senha padrão reaplicada: ${email} (uid=${existing.uid})`);
      return existing;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 5. Fluxo principal
// ---------------------------------------------------------------------------
async function main() {
  initializeAdmin();
  const db = admin.firestore();

  console.log(`\nSeed de avaliações para empresa CNPJ ${COMPANY_CNPJ_FORMATTED}`);
  console.log(`Personas: ${PERSONAS.length} | Reviews por persona: ${REVIEWS_PER_PERSONA}\n`);

  let totalReviews = 0;

  for (const persona of PERSONAS) {
    console.log(`Persona: ${persona.pseudonym} <${persona.email}>`);
    const user = await ensureAuthUser(persona);

    for (let i = 0; i < REVIEWS_PER_PERSONA; i++) {
      // seedId estável por (persona, índice) — usado para idempotência.
      // Reexecuções do script com o mesmo CNPJ/persona não duplicam.
      const seedId = `seed:${COMPANY_CNPJ}:${user.uid}:${i + 1}`;

      const existing = await db
        .collection('evaluations')
        .where('seedId', '==', seedId)
        .limit(1)
        .get();

      if (!existing.empty) {
        console.log(`    = Avaliação já existe, pulando... (seedId=${seedId})`);
        continue;
      }

      const scores = buildScores(persona.scoreWeights);
      const comment = persona.comments[i % persona.comments.length];

      const evaluation = {
        companyCnpj: COMPANY_CNPJ,
        companyCnpjFormatted: COMPANY_CNPJ_FORMATTED,
        reviewerUid: user.uid,
        pseudonym: persona.pseudonym,
        scores,
        averageScore: average(scores),
        comment,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        verified: true,
        seed: true,
        seedId,
      };

      const ref = await db.collection('evaluations').add(evaluation);
      totalReviews += 1;
      console.log(`    -> evaluation ${ref.id} (média ${evaluation.averageScore}, seedId=${seedId})`);
    }
    console.log('');
  }

  console.log(`Seed concluído com sucesso. Total de avaliações criadas: ${totalReviews}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Falha no seed:', err);
    process.exit(1);
  });
