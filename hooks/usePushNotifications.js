import { useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import {
  DEFAULT_PUSH_PREFS,
  PushUnavailableError,
  getExpoPushToken,
  readPushPrefs,
  registerPushToken,
  savePushPrefs,
  unregisterPushToken,
} from '../utils/notifications';
import { navigateHome } from '../utils/navigation';

/**
 * Keeps this phone registered for dispatch alerts while signed in.
 *
 * Re-registers on every sign-in / app start (the backend treats it as a
 * heartbeat and reassigns a shared phone to whoever signed in last), and
 * whenever the Settings toggles change. `pushState` is what Settings shows:
 *   { state: 'off' | 'registering' | 'on' | 'error', message? }
 *
 * An incoming alert also triggers `onAlert` (a status refresh), so the app is
 * already showing the new dispatch by the time the responder looks at it.
 */
export function usePushNotifications({ token, onAlert }) {
  const [prefs, setPrefsState] = useState(DEFAULT_PUSH_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [pushState, setPushState] = useState({ state: 'off' });
  const pushTokenRef = useRef(null);
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  useEffect(() => {
    readPushPrefs().then((p) => { setPrefsState(p); setPrefsLoaded(true); });
  }, []);

  useEffect(() => {
    if (!token || !prefsLoaded) return;
    let cancelled = false;

    (async () => {
      if (!prefs.enabled) {
        if (pushTokenRef.current) await unregisterPushToken(token, pushTokenRef.current);
        if (!cancelled) setPushState({ state: 'off' });
        return;
      }
      setPushState({ state: 'registering' });
      try {
        const pushToken = await getExpoPushToken();
        pushTokenRef.current = pushToken;
        await registerPushToken(token, pushToken, prefs);
        if (!cancelled) setPushState({ state: 'on' });
      } catch (err) {
        if (cancelled) return;
        setPushState({
          state: 'error',
          message: err instanceof PushUnavailableError
            ? err.message
            : `Could not register for alerts: ${err.message}`,
        });
      }
    })();

    return () => { cancelled = true; };
  }, [token, prefsLoaded, prefs]);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => {
      onAlertRef.current?.();
    });
    const tapped = Notifications.addNotificationResponseReceivedListener(() => {
      onAlertRef.current?.();
      navigateHome();
    });
    return () => { received.remove(); tapped.remove(); };
  }, []);

  const setPushPrefs = useCallback((patch) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      savePushPrefs(next);
      return next;
    });
  }, []);

  /** Call before revoking the session token, while it can still authenticate. */
  const unregisterForLogout = useCallback(async (authToken) => {
    if (pushTokenRef.current) await unregisterPushToken(authToken, pushTokenRef.current);
    setPushState({ state: 'off' });
  }, []);

  return { pushPrefs: prefs, setPushPrefs, pushState, unregisterForLogout };
}
