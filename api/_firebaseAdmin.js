// Modulo compartilhado de inicializacao do Firebase Admin SDK.
// Exporta um getter cacheado para Firestore + FieldValue/Timestamp.
//
// Var de ambiente necessaria (Vercel):
//   FIREBASE_SERVICE_ACCOUNT  → JSON completo da Service Account exportada
//                               do Firebase (objeto inteiro em uma so var).

let adminResourcesPromise;

/**
 * Le a Service Account unificada de process.env.FIREBASE_SERVICE_ACCOUNT e
 * retorna o objeto parseado. Faz JSON.parse de forma segura: se a variavel
 * estiver ausente ou contiver JSON invalido, retorna null em vez de lancar,
 * para nao derrubar o processo na carga do modulo.
 *
 * @returns {object|null} Service account parseada ou null.
 */
export function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || !String(raw).trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    // Algumas configuracoes escapam as quebras de linha da chave privada
    // (\n literais). Normaliza para o formato PEM real exigido pelo cert().
    if (parsed && typeof parsed.private_key === "string") {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  } catch (err) {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT invalida: JSON.parse falhou.",
      err?.message || err
    );
    return null;
  }
}

export async function getAdminResources() {
  if (!adminResourcesPromise) {
    adminResourcesPromise = (async () => {
      const adminApp = await import("firebase-admin/app");
      const adminFirestore = await import("firebase-admin/firestore");

      const { initializeApp, getApps, cert } = adminApp;
      const { getFirestore, FieldValue, Timestamp } = adminFirestore;

      if (!getApps().length) {
        const serviceAccount = getServiceAccount();

        if (!serviceAccount) {
          throw new Error(
            "FIREBASE_SERVICE_ACCOUNT nao configurada ou invalida no ambiente."
          );
        }

        initializeApp({
          credential: cert(serviceAccount),
        });
      }

      return {
        db: getFirestore(),
        FieldValue,
        Timestamp,
      };
    })();
  }
  return adminResourcesPromise;
}

