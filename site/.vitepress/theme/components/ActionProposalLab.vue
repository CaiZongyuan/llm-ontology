<script setup lang="ts">
import { computed, ref } from 'vue'
import LabFrame from './LabFrame.vue'

type Role = 'Resident' | 'Attending' | 'Chief'
type Encounter = 'Inpatient' | 'DaySurgery'
type Tenant = 'TENANT-DEMO' | 'TENANT-OTHER'
type Approval = 'none' | 'approved' | 'rejected'
type Outcome = 'allow' | 'tenant' | 'approval' | 'idempotency' | 'policy'

interface Gate {
  id: string
  name: string
  state: 'PASS' | 'BLOCK' | 'SKIP'
  why: string
  policy: string
}

const OUTCOMES: { id: Outcome; label: string }[] = [
  { id: 'allow', label: '放行，产生一次真实状态变更' },
  { id: 'tenant', label: '被 G1 租户隔离拦下' },
  { id: 'approval', label: '被 G2 审批门拦下' },
  { id: 'idempotency', label: '被 G3 幂等去重拦下' },
  { id: 'policy', label: '被 G4 策略 AST 拦下' },
]

const role = ref<Role>('Attending')
const encounter = ref<Encounter>('DaySurgery')
const criticalLabs = ref<0 | 2>(0)
const tenant = ref<Tenant>('TENANT-DEMO')
const approval = ref<Approval>('approved')
const repeated = ref(false)
const predict = ref<Outcome | ''>('')
const ran = ref(false)

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(8, '0').slice(0, 8)
}

const idempotencyKey = 'hospital.action.release_bed | Encounter-2026-089 | modelRevision=v1.5'
const traceId = computed(() =>
  `tr-${hash([role.value, encounter.value, criticalLabs.value, tenant.value, approval.value, repeated.value].join('|'))}`,
)

const gates = computed<Gate[]>(() => {
  const list: Gate[] = [
    {
      id: 'G0', name: 'Ontology Context Resolver', state: 'PASS',
      why: '解析出最小 Ontology Context Package，告诉 Agent 当前可用的 Action。能力发现不是授权，这一步永远不能当作「已经被允许」。',
      policy: 'runtime.context.resolve',
    },
  ]
  const push = (id: string, name: string, why: string, policy: string) => {
    list.push({ id, name, state: 'BLOCK', why, policy })
  }
  const blocked = () => list.some((g) => g.state === 'BLOCK')

  if (tenant.value === 'TENANT-OTHER') {
    push('G1', 'Tenant Isolation', '跨租户读取与写入均被隔离层拒绝：主线演示账号无权读取 TENANT-OTHER 的患者数据。负向测试必须同时覆盖读和写。', 'policy.tenant.isolation')
  } else {
    list.push({ id: 'G1', name: 'Tenant Isolation', state: blocked() ? 'SKIP' : 'PASS', why: '请求与资源同属 TENANT-DEMO，租户边界校验通过。', policy: 'policy.tenant.isolation' })
  }

  if (!blocked()) {
    if (approval.value !== 'approved') {
      push('G2', 'Approval Gate', approval.value === 'rejected'
        ? '该动作提案已被审批人驳回，不允许重试绕过；必须重新提交新的 ChangeSet / 提案。'
        : '动作提案尚未获得授权。Agent 只能提议（Proposal），不能自己批准（Execution）。', 'policy.action.approval')
    } else {
      list.push({ id: 'G2', name: 'Approval Gate', state: 'PASS', why: 'decisionId=APR-2026-113 已授权，授权记录绑定 modelRevision=v1.5。', policy: 'policy.action.approval' })
    }
  }

  if (!blocked()) {
    if (repeated.value) {
      push('G3', 'Idempotency Guard', `同一 idempotencyKey 已有一次成功执行记录，去重后不产生第二次状态变更，直接返回首次结果。键中不含时间戳，重试时保持稳定。`, 'runtime.idempotency')
    } else {
      list.push({ id: 'G3', name: 'Idempotency Guard', state: 'PASS', why: '本次 idempotencyKey 首次出现，允许进入策略校验。', policy: 'runtime.idempotency' })
    }
  }

  if (!blocked()) {
    if (criticalLabs.value > 0) {
      push('G4', 'Policy AST / Invariant', `违反不变量 inv.zero_critical_labs：仍有 ${criticalLabs.value} 项未处理检验危急值，严禁释放床位。角色再高也不豁免。`, 'inv.zero_critical_labs')
    } else if (encounter.value === 'Inpatient' && role.value !== 'Chief') {
      push('G4', 'Policy AST / Invariant', `常规住院出院须科主任（Chief）终审签发，当前调用者为 ${role.value}。`, 'policy.discharge.signoff')
    } else if (encounter.value === 'DaySurgery' && role.value === 'Resident') {
      push('G4', 'Policy AST / Invariant', '日间手术绿色通道至少要求主治医师（Attending）权限，住院医调用被拒绝。', 'policy.discharge.signoff')
    } else {
      list.push({ id: 'G4', name: 'Policy AST / Invariant', state: 'PASS', why: '前置条件全部满足：危急值为 0，角色与就诊类型匹配 SignoffPolicy 分支。', policy: 'policy.discharge.signoff' })
    }
  }

  const isBlocked = blocked()
  list.push({
    id: 'G5', name: 'Action Executor', state: isBlocked ? 'SKIP' : 'PASS',
    why: isBlocked
      ? '前置门已拦截，执行器未被调用，业务数据库零写入。'
      : '原子更新 bed.status=RELEASED，写入 PROV-O 事件与 Outbox 记录，绑定本次 traceId。',
    policy: 'runtime.action.executor',
  })
  return list
})

