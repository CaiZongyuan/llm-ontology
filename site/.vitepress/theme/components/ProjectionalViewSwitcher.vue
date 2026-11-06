<script setup lang="ts">
import { computed, ref } from 'vue'

const view = ref<'clinical' | 'engineer' | 'agent'>('clinical')

// Shared underlying AST state (Single Source of Truth)
const displayName = ref('患者出院协同路径')
const allowDaySurgerySingleSign = ref(true)
const maxPendingCriticalLabs = ref(0)
const preAuditHours = ref(24)

const astJson = computed(() =>
  JSON.stringify(
    {
      id: 'hospital.discharge_pathway',
      kind: 'EntityType',
      displayName: displayName.value,
      invariants: [
        {
          id: 'inv.zero_critical_labs',
          expr: `pending_critical_labs <= ${maxPendingCriticalLabs.value}`,
        },
      ],
      approvalPolicy: {
        id: 'policy.discharge.signoff',
        inpatient: 'AttendingPhysician && DepartmentChief',
        daySurgery: allowDaySurgerySingleSign.value ? 'AttendingPhysician (SingleSign)' : 'AttendingPhysician && DepartmentChief',
      },
      pharmacyPreAuditLeadHours: preAuditHours.value,
    },
    null,
    2,
  ),
)
</script>

