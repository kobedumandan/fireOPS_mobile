## FireOPS Mobile App

This is the Mobile app, or the Personnel Module of FireOPS. Personnel can use the app to:
- Be immediately notified about dispatches from Fire Station Command.
- Be informed about current Dispatch and Fire Incident information, in Real-time.
- Get information about the most efficient route to be taken to the Fire Incident.
- Create Incident Reports after incidents are controlled & contained, allowing faster report generation by personnel on the field.

<br>

<p align="center">
  <b>Tech Stack used:</b>
</p>
<p align="center">
  <a href="https://skillicons.dev"><img src="https://skillicons.dev/icons?i=javascript,react&perline=5" alt="Stack" /></a>
</p>

## Setup

### Backend URL
Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` to the backend
(usually the ngrok tunnel). Restart with `npx expo start -c` after changing it.

### Dispatch push alerts (one-time)
Push alerts are what reach a responder whose phone is asleep. Until these steps
are done, Settings → Push Notifications shows why it isn't active, and the
backend texts dispatched members over PhilSMS instead (when `SEND_SMS=true`).

1. **Expo project** — `npm i -g eas-cli`, `eas login`, then `eas init` in this
   folder. This writes `extra.eas.projectId` into `app.json`.
2. **Firebase** — create a Firebase project, add an Android app with package
   `com.bfp.firegis`, download `google-services.json` into this folder.
   `app.config.js` picks it up automatically.
3. **FCM key for Expo** — in Firebase → Project settings → Service accounts,
   generate a private key, then `eas credentials` → Android →
   Google Service Account → *FCM V1* and upload that JSON.
4. **Rebuild** — `npx expo prebuild --platform android --no-install`, then
   `npx expo run:android` (native changes don't arrive through a JS reload).
5. On the phone: Settings → **Send Test Alert**.

### Background location
Tracking during a dispatch runs as an Android foreground service (the
"Dispatch in progress" notification), so it continues with the screen off.
It needs location set to **Allow all the time**; the app asks when a dispatch
starts. If refused, tracking falls back to foreground-only. Some phones
(Xiaomi, Oppo, Vivo, Samsung) also need battery optimisation turned off for
FireGIS, or they kill the service anyway.
