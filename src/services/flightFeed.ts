import type { Flight } from '@/types/flight'

export type FeedStatus = 'loading' | 'ready' | 'error'

type FlightFeedOptions = {
  apiBase: string
  wsUrl?: string
  onFlights: (flights: Flight[]) => void
  onStatus: (status: FeedStatus) => void
}

type FlightFeed = {
  start: () => void
  stop: () => void
}

// Ensure optional fields have defaults so UI logic is consistent.
const normalizeFlights = (flights: Flight[]) =>
  flights.map((flight) => ({
    ...flight,
    status: flight.status ?? 'WAITING',
    issues: flight.issues ?? [],
    decoded: flight.decoded ?? null
  }))

const fetchFlights = async (apiBase: string): Promise<Flight[]> => {
  const response = await fetch(`${apiBase}/flights`, {
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache'
    }
  })
  if (!response.ok) throw new Error('Failed to fetch flights')
  const payload = (await response.json()) as Flight[]
  return normalizeFlights(payload)
}

export const createFlightFeed = (options: FlightFeedOptions): FlightFeed => {
  let timer: number | undefined
  let stopped = false
  let socket: WebSocket | null = null
  const pollIntervalMs = 5000
  let currentFlights: Flight[] = []

  // Merge a single flight update into the current list by id.
  const mergeFlight = (flights: Flight[], update: Flight) => {
    const next = flights.map((flight) =>
      flight.id === update.id ? { ...flight, ...update } : flight
    )
    const hasMatch = next.some((flight) => flight.id === update.id)
    if (hasMatch) return next
    return [...next, update]
  }

  // Load the full list via REST; used for initial state and polling.
  const load = async () => {
    try {
      const flights = await fetchFlights(options.apiBase)
      if (!stopped) {
        currentFlights = flights
        options.onFlights(currentFlights)
        options.onStatus('ready')
      }
    } catch (error) {
      if (!stopped) options.onStatus('error')
    }
  }

  return {
    start: () => {
      // Start polling and open WebSocket for live updates.
      options.onStatus('loading')
      load()
      timer = window.setInterval(() => {
        load()
      }, pollIntervalMs)
      if (options.wsUrl) {
        socket = new WebSocket(options.wsUrl)
        socket.addEventListener('message', (event) => {
          try {
            const payload = JSON.parse(event.data) as { flight?: Flight; flights?: Flight[] }
            if (payload.flights) {
              currentFlights = normalizeFlights(payload.flights)
              options.onFlights(currentFlights)
              return
            }
            if (payload.flight) {
              currentFlights = mergeFlight(currentFlights, payload.flight)
              options.onFlights(currentFlights)
            }
          } catch (error) {
            options.onStatus('error')
          }
        })
      }
    },
    stop: () => {
      // Stop polling and close WebSocket when view unmounts.
      stopped = true
      if (timer) window.clearInterval(timer)
      socket?.close()
      socket = null
    }
  }
}

export const buildFeedConfig = () => {
  const apiBase =
    (import.meta.env.VITE_BASE_URL as string | undefined) ?? 'http://localhost:4001'
  const wsUrl =
    (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:4001/ws'
  return { apiBase, wsUrl }
}