<template>
  <div class="pvs wb-panel vp-raw">
    <div class="wb-panel-head">
      <span>JetBrains MPS 投影式编辑沙盒 · 同一底层 AST 的三种角色视图</span>
      <span class="wb-mono">Stable ID: hospital.discharge_pathway</span>
    </div>

    <div class="wb-panel-body">
      <div class="editor-bar">
        <div class="e-title">
          <span class="wb-eyebrow">修改底层结构化模型（观察三种投影视图实时同步联动）</span>
        </div>
        <div class="e-controls">
          <label>
            <span>概念显示名称（不改变稳定 ID）：</span>
            <input v-model="displayName" type="text" class="inp" />
          </label>
          <label class="chk">
            <input v-model="allowDaySurgerySingleSign" type="checkbox" />
            <span>启用「日间手术主治医师单签放行」例外规则</span>
          </label>
          <label>
            <span>允许未处理危急值上限：</span>
            <select v-model.number="maxPendingCriticalLabs" class="inp">
              <option :value="0">0 项（严格清零）</option>
              <option :value="1">1 项（允许复查中）</option>
            </select>
          </label>
          <label>
            <span>出院带药前置预审提前量：</span>
            <select v-model.number="preAuditHours" class="inp">
              <option :value="24">提前 24 小时</option>
              <option :value="12">提前 12 小时</option>
            </select>
          </label>
        </div>
      </div>

      <div class="switcher">
        <div class="wb-seg">
          <button type="button" :aria-pressed="view === 'clinical'" @click="view = 'clinical'">
            投影 ① · 医务科与床位协调员视图
          </button>
          <button type="button" :aria-pressed="view === 'engineer'" @click="view = 'engineer'">
            投影 ② · 数据治理与系统建模师视图
          </button>
          <button type="button" :aria-pressed="view === 'agent'" @click="view = 'agent'">
            投影 ③ · 出院协同 AI Agent 视图
          </button>
        </div>
        <span class="wb-tag PASS">1 份 AST 模型 · 3 种零漂移投影</span>
      </div>

      <div class="proj-grid">
        <!-- Left: Active Projection -->
        <div class="proj-card">
          <template v-if="view === 'clinical'">
            <span class="wb-eyebrow">CLINICAL &amp; OPERATIONS PROJECTION · 面向医护与管理层</span>
            <h4>《{{ displayName }}》业务规则卡（无需阅读代码或 JSON）</h4>
            <ul class="rule-cards">
              <li>
                <b>1. 出院临床签字要求</b>
                <p>
                  常规住院患者须经 <strong>主治医师 + 科主任双签</strong>；
                  <span :class="allowDaySurgerySingleSign ? 'ok' : 'warn'">
                    {{ allowDaySurgerySingleSign ? '日间手术患者适用绿色通道，允许主治医师单签放行。' : '日间手术患者同样执行主治 + 科主任双签。' }}
                  </span>
                </p>
              </li>
              <li>
                <b>2. 检验危急值安全红线</b>
                <p>
                  患者名下待处理检验/影像危急值必须 <strong>≤ {{ maxPendingCriticalLabs }} 项</strong>，否则系统自动锁定床位释放按钮。
                </p>
              </li>
              <li>
                <b>3. 药房出院带药协同</b>
                <p>系统在预计出院前 <strong>{{ preAuditHours }} 小时</strong> 自动向中心药房推送带药预审单。</p>
              </li>
            </ul>
          </template>

          <template v-else-if="view === 'engineer'">
            <span class="wb-eyebrow">DATA GOVERNANCE &amp; SCHEMA PROJECTION · 面向建模与数据工程师</span>
            <h4>Typed Domain Schema &amp; 跨库字段映射（`{{ displayName }}`）</h4>
            <div class="wb-term">
              <pre>entity hospital.discharge_pathway ({{ displayName }}) {
  identity: pathway_id -> HIS.t_discharge_path.id
  links:
    encounter: hospital.encounter (1:1, FK: visit_no = inp_id)
  invariants:
    inv_critical_labs: self.pending_critical_labs &lt;= {{ maxPendingCriticalLabs }}
  policies:
    signoff_mode: {{ allowDaySurgerySingleSign ? 'Scoped(Inpatient=DualSign, DaySurgery=SingleSign)' : 'StrictDualSignAll' }}
    pre_audit_window: Duration.hours({{ preAuditHours }})
}</pre>
            </div>
          </template>

          <template v-else>
            <span class="wb-eyebrow">AGENT TOOL CONTRACT PROJECTION · 面向 AI Agent Harness</span>
            <h4>MCP Tool &amp; Action Preconditions（供 Agent 推理与守卫调用）</h4>
            <div class="wb-term">
              <pre>{
  "tool": "hospital_confirm_discharge_ready",
  "targetEntity": "hospital.discharge_pathway",
  "targetLabel": "{{ displayName }}",
  "preconditions": [
    "encounter.pending_critical_labs &lt;= {{ maxPendingCriticalLabs }}",
    "{{ allowDaySurgerySingleSign ? '(encounter.type == DaySurgery && actor.role >= Attending) || (actor.role == Chief)' : 'actor.role == Chief && encounter.attending_signed == true' }}"
  ],
  "sideEffects": [
    "SchedulePharmacyPreAudit(leadHours={{ preAuditHours }})",
    "EmitEvent(DischargeReadyConfirmed)"
  ]
}</pre>
            </div>
          </template>
        </div>

        <!-- Right: Canonical AST -->
        <div class="ast-card">
          <span class="wb-eyebrow">底层持久化的唯一结构化 AST (Canonical Model Node)</span>
          <div class="wb-term">
            <pre>{{ astJson }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pvs { margin: 22px 0; }
.editor-bar { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); margin-bottom: 14px; }
.e-controls { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 14px; align-items: center; font-size: 13px; color: var(--ink-2); }
.e-controls label { display: inline-flex; align-items: center; gap: 6px; }
.inp { padding: 4px 8px; border-radius: 6px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink); font-size: 12.5px; font-family: var(--font-ui); }
.switcher { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.proj-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 14px; align-items: start; }
.proj-card, .ast-card { padding: 16px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); }
.proj-card h4 { margin: 6px 0 12px; font-family: var(--font-display); font-size: 18px; color: var(--ink); }
.rule-cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.rule-cards li { padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface-2); }
.rule-cards b { display: block; font-size: 13.5px; color: var(--ink); margin-bottom: 4px; }
.rule-cards p { margin: 0; font-size: 13px; line-height: 1.65; color: var(--ink-2); }
.rule-cards .ok { color: var(--ok); font-weight: 500; }
.rule-cards .warn { color: var(--warn); font-weight: 500; }
.wb-term pre { margin: 0; font-family: var(--font-mono); font-size: 11.5px; line-height: 1.6; white-space: pre-wrap; }
@media (max-width: 860px) {
  .proj-grid { grid-template-columns: 1fr; }
}
</style>
