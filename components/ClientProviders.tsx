"use client";

// Firebase must only run on the client; this thin wrapper lets layout.tsx
// (a Server Component) hand down children without triggering SSR init.
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// ssr: false is allowed inside a Client Component.
const Providers = dynamic(
  () => import("./ClientProvidersInner").then((m) => m.ClientProvidersInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <span className="text-sm text-zinc-400">Loading…</span>
      </div>
    ),
  }
);

export function ClientProviders({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