const GATE_TO_OUTCOME: Record<string, Outcome> = {
  G1: 'tenant', G2: 'approval', G3: 'idempotency', G4: 'policy',
}
const firstBlock = computed(() => gates.value.find((g) => g.state === 'BLOCK'))
const actualOutcome = computed<Outcome>(() =>
  firstBlock.value ? GATE_TO_OUTCOME[firstBlock.value.id] : 'allow',
)
const correct = computed(() => predict.value === actualOutcome.value)

function run() {
  if (predict.value !== '') ran.value = true
}
function reset() {
  role.value = 'Attending'
  encounter.value = 'DaySurgery'
  criticalLabs.value = 0
  tenant.value = 'TENANT-DEMO'
  approval.value = 'approved'
  repeated.value = false
  predict.value = ''
  ran.value = false
}
</script>

<template>
  <LabFrame
    lab-id="LAB-06-03"
    title="Agent 动作提案 · 六道守卫判定轨迹"
    note="Agent 在出院看板提议调用 hospital.action.release_bed。调整角色、租户、危急值、审批与重复提交，先预测结果，再运行看它具体被哪一道门拦下。"
    @reset="reset"
  >
    <div class="ctl">
      <label><span>调用者角色</span>
        <select v-model="role" :disabled="ran" @change="ran = false">
          <option value="Resident">Resident · 住院医</option>
          <option value="Attending">Attending · 主治</option>
          <option value="Chief">Chief · 科主任</option>
        </select>
      </label>
      <label><span>就诊类型</span>
        <select v-model="encounter" :disabled="ran" @change="ran = false">
          <option value="DaySurgery">DaySurgery · 日间手术</option>
          <option value="Inpatient">Inpatient · 常规住院</option>
        </select>
      </label>
      <label><span>未处理危急值</span>
        <select v-model.number="criticalLabs" :disabled="ran" @change="ran = false">
          <option :value="0">0 项</option>
          <option :value="2">2 项（未解除）</option>
        </select>
      </label>
      <label><span>租户（负向测试）</span>
        <select v-model="tenant" :disabled="ran" @change="ran = false">
          <option value="TENANT-DEMO">TENANT-DEMO</option>
          <option value="TENANT-OTHER">TENANT-OTHER · 越权</option>
        </select>
      </label>
      <label><span>审批状态</span>
        <select v-model="approval" :disabled="ran" @change="ran = false">
          <option value="approved">已批准</option>
          <option value="none">未提交审批</option>
          <option value="rejected">已驳回</option>
        </select>
      </label>
      <label class="ck"><input v-model="repeated" type="checkbox" :disabled="ran" @change="ran = false" /><span>重复提交同一 idempotencyKey</span></label>
    </div>

    <fieldset class="predict">
      <legend>先预测：这次调用的结果是什么？</legend>
      <label v-for="o in OUTCOMES" :key="o.id" class="radio">
        <input v-model="predict" type="radio" :value="o.id" :disabled="ran" /><span>{{ o.label }}</span>
      </label>
    </fieldset>

    <div class="run-row">
      <button type="button" class="wb-btn wb-btn--primary" :disabled="predict === '' || ran" @click="run">
        {{ ran ? '✓ 已提交动作提案' : '▶ 提交 Action 并展开守卫轨迹' }}
      </button>
      <span v-if="predict === ''" class="hint">请先做出预测，才能提交。</span>
    </div>

    <div v-if="ran" class="result">
      <div class="verdict" :class="correct ? 'ok' : 'bad'">
        <span class="wb-tag" :class="correct ? 'PASS' : 'FAIL'">{{ correct ? '预测正确' : '预测错误' }}</span>
        <p>
          实际结果：<b>{{ OUTCOMES.find((o) => o.id === actualOutcome)?.label }}</b>。
          {{ correct
            ? '注意结论成立的边界：通过只代表这一次参数组合满足全部前置条件，不代表 Agent 获得了通用写权限。'
            : `你预测的是「${OUTCOMES.find((o) => o.id === predict)?.label}」。请沿着下面的轨迹找到第一道 BLOCK；短路之后的执行器根本没有被调用。` }}
        </p>
      </div>

      <div class="trace">
        <span class="wb-eyebrow">逐门判定轨迹 · {{ traceId }} · modelRevision=v1.5</span>
        <div v-for="g in gates" :key="g.id" class="g" :class="g.state.toLowerCase()">
          <div class="g-top">
            <b class="wb-mono">{{ g.id }}</b>
            <strong>{{ g.name }}</strong>
            <span class="wb-tag" :class="g.state === 'PASS' ? 'PASS' : g.state === 'BLOCK' ? 'FAIL' : 'NOT_RUN'">{{ g.state }}</span>
            <code>{{ g.policy }}</code>
          </div>
          <p>{{ g.why }}</p>
        </div>
      </div>

      <div class="kv">
        <div><span>idempotencyKey（正确）</span><code>{{ idempotencyKey }}</code></div>
        <div><span>错误做法</span><code>... | ts=1762684397000</code><small>每次重试都重生时间戳 → 去重失效 → 重复释放床位。</small></div>
        <div><span>最终业务状态</span><code>{{ actualOutcome === 'allow' ? 'bed.status = RELEASED · 1 次状态变更' : 'bed.status 保持 OCCUPIED · 0 次写入' }}</code></div>
      </div>

      <div class="boundary">
        <b>容易被误读的三条边界：</b>
        ① 前端把按钮藏起来不构成授权，后端守卫必须独立再验一次；
        ② Ontology Context Resolver 的上下文裁剪只是能力发现，不是权限判定；
        ③ 审批被驳回后不能靠重试绕过，必须重新提交提案。
      </div>
    </div>
  </LabFrame>
