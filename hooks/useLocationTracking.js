import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { BASE_URL, authHeaders } from '../constants/api';
import {
  onTrackingResult,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../tasks/locationTask';

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
 * Tracks the responder's position whenever their dispatch is active.
 *
 * Preferred path: the background task in tasks/locationTask.js, which keeps
 * reporting with the screen off (needs "Allow all the time" location access).
 * If that permission is refused, falls back to the foreground loop below,
 * which only runs while the app is open.
 *
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
  const bgAskedRef    = useRef(null); // dispatch id we last prompted "all the time" for

  const dispatchId     = dispatch?.dispatch_id ?? null;
  const dispatchStatus = dispatch?.dispatch_status ?? null;
  const isActive       = dispatchId != null && ACTIVE_STATUSES.has(dispatchStatus);

  const requestPermission = useCallback(async () => {
    if (permGranted.current) return true;
    const { status } = await Location.requestForegroundPermissionsAsync();
    permGranted.current = status === 'granted';
    return permGranted.current;
  }, []);

  // "Allow all the time". Asked for only while a dispatch is active, when the
  // reason is obvious, and at most once per dispatch so returning to the app
  // doesn't re-prompt a responder who already said no.
  const requestBackgroundPermission = useCallback(async () => {
    if (!(await requestPermission())) return false;
    try {
      const current = await Location.getBackgroundPermissionsAsync();
      if (current.status === 'granted') return true;
      if (!current.canAskAgain || bgAskedRef.current === dispatchId) return false;
      bgAskedRef.current = dispatchId;
      const { status } = await Location.requestBackgroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }, [requestPermission, dispatchId]);

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
    const stopForeground = () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      watchRef.current?.remove();
      watchRef.current  = null;
      lastFixRef.current = null;
    };

    if (!isActive) {
      isActiveRef.current = false;
      stopForeground();
      stopBackgroundTracking();
      onDeviationChange?.(null);
      return;
    }

    isActiveRef.current = true;
    let cancelled = false;
    let inBackgroundMode = false;
    const intervalMs = intervalForStatus(dispatchStatus);
    const unsubscribe = onTrackingResult((result) => onDeviationChange?.(result));

    const startTracking = async () => {
      if (await requestBackgroundPermission()) {
        try {
          await startBackgroundTracking({ token, dispatchId, intervalMs });
          if (cancelled) return;
          inBackgroundMode = true;
          stopForeground();
          return;
        } catch {
          // Android refuses to start a foreground service while the app is in
          // the background; the AppState listener below retries on return.
        }
      }
      if (cancelled || intervalRef.current) return;
      startWatch();
      sendLocation();
      intervalRef.current = setInterval(sendLocation, intervalMs);
    };
    startTracking();

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !inBackgroundMode && !cancelled) startTracking();
    });

    return () => {
      cancelled = true;
      isActiveRef.current = false;
      unsubscribe();
      sub.remove();
      stopForeground();
      // Background updates are deliberately left running here: this cleanup
      // also runs on every status change, and the next run re-tunes them.
      // They stop in the !isActive branch or when the backend ends the dispatch.
    };
  }, [isActive, dispatchId, dispatchStatus, token]); // eslint-disable-line react-hooks/exhaustive-deps
}
