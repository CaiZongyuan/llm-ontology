<script setup lang="ts">
import { computed } from 'vue'
import { chapterIndex, clamp, ramp } from './story'

const props = defineProps<{
  t: number
  offsetX?: number
  offsetY?: number
  reduced?: boolean
}>()

const ci = computed(() => chapterIndex(props.t))
const shiftStyle = computed(() => ({
  transform: `translate(${(props.offsetX ?? 0) * 320}px, ${(props.offsetY ?? 0) * 180}px)`,
}))

const NODES = [
  { id: 'src-sop', x: 240, y: 170, label: '出院管理 SOP', sub: 'Source · PDF', group: 0 },
  { id: 'src-green', x: 240, y: 270, label: '日间手术绿色通道', sub: 'Source · Normative', group: 0 },
  { id: 'src-db', x: 240, y: 370, label: 'HIS / EMR / LIS', sub: '12 张异构表 · 采样画像', group: 0 },
  { id: 'src-log', x: 240, y: 470, label: '夜班交班与历史日志', sub: 'Observational · 含异常', group: 0 },

  { id: 'cl-04', x: 470, y: 200, label: 'Claim-04 · 常规双签', sub: 'scope: Inpatient', group: 1 },
  { id: 'cl-09', x: 470, y: 310, label: 'Claim-09 · 日间单签', sub: 'scope: DaySurgery', group: 1 },
  { id: 'cl-12', x: 470, y: 430, label: 'Claim-12 · 无签字放行', sub: 'rejected: 历史违规记录', group: 1 },

  { id: 'ont-enc', x: 720, y: 190, label: 'Encounter (住院就诊)', sub: 'hospital.encounter · v1.2', group: 2 },
  { id: 'ont-path', x: 720, y: 310, label: 'DischargePathway', sub: 'StateMachine + Invariants', group: 2 },
  { id: 'ont-pol', x: 720, y: 430, label: 'Policy AST · 放行守卫', sub: 'Role >= Attending && Fit', group: 2 },

  { id: 'gen-ui', x: 970, y: 165, label: '医护出院协同看板', sub: 'Projection · React/Vue', group: 3 },
  { id: 'gen-guard', x: 970, y: 275, label: 'Action Executor 守卫', sub: 'Deterministic Runtime', group: 3 },
  { id: 'gen-mcp', x: 970, y: 385, label: 'Agent Context Package', sub: 'MCP Tools + 按需装配', group: 3 },
  { id: 'gen-wiki', x: 970, y: 495, label: 'LLM Wiki 经验知识页', sub: '[[出院延迟复盘]] 双向锚定', group: 5 },
]

const EDGES = [
  { from: 'src-sop', to: 'cl-04', g: 0 },
  { from: 'src-green', to: 'cl-09', g: 0 },
  { from: 'src-db', to: 'cl-09', g: 0 },
  { from: 'src-log', to: 'cl-12', g: 0 },

  { from: 'cl-04', to: 'ont-path', g: 1 },
  { from: 'cl-09', to: 'ont-pol', g: 1 },
  { from: 'src-db', to: 'ont-enc', g: 1 },

  { from: 'ont-enc', to: 'gen-ui', g: 3 },
  { from: 'ont-path', to: 'gen-guard', g: 3 },
  { from: 'ont-pol', to: 'gen-guard', g: 3 },
  { from: 'ont-path', to: 'gen-mcp', g: 3 },

  { from: 'gen-guard', to: 'gen-wiki', g: 5 },
  { from: 'gen-wiki', to: 'cl-09', g: 5 },
]

function nodeMap(id: string) {
  return NODES.find((n) => n.id === id)!
}

function nodeOpacity(group: number) {
  const t = props.t
  if (group === 0) return 0.95
  if (group === 1) return clamp(0.22 + ramp(t, 2, 12) * 0.78)
  if (group === 2) return clamp(0.18 + ramp(t, 12, 24) * 0.82)
  if (group === 3) return clamp(0.15 + ramp(t, 28, 36) * 0.85)
  return clamp(0.15 + ramp(t, 48, 54) * 0.85)
}

function isHighlighted(id: string) {
  const c = ci.value
  if (c === 0) return id.startsWith('src-') || id.startsWith('cl-')
  if (c === 1) return id.startsWith('cl-') || id === 'ont-enc'
  if (c === 2) return id.startsWith('ont-')
  if (c === 3) return id.startsWith('ont-') || (id.startsWith('gen-') && id !== 'gen-wiki')
  if (c === 4) return id === 'ont-pol' || id === 'gen-guard' || id === 'gen-mcp'
  return id === 'gen-wiki' || id === 'cl-09' || id === 'ont-pol' || id === 'gen-guard'
}
</script>

