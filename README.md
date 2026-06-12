# ERIS-SOSMap

> Mobile Emergency Mapping and SOS Communication Application — part of the ERIS (Emergency Response & Intelligence System) project.

---

## ERIS Project Overview

ERIS is a multi-group student applied engineering project addressing emergency communication in degraded or zero-connectivity environments. It is composed of three independent components designed to interoperate:

| Component | Description |
|---|---|
| **ERIS-SOSMap** *(this repository)* | Mobile and web application for offline mapping, SOS alerting, and emergency situational awareness |
| **ERIS-RescueAI** | Backend platform for ingesting, filtering, scoring, and prioritising SOS alerts using machine learning; exposes REST APIs consumed by this application |
| **ERIS-Box** | Physical hardware device (LoRa, GPS, FM radio, SOS button, multi-source power) enabling communication when mobile infrastructure is unavailable |

ERIS-SOSMap is the citizen-facing interface. It communicates with ERIS-RescueAI over standard REST/Supabase APIs, and is designed to remain functional when neither the backend nor the ERIS-Box network is reachable.

---

## About This Application

ERIS-SOSMap is a cross-platform application built with Capacitor and React. It targets Android and iOS as primary deployment platforms, with a Progressive Web App fallback.

The application is built around a single constraint: **it must remain operational when network infrastructure fails**. All critical data is persisted locally before any synchronisation attempt. SOS dispatch follows a redundancy chain (internet → mesh network → SMS). The risk detection engine runs entirely on-device with no backend dependency.

The repository contains two deliverables:

- **Capacitor Plugin** (`src/`, root) — TypeScript plugin wrapping native iOS and Android code for mesh networking and emergency hardware access, distributed as an npm package.
- **React Application** (`app/`) — Vite + React 19 frontend consuming the plugin and connecting to the Supabase backend.

---

## Features

- Offline-capable interactive map with downloadable tile regions
- SOS alert dispatch with GPS coordinates, altitude, battery level, and user notes
- Offline SOS queue with automatic retry on network restoration
- SMS fallback when both internet and mesh network are unavailable
- Emergency contact notification via SMS on confirmed alert
- AI-powered fall detection using accelerometer and gyroscope data
- Vehicle crash detection based on GPS speed and impact thresholds
- Prolonged inactivity detection
- Shake-to-SOS gesture trigger
- Discrete (silent) SOS via tap or flip gestures
- Emergency audio recording on fall/crash detection (GDPR opt-in)
- User-reported hazard overlay (fire, flood, road blockage, landslide)
- Turn-by-turn directions to a selected destination via Google Maps
- Points of Interest from OpenStreetMap (hospitals, pharmacies, shelters, AEDs, etc.)
- Real-time weather data and community weather reports
- Distress beacon via device flashlight (SOS strobe pattern)
- User profile with medical information and emergency contacts
- Offline map region management (preset zones and custom bounding boxes)
- Administrator dashboard with live SOS monitoring and user management
- Multi-language interface (English, French, Vietnamese, Chinese, Malagasy)
- High-contrast map theme for accessibility

---

## Tech Stack

### Application (`app/`)

| Category | Technology |
|---|---|
| Framework | React 19, TypeScript 6 (strict) |
| Build | Vite 8 |
| Styling | Tailwind CSS 3 |
| Maps | Leaflet 1.9, react-leaflet 5, leaflet.offline 3 |
| Local persistence | Dexie 4 (IndexedDB) |
| Backend client | Supabase JS 2 |
| Internationalisation | i18next 26, react-i18next 17 |
| Testing | Vitest 4, @testing-library/react 16 |
| Native bridge | Capacitor 8 |

### Capacitor Plugins

`@capacitor/geolocation` — `@capacitor/motion` — `@capacitor/device` — `@capacitor/network` — `@capgo/capacitor-flash`

### Backend

| Component | Technology |
|---|---|
| Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| File storage | Supabase Storage |
| Serverless functions | Deno (Edge Functions) |
| SMS delivery | Twilio |

---

## Architecture

```
capacitor-eris-sosmap/
│
├── src/                          # Capacitor plugin
│   ├── definitions.ts            # Public plugin API
│   ├── index.ts                  # Plugin entry point
│   └── web.ts                    # Web fallback
├── android/                      # Android native code (Java/Kotlin)
├── ios/                          # iOS native code (Swift)
│
├── app/
│   └── src/
│       ├── features/             # Vertical feature slices
│       │   ├── auth/             # Authentication
│       │   ├── map/              # Map, hazards, weather, POIs
│       │   ├── sos/              # SOS trigger, history, detection hooks
│       │   ├── offline/          # Tile download and cache management
│       │   ├── profile/          # User profile, medical data, contacts
│       │   ├── settings/         # Configuration, diagnostics, privacy
│       │   ├── admin/            # Administrator dashboard
│       │   ├── audio/            # Emergency audio recording
│       │   └── risk/             # On-device risk detection engine
│       │
│       ├── services/
│       │   ├── sosService.ts     # SOS dispatch, offline queue, retry logic
│       │   └── hazardService.ts  # Hazard CRUD with offline sync
│       │
│       ├── db/
│       │   ├── localDb.ts        # Dexie schema (IndexedDB, v6)
│       │   └── supabaseClient.ts
│       │
│       ├── components/           # Shared UI components
│       ├── utils/                # Map utilities, preset regions
│       └── locales/              # Translation files
│
├── supabase/
│   ├── functions/
│   │   └── notify-contacts/      # Edge Function — SMS on SOS dispatch
│   └── migrations/                # SQL migrations (RLS policies, admin RPCs)
│
└── docker-compose.yml
```

