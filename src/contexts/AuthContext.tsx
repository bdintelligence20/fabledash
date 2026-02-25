/**
 * Firebase Authentication Context
 *
 * Provides auth state management across the app.
 * Wraps Firebase onAuthStateChanged for reactive user state,
 * and exposes login/logout/getIdToken functions.
 */

import { createContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Map Firebase error codes to user-friendly messages.
 */
function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
      return 'Invalid email or password';
    case 'auth/too-many-requests':
      return 'Too many attempts, try again later';
    case 'auth/user-not-found':
      return 'Invalid email or password';
    case 'auth/wrong-password':
      return 'Invalid email or password';
    case 'auth/user-disabled':
      return 'This account has been disabled';
    case 'auth/network-request-failed':
      return 'Network error — check your connection';
    default:
      return 'An error occurred. Please try again.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function login(email: string, password: string): Promise<void> {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const code =
        err instanceof Error && 'code' in err
          ? (err as { code: string }).code
          : '';
      setError(mapFirebaseError(code));
      throw err;
    }
  }

  async function logout(): Promise<void> {
    await signOut(auth);
  }

  async function getIdToken(): Promise<string | null> {
    return (await auth.currentUser?.getIdToken()) ?? null;
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, logout, getIdToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}
