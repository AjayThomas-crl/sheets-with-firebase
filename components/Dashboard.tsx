"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus, FileText, LogOut, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeDocuments,
  createDocument,
  renameDocument,
  deleteDocument,
} from "@/lib/firestore";
import type { SheetDocument } from "@/lib/types";

export function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [docs, setDocs] = useState<SheetDocument[]>([]);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeDocuments(user.uid, setDocs);
    return unsub;
  }, [user]);

  const handleCreate = async () => {
    if (!user || creating) return;
    setCreating(true);
    try {
      const id = await createDocument(user.uid, "Untitled spreadsheet");
      router.push(`/editor/${id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async () => {
    if (!renaming) return;
    await renameDocument(renaming.id, renaming.title);
    setRenaming(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    await deleteDocument(id);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <FileText className="text-emerald-600" size={22} />
          <span className="text-base font-semibold text-zinc-800">Sheets</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600">{user?.displayName ?? user?.email}</span>
          <button
            onClick={logout}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-800">Your documents</h2>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <FilePlus size={16} />
            New spreadsheet
          </button>
        </div>

        {docs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 py-16 text-zinc-400">
            <FileText size={36} />
            <p className="text-sm">No spreadsheets yet. Create one to get started.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li
                key={d.id}
                className="group flex items-center justify-between rounded-xl border bg-white px-4 py-3 shadow-sm transition hover:shadow-md"
              >
                {renaming?.id === d.id ? (
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleRename(); }}
                    className="flex flex-1 items-center gap-2"
                  >
                    <input
                      autoFocus
                      value={renaming.title}
                      onChange={(e) => setRenaming({ ...renaming, title: e.target.value })}
                      className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-emerald-500"
                    />
                    <button type="submit" className="text-xs text-emerald-600 hover:underline">Save</button>
                    <button type="button" onClick={() => setRenaming(null)} className="text-xs text-zinc-400 hover:underline">Cancel</button>
                  </form>
                ) : (
                  <button
                    onClick={() => router.push(`/editor/${d.id}`)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <FileText size={18} className="shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{d.title}</p>
                      <p className="text-xs text-zinc-400">
                        {d.updatedAt?.toDate
                          ? d.updatedAt.toDate().toLocaleString()
                          : "—"}
                      </p>
                    </div>
                  </button>
                )}

                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => setRenaming({ id: d.id, title: d.title })}
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
