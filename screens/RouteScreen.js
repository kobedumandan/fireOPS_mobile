import React, { useRef, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useDeviceLocation } from '../hooks/useDeviceLocation';
import { remainingAlongRoute, formatDistance } from '../utils/geo';
import { setTruckManning } from '../constants/api';
import ConfirmModal from '../components/ConfirmModal';
import Colors from '../constants/colors';

const PANABO = { lat: 7.3072, lng: 125.6836 };

// Force the dark cockpit style at all times; flip to false to enable the
// automatic day/night basemap swap below.
const FORCE_DARK = true;
const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const DAY_STYLE  = 'https://tiles.openfreemap.org/styles/liberty';

function pickStyleUrl() {
  if (FORCE_DARK) return DARK_STYLE;
  const h = new Date().getHours();
  return h >= 6 && h < 18 ? DAY_STYLE : DARK_STYLE;
}

// WKT LINESTRING -> array of [lng, lat] (GeoJSON/MapLibre order).
function parseWkt(wkt) {
  if (!wkt) return [];
  const match = wkt.match(/LINESTRING\s*\(([^)]+)\)/);
  if (!match) return [];
  return match[1].split(',').map(pair => {
    const [lon, lat] = pair.trim().split(' ').map(Number);
    return [lon, lat];
  });
}

