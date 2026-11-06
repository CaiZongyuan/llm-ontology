<script setup lang="ts">
import { computed } from 'vue'
import { chapterAt, clamp, ramp } from './story'

const props = defineProps<{ t: number }>()
const ch = computed(() => chapterAt(props.t).id)

const SOURCES = ['医院出院管理SOP', '日间手术绿色通道', '交班访谈录音', 'HIS/EMR/LIS快照']
const CLAIMS = [
  { id: 'C-04', mod: 'normative', txt: '住院出院须主治+主任双签' },
  { id: 'C-09', mod: 'normative', txt: '日间手术允许主治单签放行' },
  { id: 'C-12', mod: 'observational', txt: '夜班存在42条无签字放行记录' },
]
const PRIM = [
  ['EntityType', 'Patient, Encounter, Bed, DischargePathway'],
  ['StateMachine', 'InTreatment → MedicallyFit → Ready → Discharged'],
  ['Action', 'ConfirmMedicallyFit, ExpeditePendingLab, ReleaseBed'],
  ['Policy AST', 'role >= Attending && pendingCriticalLab == 0'],
]
const TARGETS = [
  'schema.zod.ts (类型与校验)',
  'policy-guards.ts (确定性守卫)',
  'discharge-board.vue (医护看板)',
  'mcp-tools.json (Agent契约)',
  'contract.test.ts (16项正负例)',
]
const compileDone = computed(() => Math.floor(clamp((props.t - 31.0) / 6.0) * TARGETS.length))
</script>

<template>
  <div class="ip pl-panel">
    <template v-if="ch === 'discovery'">
      <div class="pl-panel-head"><span>多源证据采集</span><span>3 库 + 4 文档</span></div>
      <div class="pl-panel-body">
        <p class="k">不可变原始资料 (Source Corpus)</p>
        <div class="chips">
          <span v-for="(s, i) in SOURCES" :key="s" :style="{ opacity: ramp(t, 1.0 + i * 0.4, 1.8 + i * 0.4) }">{{ s }}</span>
        </div>
        <p class="k">提取出的事实主张 (Claims)</p>
        <ul class="claims">
          <li v-for="(c, i) in CLAIMS" :key="c.id" :style="{ opacity: ramp(t, 3.2 + i * 0.8, 4.0 + i * 0.8) }">
            <b class="mono">{{ c.id }}</b>
            <span class="tag" :class="c.mod">{{ c.mod }}</span>
            <em>{{ c.txt }}</em>
          </li>
        </ul>
      </div>
    </template>

    <template v-else-if="ch === 'reconcile'">
      <div class="pl-panel-head"><span>五维冲突消解</span><span>Concept Registry</span></div>
      <div class="pl-panel-body">
        <dl class="assets">
          <div><dt>Identity 跨源对齐</dt><dd class="mono">visit_no = inp_id = encounter_id</dd></div>
          <div><dt>Scope 适用范围</dt><dd>常规住院(双签) vs 日间手术(单签)</dd></div>
          <div><dt>Authority 权威性</dt><dd class="badt">拦截 C-12 历史违规习惯入模</dd></div>
        </dl>
        <p class="k">三视图 Preview 同步生成</p>
        <div class="chips">
          <span>医护临床看板</span>
          <span>数据治理 Schema</span>
          <span>Agent Tool 契约</span>
        </div>
      </div>
    </template>

    <template v-else-if="ch === 'canonical'">
      <div class="pl-panel-head"><span>Canonical Ontology</span><span class="lock">v1.2.0 已锁定</span></div>
      <div class="pl-panel-body">
        <dl class="assets">
          <div v-for="([k, v], i) in PRIM" :key="k" :style="{ opacity: ramp(t, 20.8 + i * 0.6, 21.6 + i * 0.6) }">
            <dt class="mono">{{ k }}</dt>
            <dd>{{ v }}</dd>
          </div>
        </dl>
        <p class="note">稳定节点 ID（如 <code>hospital.encounter</code>）确保改名不丢失历史事件与血缘。</p>
      </div>
    </template>

    <template v-else-if="ch === 'compile'">
      <div class="pl-panel-head"><span>Model Compiler</span><span class="mono">{{ compileDone }} / 5 产物</span></div>
      <div class="pl-panel-body">
        <ul class="checks">
          <li v-for="(m, i) in TARGETS" :key="m" :class="{ on: i < compileDone }"><i /><span class="mono">{{ m }}</span></li>
        </ul>
        <p class="note">所有契约由同一版本 IR 生成，杜绝前后端与 Agent 提示词各自为政。</p>
      </div>
    </template>

    <template v-else-if="ch === 'runtime'">
      <div class="pl-panel-head"><span>Encounter-2026-089</span><span class="mono" :class="t >= 44 && t < 47 ? 'badt' : 'okt'">{{ t >= 47 ? 'MedicallyFit' : 'PendingCheck' }}</span></div>
      <div class="pl-panel-body">
        <dl class="assets">
          <div><dt>Context Package</dt><dd class="mono">仅装载 4 实体 + 3 Action</dd></div>
          <div><dt>越权 ReleaseBed</dt><dd class="badt">Policy AST 确定性拒绝</dd></div>
          <div><dt>医师签发后</dt><dd class="okt">触发床位消毒 + PROV-O 留痕</dd></div>
        </dl>
      </div>
    </template>

    <template v-else>
      <div class="pl-panel-head"><span>LLM Wiki + 增量编译</span><span class="mono okt">4 / 28 节点重算</span></div>
      <div class="pl-panel-body">
        <dl class="assets">
          <div><dt>经验沉淀</dt><dd>[[周末出院带药核对延迟复盘]]</dd></div>
          <div><dt>双向锚点</dt><dd class="mono">→ hospital.discharge_pathway</dd></div>
          <div><dt>影响传播</dt><dd>Policy → Action → UI → Test</dd></div>
        </dl>
        <p class="note">Wiki 提供可追溯经验上下文，但不直接篡改运行时权限，须经 ChangeSet 发布。</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ip { flex-shrink: 1; min-height: 0; overflow: hidden; }
