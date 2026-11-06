<script setup lang="ts">
import { ref } from 'vue'

const stageIdx = ref(0)
const SEMANTICA_STAGES = [
  {
    step: 'Stage 1 · Semantic Network',
    input: '医院《患者出院管理制度》PDF + 临床路径文本',
    output: '实体与关系三元组网络 (Triplets + Source Node Provenance)',
    code: `# semantica.semantic_extract & semantica.kg
triplets = extractor.extract(fragment_id="doc_sop_p5")
# -> ("DischargePathway", "requiresApprovalFrom", "AttendingPhysician")
# -> ("Bed", "triggersProcess", "TerminalDisinfection")`,
  },
  {
    step: 'Stage 2 · YAML Intermediate Schema',
    input: '去重与消歧后的语义网络',
    output: '可读、可审阅的 YAML 领域结构定义',
    code: `classes:
  DischargePathway:
    attributes:
      pathway_status: { type: string, required: true }
    relations:
      approved_by: { target: AttendingPhysician, min_count: 1 }`,
  },
  {
    step: 'Stage 3 · Typed Classes & Properties',
    input: 'YAML Schema',
    output: '强类型 Python/Pydantic 领域类与数据类型绑定',
    code: `class DischargePathway(OntologyEntity):
    pathway_status: Literal["InTreatment", "MedicallyFit", "Discharged"]
    approved_by: Optional[AttendingPhysicianId]`,
  },
  {
    step: 'Stage 4 · Class Hierarchy (TBox)',
    input: 'Typed Classes',
    output: '带继承与分类体系的本体层级 (is-a / subClassOf)',
    code: `ClinicalEncounter
  ├── InpatientEncounter (常规住院就诊)
  └── DaySurgeryEncounter (日间手术就诊 · 适用24h快速出院规则)`,
  },
  {
    step: 'Stage 5 · W3C OWL/TTL & SHACL Shapes',
    input: 'Hierarchy + Constraints',
    output: '标准 Turtle (TTL) 本体与 SHACL 形状校验规则 + PROV-O 溯源图',
    code: `ex:DischargePathwayShape a sh:NodeShape ;
  sh:targetClass ex:DischargePathway ;
  sh:property [
    sh:path ex:approvedBy ;
    sh:minCount 1 ;
    sh:message "常规住院出院必须绑定主治医师审批记录 (PROV-O traced)"
  ] .`,
  },
]

const COMPARE_ROWS = [
  {
    dim: '核心设计定位',
    auto: '面向关系型数据库 Text-to-SQL 的语义发现与治理层',
    sem: '面向可审计 AI 的确定性 Context Graph 与合规溯源底座',
    pal: '企业级数字孪生与业务运营操作系统（Semantic + Kinetic）',
    ours: '证据驱动的领域模型编译器（从杂乱证据编译出可执行 SaaS 与本体）',
  },
  {
    dim: '主要输入源',
    auto: 'PostgreSQL / Snowflake / MySQL 等结构化表 Schema 与采样行',
    sem: '非结构化文档、文本块、数据库记录与 Agent 决策历史',
    pal: '企业全量异构数据源、ERP/HIS、流数据与操作日志',
    ours: 'SOP 文档、访谈录音、异构库表（复用 Auto-Ontology）与运行事件',
  },
  {
    dim: '知识冲突消解',
    auto: '依赖人工在 Web UI 中修订 Term 与认证 SQL Attribute',
    sem: '内置多源事实去重、冲突标记与 W3C PROV-O 证据溯源链',
    pal: '工程团队通过 Pipeline Builder 与 Ontology Manager 治理',
    ours: '显式区分 Evidence Graph 与 Domain Graph，五维消解 + ChangeSet 审批',
  },
  {
    dim: '业务动作执行 (Action)',
    auto: '不支持（MCP 接口为纯只读查询）',
    sem: '记录决策对象（Decision Object）与因果链，无内建 SaaS 状态机执行器',
    pal: '核心能力（Action Type、Functions、动态权限与事务写回）',
    ours: '核心能力（类型化 Policy AST + Action Executor + 前后端/工具同源编译）',
  },
]
</script>

