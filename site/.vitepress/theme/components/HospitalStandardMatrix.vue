<script setup lang="ts">
import { computed, ref } from 'vue'

interface StandardItem {
  id: string
  name: string
  category: '数据交换与临床底座' | '科研与元数据治理' | '业务语义与行动层'
  assetType: 'Data Asset (数据资产)' | 'Semantic Asset (语义资产)' | 'Operational Asset (操作资产)'
  solves: string
  roleInHospital: string
  canDriveActions: boolean
  dischargeExample: string
  boundaryWarning: string
}

const STANDARDS: StandardItem[] = [
  {
    id: 'fhir',
    name: 'HL7 FHIR (R4 / R5)',
    category: '数据交换与临床底座',
    assetType: 'Data Asset (数据资产)',
    solves: '异构系统之间如何用统一的资源（Resource）与 REST API 交换医疗数据',
    roleInHospital: '标准 API 与临床数据互操作总线（如 HAPI FHIR Server）',
    canDriveActions: false,
    dischargeExample: '将 HIS 的住院记录与 LIS 的检验报告统一封装为 FHIR `Patient`、`Encounter`、`DiagnosticReport` 资源进行跨系统传输。',
    boundaryWarning: 'FHIR 定义的是数据交换资源格式，不等于本院自定义的床位周转审批规则或 Agent 动作权限契约。',
  },
  {
    id: 'openehr',
    name: 'openEHR (Archetype / Template)',
    category: '数据交换与临床底座',
    assetType: 'Semantic Asset (语义资产)',
    solves: '临床概念如何由医学专家以两层建模（参考模型 + 临床原型）长期、结构化地表达与持久化',
    roleInHospital: '以患者为中心的纵向临床数据仓库（CDR，如 EHRbase）',
    canDriveActions: false,
    dischargeExample: '用 openEHR Archetype 严谨定义《心内科术后出院评估表》中的生命体征与临床评估结构，天然贴近 MPS 的领域元建模思想。',
    boundaryWarning: '擅长临床记录结构化建模与长期保存，但不负责跨行政、后勤、床位调度的实时业务状态机编排。',
  },
  {
    id: 'omop',
    name: 'OHDSI / OMOP CDM v5.5',
    category: '科研与元数据治理',
    assetType: 'Data Asset (数据资产)',
    solves: '多中心、多医院的异构临床数据如何转化为统一分析模型，开展真实世界研究（RWD/RWE）',
    roleInHospital: '科研数据底座与临床队列分析（配合 DataQualityDashboard 校验质量）',
    canDriveActions: false,
    dischargeExample: '将过去 5 年出院患者数据脱敏转换至 OMOP `visit_occurrence` 与 `condition_occurrence`，研究术后感染对住院日的影响。',
    boundaryWarning: 'OMOP 是面向二次科研分析的观察性数据模型，绝对不能用来直接驱动医生开立医嘱或实时放行床位！',
  },
  {
    id: 'openmetadata',
    name: 'OpenMetadata + DCMM 2025',
    category: '科研与元数据治理',
    assetType: 'Data Asset (数据资产)',
    solves: '全院有哪些数据表、责任人是谁、数据血缘怎么流、质量评分是否达标（符合 GB/T 36073-2025）',
    roleInHospital: '全院数据目录、主数据血缘、数据质量监控与合规审计底座',
    canDriveActions: false,
    dischargeExample: '追踪“平均出院准备时长”指标从 HIS 原始表到清洗层再到报表的字段级血缘，监控 `discharge_time` 空值率。',
    boundaryWarning: '元数据目录告诉你“数据在哪里、干不干净”，但它没有可执行的业务状态机、Action 契约与运行时权限守卫。',
  },
  {
    id: 'ontology',
    name: 'Hospital Operational Ontology (NHS FDP 范式)',
    category: '业务语义与行动层',
    assetType: 'Operational Asset (操作资产)',
    solves: '医院当前业务世界里有什么对象、处于什么状态、允许执行什么动作、遵循什么权限与安全守卫',
    roleInHospital: '连接数据底座与 Agent / 医护协同工作台的业务操作系统层（Semantic + Kinetic）',
    canDriveActions: true,
    dischargeExample: '将 `Encounter`、`Bed`、`DischargePathway` 建模为带状态机与 Policy AST 的业务对象，驱动 Agent 安全执行催检与床位消毒调度。',
    boundaryWarning: 'Hospital Ontology 不替代底层 HIS/EMR 或 FHIR/OMOP，而是构建在它们之上、医院自主持有知识产权的业务语义与行动契约层。',
  },
]

const sel = ref('ontology')
const cur = computed(() => STANDARDS.find((s) => s.id === sel.value)!)
</script>

<template>
  <div class="hsm wb-panel vp-raw">
    <div class="wb-panel-head">
      <span>医院数据治理与技术标准边界对比器</span>
      <span class="wb-mono">NHS FDP · FHIR · openEHR · OMOP · DCMM 2025</span>
    </div>
    <div class="wb-panel-body">
      <div class="tabs">
        <button
          v-for="s in STANDARDS"
          :key="s.id"
          type="button"
          class="tab"
          :class="{ on: sel === s.id }"
          @click="sel = s.id"
        >
          <span class="cat wb-mono">{{ s.assetType.split(' ')[0] }}</span>
          <b>{{ s.name }}</b>
        </button>
      </div>

      <div class="card">
        <div class="top">
          <div>
            <span class="wb-eyebrow">{{ cur.category }} · {{ cur.assetType }}</span>
            <h4>{{ cur.name }}</h4>
          </div>
          <span class="wb-tag" :class="cur.canDriveActions ? 'PASS' : 'NOT_RUN'">
            {{ cur.canDriveActions ? '支持 Kinetic Action 执行' : '只读 / 交换 / 分析层' }}
          </span>
        </div>

        <div class="rows">
          <div>
            <span class="k">核心解决的问题</span>
            <p>{{ cur.solves }}</p>
          </div>
          <div>
            <span class="k">在医院架构中的定位</span>
            <p class="wb-mono">{{ cur.roleInHospital }}</p>
          </div>
          <div>
            <span class="k">「患者出院协同」落地角色</span>
            <p>{{ cur.dischargeExample }}</p>
          </div>
          <div class="warn-box">
            <span class="k">架构边界警示（切勿混用）</span>
            <p>{{ cur.boundaryWarning }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hsm { margin: 22px 0; }
.tabs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px; }
.tab { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); cursor: pointer; text-align: left; transition: all .2s var(--ease); font-family: var(--font-ui); }
.tab:hover { border-color: var(--line-2); }
.tab.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); box-shadow: var(--shadow-1); }
.tab .cat { font-size: 10px; color: var(--accent-ink); }
.tab b { font-size: 13px; color: var(--ink); line-height: 1.35; }
.card { padding: 18px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); }
.top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.top h4 { margin: 4px 0 0; font-family: var(--font-display); font-size: 21px; color: var(--ink); }
.rows { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.rows > div { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
.rows .k { display: block; font-family: var(--font-mono); font-size: 11px; color: var(--faint); margin-bottom: 6px; text-transform: uppercase; }
.rows p { margin: 0; font-size: 13.5px; line-height: 1.7; color: var(--ink-2); }
.rows .warn-box { border-color: color-mix(in srgb, var(--warn) 45%, var(--line)); background: color-mix(in srgb, var(--warn) 6%, var(--surface)); }
.rows .warn-box .k { color: var(--warn); }
@media (max-width: 860px) {
  .tabs { grid-template-columns: 1fr 1fr; }
  .rows { grid-template-columns: 1fr; }
}
</style>
