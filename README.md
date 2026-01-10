# flight-tracker

Real-time flight telemetry UI with a small TCP to WebSocket proxy.

## Features

- Demo-matching telemetry cards with status, packet number, and values.
- TCP proxy validates packet size, CRC, and value ranges.
- Auto-reconnects TCP connections on close or error.
- Responsive grid layout for desktop and mobile.

## Setup

```sh
npm install
```

Terminal 1 (proxy):
```sh
npm run server
```

Terminal 2 (frontend):
```sh
npm run dev
```

## Environment Configuration (.env)

Create a `.env` file in the project root:

```sh
VITE_BASE_URL=http://localhost:4001
VITE_WS_URL=ws://localhost:4001/ws
VITE_DEMO_MODE=true
```

Notes:
- `VITE_` prefix is required for Vite to expose the variable to the client.
- `VITE_BASE_URL` points to the REST API host.
- `VITE_WS_URL` is optional; when set, the app listens for real-time updates.
- `VITE_DEMO_MODE=true` simulates telemetry values when live packets are unavailable.

### Proxy Environment (Optional)

- `TELEMETRY_HOST` (default: `fts.onenex.dev`)
- `REST_URL` (default: `https://fts.onenex.dev:4000/flights`)
- `INTERVAL_MS` (default: `5000`)
- `PORT` (default: `4001`)

## Architecture Overview

- `server/index.js` opens one TCP connection per flight, validates packets, and pushes decoded
  telemetry to WebSocket clients.
- The Vue app fetches `/flights` from the proxy and subscribes to `/ws` for live updates.

## Technology Choices (Why)

- Vue 3 + Vite: fast dev server and simple component model.
- Pinia: lightweight state management for the flight list.
- Tailwind CSS: quick, consistent layout and styling.
- Node TCP proxy: required because browsers cannot open raw TCP sockets.

## Assumptions

- Telemetry host is reachable from the machine running the proxy.
- TCP servers accept the documented JSON subscribe message.

## Known Limitations

- If the TCP servers block your IP or are unavailable, telemetry values will not appear.
- WebSocket updates require the proxy to be running.

## Project Walkthrough

- `server/index.js`
  - TCP client per flight, CRC validation, and WS broadcast.
- `src/services/flightFeed.ts`
  - REST polling for flights and WS merge for telemetry updates.
- `src/composables/useFlightFeed.ts`
  - Starts and stops the feed and exposes reactive flight data.
- `src/views/HomeView.vue`
  - Title and card grid layout.
- `src/components/FlightCard.vue`
  - Telemetry card UI.

## Build

```sh
npm run build
```
