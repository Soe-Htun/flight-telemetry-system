import http from 'node:http'
import net from 'node:net'
import { WebSocketServer } from 'ws'

const HOST = process.env.TELEMETRY_HOST ?? 'fts.onenex.dev'
const REST_URL = process.env.REST_URL ?? `https://${HOST}:4000/flights`
const PORT = Number(process.env.PORT ?? 4001)
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 5000)

const START_MARKER = 0x82
const END_MARKER = 0x80
const PACKET_SIZE = 36
const PACKET_SIZE_OFFSET = 0x0c

const state = new Map()
const sockets = new Map()

const timeFormat = new Intl.DateTimeFormat('en-SG', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hour12: false
})
const formatTimestamp = (value) => timeFormat.format(value)

// Compute CRC-16/CCITT-FALSE over the provided bytes.
const crc16ccittFalse = (buffer) => {
  let crc = 0xffff
  for (const byte of buffer) {
    crc ^= byte << 8 // XOR next byte (shifted) into the CRC register
    //XOR returns 1 when the two bits are different, 0 when they are the same.
    for (let i = 0; i < 8; i += 1) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc & 0xffff
}

const within = (value, min, max) => value >= min && value <= max

// Decode and validate a single 36-byte telemetry packet.
const parsePacket = (packet) => {
  const issues = []
  if (packet[0] !== START_MARKER) issues.push('START_MARKER')
  if (packet[PACKET_SIZE - 1] !== END_MARKER) issues.push('END_MARKER')
  if (packet[PACKET_SIZE_OFFSET] !== PACKET_SIZE) issues.push('SIZE')

  // CRC stored at bytes 0x21..0x22 (uint16, big-endian).
  const expectedCrc = packet.readUInt16BE(0x21) //readUInt16BE(offset) reads 2 bytes from a Buffer starting at offset,
  const actualCrc = crc16ccittFalse(packet.slice(0, 0x1f))
  if (expectedCrc !== actualCrc) issues.push('CRC')

  // readFloatBE reads 4 bytes as IEEE 754 float (big-endian).
  const altitude = packet.readFloatBE(0x0d)
  const speed = packet.readFloatBE(0x11)
  const acceleration = packet.readFloatBE(0x15)
  const thrust = packet.readFloatBE(0x19)
  const temperature = packet.readFloatBE(0x1d)

  if (!within(altitude, 9000, 12000)) issues.push('ALTITUDE_RANGE')
  if (!within(speed, 220, 260)) issues.push('SPEED_RANGE')
  if (!within(acceleration, -2, 2)) issues.push('ACCELERATION_RANGE')
  if (!within(thrust, 0, 200000)) issues.push('THRUST_RANGE')
  if (!within(temperature, -50, 50)) issues.push('TEMPERATURE_RANGE')

  return {
    issues,
    decoded: {
      altitude,
      speed,
      acceleration,
      thrust,
      temperature,
      packetNumber: packet.readUInt8(0x0b)
    }
  }
}

const updateFlight = (id, patch) => {
  const current = state.get(id)
  if (!current) return
  const next = { ...current, ...patch }
  state.set(id, next)
  broadcast({ flight: next })
}

const broadcast = (payload) => {
  const message = JSON.stringify(payload)
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(message)
    }
  }
}

