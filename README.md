# flight-tracker

Real-time flight telemetry UI with a small TCP to WebSocket proxy.

## Features

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
TELEMETRY_HOST=fts.onenex.dev
REST_URL=https://fts.onenex.dev:4000/flights
PORT=4001
```

Notes:
- `VITE_` prefix is required for Vite to expose the variable to the client.
- `VITE_BASE_URL` points to the REST API host.
- `VITE_WS_URL` is optional; when set, the app listens for real-time updates.
- `TELEMETRY_HOST`, `REST_URL`, and `PORT` are used by the Node proxy; the server must load `.env` for them to be available.

### Proxy Environment (Optional)

- `TELEMETRY_HOST` (default: `fts.onenex.dev`)
- `REST_URL` (default: `https://fts.onenex.dev:4000/flights`)
- `INTERVAL_MS` (default: `5000`)
- `PORT` (default: `4001`)

Set these when starting the proxy (the server does not read `.env` by default):

```sh
TELEMETRY_HOST=fts.onenex.dev REST_URL=https://fts.onenex.dev:4000/flights \
INTERVAL_MS=5000 PORT=4001 npm run server
```

## Architecture Overview

- `server/index.js` opens one TCP connection per flight, validates packets, and pushes decoded
  telemetry to WebSocket clients.
- The Vue app fetches `/flights` from the proxy and subscribes to `/ws` for live updates.

## How It Works (Step by Step)

1. **Proxy starts** and loads the flights list from `REST_URL` (default: `https://fts.onenex.dev:4000/flights`).
2. For **each flight**, the proxy opens a TCP connection to `TELEMETRY_HOST:telemetryPort`.
3. The proxy sends a **subscribe message**:
   ```json
   { "type": "subscribe", "flightId": "1", "intervalMs": "5000" }
   ```
4. The TCP server streams **binary packets**. The proxy buffers data, re-syncs on `0x82`, and
   extracts 36-byte packets.
5. Each packet is **validated** (start/end markers, packet size, CRC, and value ranges).
6. The proxy **broadcasts** the decoded telemetry to all WebSocket clients at `ws://localhost:4001/ws`.
7. The Vue app **polls** `/flights` for initial data and **merges** live updates from WebSocket.

## Packet Parsing Rules

- Packet size is 36 bytes (big-endian).
- Start marker `0x82` at byte 0, end marker `0x80` at byte 35.
- CRC-16/CCITT-FALSE is computed over bytes `0x00` to `0x1E` and compared to bytes `0x21-0x22`.

## Status Rules

- `WAITING`: Default after flights are loaded, before telemetry arrives.
- `VALID`: Packet passes all validation checks.
- `CORRUPTED`: Packet fails CRC or any value range check.
- `ERROR`: TCP socket error.
- `CLOSED`: TCP connection closed and reconnecting.

## Technology Choices (Why)

- Vue 3 + Vite: fast dev server and simple component model.
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
