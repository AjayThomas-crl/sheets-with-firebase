"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  updateProfile,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: (displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  needsDisplayName: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const signInAsGuest = useCallback(async (displayName: string) => {
    const cred = await signInAnonymously(auth);
    await updateProfile(cred.user, { displayName });
    setUser({ ...cred.user, displayName });
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  // Anonymous users without a display name still need one
  const needsDisplayName =
    !loading && !!user && user.isAnonymous && !user.displayName;

  return (
    <AuthContext.Provider
      value={{ user, loading, signInWithGoogle, signInAsGuest, logout, needsDisplayName }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
