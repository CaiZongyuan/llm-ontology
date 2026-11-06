<script setup lang="ts">
import { computed, ref } from 'vue'

const scenario = ref(0)

const SCENARIOS = [
  {
    title: '场景 A · 局部 SOP 更新：眼科日间病房纳入主治单签放行',
    trigger: 'frag_daysurg2026_p2',
    affected: ['frag_daysurg2026_p2', 'claim_09', 'policy_signoff', 'action_confirm_fit', 'guard_ts', 'ui_board', 'test_policy'],
    recompiledCount: '4 / 28 产物重编译',
    dbMigration: '无需数据库表结构迁移（纯策略 AST 枚举扩展）',
    summary: 'Incremental Semantic Compiler 沿着依赖图仅重新生成 `policy-guards.ts`、`discharge-board.vue`、`mcp-tools.json` 与策略回归测试，其余 24 个模块（如床位消毒、LIS 催检、OMOP 导出）保持原 Hash 不变！',
  },
  {
    title: '场景 B · 显示名称修改：将「出院准备路径」改名为「离院协同路径」',
    trigger: 'entity_pathway',
    affected: ['entity_pathway', 'ui_board'],
    recompiledCount: '1 / 28 产物重编译',
    dbMigration: '零迁移（稳定 ID `hospital.discharge_pathway` 未发生任何改变）',
    summary: '因为系统以稳定节点 ID（而非中文显示名）作为主键与引用锚点，改名操作仅触发前端 UI 投影字典更新，后端数据库、API 与历史事件日志 100% 免改动。',
  },
  {
    title: '场景 C · 高危破坏性变更：试图删除属性 `medically_fit_at`',
    trigger: 'prop_fit_at',
    affected: ['prop_fit_at', 'entity_pathway', 'policy_signoff', 'action_confirm_fit', 'metric_prep_hours', 'db_schema', 'guard_ts', 'ui_board', 'test_policy'],
    recompiledCount: 'BLOCKED · 触发破坏性变更保护门',
    dbMigration: '高危告警：影响 HIS 历史数据列与核心指标 `AvgDischargePrepHours`',
    summary: '依赖图立即识别出 `AvgDischargePrepHours` 指标与 `ConfirmMedicallyFit` 动作强依赖该属性，编译器拒绝直接 DROP 生产数据库列，强制要求提供 Deprecated 过渡期与数据迁移计划。',
  },
]

const NODES = [
  { id: 'frag_daysurg2026_p2', label: 'SOP Fragment', kind: 'Source' },
  { id: 'claim_09', label: 'Claim-09', kind: 'Evidence' },
  { id: 'entity_pathway', label: 'DischargePathway', kind: 'EntityType' },
  { id: 'prop_fit_at', label: 'medically_fit_at', kind: 'Property' },
  { id: 'policy_signoff', label: 'SignoffPolicy AST', kind: 'Policy' },
  { id: 'action_confirm_fit', label: 'ConfirmMedicallyFit', kind: 'Action' },
  { id: 'metric_prep_hours', label: 'AvgPrepHours', kind: 'Metric' },
  { id: 'db_schema', label: 'schema.zod.ts / DB', kind: 'Artifact' },
  { id: 'guard_ts', label: 'policy-guards.ts', kind: 'Artifact' },
  { id: 'ui_board', label: 'discharge-board.vue', kind: 'Artifact' },
  { id: 'test_policy', label: 'contract.test.ts', kind: 'Artifact' },
]

const cur = computed(() => SCENARIOS[scenario.value])
function isHit(id: string) {
  return cur.value.affected.includes(id)
}
</script>

<template>
  <div class="iig wb-panel vp-raw">
    <div class="wb-panel-head">
      <span>增量语义编译器 (Incremental Semantic Compiler) · 依赖传播沙盒</span>
      <span class="wb-tag" :class="scenario === 2 ? 'FAIL' : 'PASS'">{{ cur.recompiledCount }}</span>
    </div>

    <div class="wb-panel-body">
      <div class="scen-btns">
        <button
          v-for="(s, i) in SCENARIOS"
          :key="s.title"
          type="button"
          class="wb-btn"
          :class="{ 'wb-btn--primary': scenario === i }"
          @click="scenario = i"
        >
          {{ s.title }}
        </button>
      </div>

      <div class="nodes-grid">
        <div
          v-for="n in NODES"
          :key="n.id"
          class="n-chip"
          :class="{
            trig: cur.trigger === n.id,
            hit: isHit(n.id) && cur.trigger !== n.id,
            block: scenario === 2 && isHit(n.id),
          }"
        >
          <span class="wb-mono">{{ n.kind }}</span>
          <b>{{ n.label }}</b>
          <small class="wb-mono">{{ isHit(n.id) ? (cur.trigger === n.id ? '⚡ 变更源' : '↻ 受影响重算') : '✓ 缓存复用' }}</small>
        </div>
      </div>

      <div class="report">
        <div>
          <span class="k">数据库迁移影响</span>
          <p class="wb-mono">{{ cur.dbMigration }}</p>
        </div>
        <div>
          <span class="k">Build Manifest 增量分析结论</span>
          <p>{{ cur.summary }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.iig { margin: 22px 0; }
.scen-btns { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.nodes-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
.n-chip { padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); display: flex; flex-direction: column; gap: 3px; transition: all .25s var(--ease); }
.n-chip span { font-size: 10px; color: var(--faint); text-transform: uppercase; }
.n-chip b { font-size: 13px; color: var(--ink); }
.n-chip small { font-size: 11px; color: var(--muted); }
.n-chip.trig { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
.n-chip.trig small { color: var(--accent-ink); font-weight: 600; }
.n-chip.hit { border-color: color-mix(in srgb, var(--ok) 55%, var(--line)); background: color-mix(in srgb, var(--ok) 8%, var(--surface)); }
.n-chip.hit small { color: var(--ok); }
.n-chip.block { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 10%, var(--surface)); }
.n-chip.block small { color: var(--bad); }
.report { display: grid; grid-template-columns: 1fr 1.5fr; gap: 14px; padding: 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); }
.report .k { display: block; font-family: var(--font-mono); font-size: 11px; color: var(--faint); margin-bottom: 4px; }
.report p { margin: 0; font-size: 13.5px; line-height: 1.65; color: var(--ink-2); }
@media (max-width: 860px) {
  .nodes-grid { grid-template-columns: 1fr 1fr; }
  .report { grid-template-columns: 1fr; }
}
</style>