<template>
  <div class="osc wb-panel vp-raw">
    <div class="wb-panel-head">
      <span>Semantica 5 阶段本体生成管线 &amp; 四大方案横向对比</span>
      <span class="wb-mono">semantica-agi/semantica · NVIDIA/auto-ontology · Palantir · llm-ontology</span>
    </div>

    <div class="wb-panel-body">
      <p class="wb-eyebrow">交互演练 · Semantica 5 阶段自动本体构建与 SHACL 校验流水线</p>
      <div class="pipe">
        <button
          v-for="(s, i) in SEMANTICA_STAGES"
          :key="s.step"
          type="button"
          class="p-btn"
          :class="{ on: stageIdx === i }"
          @click="stageIdx = i"
        >
          <span class="wb-mono">0{{ i + 1 }}</span>
          <b>{{ s.step.split(' · ')[1] }}</b>
        </button>
      </div>

      <div class="stage-box">
        <div class="meta">
          <div><span class="k">当前阶段</span><b>{{ SEMANTICA_STAGES[stageIdx].step }}</b></div>
          <div><span class="k">阶段输入</span><p>{{ SEMANTICA_STAGES[stageIdx].input }}</p></div>
          <div><span class="k">阶段产出</span><p>{{ SEMANTICA_STAGES[stageIdx].output }}</p></div>
        </div>
        <div class="wb-term">
          <pre>{{ SEMANTICA_STAGES[stageIdx].code }}</pre>
        </div>
      </div>

      <p class="wb-eyebrow" style="margin-top: 22px">四大体系核心能力边界矩阵</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>对比维度</th>
              <th>NVIDIA Auto-Ontology</th>
              <th>Semantica</th>
              <th>Palantir Ontology</th>
              <th class="hi">本项目 llm-ontology</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in COMPARE_ROWS" :key="r.dim">
              <td><b>{{ r.dim }}</b></td>
              <td>{{ r.auto }}</td>
              <td>{{ r.sem }}</td>
              <td>{{ r.pal }}</td>
              <td class="hi">{{ r.ours }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.osc { margin: 22px 0; }
.pipe { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 10px 0 14px; }
.p-btn { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); cursor: pointer; text-align: left; font-family: var(--font-ui); transition: all .2s var(--ease); }
.p-btn span { font-size: 11px; color: var(--accent-ink); }
.p-btn b { font-size: 13px; color: var(--ink); line-height: 1.3; }
.p-btn.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, var(--surface)); box-shadow: var(--shadow-1); }
.stage-box { display: grid; grid-template-columns: 1fr 1.2fr; gap: 14px; padding: 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); align-items: start; }
.meta { display: flex; flex-direction: column; gap: 10px; }
.meta .k { display: block; font-family: var(--font-mono); font-size: 11px; color: var(--faint); }
.meta b { font-size: 15px; color: var(--ink); }
.meta p { margin: 2px 0 0; font-size: 13.5px; color: var(--ink-2); line-height: 1.6; }
.wb-term pre { margin: 0; font-family: var(--font-mono); font-size: 12px; line-height: 1.65; white-space: pre-wrap; }
.table-wrap { margin-top: 10px; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 10px 12px; border: 1px solid var(--line); text-align: left; vertical-align: top; line-height: 1.6; }
th { background: var(--surface-2); color: var(--ink); font-weight: 600; }
th.hi, td.hi { background: color-mix(in srgb, var(--accent) 7%, var(--surface)); border-color: color-mix(in srgb, var(--accent) 35%, var(--line)); }
@media (max-width: 860px) {
  .pipe { grid-template-columns: 1fr 1fr; }
  .stage-box { grid-template-columns: 1fr; }
}
</style>
