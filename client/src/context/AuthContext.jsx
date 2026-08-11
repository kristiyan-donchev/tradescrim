import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as api from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginToken = params.get('loginToken');
    if (loginToken) {
      // Strip it before the exchange call resolves, not after — React 18
      // StrictMode double-invokes effects in dev, and this token is
      // single-use server-side, so the URL must already be clean by the
      // time a second invocation (if any) re-reads it.
      params.delete('loginToken');
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
      api
        .exchangeGoogleLogin(loginToken)
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setCheckingSession(false));
      return;
    }

    const emailVerified = params.get('emailVerified');
    if (emailVerified != null) {
      // Just a UI signal from the verify-email redirect — strip it so a
      // refresh doesn't re-trigger anything, and re-fetch the user below so
      // emailVerified reflects the just-completed change immediately rather
      // than waiting for the next natural refetch.
      params.delete('emailVerified');
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }

    api
      .fetchCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  const signup = useCallback(async (credentials) => {
    const newUser = await api.signup(credentials);
    setUser(newUser);
    return newUser;
  }, []);

  const login = useCallback(async (credentials) => {
    const loggedInUser = await api.login(credentials);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const updateUsername = useCallback(async (username) => {
    const updated = await api.updateUsername(username);
    setUser(updated);
    return updated;
  }, []);

  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    await api.updatePassword({ currentPassword, newPassword });
  }, []);

  const deleteAccount = useCallback(async (confirmUsername) => {
    await api.deleteAccount(confirmUsername);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, checkingSession, signup, login, logout, updateUsername, changePassword, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
