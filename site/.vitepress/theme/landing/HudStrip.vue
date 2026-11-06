<script setup lang="ts">
import { computed } from 'vue'
import { hudAt } from './story'

const props = defineProps<{ t: number }>()
const h = computed(() => hudAt(props.t))
</script>

<template>
  <div class="hud pl-panel">
    <div><span>闭环阶段</span><b class="mono">{{ h.stage }} / 6</b></div>
    <div><span>证据主张 Claim</span><b class="mono ok">{{ h.claims }}</b></div>
    <div><span>本体节点 Node</span><b class="mono">{{ h.nodes }}</b></div>
    <div><span>契约测试 PASS</span><b class="mono ok">{{ h.guards }} / 16</b></div>
    <div><span>授权审批点</span><b class="mono acc">{{ h.approvals }} / 2</b></div>
  </div>
</template>

<style scoped>
.hud { display: flex; gap: 0; padding: 0; overflow: hidden; }
.hud > div { display: flex; flex-direction: column; gap: 2px; padding: 9px 16px; border-right: 1px solid var(--line); }
.hud > div:last-child { border-right: 0; }
span { font-size: 10.5px; color: var(--faint); font-family: var(--font-mono); letter-spacing: .04em; white-space: nowrap; }
b { font-size: 15px; font-weight: 500; color: var(--ink); }
b.ok { color: var(--ok); }
b.bad { color: var(--bad); }
b.acc { color: var(--accent-ink); }
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
</style>
