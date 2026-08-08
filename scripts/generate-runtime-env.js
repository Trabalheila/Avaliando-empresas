const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const envFilePath = path.join(rootDir, '.env');
const outputPath = path.join(rootDir, 'public', 'env-config.js');

function parseEnv(content) {
  return content
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return env;
      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex === -1) return env;

      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      env[key] = value;
      return env;
    }, {});
}

let envValues = {};
if (fs.existsSync(envFilePath)) {
  try {
    const fileContent = fs.readFileSync(envFilePath, 'utf8');
    envValues = parseEnv(fileContent);
  } catch (error) {
    console.warn('Não foi possível ler o .env local:', error);
  }
}

const runtimeKeys = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
  'REACT_APP_FIREBASE_MEASUREMENT_ID',
  'REACT_APP_FIREBASE_VAPID_KEY',
];

const runtimeEnv = runtimeKeys.reduce((acc, key) => {
  acc[key] = process.env[key] || envValues[key] || '';
  return acc;
}, {});

const fileContents = `window._env_ = window._env_ || ${JSON.stringify(runtimeEnv, null, 2)};\n`;
fs.writeFileSync(outputPath, fileContents, 'utf8');

console.log(`Generated runtime env config at ${outputPath}`);
