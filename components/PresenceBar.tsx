"use client";

import type { PresenceUser } from "@/lib/types";

interface Props {
  users: PresenceUser[];
}

export function PresenceBar({ users }: Props) {
  if (users.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {users.map((u) => (
        <div
          key={u.uid}
          title={u.displayName}
          style={{ backgroundColor: u.color }}
          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm"
        >
          {u.displayName.charAt(0).toUpperCase()}
        </div>
      ))}
    </div>
  );
}
