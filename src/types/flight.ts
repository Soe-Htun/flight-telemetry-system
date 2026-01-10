export type FlightStatus = 'WAITING' | 'VALID' | 'CORRUPTED' | 'ERROR' | 'CLOSED'

export type FlightTelemetry = {
  packetNumber: number
  altitude: number
  speed: number
  acceleration: number
  thrust: number
  temperature: number
}

export type Flight = {
  id: string
  model: string
  flightNumber: string
  origin: string
  destination: string
  telemetryPort: number
  status: FlightStatus
  last_updated_at?: string
  issues?: string[]
  decoded?: FlightTelemetry | null
}
