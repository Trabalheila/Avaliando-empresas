/**
 * Backfill: preenche o campo `nameLowercase` em todos os documentos da
 * collection `companies` que ainda nao possuem o campo. Esse campo e usado
 * pelo autocomplete de busca de empresa por nome (prefix search no Firestore)
 * em src/services/companies.js -> searchCompaniesByName.
 *
 * Como executar (PowerShell):
 *   $env:FIREBASE_PROJECT_ID="seu-project-id"
 *   $env:FIREBASE_CLIENT_EMAIL="firebase-adminsdk@...iam.gserviceaccount.com"
 *   $env:FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *   node scripts/backfill-companies-name-lowercase.js
 *
 * Idempotente: documentos que ja possuem `nameLowercase` sao ignorados.
 */

const admin = require("firebase-admin");

function initializeAdmin() {
  if (admin.apps.length) return;
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    admin.initializeApp();
  }
}

function normalizeNameForSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  initializeAdmin();
  const db = admin.firestore();

  const snap = await db.collection("companies").get();
  console.log(`[backfill] ${snap.size} documentos encontrados em /companies`);

  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let opsInBatch = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const sourceName = data.name || data.slug || docSnap.id;
    const expected = normalizeNameForSearch(sourceName);
    if (!expected) {
      skipped++;
      continue;
    }
    if (data.nameLowercase === expected) {
      skipped++;
      continue;
    }
    batch.update(docSnap.ref, { nameLowercase: expected });
    updated++;
    opsInBatch++;
    if (opsInBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
      console.log(`[backfill] commit parcial, atualizados ate agora: ${updated}`);
    }
  }

  if (opsInBatch > 0) await batch.commit();

  console.log(`[backfill] concluido. atualizados=${updated} ignorados=${skipped}`);
}

main().catch((err) => {
  console.error("[backfill] erro:", err);
  process.exit(1);
});
