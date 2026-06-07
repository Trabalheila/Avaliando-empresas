// Modulo compartilhado de inicializacao do Firebase Admin SDK.
// Exporta um getter cacheado para Firestore + FieldValue/Timestamp.
//
// Vars de ambiente necessarias (Vercel):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY  (com \n literal escapado)

let adminResourcesPromise;

export async function getAdminResources() {
  if (!adminResourcesPromise) {
    adminResourcesPromise = (async () => {
      const adminApp = await import("firebase-admin/app");
      const adminFirestore = await import("firebase-admin/firestore");

      const { initializeApp, getApps, cert } = adminApp;
      const { getFirestore, FieldValue, Timestamp } = adminFirestore;

      if (!getApps().length) {
        const hasCredentials =
          process.env.FIREBASE_PROJECT_ID &&
          process.env.FIREBASE_CLIENT_EMAIL &&
          process.env.FIREBASE_PRIVATE_KEY;

        if (!hasCredentials) {
          throw new Error("Credenciais FIREBASE_* nao configuradas no ambiente.");
        }

        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
          }),
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
