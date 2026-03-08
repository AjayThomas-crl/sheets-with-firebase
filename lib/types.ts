import { Timestamp } from "firebase/firestore";

export interface SheetDocument {
  id: string;
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface CellFormatting {
  bold: boolean;
  italic: boolean;
  textColor: string;
  bgColor: string;
}

export interface CellData {
  value: string;
  computed: string;
  formatting: CellFormatting;
}

export interface PresenceUser {
  uid: string;
  displayName: string;
  color: string;
  activeCell: string | null;
  lastSeen: Timestamp;
}

export type WriteState = "idle" | "saving" | "saved" | "error";

export interface ColSize {
  [colIndex: number]: number;
}

export interface RowSize {
  [rowIndex: number]: number;
}
