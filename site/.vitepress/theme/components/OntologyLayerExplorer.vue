<script setup lang="ts">
import { computed, ref } from 'vue'

interface LayerItem {
  n: string
  name: string
  en: string
  plane: 'TBox · 权威本体 (Canonical Ontology)' | 'ABox · 运行时状态与事件 (System of Record)' | 'Wiki · 经验知识库 (LLM Wiki)'
  tag: 'PASS' | 'BLOCKED' | 'IDEALIZED'
  example: string
  whatItIs: string
  whereStored: string
  code: string
  confusion: string
}

const LAYERS: LayerItem[] = [
  {
    n: 'L1',
    name: '业务概念',
    en: 'EntityType / Concept',
    plane: 'TBox · 权威本体 (Canonical Ontology)',
    tag: 'PASS',
    example: 'Patient (患者)、Encounter (住院就诊)、Bed (床位)、DischargePathway (出院准备路径)',
    whatItIs: '定义医院业务世界中存在哪些“类型”的事物、它们的稳定身份标识与核心属性，而不是某一次具体住院记录。',
    whereStored: 'Canonical Ontology (Domain Graph) + Concept Registry（跨 HIS/EMR/FHIR 映射）',
    code: `EntityType: hospital.encounter
  displayName: "住院就诊 (Encounter)"
  identity: encounter_id (EMPI aligned)
  mappings:
    - HIS.inpatient_visits.visit_no
    - EMR.admissions.inp_id
    - FHIR.R4.Encounter.id`,
    confusion: '最常见误区：把 HIS 表名 `t_zy_brdj` 直接当成业务概念，或者把“患者（Patient）”与“医保付款人（Payer）”混为一谈。',
  },
  {
    n: 'L2',
    name: '业务关系',
    en: 'Relation / LinkType',
    plane: 'TBox · 权威本体 (Canonical Ontology)',
    tag: 'PASS',
    example: 'Encounter occupiesBed Bed (1:1) · Encounter hasDischargeTasks DischargeTask (1:N)',
    whatItIs: '定义不同业务概念之间允许存在什么语义关联、基数约束（1:1 / 1:N）与逆向语义角色，独立于物理数据库外键。',
    whereStored: 'Canonical Ontology (Semantic Relation) + Mapping Binding',
    code: `Relation: hospital.encounter_occupies_bed
  source: hospital.encounter
  target: hospital.bed
  cardinality: "0..1"
  inverse: bed.currentEncounter
  physicalBinding: "his.visits.bed_code = bed_mgmt.beds.code"`,
    confusion: '最常见误区：把语义关系等同于 SQL 外键。一旦医院更换床位系统，没有解耦物理外键的模型就会全盘崩溃。',
  },
  {
    n: 'L3',
    name: '约束与策略',
    en: 'Invariant & Policy AST',
    plane: 'TBox · 权威本体 (Canonical Ontology)',
    tag: 'PASS',
    example: '未由主治及以上医师确认 MedicallyFit 且未清空危急值前，严禁将床位状态变更为 ReadyForRelease',
    whatItIs: '定义什么状态转换和动作调用在业务与法规上是合法的（Palantir Semantic + Kinetic 契约边界）。',
    whereStored: 'Canonical Ontology (Policy AST + StateMachine Invariants)',
    code: `Invariant on hospital.discharge_pathway:
  status == "ReadyForDischarge" implies (
    medically_fit_approved == true &&
    pending_critical_labs == 0
  )`,
    confusion: '最常见误区：只把规则写在系统 Prompt 里让大模型“自觉遵守”，而不编译成后端确定性拦截器。',
  },
  {
    n: 'L4',
    name: '具体业务实例',
    en: 'Runtime Instance',
    plane: 'ABox · 运行时状态与事件 (System of Record)',
    tag: 'PASS',
    example: 'Encounter-2026-089（心内科三病区 · 302床 · 张某术后第4天）',
    whatItIs: '现实世界中正在发生的具体患者就诊对象。它遵循 L1–L3 的本体契约，但自身是业务运行数据而非本体定义。',
    whereStored: '医院 HIS / EMR / 运营协同平台 PostgreSQL 数据库 (System of Record)',
    code: `{
  "entityType": "hospital.encounter",
  "id": "Encounter-2026-089",
  "patientRef": "Patient-99201",
  "ward": "Cardiology-3F",
  "bedRef": "Bed-302",
  "pathwayType": "StandardInpatient"
}`,
    confusion: '最常见误区：试图把医院每天几十万条医嘱和检验实例全部塞进 OWL 本体推理机，导致性能雪崩。',
  },
  {
    n: 'L5',
    name: '当前运行状态',
    en: 'Runtime State',
    plane: 'ABox · 运行时状态与事件 (System of Record)',
    tag: 'BLOCKED',
    example: 'Encounter-2026-089.pathwayStatus = "DischargeTasksPending" (待出超声报告 1 项，出院带药未核对)',
    whatItIs: '具体业务实例在此刻所处的生命周期节点与实时字段快照，决定当前允许向 Agent 开放哪些候选 Action。',
    whereStored: '业务状态库 + Ontology Context Resolver 运行时快照',
    code: `{
  "encounterId": "Encounter-2026-089",
  "pathwayStatus": "DischargeTasksPending",
  "medicallyFit": true,
  "pendingCriticalLabs": 0,
  "pendingImaging": 1,
  "takeHomeMedsChecked": false
}`,
    confusion: '最常见误区：只保存最后状态覆盖原字段，丢失了“是谁、在哪个模型版本下改变了状态”的完整过程。',
  },
  {
    n: 'L6',
    name: '领域业务事件',
    en: 'Domain Event & Trace',
    plane: 'ABox · 运行时状态与事件 (System of Record)',
    tag: 'PASS',
    example: 'MedicallyFitConfirmed (由王主治医师于 10:15 签发，绑定 Ontology v1.2.0)',
    whatItIs: '记录业务世界中已经发生过的不可变事实序列，是满足卫健委电子病历留痕审计与计算周转时长指标的基础。',
    whereStored: 'Event Log + W3C PROV-O 审计谱系表',
    code: `{
  "eventType": "MedicallyFitConfirmed",
  "entityId": "Encounter-2026-089",
  "actorId": "Physician-Wang-Attending",
  "modelVersion": "1.2.0",
  "occurredAt": "2026-11-06T10:15:00+08:00"
}`,
    confusion: '最常见误区：打一堆无结构的文本日志，没有绑定稳定的 Ontology 对象 ID 和模型版本号，事后无法归因。',
  },
  {
    n: 'L7',
    name: '受控业务动作',
    en: 'Kinetic Action',
    plane: 'TBox · 权威本体 (Canonical Ontology)',
    tag: 'PASS',
    example: 'ConfirmMedicallyFit / ExpeditePendingImaging / ScheduleBedCleaning',
    whatItIs: '连接认知与行动的唯一桥梁（Operational Ontology）：声明谁、在什么前置条件下可以怎样改变业务世界。',
    whereStored: '定义于 Canonical Ontology，执行于 Deterministic Action Executor',
    code: `Action: hospital.action.schedule_bed_cleaning
  input: { encounter: Encounter, bed: Bed }
  requires:
    - encounter.pathwayStatus == "ReadyForDischarge"
    - actor.hasPermission("bed.coordinate")
  effects:
    - bed.cleaningStatus = "Scheduled"
  emits: [BedCleaningScheduled]`,
    confusion: '最常见误区：只做只读 Text-to-SQL（如 Auto-Ontology 默认范围），没有 Action 层，或者让 Agent 直接写 UPDATE SQL。',
  },
  {
    n: 'L8',
    name: '经验与演化知识',
    en: 'Consolidated Knowledge',
    plane: 'Wiki · 经验知识库 (LLM Wiki)',
    tag: 'IDEALIZED',
    example: '《心内科周五下午出院带药拥堵与超声室协同复盘 Wiki》',
    whatItIs: '从 3 个月运行轨迹中由 LLM 综合提炼的排障规律与解释上下文，通过稳定 ID 锚定本体，供 Agent 推理参考。',
    whereStored: 'LLM Wiki (Markdown Graph + 证据引用)，严禁直接充当 L3/L7 执行规则',
    code: `---
title: 心内科出院准备超声与带药延迟复盘
anchors: [hospital.encounter, hospital.discharge_pathway]
status: reviewed-experience
sources: [trace-2026-10-12, retro-cardio-q3]
---
历史观察：周五 14:00 后开立的出院带药核对平均耗时增加 75 分钟。
建议策略：对预计周五出院患者，在 MedicallyFit 预评估阶段提前触发药房预审提醒。`,
    confusion: '最常见误区：让 LLM 总结出的经验 Wiki 自动改写生产系统审批流，未经过 ChangeSet 审查就变成强制规则。',
  },
]

