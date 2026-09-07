import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/authApi";
import { setAccessToken } from "../api/tokenStore";
import { onSessionExpired } from "../api/authEvents";
import { AuthContext } from "./authContextInstance";

// status: "loading" (initial refresh-on-reload in flight) | "authenticated" | "unauthenticated"
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const applySession = useCallback((sessionUser, accessToken) => {
    setAccessToken(accessToken);
    setUser(sessionUser);
    setStatus("authenticated");
  }, []);

  // On mount (including every full page reload), try to turn the httpOnly
  // refresh cookie back into an access token. There is no access token in
  // memory yet at this point, so this call is unauthenticated on purpose.
  useEffect(() => {
    let cancelled = false;

    authApi
      .refresh()
      .then((res) => {
        if (!cancelled) applySession(res.data.user, res.data.accessToken);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      });

    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  useEffect(() => onSessionExpired(clearSession), [clearSession]);

  const login = useCallback(
    async (email, password) => {
      const res = await authApi.login({ email, password });
      applySession(res.data.user, res.data.accessToken);
      return res.data.user;
    },
    [applySession]
  );

  const register = useCallback(async (name, email, password) => {
    const res = await authApi.register({ name, email, password });
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  // Re-pulls /me, e.g. after creating the first business updates lastActiveBusiness.
  const refreshUser = useCallback(async () => {
    const res = await authApi.me();
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout, logoutAll, refreshUser }),
    [user, status, login, register, logout, logoutAll, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
