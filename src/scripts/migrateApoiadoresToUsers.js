/**
 * Migração one-shot: garante que todo documento da coleção `apoiadores`
 * possua um documento espelhado em `users` com `userType: "apoiador"`.
 *
 * - NÃO altera nenhum documento existente em `apoiadores`.
 * - Cria docs de `users` apenas quando ainda não existirem (usa merge).
 * - Executa uma única vez por navegador (flag em localStorage).
 *
 * Para forçar a execução novamente em dev, remova a chave
 * `migration_apoiadores_to_users_v1` do localStorage.
 */
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const FLAG_KEY = "migration_apoiadores_to_users_v1";

export async function migrateApoiadoresToUsers({ force = false } = {}) {
  try {
    if (!force && typeof window !== "undefined") {
      if (window.localStorage.getItem(FLAG_KEY) === "done") return { skipped: true };
    }

    const snap = await getDocs(collection(db, "apoiadores"));
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const d of snap.docs) {
      const data = d.data() || {};
      const userDocId = (data.uid || d.id).toString();
      try {
        const existing = await getDoc(doc(db, "users", userDocId));
        if (existing.exists()) {
          const existingType = String(existing.data()?.userType || "").toLowerCase();
          if (existingType === "apoiador") {
            skipped += 1;
            continue;
          }
          // Não sobrescreve outros tipos; só completa metadados de apoiador.
          await setDoc(
            doc(db, "users", userDocId),
            {
              userType: "apoiador",
              name: data.nome || data.name || existing.data()?.name || "",
              apoiadorId: d.id,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          created += 1;
          continue;
        }

        await setDoc(doc(db, "users", userDocId), {
          userType: "apoiador",
          name: data.nome || data.name || "",
          email: data.email || "",
          uid: data.uid || null,
          apoiadorId: d.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created += 1;
      } catch (err) {
        failed += 1;
        // eslint-disable-next-line no-console
        console.warn("[migrateApoiadoresToUsers] falhou para", d.id, err?.message || err);
      }
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(FLAG_KEY, "done");
    }

    // eslint-disable-next-line no-console
    console.info(
      `[migrateApoiadoresToUsers] concluído. total=${snap.size} criados/atualizados=${created} já-ok=${skipped} falhas=${failed}`
    );
    return { total: snap.size, created, skipped, failed };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[migrateApoiadoresToUsers] abortado:", err?.message || err);
    return { error: err?.message || String(err) };
  }
}

export default migrateApoiadoresToUsers;
