import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { BASE_URL, authHeaders } from '../constants/api';

/**
 * Background dispatch tracking.
 *
 * The foreground loop in useLocationTracking dies when the phone sleeps or the
 * responder switches to another app, which is exactly when they are driving to
 * a fire. This task runs under an Android foreground service (the persistent
 * "sharing location" notification), so updates keep flowing with the screen
 * off and even after the app is swiped away.
 *
 * The task can run headless, with no React tree and no AuthContext, so what it
 * needs (session token, dispatch id, cadence) is mirrored into SecureStore.
 * This module must be imported at app start (App.js) so defineTask runs before
 * the OS delivers a background event.
 */
export const LOCATION_TASK = 'bfp-dispatch-location';
const CONTEXT_KEY = 'bfp_tracking';

let context = null;        // { token, dispatchId, intervalMs }
let lastSentAt = 0;
let inFlight = false;
const listeners = new Set();

async function loadContext() {
  if (context) return context;
  try {
    const raw = await SecureStore.getItemAsync(CONTEXT_KEY);
    context = raw ? JSON.parse(raw) : null;
  } catch {
    context = null;
  }
  return context;
}

/** Subscribe to each server reply (deviation state) while the app is alive. */
export function onTrackingResult(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(result) {
  listeners.forEach((fn) => { try { fn(result); } catch { /* listener bug: ignore */ } });
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const loc = data?.locations?.[data.locations.length - 1];
  if (!loc) return;

  const ctx = await loadContext();
  if (!ctx) {
    // Orphaned service (e.g. signed out while it was running): shut it down.
    await stopBackgroundTracking();
    return;
  }

  // Android may deliver faster than asked, or in batches; hold the cadence.
  const now = Date.now();
  if (inFlight || now - lastSentAt < ctx.intervalMs - 500) return;
  inFlight = true;
  lastSentAt = now;

  try {
    const res = await fetch(`${BASE_URL}/api/location/update`, {
      method: 'POST',
      headers: authHeaders(ctx.token),
      body: JSON.stringify({
        latitude:    loc.coords.latitude,
        longitude:   loc.coords.longitude,
        recorded_at: new Date(loc.timestamp).toISOString(),
        dispatch_id: ctx.dispatchId,
      }),
    });
    if (res.status === 401) {
      // Session expired or revoked; nothing more this task can do.
      await stopBackgroundTracking();
      emit(null);
      return;
    }
    if (!res.ok) return;
    const body = await res.json();
    if (body.status === 'dispatch_ended') {
      await stopBackgroundTracking();
      emit(null);
      return;
    }
    emit(
      body.deviation && body.connector_geojson
        ? { isDeviated: true, connectorGeoJSON: body.connector_geojson }
        : { isDeviated: false, connectorGeoJSON: null }
    );
  } catch {
    /* offline: the next fix retries */
  } finally {
    inFlight = false;
  }
});

export async function isBackgroundTrackingRunning() {
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}

/** Start (or re-tune) background updates for a dispatch. Idempotent. */
export async function startBackgroundTracking({ token, dispatchId, intervalMs }) {
  const prev = await loadContext();
  context = { token, dispatchId, intervalMs };
  try { await SecureStore.setItemAsync(CONTEXT_KEY, JSON.stringify(context)); }
  catch { /* the in-memory copy still serves while the app is alive */ }

  const running = await isBackgroundTrackingRunning();
  if (running && prev?.intervalMs === intervalMs) return;
  if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);

  lastSentAt = 0;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: intervalMs,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'FireGIS · Dispatch in progress',
      notificationBody: 'Sharing your location with the command center.',
      notificationColor: '#ff4d1a',
      killServiceOnDestroy: false,
    },
  });
}

export async function stopBackgroundTracking() {
  context = null;
  lastSentAt = 0;
  try { await SecureStore.deleteItemAsync(CONTEXT_KEY); } catch { /* non-fatal */ }
  if (await isBackgroundTrackingRunning()) {
    try { await Location.stopLocationUpdatesAsync(LOCATION_TASK); } catch { /* already stopped */ }
  }
}
