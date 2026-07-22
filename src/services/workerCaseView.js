// src/services/workerCaseView.js
//
// Leitura, em modo SOMENTE LEITURA, dos casos vinculados a um trabalhador.
//
// Os casos ficam em apoiadores/{specialistId}/cases/{caseId}. Um trabalhador
// só pode ler os casos onde `workerUid` é o seu próprio UID — garantido pelas
// regras do Firestore. As NOTAS PRIVADAS do advogado (subcoleção privateNotes)
// nunca são consultadas aqui e são bloqueadas pelas regras.

import {
  collection,
  collectionGroup,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

/** Lista os casos do trabalhador via collectionGroup. */
export async function listWorkerCases(workerUid) {
  if (!workerUid) return [];
  const snap = await getDocs(
    query(collectionGroup(db, "cases"), where("workerUid", "==", String(workerUid)))
  );
  return snap.docs.map((d) => {
    // Caminho: apoiadores/{specialistId}/cases/{caseId}
    const specialistId = d.ref.parent.parent?.id || "";
    return { id: d.id, caseId: d.id, specialistId, ...d.data() };
  });
}

/** Histórico de atualizações (somente leitura) de um caso. */
export async function listWorkerCaseHistory(specialistId, caseId) {
  try {
    const snap = await getDocs(
      query(
        collection(db, "apoiadores", String(specialistId), "cases", String(caseId), "history"),
        orderBy("createdAt", "asc")
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

/** Documentos marcados como visíveis pelo advogado. */
export async function listWorkerVisibleDocuments(specialistId, caseId) {
  try {
    const snap = await getDocs(
      query(
        collection(db, "apoiadores", String(specialistId), "cases", String(caseId), "caseDocuments"),
        where("visibleToWorker", "==", true)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

/** Prazos do caso (somente leitura). */
export async function listWorkerCaseDeadlines(specialistId, caseId) {
  try {
    const snap = await getDocs(
      query(
        collection(db, "apoiadores", String(specialistId), "cases", String(caseId), "deadlines"),
        orderBy("dueDate", "asc")
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}
