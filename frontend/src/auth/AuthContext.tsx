import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { getCurrentUser, fetchAuthSession, signOut as amplifySignOut } from 'aws-amplify/auth';
import { apiFetch } from '../lib/api';

interface AuthState {
  userId: string | null;
  email: string | null;
  idToken: string | null;
  balance: number | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  userId: null,
  email: null,
  idToken: null,
  balance: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
  refreshSession: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const { userId: uid } = await getCurrentUser();
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() ?? null;
      setUserId(uid);
      setIdToken(token);
      // Fetch /me for profile data
      if (token) {
        try {
          const meRes = await apiFetch('/me', token);
          if (meRes.ok) {
            const me = await meRes.json() as { email: string; balance: number; isAdmin: boolean };
            setEmail(me.email);
            setBalance(me.balance);
            setIsAdmin(me.isAdmin ?? false);
          }
        } catch { /* /me failure is non-fatal */ }
      }
    } catch {
      setUserId(null);
      setIdToken(null);
      setEmail(null);
      setBalance(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const signOut = useCallback(async () => {
    await amplifySignOut();
    setUserId(null);
    setIdToken(null);
    setEmail(null);
    setBalance(null);
    setIsAdmin(false);
  }, []);

  const refreshSession = useCallback(async () => {
    setLoading(true);
    await loadSession();
  }, [loadSession]);

  return (
    <AuthContext.Provider value={{ userId, email, idToken, balance, isAdmin, loading, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
