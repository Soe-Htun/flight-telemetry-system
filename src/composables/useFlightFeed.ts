import { onBeforeUnmount, onMounted, ref } from 'vue'
import { buildFeedConfig, createFlightFeed, type FeedStatus } from '@/services/flightFeed'
import type { Flight } from '@/types/flight'

export const useFlightFeed = () => {
  const flights = ref<Flight[]>([])
  const status = ref<FeedStatus>('connecting')
  const lastUpdated = ref<Date | null>(null)
  let stop: (() => void) | null = null

  onMounted(() => {
    const { apiBase, wsUrl } = buildFeedConfig()
    const feed = createFlightFeed({
      apiBase,
      wsUrl,
      onFlights: (nextFlights) => {
        flights.value = nextFlights
        lastUpdated.value = new Date()
      },
      onStatus: (nextStatus) => {
        status.value = nextStatus
      }
    })

    stop = feed.stop
    feed.start()
  })

  onBeforeUnmount(() => {
    stop?.()
  })

  return {
    flights,
    status,
    lastUpdated
  }
}
