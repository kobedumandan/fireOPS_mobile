import { useCallback, useEffect, useRef, useState } from 'react';

// History cap — a 24h shift doesn't need more than this on screen.
const MAX_ALERTS = 50;

function stamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function where(dispatch) {
  const inc = dispatch?.incident;
  return inc?.fire_location_name || inc?.fire_address || 'incident location';
}

/**
 * In-app alert history, derived from the status the app already receives
 * (10s poll + WebSocket-triggered refresh) and the deviation state from
 * location tracking. No new endpoint: every alert is a diff between the
 * previous and current snapshot.
 *
 * The first snapshot after login only seeds the baseline, so reopening the
 * app mid-dispatch doesn't replay "Dispatch Assigned". The log lives in memory
 * and is cleared when `token` changes (login / logout).
 */
export function useAlertLog({ token, status, deviationState }) {
  const [alerts, setAlerts] = useState([]);
  const prevRef = useRef(null);
  const prevDeviatedRef = useRef(false);
  const nextIdRef = useRef(1);

  useEffect(() => {
    setAlerts([]);
    prevRef.current = null;
    prevDeviatedRef.current = false;
  }, [token]);

  const add = useCallback((items) => {
    if (!items.length) return;
    const time = stamp();
    const at = Date.now();
    setAlerts((prev) =>
      [
        ...items.map((a) => ({ ...a, id: nextIdRef.current++, time, at, unread: true })),
        ...prev,
      ].slice(0, MAX_ALERTS)
    );
  }, []);

  useEffect(() => {
    if (!status) return;
    const d = status.dispatch ?? null;
    const snap = {
      dispatchId: d?.dispatch_id ?? null,
      dispatchStatus: d?.dispatch_status ?? null,
      routeWkt: d?.route_wkt ?? null,
      fireStatus: d?.incident?.fire_status ?? null,
    };
    const prev = prevRef.current;
    prevRef.current = snap;
    if (!prev) return;

    const out = [];
    if (snap.dispatchId && snap.dispatchId !== prev.dispatchId) {
      out.push({
        title: 'Dispatch Assigned',
        body: `DISP-${snap.dispatchId} · ${where(d)}. Proceed to the scene.`,
        variant: 'fire',
        icon: 'flame',
      });
    } else if (!snap.dispatchId && prev.dispatchId) {
      out.push({
        title: 'Dispatch Ended',
        body: `DISP-${prev.dispatchId} closed. You are back on standby.`,
        variant: 'muted',
        icon: 'flag',
      });
    } else if (snap.dispatchId) {
      if (snap.routeWkt && prev.routeWkt && snap.routeWkt !== prev.routeWkt) {
        out.push({
          title: 'Route Updated',
          body: 'Your dispatch route was recalculated. Check the Route tab.',
          variant: 'amber',
          icon: 'git-branch',
        });
      }
      if (snap.dispatchStatus === 'on_scene' && prev.dispatchStatus !== 'on_scene') {
        out.push({
          title: 'Arrived On Scene',
          body: `Your team is marked on scene at ${where(d)}.`,
          variant: 'blue',
          icon: 'location',
        });
      }
      if (snap.fireStatus === 'contained' && prev.fireStatus !== 'contained') {
        out.push({
          title: 'Fire Contained',
          body: `${where(d)} is marked contained. Continue overhaul until released.`,
          variant: 'green',
          icon: 'checkmark-circle',
        });
      }
    }
    add(out);
  }, [status, add]);

  useEffect(() => {
    const deviated = !!deviationState?.isDeviated;
    if (deviated && !prevDeviatedRef.current) {
      add([{
        title: 'Off Route',
        body: 'You have left the dispatch route. A connector back to it is on the Route tab.',
        variant: 'amber',
        icon: 'warning',
      }]);
    }
    prevDeviatedRef.current = deviated;
  }, [deviationState, add]);

  const markAlertsRead = useCallback(() => {
    setAlerts((prev) =>
      prev.some((a) => a.unread) ? prev.map((a) => ({ ...a, unread: false })) : prev
    );
  }, []);

  const clearAlerts = useCallback(() => setAlerts([]), []);

  return {
    alerts,
    unreadAlerts: alerts.filter((a) => a.unread).length,
    markAlertsRead,
    clearAlerts,
  };
}
