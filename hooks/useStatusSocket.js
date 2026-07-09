import { useEffect, useRef } from 'react';
import { WS_URL, WS_HEADERS } from '../constants/api';

// Broadcast message types that change THIS user's dispatch / incident / route
// and therefore warrant an immediate /api/mobile/me/status refresh. The
// high-frequency types (personnel_location, reporter_location) and the
// dashboard-only ones (obstruction_*, constraint_*) are intentionally excluded
// so a busy incident doesn't trigger a refresh storm on every responder's phone.
const REFRESH_TYPES = new Set([
  'route_updated',      // dispatcher picked / recomputed the route
  'dispatch_rerouted',  // driver deviated and the whole route was rebuilt
  'incident_updated',   // status change, containment, new dispatch, etc.
  'incident_created',
]);

const PING_MS      = 30_000; // keep-alive; backend replies "pong"
const RECONNECT_MS = 3_000;  // backoff before reconnecting after a drop
const DEBOUNCE_MS  = 300;    // coalesce a burst of messages into one refresh

/**
 * Persistent WebSocket to the backend's /ws channel. On any message that
 * affects the logged-in user's dispatch, it calls onRefresh() — which should
 * re-fetch /api/mobile/me/status — so route/incident changes appear instantly
 * instead of waiting for the 10s poll. The poll remains as a safety net.
 *
 * Connects whenever `token` is set and tears down on logout / unmount, with
 * automatic reconnect on unexpected close.
 */
export function useStatusSocket({ token, onRefresh }) {
  // Hold the latest callback in a ref so reconnect logic never closes over a
  // stale onRefresh and we don't reconnect just because the callback changed.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    if (!token) return;

    let ws          = null;
    let pingId      = null;
    let reconnectId = null;
    let debounceId  = null;
    let destroyed   = false;

    const scheduleRefresh = () => {
      clearTimeout(debounceId);
      debounceId = setTimeout(() => onRefreshRef.current?.(), DEBOUNCE_MS);
    };

    function connect() {
      if (destroyed) return;
      ws = new WebSocket(`${WS_URL}?token=${token}`, undefined, { headers: WS_HEADERS });

      ws.onopen = () => {
        pingId = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) ws.send('ping');
        }, PING_MS);
      };

      ws.onmessage = (e) => {
        if (e.data === 'pong') return;
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg && REFRESH_TYPES.has(msg.type)) scheduleRefresh();
      };

      // Swallow errors; onclose drives the reconnect.
      ws.onerror = () => {};

      ws.onclose = () => {
        clearInterval(pingId);
        pingId = null;
        if (!destroyed) reconnectId = setTimeout(connect, RECONNECT_MS);
      };
    }

    connect();

    return () => {
      destroyed = true;
      clearInterval(pingId);
      clearTimeout(reconnectId);
      clearTimeout(debounceId);
      ws?.close();
    };
  }, [token]);
}
