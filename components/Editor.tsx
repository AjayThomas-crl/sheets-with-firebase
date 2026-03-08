"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Download, Loader2, XCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { subscribeCells, saveCell, subscribeDocument, renameDocument } from "@/lib/firestore";
import { upsertPresence, removePresence, subscribePresence } from "@/lib/presence";
import { resolveAll } from "@/lib/formula";
import type { CellData, CellFormatting, PresenceUser, WriteState } from "@/lib/types";
import { Grid } from "./Grid";
import { FormulaBar } from "./FormulaBar";
import { PresenceBar } from "./PresenceBar";
import { Toolbar } from "./Toolbar";

const EMPTY_FMT: CellFormatting = { bold: false, italic: false, textColor: "", bgColor: "" };
const DEBOUNCE_MS = 400;
const PRESENCE_INTERVAL_MS = 30_000;

interface Props {
  docId: string;
}

export function Editor({ docId }: Props) {
  const { user } = useAuth();

  const [cells, setCells] = useState<Record<string, CellData>>({});
  const [computed, setComputed] = useState<Record<string, string>>({});
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [selected, setSelected] = useState<string | null>("A1");
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [writeState, setWriteState] = useState<WriteState>("idle");
  const [docTitle, setDocTitle] = useState("Spreadsheet");

  const activePendingKey = useRef<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localCellsRef = useRef<Record<string, CellData>>({});

  // ── Firestore document subscription (title) ───────────────────────────────
  useEffect(() => {
    return subscribeDocument(docId, (data) => {
      if (data.title) setDocTitle(data.title);
    });
  }, [docId]);

  // ── Firestore cell subscription ───────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeCells(docId, (incoming) => {
      setCells(incoming);
      localCellsRef.current = incoming;
      setComputed(resolveAll(incoming));
    });
    return unsub;
  }, [docId]);

  const handleTitleChange = useCallback(
    (title: string) => {
      setDocTitle(title);
      if (titleDebounce.current) clearTimeout(titleDebounce.current);
      titleDebounce.current = setTimeout(() => renameDocument(docId, title), 600);
    },
    [docId]
  );

  // ── Presence ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const displayName = user.displayName ?? "Anonymous";
    upsertPresence(docId, user.uid, displayName, selected);

    const heartbeat = setInterval(() => {
      upsertPresence(docId, user.uid, displayName, selected);
    }, PRESENCE_INTERVAL_MS);

    const unsub = subscribePresence(docId, user.uid, setPresenceUsers);

    return () => {
      clearInterval(heartbeat);
      unsub();
      removePresence(docId, user.uid);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, user]);

  // Update presence activeCell when selection changes
  useEffect(() => {
    if (!user) return;
    upsertPresence(docId, user.uid, user.displayName ?? "Anonymous", selected);
  }, [docId, user, selected]);

  // ── Persist cell (debounced) ───────────────────────────────────────────────
  const persistCell = useCallback(
    (key: string, data: CellData) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      activePendingKey.current = key;
      setWriteState("saving");

      debounceTimer.current = setTimeout(async () => {
        try {
          await saveCell(docId, key, data);
          setWriteState("saved");
          setTimeout(() => setWriteState("idle"), 1500);
        } catch {
          setWriteState("error");
        }
      }, DEBOUNCE_MS);
    },
    [docId]
  );

  // ── Edit helpers ──────────────────────────────────────────────────────────
  const handleSelect = useCallback((key: string) => {
    setSelected(key);
    setEditing(false);
  }, []);

  const handleEditStart = useCallback(
    (key: string, initialValue?: string) => {
      setSelected(key);
      const raw = initialValue !== undefined
        ? initialValue
        : (localCellsRef.current[key]?.value ?? "");
      setEditValue(raw);
      setEditing(true);
    },
    []
  );

  const handleEditChange = useCallback((v: string) => {
    setEditValue(v);
  }, []);

  const handleEditCommit = useCallback(
    (moveDir: "down" | "right" | "none" = "none") => {
      if (!selected) return;
      const existing = localCellsRef.current[selected];
      const newData: CellData = {
        value: editValue,
        computed: editValue, // will be resolved client-side immediately
        formatting: existing?.formatting ?? EMPTY_FMT,
      };

      // Optimistic local update
      const updated = { ...localCellsRef.current, [selected]: newData };
      localCellsRef.current = updated;
      const newComputed = resolveAll(updated);
      setCells(updated);
      setComputed(newComputed);

      persistCell(selected, {
        ...newData,
        computed: newComputed[selected] ?? editValue,
      });

      setEditing(false);

      // Move selection
      const pos = parseKey(selected);
      if (pos) {
        if (moveDir === "down") setSelected(cellKey(pos.col, pos.row + 1));
        else if (moveDir === "right") setSelected(cellKey(pos.col + 1, pos.row));
      }
    },
    [selected, editValue, persistCell]
  );

  const handleEditCancel = useCallback(() => {
    setEditing(false);
    setEditValue("");
  }, []);

  // ── Formatting ────────────────────────────────────────────────────────────
  const handleFormat = useCallback(
    (key: string, patch: Partial<CellFormatting>) => {
      const existing = localCellsRef.current[key];
      const newData: CellData = {
        value: existing?.value ?? "",
        computed: existing?.computed ?? "",
        formatting: { ...(existing?.formatting ?? EMPTY_FMT), ...patch },
      };
      const updated = { ...localCellsRef.current, [key]: newData };
      localCellsRef.current = updated;
      setCells(updated);
      persistCell(key, newData);
    },
    [persistCell]
  );

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const ROWS = 100;
    const COLS = 26;
    const lines: string[] = [];
    for (let r = 0; r < ROWS; r++) {
      const row: string[] = [];
      for (let c = 0; c < COLS; c++) {
        const k = `${colLetter(c)}${r + 1}`;
        const v = computed[k] ?? cells[k]?.value ?? "";
        row.push(`"${v.replace(/"/g, '""')}"`);
      }
      lines.push(row.join(","));
    }
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docTitle}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [cells, computed, docTitle]);

  const selectedCell = selected ? (cells[selected] ?? null) : null;
  const selectedFmt = selectedCell?.formatting ?? EMPTY_FMT;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      {/* ── App bar ──────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b px-3 py-2">
        <Link href="/" className="rounded p-1 text-zinc-500 hover:bg-zinc-100">
          <ArrowLeft size={16} />
        </Link>
        <input
          value={docTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="flex-1 rounded px-2 py-0.5 text-sm font-medium text-zinc-800 outline-none hover:bg-zinc-50 focus:bg-zinc-50 focus:ring-1 focus:ring-blue-400"
        />
        <PresenceBar users={presenceUsers} />
        <WriteIndicator state={writeState} />
        <button
          onClick={handleExport}
          title="Export as CSV"
          className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
        >
          <Download size={13} />
          Export CSV
        </button>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <Toolbar
        formatting={selectedFmt}
        disabled={!selected}
        onFormat={(patch) => selected && handleFormat(selected, patch)}
      />

      {/* ── Formula bar ──────────────────────────────────────────────────── */}
      <FormulaBar
        cellRef={selected ?? ""}
        value={editing ? editValue : (selectedCell?.value ?? "")}
        editing={editing}
        onChange={(v) => {
          setEditValue(v);
          if (!editing && selected) {
            handleEditStart(selected, v);
          }
        }}
        onCommit={() => handleEditCommit("none")}
        onCancel={handleEditCancel}
      />

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      <Grid
        docId={docId}
        cells={cells}
        computed={computed}
        presenceUsers={presenceUsers}
        selected={selected}
        editing={editing}
        editValue={editValue}
        onSelect={handleSelect}
        onEditStart={handleEditStart}
        onEditChange={handleEditChange}
        onEditCommit={handleEditCommit}
        onEditCancel={handleEditCancel}
        onFormat={handleFormat}
      />
    </div>
  );
}

// ── Write state indicator ─────────────────────────────────────────────────────
function WriteIndicator({ state }: { state: WriteState }) {
  if (state === "idle") return null;
  return (
    <div className="flex items-center gap-1 text-xs">
      {state === "saving" && <Loader2 size={12} className="animate-spin text-zinc-400" />}
      {state === "saved" && <CheckCircle size={12} className="text-emerald-500" />}
      {state === "error" && <XCircle size={12} className="text-red-500" />}
      <span className={state === "error" ? "text-red-500" : "text-zinc-400"}>
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save failed"}
      </span>
    </div>
  );
}
// ── helpers duplicated from formula.ts (avoid circular imports in client comp)
function colLetter(n: number): string {
  let s = "";
  let i = n;
  while (i >= 0) {
    s = String.fromCharCode((i % 26) + 65) + s;
    i = Math.floor(i / 26) - 1;
  }
  return s;
}

function cellKey(col: number, row: number): string {
  return `${colLetter(col)}${row + 1}`;
}

function parseKey(key: string): { col: number; row: number } | null {
  const m = key.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (let i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
  return { col: col - 1, row: parseInt(m[2], 10) - 1 };
}