</template>

<style scoped>
.ctl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
.ctl label { display: flex; flex-direction: column; gap: 5px; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-2); font-size: 12px; color: var(--muted); }
.ctl label.ck { flex-direction: row; align-items: center; gap: 8px; color: var(--ink-2); }
.ctl input[type='checkbox'] { accent-color: var(--accent); }
select { padding: 6px 8px; border-radius: 7px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink); font-size: 12.5px; font-family: var(--font-ui); }
.predict { margin: 14px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); }
.predict legend { padding: 0 6px; font-size: 12px; color: var(--muted); }
.radio { display: inline-flex; align-items: center; gap: 6px; margin: 4px 18px 4px 0; font-size: 12.5px; color: var(--ink-2); cursor: pointer; }
.radio input { accent-color: var(--accent); }
.run-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 14px 0 4px; }
.hint { margin: 0; font-size: 12px; color: var(--faint); }
.result { margin-top: 16px; display: flex; flex-direction: column; gap: 14px; }
.verdict { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); }
.verdict.ok { border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
.verdict.bad { border-color: color-mix(in srgb, var(--bad) 45%, var(--line)); }
.verdict p { margin: 8px 0 0; font-size: 13.5px; line-height: 1.8; color: var(--ink-2); }
.trace, .kv { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
.g { margin-top: 9px; padding: 9px 11px; border-radius: 8px; border-left: 3px solid var(--line-2); background: var(--surface-2); }
.g.pass { border-left-color: var(--ok); }
.g.block { border-left-color: var(--bad); }
.g.skip { opacity: .62; }
.g-top { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.g-top b { font-size: 11px; color: var(--faint); }
.g-top strong { font-size: 12.5px; color: var(--ink); }
.g-top code, .kv code { font-family: var(--font-mono); font-size: 11px; color: var(--accent-ink); }
.g p { margin: 6px 0 0; font-size: 12.5px; line-height: 1.7; color: var(--ink-2); }
.kv { display: flex; flex-direction: column; gap: 9px; }
.kv > div { display: grid; grid-template-columns: 150px 1fr; gap: 9px; align-items: baseline; border-top: 1px solid var(--line); padding-top: 9px; }
.kv > div:first-child { border-top: 0; padding-top: 0; }
.kv span { font-size: 12px; color: var(--faint); }
.kv code { word-break: break-all; }
.kv small { grid-column: 2; font-size: 11.5px; color: var(--bad); line-height: 1.6; }
.boundary { padding: 12px 14px; border-radius: 10px; border: 1px dashed var(--line-2); background: var(--surface-2); font-size: 13px; line-height: 1.85; color: var(--ink-2); }
@media (max-width: 860px) {
  .ctl { grid-template-columns: 1fr 1fr; }
  .kv > div { grid-template-columns: 1fr; gap: 3px; }
  .kv small { grid-column: 1; }
}
</style>
