import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, ApiError } from './api-client';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  timezone: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  // login/register return the freshly-authenticated User so callers can route based on
  // the live role (Section 4.1.9 post-auth routing). The user is also persisted in context
  // via setUser; the return is for immediate routing without waiting for re-render.
  login: (email: string, password: string) => Promise<User>;
  register: (data: { email: string; password: string; name: string; phone?: string; role?: string }) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

interface LoginResponse {
  user: User;
  token: string;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadToken = useCallback(async () => {
    try {
      const stored = await SecureStore.getItemAsync('auth_token');
      if (stored) {
        setToken(stored);
        // 6-second timeout safety net: if /auth/me hangs (Vercel free tier
        // cold start can pause 10s+ on the first request after idle), we
        // treat it the same as any other auth failure — clear local auth
        // state and let the user re-login. Without this, the app freezes
        // on the splash / ActivityIndicator forever waiting for the verify
        // call to come back. The lost fetch promise resolves in the
        // background after we've moved on; nothing listens, GC eats it.
        const userData = await Promise.race([
          api.get<User>('/auth/me'),
          new Promise<User>((_, reject) =>
            setTimeout(() => reject(new Error('AUTH_VERIFY_TIMEOUT')), 6000),
          ),
        ]);
        setUser(userData);
      }
    } catch {
      await SecureStore.deleteItemAsync('auth_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadToken();
  }, [loadToken]);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const data = await api.post<LoginResponse>('/auth/login', { email, password });
    await SecureStore.setItemAsync('auth_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(
    async (regData: { email: string; password: string; name: string; phone?: string; role?: string }): Promise<User> => {
      const data = await api.post<LoginResponse>('/auth/register', regData);
      await SecureStore.setItemAsync('auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync('auth_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export { ApiError };