function buildMapHtml({ center, fireLat, fireLng, fireAddress, routeCoords, styleUrl }) {
  const hasIncident = fireLat != null && fireLng != null;
  const routeJson   = JSON.stringify(routeCoords);
  const safeAddress = (fireAddress ?? 'Fire Incident').replace(/'/g, "\\'");

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #0a0c0f; }
    .maplibregl-ctrl-attrib, .maplibregl-ctrl-logo { display: none !important; }

    .user-puck { position: relative; width: 26px; height: 26px;
                 display: flex; align-items: center; justify-content: center; }
    .user-dot  { width: 16px; height: 16px; border-radius: 50%;
                 background: #3b82f6; border: 3px solid #fff;
                 box-shadow: 0 0 0 2px rgba(59,130,246,0.35), 0 0 12px rgba(59,130,246,0.9); }
    .user-cone { position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
                 width: 0; height: 0;
                 border-left: 8px solid transparent;
                 border-right: 8px solid transparent;
                 border-bottom: 13px solid #3b82f6; }

    .fire-puck { position: relative; width: 18px; height: 18px; border-radius: 50%;
                 background: #ff4d1a; border: 2px solid #ff7a4d;
                 box-shadow: 0 0 14px #ff4d1a; }
    .fire-puck::after { content: ''; position: absolute; top: 50%; left: 50%;
                 width: 18px; height: 18px; border-radius: 50%;
                 transform: translate(-50%, -50%);
                 background: rgba(255,77,26,0.5);
                 animation: pulse 1.8s ease-out infinite; }
    @keyframes pulse {
      0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.7; }
      100% { transform: translate(-50%,-50%) scale(3.2); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var INITIAL = { lng: ${center.lng}, lat: ${center.lat} };

    var map = new maplibregl.Map({
      container: 'map',
      style: '${styleUrl}',
      center: [INITIAL.lng, INITIAL.lat],
      zoom: 16, pitch: 55, bearing: 0,
      maxPitch: 75,
      attributionControl: false,
    });

    // ---- shared state -------------------------------------------------------
    var hasUserLocation = false;
    var followMode      = true;
    var userMarker      = null;
    // Animated route dashes look nice but re-tessellate the whole line ~14x/sec,
    // which is a real perf drain in the tilted 3D view. Off by default.
    var ANIMATE_FLOW    = false;

    // Camera easing state. 'current' is what is rendered; 'target' is where we
    // want to be. A single rAF loop eases current -> target every frame.
    var current = { lng: INITIAL.lng, lat: INITIAL.lat, bearing: 0, zoom: 16, pitch: 55 };
    var target  = { lng: INITIAL.lng, lat: INITIAL.lat, bearing: 0, zoom: 16, pitch: 55 };

    function post(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(msg);
    }

    function lerp(a, b, f) { return a + (b - a) * f; }
    function lerpAngle(a, b, f) {
      var d = ((b - a + 540) % 360) - 180; // shortest signed delta
      return a + d * f;
    }

    // Speed-adaptive camera (speed in m/s; -1/null when unknown).
    function speedZoom(s) {
      if (s == null || s < 0) return 16.5;
      var t = Math.max(0, Math.min(1, (s - 2) / 23)); // 2..25 m/s
      return 17.5 - t * 3.0;                           // 17.5 -> 14.5
    }
    function speedPitch(s) {
      if (s == null || s < 0) return 50;
      var t = Math.max(0, Math.min(1, (s - 2) / 23));
      return 45 + t * 17;                              // 45 -> 62
    }

    // Travel direction from displacement between two fixes. Far more reliable on
    // Android than coords.heading, which is frequently null/-1.
    var D2R = Math.PI / 180, R2D = 180 / Math.PI;
    function geoBearing(lng1, lat1, lng2, lat2) {
      var dLng = (lng2 - lng1) * D2R;
      var y = Math.sin(dLng) * Math.cos(lat2 * D2R);
      var x = Math.cos(lat1 * D2R) * Math.sin(lat2 * D2R) -
              Math.sin(lat1 * D2R) * Math.cos(lat2 * D2R) * Math.cos(dLng);
      return (Math.atan2(y, x) * R2D + 360) % 360;
    }
    function geoDist(lng1, lat1, lng2, lat2) {
      var dLat = (lat2 - lat1) * D2R, dLng = (lng2 - lng1) * D2R;
      var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * D2R) * Math.cos(lat2 * D2R) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ---- camera loop --------------------------------------------------------
    // Skip jumpTo when the eased camera hasn't moved enough to matter. Easing is
    // asymptotic, so without this the loop repaints the full 3D scene 60x/sec
    // forever (even at a red light) and the WebView can't keep up.
    var lastApplied = null;
    function cameraChanged() {
      if (!lastApplied) return true;
      return geoDist(lastApplied.lng, lastApplied.lat, current.lng, current.lat) > 0.3 ||
             Math.abs(((current.bearing - lastApplied.bearing + 540) % 360) - 180) > 0.1 ||
             Math.abs(current.zoom - lastApplied.zoom) > 0.005 ||
             Math.abs(current.pitch - lastApplied.pitch) > 0.03;
    }

    function frame() {
      var now = Date.now();
      var dt  = lastFrameMs ? (now - lastFrameMs) / 1000 : 0;
      lastFrameMs = now;

      // Dead reckoning: between GPS fixes, push the target forward along the
      // route at the last known speed so the puck keeps gliding instead of
      // freezing until the next fix. dt is capped so a stalled or backgrounded
      // loop can't teleport the puck on resume. Below ~0.5 m/s we treat it as
      // parked and hold position (avoids creep from noisy near-zero speeds).
      if (hasUserLocation && drSpeed > 0.5 && fullRoute.length > 1) {
        advanceTargetAlongRoute(drSpeed * Math.min(dt, 0.5));
      }

      current.lng     = lerp(current.lng, target.lng, 0.25);
      current.lat     = lerp(current.lat, target.lat, 0.25);
      current.zoom    = lerp(current.zoom, target.zoom, 0.08);
      current.pitch   = lerp(current.pitch, target.pitch, 0.08);
      current.bearing = lerpAngle(current.bearing, target.bearing, 0.2);

      if (userMarker) userMarker.setLngLat([current.lng, current.lat]);

      // Snap the eased position onto the route every frame so (a) the line trims
      // smoothly in lockstep with the gliding puck instead of in GPS-fix-sized
      // jumps, and (b) the camera heading follows the route's own direction,
      // which kills the spinning caused by noisy GPS-derived bearings. Blend
      // toward the next segment's bearing (weighted by how far along this segment
      // we are) so turns are eased into rather than snapped.
      if (hasUserLocation && fullRoute.length > 1) {
        var snap = snapToRoute(current.lng, current.lat);
        if (snap && snap.d <= 60) {
          applyTrim(snap);
          var bNext = routeBearings[Math.min(snap.i + 1, routeBearings.length - 1)];
          target.bearing = lerpAngle(routeBearings[snap.i], bNext, snap.t);
        }
      }

      // Only drive the camera once we have a real fix (before that, leave the
      // fitBounds overview untouched) and only when it actually changed.
      if (followMode && hasUserLocation && cameraChanged()) {
        map.jumpTo({
          center:  [current.lng, current.lat],
          bearing: current.bearing,
          zoom:    current.zoom,
          pitch:   current.pitch,
        });
        lastApplied = {
          lng: current.lng, lat: current.lat,
          bearing: current.bearing, zoom: current.zoom, pitch: current.pitch,
        };
      }
      requestAnimationFrame(frame);
    }

    // ---- layers / markers (added once the style is ready) -------------------
    map.on('load', function () {
      try {
        map.setSky({
          'sky-color': '#0a1020',
          'horizon-color': '#1a2440',
          'fog-color': '#0a0c0f',
          'sky-horizon-blend': 0.5,
          'horizon-fog-blend': 0.5,
          'fog-ground-blend': 0.5,
        });
      } catch (e) { /* setSky unsupported on this build; non-fatal */ }

      // 3D buildings from the OpenMapTiles vector source baked into the style.
      try {
        map.addLayer({
          id: 'fire-3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#1b1f27',
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
            'fill-extrusion-base':   ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.85,
          },
        });
      } catch (e) { /* style may name the source differently; non-fatal */ }

      // Route (casing under main line) + animated flow dashes.
      map.addSource('route', { type: 'geojson', data: lineFeature([]) });
      map.addLayer({
        id: 'route-casing', type: 'line', source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#1a0f0a', 'line-width': 9 },
      });
      map.addLayer({
        id: 'route-line', type: 'line', source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ff4d1a', 'line-width': 5 },
      });
      if (ANIMATE_FLOW) {
        map.addLayer({
          id: 'route-flow', type: 'line', source: 'route',
          layout: { 'line-cap': 'butt', 'line-join': 'round' },
          paint: { 'line-color': '#ffd0bf', 'line-width': 3, 'line-dasharray': [0, 4, 3] },
        });
      }

      // Reroute connector (dashed amber).
      map.addSource('connector', { type: 'geojson', data: lineFeature([]) });
      map.addLayer({
        id: 'connector-line', type: 'line', source: 'connector',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffb020', 'line-width': 4, 'line-dasharray': [2, 1.5] },
      });

      ${hasIncident ? `
      var fireEl = document.createElement('div');
      fireEl.className = 'fire-puck';
      new maplibregl.Marker({ element: fireEl })
        .setLngLat([${fireLng}, ${fireLat}])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML('<b>${safeAddress}</b>'))
        .addTo(map);
      ` : ''}

      // User puck marker.
      var puck = document.createElement('div');
      puck.className = 'user-puck';
      puck.innerHTML = '<div class="user-cone"></div><div class="user-dot"></div>';
      puck.style.display = hasUserLocation ? 'flex' : 'none';
      userMarker = new maplibregl.Marker({ element: puck })
        .setLngLat([current.lng, current.lat])
        .addTo(map);

      setRoute(${routeJson});
      if (ANIMATE_FLOW) animateFlow();
      requestAnimationFrame(frame);
    });

    // Leave follow mode when the user manually drives the camera. originalEvent
    // is present only for real gestures (pan/pinch/rotate/pitch) and absent for
    // our programmatic jumpTo, so the follow loop never trips this on itself.
    map.on('movestart', function (e) {
      if (e && e.originalEvent) exitFollow();
    });
    function exitFollow() {
      if (!followMode) return;
      followMode = false;
      post('userInteracted');
    }

    // ---- helpers callable from React via injectJavaScript --------------------
    function lineFeature(coords) {
      return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords || [] } };
    }

    var fullRoute     = []; // the complete assigned route, kept for progress trimming
    var routeBearings = []; // bearing (deg) of each route segment i -> i+1
    var lastBestI     = 0;  // forward-only snap pointer into fullRoute
    var lastTrimPoint = null; // last point setData() trimmed to (throttle guard)
    var drIndex       = 0;  // segment the dead-reckon cursor (target) sits on
    var drSpeed       = 0;  // m/s from the latest fix; drives between-fix motion
    var lastFrameMs   = 0;  // previous frame time, for the dead-reckon dt
    function setRoute(coords) {
      fullRoute = coords || [];
      // Precompute each segment's compass bearing once, so the per-frame camera
      // can lock onto the route's direction without recomputing trig every frame.
      routeBearings = [];
      for (var bi = 0; bi < fullRoute.length - 1; bi++) {
        routeBearings.push(
          geoBearing(fullRoute[bi][0], fullRoute[bi][1], fullRoute[bi + 1][0], fullRoute[bi + 1][1])
        );
      }
      lastBestI     = 0;
      lastTrimPoint = null;
      drIndex       = 0;
      drSpeed       = 0;
      var src = map.getSource('route');
      if (src) src.setData(lineFeature(fullRoute));
      if (fullRoute.length < 2) return;
      if (!hasUserLocation) {
        var b = new maplibregl.LngLatBounds(fullRoute[0], fullRoute[0]);
        fullRoute.forEach(function (c) { b.extend(c); });
        map.fitBounds(b, { padding: 60, pitch: 0, bearing: 0, duration: 0 });
      }
    }

    // Projects p ([lng,lat]) onto segment a->b in a local planar frame; returns
    // { t, point, d } with d in metres. Used to snap the user onto the route.
    function projectToSeg(p, a, b) {
      var lat0 = ((a[1] + b[1]) / 2) * D2R;
      function mx(lng) { return lng * D2R * Math.cos(lat0) * 6371000; }
      function my(lat) { return lat * D2R * 6371000; }
      var ax = mx(a[0]), ay = my(a[1]), bx = mx(b[0]), by = my(b[1]);
      var px = mx(p[0]), py = my(p[1]);
      var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      var t = L2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / L2;
      t = Math.max(0, Math.min(1, t));
      var point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      var ex = px - (ax + dx * t), ey = py - (ay + dy * t);
      return { t: t, point: point, d: Math.sqrt(ex * ex + ey * ey) };
    }

    // Finds the route segment closest to (lng,lat). Scans only a small window
    // around the last match — we only ever move forward along the route — so it
    // is cheap enough to run every animation frame. On a poor match (a GPS jump
    // or a fresh reroute) it falls back to a one-off full scan to relocate.
    function scanRange(lng, lat, a, b) { // a,b inclusive segment-start indices
      var best = { i: a, point: fullRoute[a], t: 0, d: Infinity };
      for (var i = a; i <= b; i++) {
        var pr = projectToSeg([lng, lat], fullRoute[i], fullRoute[i + 1]);
        if (pr.d < best.d) best = { i: i, point: pr.point, t: pr.t, d: pr.d };
      }
      return best;
    }
    function snapToRoute(lng, lat) {
      if (fullRoute.length < 2) return null;
      var lastSeg = fullRoute.length - 2;
      var best = scanRange(lng, lat, Math.max(0, lastBestI - 2), Math.min(lastSeg, lastBestI + 40));
      if (best.d > 60) {
        var full = scanRange(lng, lat, 0, lastSeg); // lost the line — relocate
        if (full.d < best.d) best = full;
      }
      lastBestI = best.i;
      return best;
    }

    // Redraws the route as only the part still ahead of the snapped point. The
    // setData() call re-tessellates the whole line, so it is guarded to fire only
    // once progress has actually advanced ~2 m rather than on every frame.
    function applyTrim(best) {
      if (lastTrimPoint &&
          geoDist(lastTrimPoint[0], lastTrimPoint[1], best.point[0], best.point[1]) < 2) return;
      var remaining = [best.point];
      for (var j = best.i + 1; j < fullRoute.length; j++) remaining.push(fullRoute[j]);
      var src = map.getSource('route');
      if (src) src.setData(lineFeature(remaining));
      lastTrimPoint = best.point;
    }

    // Walks the dead-reckon cursor (target) forward along the route by 'meters',
    // updating drIndex + target.lng/lat. Clamps at the destination so the puck
    // settles on the last vertex instead of running off the end.
    function advanceTargetAlongRoute(meters) {
      var i = drIndex, px = target.lng, py = target.lat, remaining = meters;
      while (i < fullRoute.length - 1) {
        var nx = fullRoute[i + 1][0], ny = fullRoute[i + 1][1];
        var segLeft = geoDist(px, py, nx, ny);
        if (segLeft === 0) { i++; continue; }
        if (segLeft >= remaining) {
          var f = remaining / segLeft;
          px += (nx - px) * f; py += (ny - py) * f;
          remaining = 0; break;
        }
        remaining -= segLeft; px = nx; py = ny; i++;
      }
      drIndex = i; target.lng = px; target.lat = py;
    }

    // Snaps a raw fix onto the route to re-anchor dead reckoning each cycle.
    // Mirrors snapToRoute but keys off drIndex and never touches lastBestI (the
    // render pointer), so correcting the target can't yank the trim ahead.
    function anchorSnap(lng, lat) {
      if (fullRoute.length < 2) return null;
      var lastSeg = fullRoute.length - 2;
      var best = scanRange(lng, lat, Math.max(0, drIndex - 2), Math.min(lastSeg, drIndex + 40));
      if (best.d > 60) {
        var full = scanRange(lng, lat, 0, lastSeg); // lost the line — relocate
        if (full.d < best.d) best = full;
      }
      return best;
    }

    function setConnector(coords) {
      var src = map.getSource('connector');
      if (src) src.setData(lineFeature(coords));
    }

    // coords already [lng, lat]. heading deg (0=N, cw) or null. speed m/s or null.
    var lastFix      = null; // previous { lng, lat } used to derive travel direction
    var lastSpeedFix = null; // previous { lng, lat, ms } used to estimate ground speed
    function setUserLocation(lat, lng, heading, speed) {
      target.zoom  = speedZoom(speed);
      target.pitch = speedPitch(speed);

      // Estimate ground speed for dead reckoning. Prefer the GPS Doppler speed
      // when it's positive; otherwise fall back to distance/time between fixes,
      // since Android often reports speed as 0/-1/null at walking pace even while
      // moving. Smoothed (EMA) and clamped so one noisy fix can't launch the puck.
      var nowMs = Date.now();
      var measured = 0;
      if (lastSpeedFix) {
        var dtSec = (nowMs - lastSpeedFix.ms) / 1000;
        if (dtSec > 0.2) measured = geoDist(lastSpeedFix.lng, lastSpeedFix.lat, lng, lat) / dtSec;
      }
      lastSpeedFix = { lng: lng, lat: lat, ms: nowMs };
      var fixSpeed = (speed != null && speed > 0) ? speed : measured;
      drSpeed = Math.max(0, Math.min(35, drSpeed * 0.4 + fixSpeed * 0.6));

      // Anchor the target to the route and arm dead reckoning. Snapping the fix
      // onto the line (when within 60 m) keeps the puck riding the route and
      // gives a clean cursor to advance from between fixes; off route we drop
      // dead reckoning and head straight to the real position.
      var anchor = anchorSnap(lng, lat);
      if (anchor && anchor.d <= 60) {
        target.lng = anchor.point[0];
        target.lat = anchor.point[1];
        drIndex    = anchor.i;
      } else {
        target.lng = lng;
        target.lat = lat;
        drSpeed    = 0;
      }

      // Off-route fallback heading, from displacement between fixes. While on the
      // route this is overridden every frame by the route-tangent heading in
      // frame(); it only takes effect when the user has strayed off the line
      // (snap.d > 60 m). Hold an anchor fix and advance it only once travel
      // exceeds ~3 m, so parked GPS jitter doesn't spin the map.
      if (lastFix) {
        var moved = geoDist(lastFix.lng, lastFix.lat, lng, lat);
        if (moved > 3) {
          target.bearing = geoBearing(lastFix.lng, lastFix.lat, lng, lat);
          lastFix = { lng: lng, lat: lat };
        }
      } else {
        lastFix = { lng: lng, lat: lat };
        if (heading != null && heading >= 0) target.bearing = heading; // initial hint
      }

      if (!hasUserLocation) {
        // Snap immediately on the first fix so we don't ease in from Panabo.
        current.lng = target.lng; current.lat = target.lat;
        current.zoom = target.zoom; current.pitch = target.pitch;
        hasUserLocation = true;
        if (userMarker) userMarker.getElement().style.display = 'flex';
      }
    }

    function recenter() {
      // Resync 'current' to wherever the user left the camera so the loop eases
      // smoothly back to the puck instead of hard-cutting.
      var c = map.getCenter();
      current.lng = c.lng; current.lat = c.lat;
      current.bearing = map.getBearing();
      current.zoom = map.getZoom();
      current.pitch = map.getPitch();
      followMode = true;
    }

    // Drop follow mode and frame the entire route (plus the incident and the
    // user) flat and north-up, so the whole path is visible at once.
    function showRouteOverview() {
      if (fullRoute.length < 2) return;
      followMode = false;
      var b = new maplibregl.LngLatBounds(fullRoute[0], fullRoute[0]);
      fullRoute.forEach(function (c) { b.extend(c); });
      ${hasIncident ? `b.extend([${fireLng}, ${fireLat}]);` : ''}
      if (hasUserLocation) b.extend([target.lng, target.lat]);
      map.fitBounds(b, { padding: 70, bearing: 0, pitch: 0, duration: 700 });
      post('userInteracted');
    }

    // Animated "flow" dashes marching toward the destination.
    var dashStep = 0;
    var dashSeq = [
      [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
      [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5],
    ];
    function animateFlow() {
      if (map.getLayer('route-flow')) {
        dashStep = (dashStep + 1) % dashSeq.length;
        map.setPaintProperty('route-flow', 'line-dasharray', dashSeq[dashStep]);
      }
      setTimeout(animateFlow, 70); // ~14 fps, easy on the battery
    }
  </script>
</body>
</html>`;
}

export default function RouteScreen() {
  const webViewRef = useRef(null);
  const { status, deviationState, token, refreshStatus } = useAuth();
  const location = useDeviceLocation();
  const [following, setFollowing] = useState(true);
  const [manningBusy, setManningBusy] = useState(false);
  const [manningConfirm, setManningConfirm] = useState(false);

  const dispatch    = status?.dispatch ?? null;
  const incident    = dispatch?.incident ?? null;
  const isDriver    = dispatch?.is_driver ?? false;
  const truck       = dispatch?.truck ?? null;
  const isManning   = truck?.is_manning ?? false;
  const fireLat     = incident?.fire_latitude  ?? null;
  const fireLng     = incident?.fire_longitude ?? null;
  const fireAddress = incident?.fire_address   ?? null;

  // Once the incident is closed, the dispatch (and its route_wkt) may linger in
  // status for a beat before the backend tears it down. Drop the route locally
  // the moment the fire reads "closed" so every route line clears from the map.
  const isClosed = incident?.fire_status === 'closed';

  const routeCoords = useMemo(
    () => (isClosed ? [] : parseWkt(dispatch?.route_wkt)),
    [dispatch?.route_wkt, isClosed],
  );

  const center = (fireLat != null && fireLng != null)
    ? { lat: fireLat, lng: fireLng }
    : PANABO;

  const styleUrl = useMemo(() => pickStyleUrl(), []);

  const html = useMemo(
    () => buildMapHtml({ center, fireLat, fireLng, fireAddress, routeCoords, styleUrl }),
    // Rebuild (and thus remount the WebView) only when the incident or basemap
    // changes. The route is intentionally NOT a dependency: manning/unmanning
    // swaps route_wkt, and remounting here would cold-start the whole map
    // (CDN + tiles) and drop the pin. Route changes are pushed into the live
    // map via injectJavaScript(setRoute) below instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fireLat, fireLng, fireAddress, styleUrl],
  );

  // Push connector updates into the live WebView without re-mounting it.
  useEffect(() => {
    if (!webViewRef.current) return;
    // Clear the reroute connector too once the incident is closed — there is no
    // active route left to deviate from.
    if (!isClosed && deviationState?.isDeviated && deviationState.connectorGeoJSON?.coordinates) {
      // GeoJSON coordinates are already [lng, lat] — MapLibre uses the same order.
      const coords = deviationState.connectorGeoJSON.coordinates;
      webViewRef.current.injectJavaScript(`setConnector(${JSON.stringify(coords)}); true;`);
    } else {
      webViewRef.current.injectJavaScript(`setConnector([]); true;`);
    }
  }, [deviationState, isClosed]);

  // Push route updates into the already-loaded map without remounting the
  // WebView. Manning/unmanning swaps route_wkt; injecting redraws the line
  // instantly and keeps the pin/camera intact. setRoute() no-ops if the map
  // source isn't ready yet, so the early call before the first map 'load' (when
  // the WebView remounts on an incident change) is harmless — the route baked
  // into the fresh HTML draws on load.
  useEffect(() => {
    webViewRef.current?.injectJavaScript(
      `setRoute(${JSON.stringify(routeCoords)}); true;`
    );
  }, [routeCoords]);

  // Follow the device: recenter on the user pin and rotate the map heading-up.
  useEffect(() => {
    if (!webViewRef.current || !location) return;
    const { latitude, longitude, heading, speed } = location;
    const h = heading == null || heading < 0 ? 'null' : heading;
    const s = speed == null ? 'null' : speed;
    webViewRef.current.injectJavaScript(
      `setUserLocation(${latitude}, ${longitude}, ${h}, ${s}); true;`
    );
  }, [location]);

  const handleMessage = (event) => {
    if (event.nativeEvent.data === 'userInteracted') setFollowing(false);
  };

  const handleRecenter = () => {
    webViewRef.current?.injectJavaScript('recenter(); true;');
    setFollowing(true);
  };

  const handleOverview = () => {
    webViewRef.current?.injectJavaScript('showRouteOverview(); true;');
    setFollowing(false);
  };

  const handleToggleManning = () => {
    if (!token || !dispatch?.dispatch_id || manningBusy) return;
    setManningConfirm(true);
  };

  const confirmToggleManning = async () => {
    if (!token || !dispatch?.dispatch_id) return;
    const next = !isManning;
    setManningBusy(true);
    try {
      await setTruckManning(token, dispatch.dispatch_id, next);
      await refreshStatus();
      setManningConfirm(false);
    } catch (err) {
      setManningConfirm(false);
      Alert.alert('Truck Status', err.message ?? 'Could not update truck status.');
    } finally {
      setManningBusy(false);
    }
  };

  const hasRoute = routeCoords.length >= 2;

  const isDeviated = deviationState?.isDeviated ?? false;

  // HUD readouts derived from the live fix.
  const speedKmh = location?.speed != null && location.speed > 0
    ? Math.round(location.speed * 3.6)
    : 0;
  const userLngLat = location ? [location.longitude, location.latitude] : null;
  const remaining = useMemo(
    () => remainingAlongRoute(routeCoords, userLngLat),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routeCoords, userLngLat?.[0], userLngLat?.[1]],
  );

  return (
    <View style={styles.root}>
      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        startInLoadingState={false}
      />

      {/* Nav HUD */}
      <View style={styles.hud} pointerEvents="none">
        <View style={styles.hudLeft}>
          <View style={styles.speedBox}>
            <Text style={styles.speedValue}>{speedKmh}</Text>
            <Text style={styles.speedUnit}>km/h</Text>
          </View>
          {isDeviated && (
            <View style={styles.deviationPill}>
              <Ionicons name="warning" size={16} color={Colors.accentAmber ?? '#ffb020'} />
              <View style={styles.bannerText}>
                {/* <Text style={styles.bannerTitle}>Route</Text> */}
                <Text style={styles.bannerSub}>Follow the amber path to the incident site.</Text>
              </View>
            </View>
          )}
        </View>
        {remaining != null && (
          <View style={styles.distBox}>
            <Ionicons name="flag" size={14} color="#ff7a4d" />
            <Text style={styles.distValue}>{formatDistance(remaining)}</Text>
          </View>
        )}
      </View>

      {/* Driver-only: claim/release manning the assigned truck so its live
          position follows this device's GPS. */}
      {isDriver && truck && (
        <TouchableOpacity
          style={[styles.manningPill, isManning ? styles.manningOn : styles.manningOff]}
          onPress={handleToggleManning}
          activeOpacity={0.85}
          disabled={manningBusy}
        >
          <Ionicons
            name={isManning ? 'car-sport' : 'car-sport-outline'}
            size={18}
            color={isManning ? Colors.accentGreen : Colors.textSecondary}
          />
          <View style={styles.manningText}>
            <Text
              style={[
                styles.manningLabel,
                { color: isManning ? Colors.accentGreen : Colors.textPrimary },
              ]}
            >
              {isManning ? 'Manning Truck' : 'Mark as Driving'}
            </Text>
            <Text style={styles.manningSub}>
              {truck.truck_platenum
                ? `${truck.truck_platenum}${isManning ? '  |  Tracking you' : '  |  Tap when aboard'}`
                : (isManning ? 'Tracking you' : 'Tap when aboard')}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* One slot, two modes: while following it frames the whole route; once
          you've panned/zoomed/overviewed it snaps back to follow the puck. */}
      {(hasRoute || !following) && (
        <TouchableOpacity
          style={[styles.fab, following ? styles.fabOverview : styles.fabRecenter]}
          onPress={following ? handleOverview : handleRecenter}
          activeOpacity={0.85}
        >
          <Ionicons name={following ? 'scan-outline' : 'locate'} size={22} color="#fff" />
        </TouchableOpacity>
      )}

      <ConfirmModal
        visible={manningConfirm}
        icon={isManning ? 'car-sport-outline' : 'car-sport'}
        title={isManning ? 'Release Truck?' : 'Man This Truck?'}
        message={
          isManning
            ? `Stop manning ${truck?.truck_platenum ?? 'this truck'}. The truck will stop following your location and the route will reset to the default station route.`
            : `Confirm you are aboard ${truck?.truck_platenum ?? 'this truck'}. The truck's live position will follow your device while you man it.`
        }
        confirmLabel={isManning ? 'Release' : 'Man Truck'}
        tone={isManning ? 'warning' : 'primary'}
        busy={manningBusy}
        onConfirm={confirmToggleManning}
        onCancel={() => setManningConfirm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgBase },
  map:  { flex: 1 },
  deviationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(10,12,15,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,176,32,0.25)',
    flexShrink: 1,
  },
  bannerText: { flexShrink: 1 },
  bannerTitle: {
    fontFamily: 'AxiformaBold',
    fontSize: 14,
    color: '#ffb020',
    letterSpacing: -1,
    // textTransform: 'uppercase',
  },
  bannerSub: {
    fontFamily: 'AxiformaBold',
    fontSize: 9.8,
    color: '#c8a040',
    marginTop: 1,
  },

  hud: {
    width: '100%',
    position: 'absolute',
    // left: 14,
    top: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    // borderWidth: 1,
    // borderColor: 'red',
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  speedBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 66,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(10,12,15,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  speedValue: {
    fontFamily: 'AxiformaBold',
    fontSize: 31,
    color: '#fff',
    lineHeight: 32,
  },
  speedUnit: {
    fontFamily: 'AxiformaBold',
    fontSize: 9,
    color: '#9aa3ad',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  distBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(10,12,15,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  distValue: {
    fontFamily: 'AxiformaBold',
    fontSize: 11,
    color: '#fff',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 104,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  fabRecenter: { backgroundColor: '#3b82f6' },
  fabOverview: {
    backgroundColor: 'rgba(10,12,15,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  manningPill: {
    position: 'absolute',
    left: 16,
    bottom: 104,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 14,
    maxWidth: '62%',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  manningOn: {
    backgroundColor: 'rgba(10,12,15,0.9)',
    borderWidth: 1,
    borderColor: Colors.accentGreen,
  },
  manningOff: {
    backgroundColor: 'rgba(10,12,15,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  manningText: { flexShrink: 1 },
  manningLabel: {
    fontFamily: 'AxiformaBold',
    fontSize: 12,
    letterSpacing: -0.4,
  },
  manningSub: {
    fontFamily: 'AxiformaBold',
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
