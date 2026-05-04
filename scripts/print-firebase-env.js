// scripts/print-firebase-env.js
//
// Uso (PowerShell):
//   node scripts/print-firebase-env.js .\service-account.json
//
// Lê o JSON da conta de serviço do Firebase, valida a chave privada
// localmente (tenta inicializar o Admin SDK) e imprime as 3 variáveis
// no formato exato que a Vercel espera. NÃO envia nada para fora.
//
// Saída:
//   FIREBASE_PROJECT_ID=...
//   FIREBASE_CLIENT_EMAIL=...
//   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/print-firebase-env.js <caminho-do-service-account.json>');
  process.exit(1);
}

const abs = path.resolve(file);
if (!fs.existsSync(abs)) {
  console.error('Arquivo não encontrado:', abs);
  process.exit(1);
}

let json;
try {
  json = JSON.parse(fs.readFileSync(abs, 'utf8'));
} catch (e) {
  console.error('JSON inválido:', e.message);
  process.exit(1);
}

const { project_id, client_email, private_key } = json;
if (!project_id || !client_email || !private_key) {
  console.error('JSON não tem project_id / client_email / private_key.');
  process.exit(1);
}

if (!private_key.includes('BEGIN PRIVATE KEY') || !private_key.includes('END PRIVATE KEY')) {
  console.error('private_key não contém os delimitadores BEGIN/END. Arquivo provavelmente corrompido.');
  process.exit(1);
}

// Tenta inicializar o Admin SDK localmente para validar a chave.
try {
  const admin = require('firebase-admin');
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: project_id,
      clientEmail: client_email,
      privateKey: private_key, // já vem com \n reais do JSON
    }),
  });
  console.log('OK: Admin SDK inicializou com sucesso.\n');
} catch (e) {
  console.error('Falha ao inicializar Admin SDK localmente:', e.message);
  process.exit(1);
}

// Formato Vercel: \n como dois caracteres literais, com aspas envolvendo.
const escaped = private_key.replace(/\r/g, '').replace(/\n/g, '\\n');

console.log('=== Cole estes valores em Vercel → Settings → Environment Variables ===\n');
console.log('FIREBASE_PROJECT_ID');
console.log(project_id);
console.log('');
console.log('FIREBASE_CLIENT_EMAIL');
console.log(client_email);
console.log('');
console.log('FIREBASE_PRIVATE_KEY  (cole TUDO incluindo as aspas duplas)');
console.log('"' + escaped + '"');
console.log('');
console.log('Dica: na Vercel, cole o valor de FIREBASE_PRIVATE_KEY exatamente como acima,');
console.log('com aspas. O backend remove as aspas e converte \\n em quebras reais.');
