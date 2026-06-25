<script setup lang="ts">
import { VisSingleContainer, VisDonut } from '@unovis/vue'
import type { DonutSlice } from '~/types/charts'

const props = defineProps<{ data: DonutSlice[], centralLabel?: string, centralSubLabel?: string }>()

const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#ec4899', '#84cc16']

const value = (d: DonutSlice) => d.value
const color = (_d: DonutSlice, i: number) => PALETTE[i % PALETTE.length] as string

const legend = computed(() => props.data.map((d, i) => ({
  ...d,
  color: PALETTE[i % PALETTE.length] as string
})))
</script>

<template>
  <div class="flex flex-col sm:flex-row items-center gap-4">
    <VisSingleContainer
      :data="data"
      :height="200"
      class="shrink-0 w-full sm:w-48"
    >
      <VisDonut
        :value="value"
        :color="color"
        :arc-width="34"
        :corner-radius="3"
        :pad-angle="0.02"
        :central-label="centralLabel"
        :central-sub-label="centralSubLabel"
      />
    </VisSingleContainer>

    <ul class="w-full space-y-1.5">
      <li
        v-for="item in legend"
        :key="item.name"
        class="flex items-center gap-2 text-sm"
      >
        <span
          class="size-2.5 rounded-full shrink-0"
          :style="{ backgroundColor: item.color }"
        />
        <span class="truncate flex-1">{{ item.name }}</span>
        <span class="font-medium tabular-nums">{{ formatEuro(item.value) }}</span>
      </li>
    </ul>
  </div>
</template>