<template>
  <div class="sc">
    <svg class="canvas" viewBox="0 0 1280 680" preserveAspectRatio="xMidYMid slice" :style="shiftStyle">
      <defs>
        <pattern id="ont-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--line)" stroke-width="0.7" opacity="0.65" />
        </pattern>
        <marker id="arrow-acc" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--accent)" />
        </marker>
      </defs>

      <rect width="1280" height="680" fill="url(#ont-grid)" />

      <!-- Column lane headers -->
      <g class="lanes" transform="translate(0, 92)">
        <g transform="translate(150, 0)">
          <rect x="0" y="0" width="180" height="26" rx="6" fill="var(--surface)" stroke="var(--line-2)" />
          <text x="90" y="17" text-anchor="middle">1. RAW SOURCES</text>
        </g>
        <g transform="translate(380, 0)">
          <rect x="0" y="0" width="180" height="26" rx="6" fill="var(--surface)" stroke="var(--line-2)" />
          <text x="90" y="17" text-anchor="middle">2. EVIDENCE GRAPH</text>
        </g>
        <g transform="translate(630, 0)">
          <rect x="0" y="0" width="180" height="26" rx="6" fill="var(--surface)" stroke="var(--line-2)" />
          <text x="90" y="17" text-anchor="middle">3. CANONICAL ONTOLOGY</text>
        </g>
        <g transform="translate(880, 0)">
          <rect x="0" y="0" width="180" height="26" rx="6" fill="var(--surface)" stroke="var(--line-2)" />
          <text x="90" y="17" text-anchor="middle">4. RUNTIME &amp; WIKI</text>
        </g>
      </g>

      <!-- Edges -->
      <g class="edges">
        <path
          v-for="(e, idx) in EDGES"
          :key="idx"
          :d="`M ${nodeMap(e.from).x + 88} ${nodeMap(e.from).y} C ${(nodeMap(e.from).x + nodeMap(e.to).x) / 2} ${nodeMap(e.from).y}, ${(nodeMap(e.from).x + nodeMap(e.to).x) / 2} ${nodeMap(e.to).y}, ${nodeMap(e.to).x - 88} ${nodeMap(e.to).y}`"
          :class="{ active: ci >= e.g, pulse: ci === e.g }"
          marker-end="url(#arrow-acc)"
        />
      </g>

      <!-- Nodes -->
      <g class="nodes">
        <g
          v-for="n in NODES"
          :key="n.id"
          :transform="`translate(${n.x - 88}, ${n.y - 28})`"
          :style="{ opacity: nodeOpacity(n.group) }"
          :class="{
            hi: isHighlighted(n.id),
            bad: n.id === 'cl-12' || (n.id === 'gen-guard' && t >= 44 && t < 47),
            good: (n.id === 'ont-pol' && t >= 23) || (n.id === 'gen-guard' && t >= 47),
          }"
        >
          <rect width="176" height="56" rx="10" class="card" />
          <circle cx="16" cy="20" r="4.5" class="dot" />
          <text x="28" y="24" class="title">{{ n.label }}</text>
          <text x="28" y="42" class="sub">{{ n.sub }}</text>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.sc { width: 100%; height: 100%; overflow: hidden; }
.canvas { width: 100%; height: 100%; transition: transform .35s var(--ease); }
.lanes text { font-family: var(--font-mono); font-size: 10px; letter-spacing: .08em; fill: var(--faint); }
.edges path { fill: none; stroke: var(--line-2); stroke-width: 1.5; stroke-dasharray: 5 4; opacity: 0.45; transition: stroke .35s var(--ease), opacity .35s var(--ease); }
.edges path.active { stroke: var(--accent); opacity: 0.78; stroke-dasharray: none; }
.edges path.pulse { stroke: var(--accent-ink); stroke-width: 2.2; stroke-dasharray: 8 4; animation: wb-flow 1.2s linear infinite; opacity: 1; }
.nodes .card { fill: var(--surface); stroke: var(--line-2); stroke-width: 1.2; transition: all .3s var(--ease); }
.nodes .dot { fill: var(--ghost); transition: fill .3s var(--ease); }
.nodes .title { font-family: var(--font-ui); font-size: 12.5px; font-weight: 600; fill: var(--ink); }
.nodes .sub { font-family: var(--font-mono); font-size: 10px; fill: var(--muted); }
.nodes g.hi .card { stroke: var(--accent); stroke-width: 1.8; fill: color-mix(in srgb, var(--accent) 7%, var(--surface)); }
.nodes g.hi .dot { fill: var(--accent); }
.nodes g.bad .card { stroke: var(--bad); stroke-width: 1.8; fill: color-mix(in srgb, var(--bad) 8%, var(--surface)); }
.nodes g.bad .dot { fill: var(--bad); }
.nodes g.good .card { stroke: var(--ok); stroke-width: 1.8; fill: color-mix(in srgb, var(--ok) 8%, var(--surface)); }
.nodes g.good .dot { fill: var(--ok); }
</style>
