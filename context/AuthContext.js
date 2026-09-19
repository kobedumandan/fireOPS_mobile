import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { useStatusSocket } from '../hooks/useStatusSocket';
import { BASE_URL, authHeaders, revokeToken } from '../constants/api';

const STATUS_POLL_MS = 10_000;

// Session survives app restarts so a responder whose app was killed mid-dispatch
// doesn't have to log in again. Kept in the OS keystore, not AsyncStorage,
// since it holds the bearer token.
const SESSION_KEY = 'bfp_session';

async function saveSession(session) {
  try { await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session)); }
  catch { /* non-fatal — the user just logs in again next launch */ }
}

async function clearSession() {
  try { await SecureStore.deleteItemAsync(SESSION_KEY); } catch { /* non-fatal */ }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,          setUser]          = useState(null);
  const [token,         setToken]         = useState(null);
  const [status,        setStatus]        = useState(null);
  const [deviationState, setDeviationState] = useState(null);
  // The responder's home station. Static per personnel, so it is cached from
  // the login response and deliberately NOT part of the 10s status poll below.
  const [station,       setStation]       = useState(null);
  // True until the stored session has been read, so the app doesn't flash the
  // login screen before restoring a logged-in user.
  const [restoring,     setRestoring]     = useState(true);

  const dispatch = status?.dispatch ?? null;

  const handleDeviationChange = useCallback((state) => {
    setDeviationState(state);
  }, []);

  useLocationTracking({
    token,
    dispatch,
    onDeviationChange: handleDeviationChange,
  });

  const clearAuthState = useCallback(() => {
    setUser(null);
    setToken(null);
    setStatus(null);
    setStation(null);
    setDeviationState(null);
    clearSession();
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/api/mobile/me/status`, {
        headers: authHeaders(token),
      });
      // Expired (JWT_EXPIRE_HOURS) or revoked token: drop the stale session
      // instead of polling forever with a dead token.
      if (res.status === 401) { clearAuthState(); return; }
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data);
    } catch { /* non-fatal */ }
  }, [token, clearAuthState]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        const saved = raw ? JSON.parse(raw) : null;
        if (saved?.token && saved?.user) {
          setUser(saved.user);
          setToken(saved.token);
          setStation(saved.station ?? null);
          // Status is not restored: the poll below fetches it fresh, and a
          // 401 there signs the user out if the token has since expired.
        }
      } catch { /* corrupt or unreadable — fall through to the login screen */ }
      setRestoring(false);
    })();
  }, []);

  // Instant push: refresh status the moment the backend broadcasts a route /
  // incident / dispatch change, instead of waiting for the next poll below.
  useStatusSocket({ token, onRefresh: refreshStatus });

  useEffect(() => {
    if (!token) return;
    refreshStatus();
    const id = setInterval(refreshStatus, STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [token, refreshStatus]);

  // Re-read the cached station on app foreground. Stations don't move, but an
  // admin can correct a bad coordinate and a session may live for days.
  const refreshStation = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/api/mobile/me/station`, {
        headers: authHeaders(token),
      });
      if (!res.ok) return;
      const data = await res.json();
      setStation(data.station ?? null);
    } catch { /* non-fatal — keep the cached value */ }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshStation();
    });
    return () => sub.remove();
  }, [token, refreshStation]);

  const login = (userData, authToken, statusData = null, stationData = null) => {
    setUser(userData);
    setToken(authToken ?? null);
    setStatus(statusData);
    setStation(stationData);
    if (authToken) saveSession({ token: authToken, user: userData, station: stationData });
  };

  const updateDispatchStatus = (newStatus) => {
    setStatus(prev => {
      if (!prev?.dispatch) return prev;
      return { ...prev, dispatch: { ...prev.dispatch, dispatch_status: newStatus } };
    });
  };

  const logout = () => {
    if (token) revokeToken(token);
    clearAuthState();
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      status,
      station,
      deviationState,
      login,
      logout,
      updateDispatchStatus,
      refreshStatus,
      refreshStation,
      isAuthenticated: !!user,
      restoring,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
