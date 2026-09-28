// Set EXPO_PUBLIC_API_BASE_URL in .env (see .env.example) when the tunnel
// changes, then restart Expo with `npx expo start -c` — the value is inlined
// at bundle time, so a plain reload won't pick it up.
export const BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://deacon-overcook-heftiness.ngrok-free.dev'
).replace(/\/+$/, '');

// WebSocket endpoint derived from BASE_URL (https→wss, http→ws). The mobile app
// subscribes here to learn about route/incident/dispatch changes the instant
// they happen, instead of waiting up to 10s for the next status poll.
export const WS_URL = `${BASE_URL.replace(/^http/, 'ws')}/ws`;

export const API_HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

// React Native's WebSocket accepts custom headers; ngrok's free tier gates
// browser-style requests behind an interstitial unless this header is present.
export const WS_HEADERS = { 'ngrok-skip-browser-warning': 'true' };

export function authHeaders(token) {
  return { ...API_HEADERS, Authorization: `Bearer ${token}` };
}

// Driver claims/releases manning (driving) the dispatched truck.
export async function setTruckManning(token, dispatchId, manning) {
  const res = await fetch(`${BASE_URL}/api/dispatch/${dispatchId}/truck-manning`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ manning }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? 'Failed to update truck status');
  }
  return res.json();
}

// Any crew member marks the team as arrived on scene. Moves the dispatch to
// 'on_scene' and records the arrival time used for response-time metrics.
export async function markArrived(token, dispatchId) {
  const res = await fetch(`${BASE_URL}/api/dispatch/${dispatchId}/arrived`, {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? 'Failed to mark arrival');
  }
  return res.json();
}

// Fleet list with live status and last position; TrucksScreen filters it to
// the responder's station.
export async function fetchTrucks(token) {
  const res = await fetch(`${BASE_URL}/api/trucks`, { headers: authHeaders(token) });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? 'Failed to load trucks');
  }
  return res.json();
}

// Revoke the token server-side so it can't be reused after sign-out.
// Best-effort: a failure here must never block the local sign-out.
export async function revokeToken(token) {
  try {
    await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: authHeaders(token),
    });
  } catch { /* offline — the token still expires on its own */ }
}

// Personnel mark the dispatch's incident as contained.
export async function markContained(token, dispatchId) {
  const res = await fetch(`${BASE_URL}/api/dispatch/${dispatchId}/contain`, {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? 'Failed to mark incident contained');
  }
  return res.json();
}

// Personnel file the after-action report for a contained incident. Submitting
// closes the incident (fire_status='closed') and completes the dispatch.
// `photos` is an array of picked assets ({ uri, fileName?, mimeType? }); the
// request is sent as multipart/form-data so the images ride along with the text.
export async function submitIncidentReport(token, dispatchId, report, photos = []) {
  const form = new FormData();
  form.append('narrative', report.narrative ?? '');
  if (report.cause)           form.append('cause', report.cause);
  if (report.casualties)      form.append('casualties', report.casualties);
  if (report.damage_estimate) form.append('damage_estimate', report.damage_estimate);
  if (report.recommendations) form.append('recommendations', report.recommendations);

  photos.forEach((photo, i) => {
    const type = photo.mimeType ?? 'image/jpeg';
    const ext  = type.split('/')[1] || 'jpg';
    form.append('photos', {
      uri:  photo.uri,
      name: photo.fileName ?? `photo_${i + 1}.${ext}`,
      type,
    });
  });

  // Don't set Content-Type — fetch adds the multipart boundary itself.
  const res = await fetch(`${BASE_URL}/api/dispatch/${dispatchId}/report`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': 'true',
    },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? 'Failed to submit incident report');
  }
  return res.json();
}
