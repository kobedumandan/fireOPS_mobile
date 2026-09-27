import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { BASE_URL, authHeaders } from '../constants/api';

// Channel ids must match services/push.py on the backend.
export const CHANNEL_DISPATCH = 'dispatch';
export const CHANNEL_SILENT   = 'dispatch-silent';

const PREFS_KEY = 'bfp_push_prefs';
export const DEFAULT_PUSH_PREFS = { enabled: true, sound: true };

// Show alerts even while the app is open — a dispatch must never be swallowed
// just because the responder happened to be looking at the Route tab.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Why push isn't available, in words a responder can pass on to an admin. */
export class PushUnavailableError extends Error {}

export async function readPushPrefs() {
  try {
    const raw = await SecureStore.getItemAsync(PREFS_KEY);
    return { ...DEFAULT_PUSH_PREFS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_PUSH_PREFS;
  }
}

export async function savePushPrefs(prefs) {
  try { await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs)); }
  catch { /* non-fatal — falls back to defaults next launch */ }
}

// Android 8+ decides sound/importance per channel, and a channel's settings are
// frozen once created, so both variants exist up front and the backend picks one.
export async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_DISPATCH, {
    name: 'Dispatch alerts',
    description: 'New dispatches for your team, with sound.',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 600, 300, 600, 300, 600],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_SILENT, {
    name: 'Dispatch alerts (silent)',
    description: 'New dispatches for your team, vibrate only.',
    importance: Notifications.AndroidImportance.HIGH,
    sound: null,
    vibrationPattern: [0, 600, 300, 600],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/** Ask for permission and return this phone's Expo push token. */
export async function getExpoPushToken() {
  if (!Device.isDevice) {
    throw new PushUnavailableError('Push alerts need a physical phone, not an emulator.');
  }
  await ensureChannels();

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') {
    throw new PushUnavailableError('Notifications are blocked. Allow them in the phone settings.');
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    throw new PushUnavailableError('Push is not set up for this build yet (no EAS project id).');
  }
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    // Most often a missing google-services.json in the Android build.
    throw new PushUnavailableError(`Could not get a push token: ${err.message}`);
  }
}

export async function registerPushToken(authToken, pushToken, prefs) {
  const res = await fetch(`${BASE_URL}/api/mobile/push-token`, {
    method: 'PUT',
    headers: authHeaders(authToken),
    body: JSON.stringify({
      token: pushToken,
      platform: Platform.OS,
      sound_enabled: prefs.sound,
    }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? 'Could not register for alerts');
  }
}

// Best-effort: signing out or switching push off must still work offline.
export async function unregisterPushToken(authToken, pushToken) {
  try {
    await fetch(`${BASE_URL}/api/mobile/push-token/unregister`, {
      method: 'POST',
      headers: authHeaders(authToken),
      body: JSON.stringify({ token: pushToken }),
    });
  } catch { /* non-fatal */ }
}

export async function sendTestPush(authToken) {
  const res = await fetch(`${BASE_URL}/api/mobile/push-token/test`, {
    method: 'POST',
    headers: authHeaders(authToken),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.detail ?? 'Test alert failed');
  return body;
}
