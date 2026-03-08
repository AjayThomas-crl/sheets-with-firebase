"use client";

import { Bold, Italic } from "lucide-react";
import type { CellFormatting } from "@/lib/types";

const PRESET_COLORS = [
  "#000000", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
];

const PRESET_BG = [
  "", "#fef2f2", "#fff7ed", "#fefce8",
  "#f0fdf4", "#eff6ff", "#f5f3ff", "#fdf4ff",
];

interface Props {
  formatting: CellFormatting;
  disabled: boolean;
  onFormat: (patch: Partial<CellFormatting>) => void;
}

export function Toolbar({ formatting, disabled, onFormat }: Props) {
  return (
    <div className="flex items-center gap-1 border-b bg-white px-3 py-1">
      <ToolBtn
        active={formatting.bold}
        disabled={disabled}
        onClick={() => onFormat({ bold: !formatting.bold })}
        title="Bold (Ctrl+B)"
      >
        <Bold size={14} />
      </ToolBtn>

      <ToolBtn
        active={formatting.italic}
        disabled={disabled}
        onClick={() => onFormat({ italic: !formatting.italic })}
        title="Italic (Ctrl+I)"
      >
        <Italic size={14} />
      </ToolBtn>

      <div className="mx-1 h-5 w-px bg-zinc-200" />

      <label className="flex items-center gap-1 text-xs text-zinc-500" title="Text color">
        <span className="inline-block h-3 w-3 rounded-sm border border-zinc-300" style={{ backgroundColor: formatting.textColor || "#000" }} />
        A
        <input
          type="color"
          value={formatting.textColor || "#000000"}
          onChange={(e) => onFormat({ textColor: e.target.value })}
          disabled={disabled}
          className="sr-only"
        />
      </label>

      <div className="flex gap-0.5">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            disabled={disabled}
            title={`Text: ${c}`}
            onClick={() => onFormat({ textColor: c })}
            style={{ backgroundColor: c }}
            className="h-4 w-4 rounded-sm border border-zinc-200 hover:scale-110"
          />
        ))}
      </div>

      <div className="mx-1 h-5 w-px bg-zinc-200" />

      <span className="text-xs text-zinc-400">Fill</span>
      <div className="flex gap-0.5">
        {PRESET_BG.map((c, i) => (
          <button
            key={i}
            disabled={disabled}
            title={`Background: ${c || "none"}`}
            onClick={() => onFormat({ bgColor: c })}
            style={{ backgroundColor: c || "#fff" }}
            className="h-4 w-4 rounded-sm border border-zinc-300 hover:scale-110"
          />
        ))}
      </div>
    </div>
  );
}

function ToolBtn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-40 ${active ? "bg-zinc-200 font-bold" : ""}`}
    >
      {children}
    </button>
  );
}