const idx = ref(0)
const filterPlane = ref<string>('ALL')
const filtered = computed(() =>
  filterPlane.value === 'ALL' ? LAYERS : LAYERS.filter((l) => l.plane.startsWith(filterPlane.value)),
)
const cur = computed(() => LAYERS[idx.value])

function selectLayer(layer: LayerItem) {
  idx.value = LAYERS.findIndex((x) => x.n === layer.n)
}
</script>

<template>
  <div class="ole wb-panel vp-raw">
    <div class="wb-panel-head">
      <span>交互解剖台 · 医院患者出院协同的八个认知层次</span>
      <span class="wb-mono">Encounter-2026-089</span>
    </div>
    <div class="wb-panel-body">
      <div class="toolbar">
        <div class="wb-seg" role="group" aria-label="按所属事实源过滤">
          <button type="button" :aria-pressed="filterPlane === 'ALL'" @click="filterPlane = 'ALL'">全部 8 层</button>
          <button type="button" :aria-pressed="filterPlane === 'TBox'" @click="filterPlane = 'TBox'">TBox · 权威本体 (4)</button>
          <button type="button" :aria-pressed="filterPlane === 'ABox'" @click="filterPlane = 'ABox'">ABox · 运行状态与事件 (3)</button>
          <button type="button" :aria-pressed="filterPlane === 'Wiki'" @click="filterPlane = 'Wiki'">Wiki · 经验知识 (1)</button>
        </div>
      </div>

      <div class="grid">
        <div class="stack">
          <button
            v-for="l in filtered"
            :key="l.n"
            type="button"
            class="layer-btn"
            :class="{ active: cur.n === l.n }"
            @click="selectLayer(l)"
          >
            <span class="num wb-mono">{{ l.n }}</span>
            <div class="mid">
              <b>{{ l.name }} <small class="wb-mono">{{ l.en }}</small></b>
              <span>{{ l.example }}</span>
            </div>
            <span class="wb-tag" :class="l.tag">{{ l.plane.split(' ')[0] }}</span>
          </button>
        </div>

        <div class="inspector">
          <div class="head">
            <div>
              <span class="wb-eyebrow">{{ cur.plane }}</span>
              <h4>{{ cur.n }} · {{ cur.name }}（{{ cur.en }}）</h4>
            </div>
            <span class="wb-tag" :class="cur.tag">{{ cur.tag === 'PASS' ? '确定性契约/事实' : cur.tag === 'BLOCKED' ? '动态运行态' : '经验参考' }}</span>
          </div>

          <dl class="meta">
            <div>
              <dt>医院实例</dt>
              <dd>{{ cur.example }}</dd>
            </div>
            <div>
              <dt>本质定义</dt>
              <dd>{{ cur.whatItIs }}</dd>
            </div>
            <div>
              <dt>权威存储</dt>
              <dd class="wb-mono">{{ cur.whereStored }}</dd>
            </div>
            <div>
              <dt>工程误区</dt>
              <dd class="bad">{{ cur.confusion }}</dd>
            </div>
          </dl>

          <div class="wb-term">
            <div class="dim"># {{ cur.n }} {{ cur.name }} 结构化表示示例</div>
            <pre>{{ cur.code }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ole { margin: 22px 0; }
.toolbar { margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
.grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 16px; align-items: start; }
.stack { display: flex; flex-direction: column; gap: 6px; }
.layer-btn { display: grid; grid-template-columns: 34px 1fr auto; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); text-align: left; cursor: pointer; transition: all .2s var(--ease); font-family: var(--font-ui); }
.layer-btn:hover { border-color: var(--line-2); background: var(--surface-2); }
.layer-btn.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); box-shadow: var(--shadow-1); }
.num { font-size: 12px; font-weight: 600; color: var(--accent-ink); }
.mid { min-width: 0; }
.mid b { display: block; font-size: 14px; color: var(--ink); }
.mid b small { font-weight: 400; font-size: 11px; color: var(--faint); margin-left: 4px; }
.mid span { display: block; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.inspector { padding: 16px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.head h4 { margin: 4px 0 0; font-family: var(--font-display); font-size: 20px; color: var(--ink); }
.meta { margin: 12px 0; display: flex; flex-direction: column; gap: 8px; }
.meta > div { display: grid; grid-template-columns: 72px 1fr; gap: 10px; font-size: 13.5px; line-height: 1.65; }
.meta dt { color: var(--faint); font-size: 12.5px; }
.meta dd { margin: 0; color: var(--ink-2); }
.meta dd.bad { color: var(--bad); }
.wb-term pre { margin: 4px 0 0; font-family: var(--font-mono); font-size: 12px; line-height: 1.65; white-space: pre-wrap; color: var(--term-ink); }
@media (max-width: 860px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
