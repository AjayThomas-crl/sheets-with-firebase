// Formula engine: parses and evaluates spreadsheet formulas.
// Supports: arithmetic (+,-,*,/), cell references (A1), ranges (A1:B3),
// and functions: SUM, AVERAGE, MIN, MAX, COUNT.
// Limitation: no nested function calls, no circular dependency detection.

export type CellGetter = (cellKey: string) => number;

function colIndexToLetter(index: number): string {
  let result = "";
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

function cellKeyToIndices(key: string): { col: number; row: number } | null {
  const match = key.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const colStr = match[1];
  const rowStr = match[2];
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  return { col: col - 1, row: parseInt(rowStr, 10) - 1 };
}

function expandRange(from: string, to: string): string[] {
  const a = cellKeyToIndices(from);
  const b = cellKeyToIndices(to);
  if (!a || !b) return [];
  const keys: string[] = [];
  for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) {
    for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) {
      keys.push(`${colIndexToLetter(c)}${r + 1}`);
    }
  }
  return keys;
}

function resolveArg(arg: string, getCellValue: CellGetter): number {
  const trimmed = arg.trim();
  if (/^[A-Za-z]+\d+:[A-Za-z]+\d+$/.test(trimmed)) {
    const [from, to] = trimmed.split(":");
    return expandRange(from, to).reduce((sum, k) => sum + getCellValue(k), 0);
  }
  if (/^[A-Za-z]+\d+$/.test(trimmed)) return getCellValue(trimmed.toUpperCase());
  return parseFloat(trimmed) || 0;
}

function evalFunction(name: string, argsStr: string, getCellValue: CellGetter): number {
  const rawArgs = argsStr.split(",");
  const fn = name.toUpperCase();

  const numbers: number[] = [];
  for (const rawArg of rawArgs) {
    const arg = rawArg.trim();
    if (/^[A-Za-z]+\d+:[A-Za-z]+\d+$/.test(arg)) {
      const [from, to] = arg.split(":");
      expandRange(from, to).forEach((k) => numbers.push(getCellValue(k)));
    } else if (/^[A-Za-z]+\d+$/.test(arg)) {
      numbers.push(getCellValue(arg.toUpperCase()));
    } else {
      const n = parseFloat(arg);
      if (!isNaN(n)) numbers.push(n);
    }
  }

  if (numbers.length === 0) return 0;

  switch (fn) {
    case "SUM":     return numbers.reduce((a, b) => a + b, 0);
    case "AVERAGE": return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    case "MIN":     return Math.min(...numbers);
    case "MAX":     return Math.max(...numbers);
    case "COUNT":   return numbers.filter((n) => !isNaN(n)).length;
    default:        return 0;
  }
}

// Tokenise and evaluate a formula expression (without the leading "=")
function evalExpr(expr: string, getCellValue: CellGetter): number {
  // Replace function calls first
  const withFns = expr.replace(
    /([A-Z]+)\(([^)]*)\)/g,
    (_, name, args) => String(evalFunction(name, args, getCellValue))
  );

  // Replace cell references
  const withRefs = withFns.replace(/\b([A-Za-z]+)(\d+)\b/g, (_, col, row) =>
    String(getCellValue(`${col.toUpperCase()}${row}`))
  );

  // Evaluate arithmetic — only allow safe characters
  if (!/^[0-9+\-*/.() \t]+$/.test(withRefs)) return NaN;
  try {
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${withRefs})`)() as number;
  } catch {
    return NaN;
  }
}

export function evaluateFormula(raw: string, getCellValue: CellGetter): string {
  if (!raw.startsWith("=")) return raw;
  const expr = raw.slice(1).trim().toUpperCase();
  const result = evalExpr(expr, getCellValue);
  if (isNaN(result)) return "#ERROR";
  const rounded = Math.round(result * 1e10) / 1e10;
  return String(rounded);
}

// Resolve all cells: returns a new computed map after running formulas.
// Runs up to 10 passes to handle inter-cell dependencies (no circular detection).
export function resolveAll(
  cells: Record<string, { value: string; computed: string }>
): Record<string, string> {
  const computed: Record<string, string> = {};

  const getCellValue: CellGetter = (key) => {
    const v = computed[key] ?? cells[key]?.computed ?? "";
    return parseFloat(v) || 0;
  };

  const formulaCells = Object.entries(cells).filter(([, c]) =>
    c.value.startsWith("=")
  );
  const plainCells = Object.entries(cells).filter(([, c]) => !c.value.startsWith("="));

  for (const [key, cell] of plainCells) {
    computed[key] = cell.value;
  }

  for (let pass = 0; pass < 10; pass++) {
    for (const [key, cell] of formulaCells) {
      computed[key] = evaluateFormula(cell.value, getCellValue);
    }
  }

  return computed;
}
