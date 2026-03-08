"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { CellData, CellFormatting, PresenceUser } from "@/lib/types";

const ROWS = 100;
const COLS = 26;
const DEFAULT_COL_W = 100;
const DEFAULT_ROW_H = 25;
const HEADER_COL_W = 48;
const HEADER_ROW_H = 24;

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

interface Props {
  docId: string;
  cells: Record<string, CellData>;
  computed: Record<string, string>;
  presenceUsers: PresenceUser[];
  selected: string | null;
  editing: boolean;
  editValue: string;
  onSelect: (key: string) => void;
  onEditStart: (key: string, initialValue?: string) => void;
  onEditChange: (v: string) => void;
  onEditCommit: (moveDir?: "down" | "right" | "none") => void;
  onEditCancel: () => void;
  onFormat: (key: string, patch: Partial<CellFormatting>) => void;
}

export function Grid({
  cells,
  computed,
  presenceUsers,
  selected,
  editing,
  editValue,
  onSelect,
  onEditStart,
  onEditChange,
  onEditCommit,
  onEditCancel,
  onFormat,
}: Props) {
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [colOrder, setColOrder] = useState<number[]>(() => Array.from({ length: COLS }, (_, i) => i));
  const editInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── column resize ─────────────────────────────────────────────────────────
  const resizingCol = useRef<{ colIdx: number; startX: number; startW: number } | null>(null);

  const onColResizeStart = useCallback((e: ReactPointerEvent<HTMLDivElement>, colIdx: number) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizingCol.current = {
      colIdx,
      startX: e.clientX,
      startW: colWidths[colIdx] ?? DEFAULT_COL_W,
    };
  }, [colWidths]);

  const onColResizeMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizingCol.current) return;
    const { colIdx, startX, startW } = resizingCol.current;
    const newW = Math.max(40, startW + (e.clientX - startX));
    setColWidths((prev) => ({ ...prev, [colIdx]: newW }));
  }, []);

  const onColResizeEnd = useCallback(() => {
    resizingCol.current = null;
  }, []);

  // ── row resize ────────────────────────────────────────────────────────────
  const resizingRow = useRef<{ rowIdx: number; startY: number; startH: number } | null>(null);

  const onRowResizeStart = useCallback((e: ReactPointerEvent<HTMLDivElement>, rowIdx: number) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizingRow.current = {
      rowIdx,
      startY: e.clientY,
      startH: rowHeights[rowIdx] ?? DEFAULT_ROW_H,
    };
  }, [rowHeights]);

  const onRowResizeMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizingRow.current) return;
    const { rowIdx, startY, startH } = resizingRow.current;
    const newH = Math.max(20, startH + (e.clientY - startY));
    setRowHeights((prev) => ({ ...prev, [rowIdx]: newH }));
  }, []);

  const onRowResizeEnd = useCallback(() => {
    resizingRow.current = null;
  }, []);

  // ── column drag-to-reorder ────────────────────────────────────────────────
  const draggingCol = useRef<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);

  const onColDragStart = useCallback((visualIdx: number) => {
    draggingCol.current = visualIdx;
  }, []);

  const onColDrop = useCallback((targetVisualIdx: number) => {
    if (draggingCol.current === null || draggingCol.current === targetVisualIdx) return;
    setColOrder((prev) => {
      const next = [...prev];
      const [removed] = next.splice(draggingCol.current!, 1);
      next.splice(targetVisualIdx, 0, removed);
      return next;
    });
    draggingCol.current = null;
    setDragOverCol(null);
  }, []);

  // ── keyboard navigation ───────────────────────────────────────────────────
  const handleGridKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!selected) return;
    const pos = parseKey(selected);
    if (!pos) return;

    if (editing) return; // input handles its own keys

    const visualColIdx = colOrder.indexOf(pos.col);

    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      onEditStart(selected);
      return;
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onEditStart(selected, "");
      onEditCommit("none");
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      onEditStart(selected, e.key);
      return;
    }

    const move = (dc: number, dr: number) => {
      e.preventDefault();
      const newVisualCol = Math.max(0, Math.min(COLS - 1, visualColIdx + dc));
      const newCol = colOrder[newVisualCol];
      const newRow = Math.max(0, Math.min(ROWS - 1, pos.row + dr));
      onSelect(cellKey(newCol, newRow));
    };

    if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) move(1, 0);
    else if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) move(-1, 0);
    else if (e.key === "ArrowDown") move(0, 1);
    else if (e.key === "ArrowUp") move(0, -1);

    if (e.ctrlKey && e.key === "b" && selected) {
      e.preventDefault();
      onFormat(selected, { bold: !(cells[selected]?.formatting.bold ?? false) });
    }
    if (e.ctrlKey && e.key === "i" && selected) {
      e.preventDefault();
      onFormat(selected, { italic: !(cells[selected]?.formatting.italic ?? false) });
    }
  }, [selected, editing, colOrder, cells, onSelect, onEditStart, onEditCommit, onFormat]);

  const handleEditKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); onEditCommit("down"); }
    else if (e.key === "Tab") { e.preventDefault(); onEditCommit(e.shiftKey ? "none" : "right"); }
    else if (e.key === "Escape") { e.preventDefault(); onEditCancel(); }
  }, [onEditCommit, onEditCancel]);

  useEffect(() => {
    if (editing) editInputRef.current?.focus();
    else containerRef.current?.focus();
  }, [editing, selected]);

  // ── presence map: cellKey → user ─────────────────────────────────────────
  const presenceMap = new Map<string, PresenceUser>();
  for (const u of presenceUsers) {
    if (u.activeCell) presenceMap.set(u.activeCell, u);
  }

  const colW = (col: number) => colWidths[col] ?? DEFAULT_COL_W;
  const rowH = (row: number) => rowHeights[row] ?? DEFAULT_ROW_H;

  // ── total dimensions ──────────────────────────────────────────────────────
  const totalW = HEADER_COL_W + colOrder.reduce((s, c) => s + colW(c), 0);
  const totalH = HEADER_ROW_H + Array.from({ length: ROWS }, (_, i) => rowH(i)).reduce((a, b) => a + b, 0);

  // ── col header top offsets ────────────────────────────────────────────────
  const colLeft = (visualIdx: number) =>
    HEADER_COL_W + colOrder.slice(0, visualIdx).reduce((s, c) => s + colW(c), 0);

  const rowTop = (row: number) =>
    HEADER_ROW_H + Array.from({ length: row }, (_, i) => rowH(i)).reduce((a, b) => a + b, 0);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleGridKeyDown}
      className="relative flex-1 overflow-auto outline-none"
      style={{ minHeight: 0 }}
    >
      <div style={{ width: totalW, height: totalH, position: "relative" }}>

        {/* ── top-left corner ────────────────────────────────────────────── */}
        <div
          className="sticky left-0 top-0 z-30 border-b border-r bg-zinc-100"
          style={{ width: HEADER_COL_W, height: HEADER_ROW_H, position: "absolute", top: 0, left: 0 }}
        />

        {/* ── column headers ─────────────────────────────────────────────── */}
        {colOrder.map((colIdx, visualIdx) => (
          <div
            key={colIdx}
            className={`absolute top-0 z-20 flex select-none items-center justify-center border-b border-r bg-zinc-100 text-xs font-medium text-zinc-600 ${dragOverCol === visualIdx ? "bg-blue-100" : ""}`}
            style={{
              left: colLeft(visualIdx),
              width: colW(colIdx),
              height: HEADER_ROW_H,
              cursor: "grab",
            }}
            draggable
            onDragStart={() => onColDragStart(visualIdx)}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(visualIdx); }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={() => onColDrop(visualIdx)}
          >
            {colLetter(colIdx)}
            {/* resize handle */}
            <div
              className="absolute right-0 top-0 h-full w-1 cursor-col-resize"
              onPointerDown={(e) => onColResizeStart(e, colIdx)}
              onPointerMove={onColResizeMove}
              onPointerUp={onColResizeEnd}
            />
          </div>
        ))}

        {/* ── row headers ────────────────────────────────────────────────── */}
        {Array.from({ length: ROWS }, (_, rowIdx) => (
          <div
            key={rowIdx}
            className="absolute left-0 z-20 flex select-none items-center justify-end border-b border-r bg-zinc-100 pr-2 text-xs text-zinc-500"
            style={{
              top: rowTop(rowIdx),
              width: HEADER_COL_W,
              height: rowH(rowIdx),
            }}
          >
            {rowIdx + 1}
            {/* row resize handle */}
            <div
              className="absolute bottom-0 left-0 h-1 w-full cursor-row-resize"
              onPointerDown={(e) => onRowResizeStart(e, rowIdx)}
              onPointerMove={onRowResizeMove}
              onPointerUp={onRowResizeEnd}
            />
          </div>
        ))}

        {/* ── cells ──────────────────────────────────────────────────────── */}
        {Array.from({ length: ROWS }, (_, rowIdx) =>
          colOrder.map((colIdx, visualIdx) => {
            const key = cellKey(colIdx, rowIdx);
            const cell = cells[key];
            const fmt = cell?.formatting ?? { bold: false, italic: false, textColor: "", bgColor: "" };
            const computedVal = computed[key] ?? cell?.value ?? "";
            const isSelected = selected === key;
            const isEditing = isSelected && editing;
            const presenceUser = presenceMap.get(key);

            return (
              <div
                key={key}
                className={`absolute overflow-hidden border-b border-r ${
                  isSelected && !isEditing
                    ? "outline outline-2 outline-blue-500 z-10"
                    : ""
                }`}
                style={{
                  left: colLeft(visualIdx),
                  top: rowTop(rowIdx),
                  width: colW(colIdx),
                  height: rowH(rowIdx),
                  backgroundColor: presenceUser
                    ? `${presenceUser.color}22`
                    : fmt.bgColor || "transparent",
                }}
                onClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  if (!isEditing) onSelect(key);
                }}
                onDoubleClick={(e: MouseEvent) => {
                  e.stopPropagation();
                  onEditStart(key);
                }}
              >
                {isEditing ? (
                  <input
                    ref={editInputRef}
                    value={editValue}
                    onChange={(e) => onEditChange(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    onBlur={() => onEditCommit("none")}
                    className="h-full w-full bg-white px-1 text-xs outline-none"
                    style={{ minWidth: 0 }}
                    spellCheck={false}
                  />
                ) : (
                  <div
                    className="flex h-full items-center px-1 text-xs"
                    style={{
                      fontWeight: fmt.bold ? 700 : 400,
                      fontStyle: fmt.italic ? "italic" : "normal",
                      color: fmt.textColor || "#000",
                      userSelect: "none",
                    }}
                  >
                    {computedVal}
                  </div>
                )}

                {/* presence corner dot */}
                {presenceUser && (
                  <div
                    className="absolute right-0 top-0 h-2 w-2 rounded-bl"
                    style={{ backgroundColor: presenceUser.color }}
                    title={presenceUser.displayName}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
