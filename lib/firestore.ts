import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { CellData, SheetDocument } from "./types";

// Documents

export function subscribeDocuments(
  uid: string,
  onChange: (docs: SheetDocument[]) => void
): Unsubscribe {
  const q = query(collection(db, "documents"), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as SheetDocument[];
    onChange(docs);
  });
}

export async function createDocument(uid: string, title: string): Promise<string> {
  const ref = await addDoc(collection(db, "documents"), {
    title,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: uid,
  });
  return ref.id;
}

export async function renameDocument(docId: string, title: string): Promise<void> {
  await updateDoc(doc(db, "documents", docId), {
    title,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDocument(docId: string): Promise<void> {
  await deleteDoc(doc(db, "documents", docId));
}

// Cells

export function subscribeCells(
  docId: string,
  onChange: (cells: Record<string, CellData>) => void
): Unsubscribe {
  return onSnapshot(collection(db, "documents", docId, "cells"), (snap) => {
    const cells: Record<string, CellData> = {};
    snap.forEach((d) => {
      cells[d.id] = d.data() as CellData;
    });
    onChange(cells);
  });
}

export async function saveCell(docId: string, cellKey: string, data: CellData): Promise<void> {
  await setDoc(doc(db, "documents", docId, "cells", cellKey), data);
  await updateDoc(doc(db, "documents", docId), { updatedAt: serverTimestamp() });
}
