<script setup lang="ts">
import { VisXYContainer, VisGroupedBar, VisLine, VisAxis, VisCrosshair, VisTooltip } from '@unovis/vue'
import type { MonthPoint } from '~/types/charts'

const props = defineProps<{ data: MonthPoint[] }>()

const x = (d: MonthPoint) => d.i
const barY = [(d: MonthPoint) => d.income, (d: MonthPoint) => d.expense]
const netY = (d: MonthPoint) => d.net
const barColor = (_d: MonthPoint, i: number) => ['#10b981', '#f43f5e'][i] as string

const tickFormat = (i: number) => props.data[i]?.label ?? ''

function compactEuro(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1000) return `${(v / 1000).toFixed(abs >= 10000 ? 0 : 1)}k €`
  return `${Math.round(v)} €`
}

// Tooltip-Inhalt für einen Monatsbalken
function tooltipTemplate(d: MonthPoint): string {
  return `
    <div style="font-weight:600;margin-bottom:4px">${d.label}</div>
    <div style="display:flex;gap:8px;justify-content:space-between"><span style="color:#10b981">Einnahmen</span><span>${formatEuro(d.income)}</span></div>
    <div style="display:flex;gap:8px;justify-content:space-between"><span style="color:#f43f5e">Ausgaben</span><span>${formatEuro(d.expense)}</span></div>
    <div style="display:flex;gap:8px;justify-content:space-between;border-top:1px solid rgba(128,128,128,.2);margin-top:4px;padding-top:4px"><span>Netto</span><span>${formatEuro(d.net)}</span></div>
  `
}
</script>

<template>
  <VisXYContainer
    :data="data"
    :height="300"
    :margin="{ left: 8, right: 8, top: 8, bottom: 8 }"
  >
    <VisGroupedBar
      :x="x"
      :y="barY"
      :color="barColor"
      :rounded-corners="4"
      :group-padding="0.25"
    />
    <VisLine
      :x="x"
      :y="netY"
      color="#8b5cf6"
      :line-width="2.5"
    />
    <VisCrosshair
      :template="tooltipTemplate"
      color="#8b5cf6"
    />
    <VisTooltip />
    <VisAxis
      type="x"
      :tick-format="tickFormat"
      :grid-line="false"
      :tick-line="false"
      :domain-line="false"
    />
    <VisAxis
      type="y"
      :tick-format="compactEuro"
      :grid-line="true"
      :tick-line="false"
      :domain-line="false"
      :num-ticks="5"
    />
  </VisXYContainer>
</template>