const connectFlight = (flight) => {
  const socket = new net.Socket()
  sockets.set(flight.id, socket)
  let buffer = Buffer.alloc(0) // Start with empty buffer; TCP delivers partial chunks.
  let reconnectTimer = null

  const cleanup = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    sockets.delete(flight.id)
  }

  const reconnect = () => {
    updateFlight(flight.id, { status: 'CLOSED' })
    cleanup()
    reconnectTimer = setTimeout(() => connectFlight(flight), 3000)
  }

  let lastDataAt = Date.now()
  let resubscribeTimer = null

  const message = JSON.stringify({
    type: 'subscribe',
    flightId: String(flight.id),
    intervalMs: String(INTERVAL_MS)
  })

  // Send subscribe payload to start telemetry stream.
  const sendSubscribe = () => {
    socket.write(`${message}\n`)
  }

  socket.on('connect', () => {
    // TCP connection established; configure socket and subscribe.
    sendSubscribe()
    socket.setKeepAlive(true, 5000)
    socket.setNoDelay(true)
    // Trigger a timeout if no data arrives for 2x interval.
    socket.setTimeout(INTERVAL_MS * 2)
    resubscribeTimer = setInterval(() => {
      if (Date.now() - lastDataAt > INTERVAL_MS * 2) {
        console.log(`No data yet for flight ${flight.id}, resubscribing`)
        sendSubscribe()
      }
    }, INTERVAL_MS * 2)
  })

  socket.on('data', (chunk) => {
    // Incoming TCP bytes; buffer and parse packets.
    lastDataAt = Date.now()
    buffer = Buffer.concat([buffer, chunk])
    // TCP is a stream; re-sync on 0x82 and extract fixed-size packets.
    while (buffer.length >= PACKET_SIZE) {
      const startIndex = buffer.indexOf(START_MARKER)
      if (startIndex === -1) {
        buffer = Buffer.alloc(0)
        return
      }
      if (startIndex > 0) {
        // Drop bytes before the start marker to re-align.
        buffer = buffer.slice(startIndex)
      }
      if (buffer.length < PACKET_SIZE) return
      const packet = buffer.slice(0, PACKET_SIZE)
      buffer = buffer.slice(PACKET_SIZE)

      if (packet[PACKET_SIZE - 1] !== END_MARKER) {
        // False start; shift by one byte and keep scanning.
        buffer = Buffer.concat([packet.slice(1), buffer])
        continue
      }

      const parsed = parsePacket(packet)
      const status = parsed.issues.length > 0 ? 'CORRUPTED' : 'VALID'

      updateFlight(flight.id, {
        status,
        issues: parsed.issues,
        decoded: parsed.decoded,
        last_updated_at: formatTimestamp(new Date())
      })
    }
  })

  socket.on('error', () => {
    // Socket error: mark flight as ERROR.
    updateFlight(flight.id, { status: 'ERROR' })
  })

  socket.on('timeout', () => {
    // No data in time; re-send subscribe.
    sendSubscribe()
  })

  socket.on('close', () => {
    // Connection closed; clear timers and reconnect.
    if (resubscribeTimer) clearInterval(resubscribeTimer)
    reconnect()
  })

  // Open TCP connection to the telemetry port.
  socket.connect(flight.telemetryPort, HOST)
}

const loadFlights = async () => {
  const response = await fetch(REST_URL)
  if (!response.ok) {
    throw new Error(`Failed to load flights: ${response.status}`)
  }
  const flights = await response.json()
  for (const flight of flights) {
    state.set(flight.id, { ...flight, status: 'WAITING', issues: [], decoded: null })
  }
  return flights
}

const server = http.createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS')
  res.setHeader('access-control-allow-headers', 'content-type, cache-control')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.method === 'GET' && req.url === '/flights') {
    res.writeHead(200, {
      'content-type': 'application/json'
    })
    res.end(JSON.stringify(Array.from(state.values())))
    return
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  res.writeHead(404)
  res.end()
})

// WebSocket server for pushing live updates to the UI.
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (ws) => {
  // Send current state on initial WS connect.
  ws.send(JSON.stringify({ flights: Array.from(state.values()) }))
})

// Startup: load flights, connect TCP sockets, and listen for HTTP/WS.
const start = async () => {
  const flights = await loadFlights()
  for (const flight of flights) {
    connectFlight(flight)
  }
  server.listen(PORT)
}

start().catch((error) => {
  process.stderr.write(`Failed to start telemetry proxy: ${String(error)}\n`)
  process.exit(1)
})
