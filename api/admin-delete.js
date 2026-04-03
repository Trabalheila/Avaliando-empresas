// /api/admin-delete.js
// Endpoint administrativo: exclui documentos de reviews ou comments via Firebase Admin SDK.
// Protegido pela verificação server-side do ADMIN_UID.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uid, collectionName, docId } = req.body;

  // Validação de entrada
  if (!uid || !collectionName || !docId) {
    return res.status(400).json({ error: "uid, collectionName e docId são obrigatórios." });
  }

  // Apenas coleções permitidas
  const ALLOWED_COLLECTIONS = ["reviews", "comments", "consultores", "prestadores"];
  if (!ALLOWED_COLLECTIONS.includes(collectionName)) {
    return res.status(400).json({ error: "Coleção não permitida." });
  }

  // Verificação de admin server-side
  const adminUid = (process.env.REACT_APP_ADMIN_UID || process.env.ADMIN_UID || "").trim();
  if (!adminUid || uid !== adminUid) {
    return res.status(403).json({ error: "Acesso restrito ao administrador." });
  }

  // Firebase Admin SDK
  const { initializeApp, getApps, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      }),
    });
  }

  const db = getFirestore();

  try {
    const docRef = db.collection(collectionName).doc(docId);
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: "Documento não encontrado." });
    }

    await docRef.delete();
    return res.status(200).json({ success: true, deleted: docId });
  } catch (err) {
    console.error("Erro ao excluir documento:", err);
    return res.status(500).json({ error: "Erro interno ao excluir documento." });
  }
}
