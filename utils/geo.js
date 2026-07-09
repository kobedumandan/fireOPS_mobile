// Lightweight geo helpers for the navigation HUD. All coordinates are [lng, lat]
// (GeoJSON / MapLibre order) to match the route geometry used by RouteScreen.

const R = 6371000; // earth radius, metres
const toRad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in metres between two [lng, lat] points. */
export function haversine(a, b) {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Projects `p` onto the segment a→b (all [lng, lat]) and returns
 * { point, t, dist } where `t` is the clamped [0,1] position along the segment,
 * `point` is the projected [lng, lat], and `dist` is metres from `p` to `point`.
 *
 * Uses a local equirectangular approximation (fine at street scale) so the
 * projection math can run in plain Cartesian space.
 */
function projectToSegment(p, a, b) {
  const lat0 = toRad((a[1] + b[1]) / 2);
  const x = (lng) => toRad(lng) * Math.cos(lat0) * R;
  const y = (lat) => toRad(lat) * R;

  const ax = x(a[0]), ay = y(a[1]);
  const bx = x(b[0]), by = y(b[1]);
  const px = x(p[0]), py = y(p[1]);

  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));

  const point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { point, t, dist: haversine(p, point) };
}

/**
 * Distance in metres from the user to the end of the route, measured *along*
 * the route. Snaps the user to the nearest point on the polyline, then sums the
 * remaining segment lengths from that point onward.
 *
 * @param routeCoords array of [lng, lat] vertices
 * @param userLngLat  [lng, lat]
 * @returns metres remaining, or null when the route is empty/degenerate
 */
export function remainingAlongRoute(routeCoords, userLngLat) {
  if (!routeCoords || routeCoords.length < 2 || !userLngLat) return null;

  // Find the segment whose projection is closest to the user.
  let best = { i: 0, t: 0, point: routeCoords[0], dist: Infinity };
  for (let i = 0; i < routeCoords.length - 1; i++) {
    const proj = projectToSegment(userLngLat, routeCoords[i], routeCoords[i + 1]);
    if (proj.dist < best.dist) best = { i, ...proj };
  }

  // Remaining = leftover of the current segment + every segment after it.
  let remaining = haversine(best.point, routeCoords[best.i + 1]);
  for (let i = best.i + 1; i < routeCoords.length - 1; i++) {
    remaining += haversine(routeCoords[i], routeCoords[i + 1]);
  }
  return remaining;
}

/** Formats metres as "650 m" or "2.3 km" for the HUD. */
export function formatDistance(m) {
  if (m == null) return '--';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
