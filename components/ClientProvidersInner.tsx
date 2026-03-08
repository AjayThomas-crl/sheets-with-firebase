"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { IdentityGate } from "@/components/IdentityGate";

export function ClientProvidersInner({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <IdentityGate>{children}</IdentityGate>
    </AuthProvider>
  );
}
