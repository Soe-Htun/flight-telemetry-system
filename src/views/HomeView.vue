<script setup lang="ts">
import FlightCard from '@/components/FlightCard.vue'
import { useFlightFeed } from '@/composables/useFlightFeed'

const { flights } = useFlightFeed()
</script>

<template>
  <main class="min-h-screen bg-black text-slate-200">
    <section class="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
      <header class="text-center">
        <h1 class="text-3xl font-semibold text-slate-100 md:text-4xl">
          Flight Telemetry System
        </h1>
        <p class="mt-2 text-sm text-slate-400">
          Live telemetry updates every 5000 ms by default.
        </p>
      </header>

      <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <FlightCard
          v-for="flight in flights"
          :key="flight.id"
          :flight="flight"
        />
      </div>
    </section>
  </main>
</template>
