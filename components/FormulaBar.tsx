"use client";

import { useEffect, useRef } from "react";

interface Props {
  cellRef: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}

export function FormulaBar({ cellRef, value, editing, onChange, onCommit, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing, cellRef]);

  return (
    <div className="flex items-center gap-0 border-b bg-white">
      <div className="flex h-8 w-16 shrink-0 items-center justify-center border-r bg-zinc-50 text-xs font-medium text-zinc-600">
        {cellRef || ""}
      </div>
      <span className="px-2 text-sm text-zinc-400">fx</span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); onCommit(); }
          if (e.key === "Escape") { e.preventDefault(); onCancel(); }
        }}
        className="flex-1 bg-transparent px-1 py-1 text-sm outline-none"
        placeholder="Enter value or formula"
        spellCheck={false}
      />
    </div>
  );
}
