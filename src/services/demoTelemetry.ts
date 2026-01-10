import type { Flight } from '@/types/flight'

const pad = (value: number, length: number) => String(value).padStart(length, '0')

const formatTimestamp = (value: Date) =>
  `${pad(value.getHours(), 2)}:${pad(value.getMinutes(), 2)}:${pad(value.getSeconds(), 2)}.${pad(
    value.getMilliseconds(),
    3
  )}`

const hashString = (value: string) =>
  Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0)

const wave = (seed: number, frame: number) => (Math.sin(seed + frame * 0.7) + 1) / 2

const range = (min: number, max: number, seed: number, frame: number) =>
  min + (max - min) * wave(seed, frame)

export const buildDemoFlights = (flights: Flight[], now: Date): Flight[] => {
  const frame = Math.floor(now.getTime() / 5000)

  return flights.map((flight, index) => {
    const seed = hashString(flight.id)
    const statusIndex = (frame + index) % 12
    const status = statusIndex === 0 ? 'CORRUPTED' : statusIndex === 1 ? 'CONNECTED' : 'VALID'
    const issues = statusIndex === 0 ? ['CRC'] : []
    const decoded = {
      packetNumber: (frame + seed) % 256,
      altitude: range(9000, 12000, seed + 1, frame),
      speed: range(220, 260, seed + 2, frame),
      acceleration: range(-2, 2, seed + 3, frame),
      thrust: range(0, 200000, seed + 4, frame),
      temperature: range(-50, 50, seed + 5, frame)
    }

    return {
      ...flight,
      status,
      issues,
      decoded,
      last_updated_at: formatTimestamp(now)
    }
  })
}
