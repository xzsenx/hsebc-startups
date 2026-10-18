import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, clearToken, hasToken, saveToken, type Me } from "./api";

interface AuthValue {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: Record<string, string>) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const data = await api.login(email, password);
        saveToken(data.access_token);
        setUser(data.user);
      },
      register: async (payload) => {
        const data = await api.register(payload);
        saveToken(data.access_token);
        setUser(data.user);
      },
      logout: () => {
        clearToken();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth вне AuthProvider");
  return context;
}
