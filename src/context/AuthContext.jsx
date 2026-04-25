import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signIn, refreshIdToken, FIREBASE_DB_URL } from '../firebase';

const AuthContext = createContext(null);
const STORAGE_KEY = 'news_admin_session';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);   // { idToken, refreshToken, localId, email, expiresAt }
  const [role, setRole]       = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async (idToken, uid) => {
    try {
      const res = await fetch(`${FIREBASE_DB_URL}/roles/${uid}.json?auth=${idToken}`);
      const r = await res.json();
      return r ?? 'user';
    } catch { return 'user'; }
  }, []);

  // Restore session from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { setLoading(false); return; }
    const saved = JSON.parse(raw);
    // If expired, try to refresh
    if (Date.now() >= saved.expiresAt - 60_000) {
      refreshIdToken(saved.refreshToken)
        .then(async updated => {
          const merged = { ...saved, ...updated };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          const r = await fetchRole(merged.idToken, merged.localId);
          setSession(merged);
          setRole(r);
        })
        .catch(() => localStorage.removeItem(STORAGE_KEY))
        .finally(() => setLoading(false));
    } else {
      fetchRole(saved.idToken, saved.localId).then(r => {
        setSession(saved);
        setRole(r);
        setLoading(false);
      });
    }
  }, [fetchRole]);

  const login = useCallback(async (email, password) => {
    const s = await signIn(email, password);
    const r = await fetchRole(s.idToken, s.localId);
    if (r !== 'admin') throw new Error('Access denied. Admin accounts only.');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    setSession(s);
    setRole(r);
  }, [fetchRole]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setRole(null);
  }, []);

  // Auto-refresh token 5 minutes before expiry
  useEffect(() => {
    if (!session) return;
    const msLeft = session.expiresAt - Date.now() - 5 * 60_000;
    if (msLeft <= 0) return;
    const timer = setTimeout(async () => {
      try {
        const updated = await refreshIdToken(session.refreshToken);
        const merged = { ...session, ...updated };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        setSession(merged);
      } catch { logout(); }
    }, msLeft);
    return () => clearTimeout(timer);
  }, [session, logout]);

  return (
    <AuthContext.Provider value={{ session, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
