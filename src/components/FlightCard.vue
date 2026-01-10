<script setup lang="ts">
import { computed } from 'vue'
import Icons from '@/components/icons/icons.vue'
import type { Flight } from '@/types/flight'

const props = defineProps<{
  flight: Flight
}>()

const formatValue = (value: number | undefined, unit: string) =>
  typeof value === 'number' ? `${value.toFixed(2)} ${unit}` : `- ${unit}`

const telemetryRows = computed(() => [
  { label: 'Altitude', value: formatValue(props.flight.decoded?.altitude, 'm') },
  { label: 'Speed', value: formatValue(props.flight.decoded?.speed, 'm/s') },
  { label: 'Acceleration', value: formatValue(props.flight.decoded?.acceleration, 'm/s^2') },
  { label: 'Thrust', value: formatValue(props.flight.decoded?.thrust, 'N') },
  { label: 'Temperature', value: formatValue(props.flight.decoded?.temperature, 'deg C') },
  {
    label: 'Last Updated At',
    value: props.flight.last_updated_at ?? '--:--:--.---'
  }
])

const statusLabel = computed(() => {
  if (props.flight.status && props.flight.status !== 'WAITING') return props.flight.status
  if ((props.flight.issues?.length ?? 0) > 0) return 'CORRUPTED'
  if (props.flight.decoded) return 'VALID'
  return 'WAITING'
})
</script>

<template>
  <article
    class="rounded-2xl border border-white/10 bg-[#0f172a] p-5 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.85)] transition hover:-translate-y-1 hover:border-white/30 hover:bg-slate-500 hover:shadow-[0_22px_55px_-32px_rgba(0,0,0,0.9)]"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex h-10 w-10 items-center justify-center">
        <Icons name="flight" class="h-7 w-7 text-slate-200" />
      </div>
      <div class="text-right">
        <div class="inline-block text-left">
          <div class="text-sm font-bold text-slate-100">
            {{ props.flight.model }} ({{ props.flight.flightNumber }})
          </div>
          <div class="mt-1 grid w-full grid-cols-[1fr_auto_1fr] items-center text-sm font-bold text-slate-100">
            <span class="text-left">{{ props.flight.origin }}</span>
            <span class="px-2">→</span>
            <span class="text-right">{{ props.flight.destination }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-5 grid gap-2 text-xs font-bold text-slate-300">
      <div
        v-for="row in telemetryRows"
        :key="row.label"
        class="flex items-center justify-between"
      >
        <span>{{ row.label }}</span>
        <span class="text-slate-200">{{ row.value }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span>Status</span>
        <span :data-status="statusLabel">
          {{ statusLabel }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span>Errors</span>
        <span class="text-slate-200">
          {{ props.flight.issues?.length ? props.flight.issues.length : '-' }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span>Packet Number</span>
        <span class="text-slate-200">
          {{ props.flight.decoded?.packetNumber ?? '-' }}
        </span>
      </div>
    </div>
  </article>
</template>
