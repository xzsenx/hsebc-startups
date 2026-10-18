import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, onUnauthorized, tokenStore, type Me, type ProfilePayload, type Summary } from "./api";

interface AuthValue {
  user: Me | null;
  loading: boolean;
  summary: Summary | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: Parameters<typeof api.register>[0]) => Promise<void>;
  updateProfile: (payload: Partial<ProfilePayload>) => Promise<void>;
  refreshSummary: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSummary = useCallback(async () => {
    if (!tokenStore.get()) return;
    try {
      setSummary(await api.summary());
    } catch {
      /* счётчик — некритичная информация, ошибку не показываем */
    }
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setSummary(null);
  }, []);

  useEffect(() => onUnauthorized(logout), [logout]);

  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((me) => {
        setUser(me);
        void refreshSummary();
      })
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, [refreshSummary]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      summary,
      login: async (email, password) => {
        const data = await api.login(email, password);
        tokenStore.set(data.access_token);
        setUser(data.user);
        void refreshSummary();
      },
      register: async (payload) => {
        const data = await api.register(payload);
        tokenStore.set(data.access_token);
        setUser(data.user);
        void refreshSummary();
      },
      updateProfile: async (payload) => {
        setUser(await api.updateProfile(payload));
      },
      refreshSummary,
      logout,
    }),
    [user, loading, summary, refreshSummary, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth вызван вне AuthProvider");
  return context;
}
