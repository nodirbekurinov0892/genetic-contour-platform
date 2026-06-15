"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authService, type AuthUser, type ProfileUpdatePayload } from "@/services/authService";
import {
  clearTokens,
  getAccessToken,
  setTokens,
  syncSessionCookie,
} from "@/lib/auth-storage";
import { toUserFacingNetworkError } from "@/lib/network-errors";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: ProfileUpdatePayload) => Promise<AuthUser>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    const hasCookieSession =
      typeof document !== "undefined" &&
      document.cookie.includes("gc_session=1");
    if (!token && !hasCookieSession) {
      setUser(null);
      syncSessionCookie();
      return;
    }

    if (token) syncSessionCookie();

    try {
      const me = await authService.me();
      setUser(me);
    } catch {
      clearTokens();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      await authService.login({ email, password });
      try {
        const me = await authService.me();
        setUser(me);
      } catch (err) {
        clearTokens();
        setUser(null);
        throw toUserFacingNetworkError(
          err,
          "Kirish muvaffaqiyatli, lekin profil yuklanmadi. Sahifani yangilab qayta urinib ko'ring.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      setLoading(true);
      try {
        await authService.register({ email, password, name });
        await authService.login({ email, password });
        try {
          const me = await authService.me();
          setUser(me);
        } catch (err) {
          clearTokens();
          setUser(null);
          throw toUserFacingNetworkError(
            err,
            "Ro'yxatdan o'tish muvaffaqiyatli, lekin profil yuklanmadi.",
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: ProfileUpdatePayload) => {
    const updated = await authService.updateProfile(data);
    setUser(updated);
    return updated;
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await authService.changePassword({ current_password: currentPassword, new_password: newPassword });
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
      changePassword,
    }),
    [user, loading, login, register, logout, refreshUser, updateProfile, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
