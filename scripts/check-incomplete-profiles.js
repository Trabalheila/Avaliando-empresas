// scripts/check-incomplete-profiles.js
//
// Lista perfis incompletos na coleção `users` do Firestore.
//
// Schema considerado "completo":
//   - status === "ativo" (o saveUserProfile derruba para "incompleto"
//     quando não há pseudônimo)
//   - pseudonimo OU pseudonym presente e não vazio
//
// Uso (PowerShell, na raiz do repo):
//   node scripts/check-incomplete-profiles.js .\service-account.json
//
// Saída: lista uid + motivos, e ao final um sumário.
// Nada é alterado no banco.

const fs = require("fs");
const path = require("path");

const file = process.argv[2];
if (!file) {
  console.error(
    "Uso: node scripts/check-incomplete-profiles.js <caminho-do-service-account.json>"
  );
  process.exit(1);
}

const abs = path.resolve(file);
if (!fs.existsSync(abs)) {
  console.error("Arquivo não encontrado:", abs);
  process.exit(1);
}

let json;
try {
  json = JSON.parse(fs.readFileSync(abs, "utf8"));
} catch (e) {
  console.error("JSON inválido:", e.message);
  process.exit(1);
}

const { project_id, client_email, private_key } = json;
if (!project_id || !client_email || !private_key) {
  console.error("JSON não tem project_id / client_email / private_key.");
  process.exit(1);
}

const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: project_id,
    clientEmail: client_email,
    privateKey: private_key,
  }),
});

const db = admin.firestore();

function isPseudonymPresent(data) {
  const v = (data?.pseudonimo || data?.pseudonym || "").toString().trim();
  return v.length > 0;
}

function getIncompletionReasons(data) {
  const reasons = [];
  if (data?.status && data.status !== "ativo") {
    reasons.push(`status="${data.status}"`);
  }
  if (!isPseudonymPresent(data)) {
    reasons.push("sem pseudonimo");
  }
  if (!data?.email) {
    reasons.push("sem email");
  }
  return reasons;
}

(async () => {
  console.log(`Lendo coleção users do projeto ${project_id}...`);
  const snap = await db.collection("users").get();
  console.log(`Total de documentos: ${snap.size}\n`);

  let incomplete = 0;
  let missingStatus = 0;

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const reasons = getIncompletionReasons(data);
    if (reasons.length) {
      incomplete += 1;
      if (!data.status) missingStatus += 1;
      console.log(
        `${doc.id}\t${reasons.join(", ")}\t(loginProvider=${
          data.loginProvider || "?"
        }, profileTypeChosen=${data.profileTypeChosen || "?"})`
      );
    }
  });

  console.log("\n──── sumário ────");
  console.log(`Total          : ${snap.size}`);
  console.log(`Incompletos    : ${incomplete}`);
  console.log(`Sem campo status: ${missingStatus}`);
  console.log(`Completos      : ${snap.size - incomplete}`);

  process.exit(0);
})().catch((err) => {
  console.error("Falha ao consultar Firestore:", err?.message || err);
  process.exit(1);
});