Each feature under `app/src/features/` is self-contained and owns its components, hooks, types, and tests. There is no global state manager — state flows through React hooks, Dexie for local persistence, and Supabase Realtime for live data. All native hardware access is routed through the Capacitor plugin.

### Local Database Schema (Dexie, v6)

| Table | Contents |
|---|---|
| `sosQueue` | Pending SOS alerts awaiting sync |
| `userProfile` | Local copy of the user's profile and medical data |
| `emergencyContacts` | Registered emergency contacts |
| `hazards` | Locally reported hazards pending upload |
| `riskEvents` | Audit log of on-device detected risk events |
| `pendingAudioUploads` | Audio recordings queued for Supabase Storage |

### Supabase Migrations (`supabase/migrations/`)

Row Level Security policies and admin-only RPCs for `sos_alerts`, `hazards`, and `user_profiles` are versioned as SQL migrations and must be applied to any Supabase project backing this app (`supabase db push` or via the Supabase SQL editor). Notably:

- `update_sos_alert_status(alert_id, new_status)` — `SECURITY DEFINER` RPC used by the admin dashboard to update an alert's status after a server-side admin check.
- RLS policies restrict `sos_alerts` reads/updates to the alert owner and admins (anonymous inserts remain allowed for guest SOS).

### SOS Dispatch Chain

```
User triggers SOS
      │
      ├── Internet available?  →  POST to Supabase → notify-contacts Edge Function → Twilio SMS
      │
      ├── Mesh network available?  →  plugin.triggerEmergency() (native P2P relay)
      │
      └── Fully offline?  →  Write to Dexie queue + open native SMS client
                                    └── Network restored → flushRetryQueue()
```

---

## Prerequisites

- Node.js 18+, npm 9+
- Docker and Docker Compose
- Supabase CLI
- A configured Supabase project
- For iOS: macOS, Xcode 15+
- For Android: Android Studio, JDK 17+

---

## Setup

### 1. Configure environment variables

```bash
cp app/.env.example app/.env
```

```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 2. Start the application

```bash
docker compose up
```

Docker handles everything: installing root and app dependencies, building the Capacitor plugin, and starting the Vite dev server with hot reload. The application is available at `http://localhost:5173`.

> **Without Docker** — if you need to run outside of Docker, you must first build the plugin manually then start the dev server:
> ```bash
> npm install && npm run build        # install and build the plugin
> cd app && npm install && npm run dev # install app deps and start Vite
> ```

### 3. Local Supabase stack

```bash
supabase start
supabase functions serve notify-contacts
```

---

## Configuration

### Edge Function environment variables

| Variable | Purpose |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | Twilio authentication token |
| `TWILIO_PHONE_NUMBER` | SMS sender number |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged key for backend reads |

---

## Running Tests

```bash
cd app

npm run test              # Single run
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report (text + lcov)
```

---

## Building

### Plugin

```bash
# From root — runs docgen → tsc → rollup
npm run build
```

### Application

```bash
cd app && npm run build
```

### Full platform verification

```bash
npm run verify   # iOS + Android + web builds
```

---

## Mobile Deployment

```bash
cd app
npx cap sync

npx cap open ios      # Opens Xcode
npx cap open android  # Opens Android Studio
```

Application ID: `com.dniit.erissosmap`

---

## Plugin API

<docgen-index>

* [`echo(...)`](#echo)
* [`triggerEmergency(...)`](#triggeremergency)
* [`startMeshNetwork()`](#startmeshnetwork)
* [`stopMeshNetwork()`](#stopmeshnetwork)
* [`broadcastMeshMessage(...)`](#broadcastmeshmessage)
* [`addListener('onMeshMessageReceived', ...)`](#addlisteneronmeshmessagereceived-)
* [Interfaces](#interfaces)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### echo(...)

```typescript
echo(options: { value: string; }) => Promise<{ value: string; }>
```

| Param         | Type                            |
| ------------- | ------------------------------- |
| **`options`** | <code>{ value: string; }</code> |

**Returns:** <code>Promise&lt;{ value: string; }&gt;</code>

--------------------


### triggerEmergency(...)

```typescript
triggerEmergency(options: { latitude: number; longitude: number; userId: string; }) => Promise<{ success: boolean; transmissionMethod: string; }>
```

| Param         | Type                                                                  |
| ------------- | --------------------------------------------------------------------- |
| **`options`** | <code>{ latitude: number; longitude: number; userId: string; }</code> |

**Returns:** <code>Promise&lt;{ success: boolean; transmissionMethod: string; }&gt;</code>

--------------------


### startMeshNetwork()

```typescript
startMeshNetwork() => Promise<void>
```

--------------------


### stopMeshNetwork()

```typescript
stopMeshNetwork() => Promise<void>
```

--------------------


### broadcastMeshMessage(...)

```typescript
broadcastMeshMessage(options: { message: string; }) => Promise<void>
```

| Param         | Type                              |
| ------------- | --------------------------------- |
| **`options`** | <code>{ message: string; }</code> |

--------------------


### addListener('onMeshMessageReceived', ...)

```typescript
addListener(eventName: 'onMeshMessageReceived', listenerFunc: (data: { message: string; }) => void) => Promise<PluginListenerHandle>
```

| Param              | Type                                                 |
| ------------------ | ---------------------------------------------------- |
| **`eventName`**    | <code>'onMeshMessageReceived'</code>                 |
| **`listenerFunc`** | <code>(data: { message: string; }) =&gt; void</code> |

**Returns:** <code>Promise&lt;<a href="#pluginlistenerhandle">PluginListenerHandle</a>&gt;</code>

--------------------


### Interfaces


#### PluginListenerHandle

| Prop         | Type                                      |
| ------------ | ----------------------------------------- |
| **`remove`** | <code>() =&gt; Promise&lt;void&gt;</code> |

</docgen-api>
