import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { useStatusSocket } from '../hooks/useStatusSocket';
import { BASE_URL, authHeaders } from '../constants/api';

const STATUS_POLL_MS = 10_000;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,          setUser]          = useState(null);
  const [token,         setToken]         = useState(null);
  const [status,        setStatus]        = useState(null);
  const [deviationState, setDeviationState] = useState(null);
  // The responder's home station. Static per personnel, so it is cached from
  // the login response and deliberately NOT part of the 10s status poll below.
  const [station,       setStation]       = useState(null);

  const dispatch = status?.dispatch ?? null;

  const handleDeviationChange = useCallback((state) => {
    setDeviationState(state);
  }, []);

  useLocationTracking({
    token,
    dispatch,
    onDeviationChange: handleDeviationChange,
  });

  const refreshStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/api/mobile/me/status`, {
        headers: authHeaders(token),
      });
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data);
    } catch { /* non-fatal */ }
  }, [token]);

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
  };

  const updateDispatchStatus = (newStatus) => {
    setStatus(prev => {
      if (!prev?.dispatch) return prev;
      return { ...prev, dispatch: { ...prev.dispatch, dispatch_status: newStatus } };
    });
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setStatus(null);
    setStation(null);
    setDeviationState(null);
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
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
