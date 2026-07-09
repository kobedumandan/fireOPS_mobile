import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { BASE_URL, authHeaders } from '../constants/api';

const ACTIVE_STATUSES = new Set(['dispatched', 'en_route', 'on_scene']);
const INTERVAL_MS_DISPATCHED = 3_000;
const INTERVAL_MS_ON_SCENE   = 20_000;
const INTERVAL_MS_DEFAULT    = 30_000;

function intervalForStatus(status) {
  if (status === 'dispatched' || status === 'en_route') return INTERVAL_MS_DISPATCHED;
  if (status === 'on_scene') return INTERVAL_MS_ON_SCENE;
  return INTERVAL_MS_DEFAULT;
}

/**
 * Starts a 30-second location tracking loop whenever the dispatch is active.
 * Sends POST /api/location/update with the device timestamp.
 * Calls onDeviationChange({ isDeviated, connectorGeoJSON }) on every response,
 * or onDeviationChange(null) when tracking stops.
 *
 * The loop stops automatically when:
 *   - The backend returns { status: "dispatch_ended" }
 *   - The dispatch becomes inactive (status leaves the active set)
 *   - The component unmounts
 */
export function useLocationTracking({ token, dispatch, onDeviationChange }) {
  const intervalRef   = useRef(null);
  const isActiveRef   = useRef(false);
  const permGranted   = useRef(false);
  const watchRef      = useRef(null);
  const lastFixRef    = useRef(null); // newest { latitude, longitude, timestamp }

  const dispatchId     = dispatch?.dispatch_id ?? null;
  const dispatchStatus = dispatch?.dispatch_status ?? null;
  const isActive       = dispatchId != null && ACTIVE_STATUSES.has(dispatchStatus);

  const requestPermission = useCallback(async () => {
    if (permGranted.current) return true;
    const { status } = await Location.requestForegroundPermissionsAsync();
    permGranted.current = status === 'granted';
    return permGranted.current;
  }, []);

  // Keep a warm GPS fix streaming in the background so each report sends the
  // latest position immediately, instead of paying the cold-start latency of
  // getCurrentPositionAsync (often several seconds) on every tick.
  const startWatch = useCallback(async () => {
    if (watchRef.current) return;
    const granted = await requestPermission();
    if (!granted) return;
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 2_000, distanceInterval: 3 },
      (loc) => {
        lastFixRef.current = {
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
          timestamp: loc.timestamp,
        };
      },
    );
  }, [requestPermission]);

  const sendLocation = useCallback(async () => {
    if (!isActiveRef.current || !token || !dispatchId) return;

    let fix = lastFixRef.current;
    if (!fix) {
      // Watch hasn't produced a fix yet — fall back to a one-shot read so the
      // very first report isn't delayed by a whole interval.
      const granted = await requestPermission();
      if (!granted) return;
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        fix = {
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
          timestamp: loc.timestamp,
        };
      } catch {
        return;
      }
    }

    const recorded_at = new Date(fix.timestamp).toISOString();

    let data;
    try {
      const res = await fetch(`${BASE_URL}/api/location/update`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          latitude:    fix.latitude,
          longitude:   fix.longitude,
          recorded_at,
          dispatch_id: dispatchId,
        }),
      });
      if (!res.ok) return;
      data = await res.json();
    } catch {
      return;
    }

    if (data.status === 'dispatch_ended') {
      isActiveRef.current = false;
      clearInterval(intervalRef.current);
      watchRef.current?.remove();
      watchRef.current  = null;
      lastFixRef.current = null;
      onDeviationChange?.(null);
      return;
    }

    if (data.deviation && data.connector_geojson) {
      onDeviationChange?.({ isDeviated: true, connectorGeoJSON: data.connector_geojson });
    } else {
      onDeviationChange?.({ isDeviated: false, connectorGeoJSON: null });
    }
  }, [token, dispatchId, requestPermission, onDeviationChange]);

  useEffect(() => {
    if (!isActive) {
      isActiveRef.current = false;
      clearInterval(intervalRef.current);
      watchRef.current?.remove();
      watchRef.current  = null;
      lastFixRef.current = null;
      onDeviationChange?.(null);
      return;
    }

    isActiveRef.current = true;
    startWatch();
    sendLocation();
    intervalRef.current = setInterval(sendLocation, intervalForStatus(dispatchStatus));

    return () => {
      isActiveRef.current = false;
      clearInterval(intervalRef.current);
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [isActive, dispatchId, dispatchStatus]); // eslint-disable-line react-hooks/exhaustive-deps
}