.k { margin: 10px 0 6px; font-size: 11.5px; color: var(--faint); }
.k:first-child { margin-top: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 5px; }
.chips span { font-size: 11.5px; padding: 2px 8px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-2); }
.claims { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.claims li { display: grid; grid-template-columns: 36px auto 1fr; gap: 6px; align-items: center; font-size: 11.5px; }
.claims b { color: var(--accent-ink); }
.claims em { font-style: normal; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag { font-family: var(--font-mono); font-size: 10px; padding: 1px 5px; border-radius: 4px; border: 1px solid var(--line-2); }
.tag.normative { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
.tag.observational { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 45%, var(--line)); }
.assets { margin: 0; display: flex; flex-direction: column; }
.assets div { display: flex; justify-content: space-between; gap: 10px; padding: 5px 0; border-top: 1px solid var(--line); font-size: 12px; }
.assets div:first-child { border-top: 0; }
.assets dt { color: var(--faint); flex-shrink: 0; }
.assets dd { margin: 0; color: var(--ink-2); text-align: right; }
.lock, .okt { color: var(--ok); }
.badt { color: var(--bad); }
.checks { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 5px; }
.checks li { font-size: 11.5px; color: var(--faint); display: flex; align-items: center; gap: 8px; transition: color .3s var(--ease); }
.checks i { width: 11px; height: 11px; border-radius: 50%; border: 1px solid var(--line-2); flex-shrink: 0; transition: all .3s var(--ease); }
.checks li.on { color: var(--ink-2); }
.checks li.on i { background: var(--ok); border-color: var(--ok); }
.note { margin-top: 10px; font-size: 12px; line-height: 1.6; color: var(--muted); }
.mono { font-family: var(--font-mono); }
</style>
