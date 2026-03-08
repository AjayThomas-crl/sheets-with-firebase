import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  serverTimestamp,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { PresenceUser } from "./types";

const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

export function getUserColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export async function upsertPresence(
  docId: string,
  uid: string,
  displayName: string,
  activeCell: string | null
): Promise<void> {
  await setDoc(doc(db, "documents", docId, "presence", uid), {
    uid,
    displayName,
    color: getUserColor(uid),
    activeCell,
    lastSeen: serverTimestamp(),
  });
}

export async function removePresence(docId: string, uid: string): Promise<void> {
  await deleteDoc(doc(db, "documents", docId, "presence", uid));
}

export function subscribePresence(
  docId: string,
  currentUid: string,
  onChange: (users: PresenceUser[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, "documents", docId, "presence"), (snap) => {
    const now = Date.now();
    const users: PresenceUser[] = [];
    snap.forEach((d) => {
      const data = d.data() as PresenceUser;
      // Filter out stale presence entries (> 90 s old) and current user
      const lastSeen = data.lastSeen?.toMillis?.() ?? 0;
      if (d.id !== currentUid && now - lastSeen < 90_000) {
        users.push(data);
      }
    });
    onChange(users);
  });
}
