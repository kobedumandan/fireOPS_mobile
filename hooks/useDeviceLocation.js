import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

/**
 * Streams the device's live position for map UI (centering + heading-up rotation).
 *
 * Unlike useLocationTracking (which polls every 10–30s purely to report to the
 * backend), this uses a continuous watchPositionAsync subscription so the map can
 * follow the user smoothly. It runs only while the consuming screen is mounted.
 *
 * Returns the latest { latitude, longitude, heading, speed } or null until the
 * first fix. `heading` is the GPS course over ground in degrees (0 = north,
 * clockwise), or null/-1 when stationary or unavailable.
 */
export function useDeviceLocation(enabled = true) {
  const [location, setLocation] = useState(null);
  const subRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      subRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 500,    // at most ~2 updates/sec
          distanceInterval: 1,  // or every 1 metre moved
        },
        (loc) => {
          if (cancelled) return;
          setLocation({
            latitude:  loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading:   loc.coords.heading,
            speed:     loc.coords.speed,
          });
        },
      );

      if (cancelled) {
        subRef.current?.remove();
        subRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [enabled]);

  return location;
}
