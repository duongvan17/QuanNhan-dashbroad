import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '../../shared/types';
import {
  getAuthStatus, apiLogin, apiRegister, apiMe, apiLogout, apiChangePassword, tokenStore,
} from '../services/api';

interface AuthContextValue {
  loading: boolean;
  dbConnected: boolean;
  user: User | null;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const status = await getAuthStatus();
      setDbConnected(!!status.dbConnected);
      if (status.dbConnected && tokenStore.get()) {
        try {
          const me = await apiMe();
          setUser(me.user ?? null);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setDbConnected(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await apiLogin(username, password);
    tokenStore.set(res.token);
    setUser(res.user);
    setDbConnected(true);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await apiRegister(username, password);
    tokenStore.set(res.token);
    setUser(res.user);
    setDbConnected(true);
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* */ }
    tokenStore.clear();
    setUser(null);
  }, []);

  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    await apiChangePassword(oldPassword, newPassword);
    setUser((u) => (u ? { ...u, must_change_password: false } : u));
  }, []);

  const refreshStatus = useCallback(async () => {
    const status = await getAuthStatus();
    setDbConnected(!!status.dbConnected);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        loading,
        dbConnected,
        user,
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout,
        changePassword,
        refreshStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
