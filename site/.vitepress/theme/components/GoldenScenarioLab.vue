<script setup lang="ts">
import { computed, ref } from 'vue'
import LabFrame from './LabFrame.vue'

type Rev = 'v1' | 'v2'

interface Patient {
  id: string
  type: 'Inpatient' | 'DaySurgery'
  critical: number
  chief: boolean
  note: string
}

// 课程虚构 fixture：4 位患者，固定业务日与模型版本，不复用上次实验状态。
const PATIENTS: Patient[] = [
  { id: 'E-201', type: 'Inpatient', critical: 0, chief: true, note: '常规住院 · 主治 + 科主任双签完成' },
  { id: 'E-202', type: 'DaySurgery', critical: 0, chief: false, note: '日间手术 · 仅主治单签（Claim-09 适用范围）' },
  { id: 'E-203', type: 'Inpatient', critical: 2, chief: true, note: '常规住院 · 2 项检验危急值待处理' },
  { id: 'E-204', type: 'Inpatient', critical: 0, chief: false, note: '常规住院 · 缺科主任终审签发' },
]

// 独立黄金预期：逐格来自课程业务基线的人工核对表，绝不调用下面的被测逻辑。
const EXPECTED: Record<string, { released: number; metric: number; blocked: number }> = {
  'v1|critical|unsigned': { released: 1, metric: 1, blocked: 3 },
  'v1|clear|unsigned': { released: 2, metric: 2, blocked: 2 },
  'v1|critical|signed': { released: 2, metric: 2, blocked: 2 },
  'v1|clear|signed': { released: 3, metric: 3, blocked: 1 },
  'v2|critical|unsigned': { released: 2, metric: 2, blocked: 2 },
  'v2|clear|unsigned': { released: 3, metric: 3, blocked: 1 },
  'v2|critical|signed': { released: 3, metric: 3, blocked: 1 },
  'v2|clear|signed': { released: 4, metric: 4, blocked: 0 },
}

const rev = ref<Rev>('v2')
const criticalCleared = ref(false)
const chiefSigned = ref(false)
const joinFanout = ref(false)
const selfOracle = ref(false)
const predictReleased = ref('')
const predictPass = ref('')
const ran = ref(false)

const key = computed(() =>
  `${rev.value}|${criticalCleared.value ? 'clear' : 'critical'}|${chiefSigned.value ? 'signed' : 'unsigned'}`,
)
const golden = computed(() => EXPECTED[key.value])

// 被测实现：与上面的期望表完全分离。
const rows = computed(() =>
  PATIENTS.map((p) => {
    let ok = true
    let why = '全部前置条件满足，允许 ReleaseBed'
    if (p.critical > 0 && !criticalCleared.value) {
      ok = false
      why = '拦截 · inv.zero_critical_labs（危急值未清零）'
    } else if (p.type === 'Inpatient' && !p.chief && !chiefSigned.value) {
      ok = false
      why = '拦截 · policy.discharge.signoff（缺科主任终审）'
    } else if (p.type === 'DaySurgery' && rev.value === 'v1') {
      ok = false
      why = '拦截 · v1 未发布 Claim-09 日间手术单签分支'
    }
    return { ...p, ok, why }
  }),
)
const released = computed(() => rows.value.filter((r) => r.ok).length)
const blocked = computed(() => 4 - released.value)
// 教学缺陷注入：把检验明细 JOIN 进指标后，同一出院医嘱被重复计数 2 次。
const metric = computed(() => released.value + (joinFanout.value ? 2 : 0))

const expectedReleased = computed(() => (selfOracle.value ? released.value : golden.value.released))
const expectedMetric = computed(() => (selfOracle.value ? metric.value : golden.value.metric))

const assertions = computed(() => [
  { name: '放行床位数 = 独立基线期望', pass: released.value === expectedReleased.value, detail: `实现 ${released.value} / 期望 ${expectedReleased.value}` },
  { name: '指标无明细 JOIN 膨胀', pass: metric.value === expectedMetric.value, detail: `实现 ${metric.value} / 期望 ${expectedMetric.value}` },
  { name: '拦截数 = 4 − 放行', pass: blocked.value === 4 - released.value, detail: `${blocked.value} / ${4 - released.value}` },
  { name: 'trace 绑定 modelRevision', pass: true, detail: `${rev.value} · tr-6f3a21c0（教学断言）` },
  { name: '跨租户读取与越权写入均被拒', pass: true, detail: '复用 LAB-06-03 的负向用例（教学断言）' },
])
const allPass = computed(() => assertions.value.every((a) => a.pass))
const predictedOk = computed(() =>
  Number(predictReleased.value) === released.value && (predictPass.value === 'yes') === allPass.value,
)
const canRun = computed(() => predictReleased.value !== '' && predictPass.value !== '')

function run() {
  if (canRun.value) ran.value = true
}
function reset() {
  rev.value = 'v2'
  criticalCleared.value = false
  chiefSigned.value = false
  joinFanout.value = false
  selfOracle.value = false
  predictReleased.value = ''
  predictPass.value = ''
  ran.value = false
}
</script>

<template>
  <LabFrame
    lab-id="LAB-06-05"
    title="黄金场景 · 独立期望值与自证反例"
    note="同一份 4 位患者的出院协同批次，用浏览器内确定性规则计算，再与课程业务基线里人工核对的独立期望值比对。请先预测放行数和断言结果。"
    @reset="reset"
  >
    <div class="ctl">
      <label><span>模型版本</span>
        <select v-model="rev" :disabled="ran" @change="ran = false">
          <option value="v1">v1 · 仅常规住院双签</option>
          <option value="v2">v2 · 已发布 Claim-09 日间单签分支</option>
        </select>
      </label>
      <label><span>E-203 危急值</span>
        <select v-model="criticalCleared" :disabled="ran" @change="ran = false">
          <option :value="false">2 项未清零</option>
          <option :value="true">已清零</option>
        </select>
      </label>
      <label><span>E-204 科主任终审</span>
        <select v-model="chiefSigned" :disabled="ran" @change="ran = false">
          <option :value="false">缺签</option>
          <option :value="true">已补签</option>
        </select>
      </label>
      <label class="ck"><input v-model="joinFanout" type="checkbox" :disabled="ran" @change="ran = false" /><span>注入明细 JOIN 膨胀</span></label>
      <label class="ck bad"><input v-model="selfOracle" type="checkbox" :disabled="ran" @change="ran = false" /><span>让生成器同时生成实现与测试（故意失败版）</span></label>
    </div>

    <div class="fixture">
      <span class="wb-eyebrow">固定 fixture · hospital-discharge-1.0 · 业务日 2026-11-09</span>
      <div class="plist">
        <div v-for="p in PATIENTS" :key="p.id" class="pc"><b class="wb-mono">{{ p.id }}</b><small>{{ p.note }}</small></div>
      </div>
    </div>

    <div class="predicts">
      <fieldset>
        <legend>先预测：合规放行床位数</legend>
        <label v-for="n in [1, 2, 3, 4]" :key="n" class="radio"><input v-model="predictReleased" type="radio" :value="String(n)" :disabled="ran" /><span>{{ n }} 张</span></label>
      </fieldset>
      <fieldset>
        <legend>先预测：这组断言会全部通过吗？</legend>
        <label class="radio"><input v-model="predictPass" type="radio" value="yes" :disabled="ran" /><span>会全部通过</span></label>
        <label class="radio"><input v-model="predictPass" type="radio" value="no" :disabled="ran" /><span>至少一条失败</span></label>
      </fieldset>
    </div>

    <div class="run-row">
      <button type="button" class="wb-btn wb-btn--primary" :disabled="!canRun || ran" @click="run">
        {{ ran ? '✓ 已运行黄金场景' : '▶ 运行场景并比对独立期望' }}
      </button>
      <span v-if="!canRun" class="hint">请完成两项预测。</span>
    </div>

    <div v-if="ran" class="result">
      <div class="verdict" :class="predictedOk ? 'ok' : 'bad'">
        <span class="wb-tag" :class="predictedOk ? 'PASS' : 'FAIL'">{{ predictedOk ? '预测正确' : '预测有偏差' }}</span>
        <p>
          实现算出放行 <b>{{ released }}</b> 张、拦截 {{ blocked }} 张，指标值 <b>{{ metric }}</b>；
          独立基线期望放行 <b>{{ golden.released }}</b> 张、指标 <b>{{ golden.metric }}</b>。
          断言整体 <b>{{ allPass ? 'PASS' : 'FAIL' }}</b>。
        </p>
      </div>

      <div v-if="selfOracle" class="danger">
        <b>反例正在发生：断言全绿，但业务值是错的。</b>
        因为「期望值」被改成了实现自己的输出，测试与实现共享同一个错误，无论指标膨胀到多少都不会失败。
        黄金预期必须来自独立业务基线并经人工复核，不能由生成器自证。
      </div>
      <div v-else-if="joinFanout" class="danger soft">
        <b>独立期望值抓住了缺陷：</b>把检验明细 JOIN 进「完成出院协同医嘱数」后，同一医嘱被重复计数，
        指标从 {{ golden.metric }} 膨胀到 {{ metric }}。正确做法是修聚合口径，而不是把期望改成 {{ metric }}。
      </div>

      <div class="rows">
        <span class="wb-eyebrow">逐位患者判定轨迹</span>
        <div v-for="r in rows" :key="r.id" class="rr" :class="r.ok ? 'ok' : 'bad'">
          <b class="wb-mono">{{ r.id }}</b>
          <span>{{ r.type }}</span>
          <span class="why">{{ r.why }}</span>
          <span class="wb-tag" :class="r.ok ? 'PASS' : 'BLOCKED'">{{ r.ok ? 'RELEASE' : 'BLOCK' }}</span>
        </div>
      </div>

      <div class="cmp">
        <span class="wb-eyebrow">实现输出 vs 独立 Oracle（注意两者来源分离）</span>
        <table>
          <thead><tr><th>断言</th><th>结果</th><th>依据</th></tr></thead>
          <tbody>
            <tr v-for="a in assertions" :key="a.name" :class="a.pass ? '' : 'fail'">
              <td>{{ a.name }}</td><td>{{ a.pass ? '✓ PASS' : '✗ FAIL' }}</td><td class="wb-mono">{{ a.detail }}</td>
            </tr>
          </tbody>
        </table>
        <p class="hint">本表是浏览器内确定性计算的教学断言，不是真实 CI 报告；未运行 Hono 后端、Playwright 或 Vitest，因此不产生 VERIFIED_EXPERIMENT 证据。</p>
      </div>

      <div class="boundary">
        <b>迁移一下：</b>把模型版本切到 v1、把 E-203 危急值清零、给 E-204 补上终审，放行数和指标会怎么变？
        先按上面的规则自己算，再重置实验验证。如果只改了期望值来让断言变绿，这一步就白做了。
      </div>
    </div>
  </LabFrame>
</template>

<style scoped>
.ctl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
.ctl label { display: flex; flex-direction: column; gap: 5px; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-2); font-size: 12px; color: var(--muted); }
.ctl label.ck { flex-direction: row; align-items: center; gap: 8px; color: var(--ink-2); grid-column: span 1; }
.ctl label.ck.bad { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 40%, var(--line)); }
.ctl input[type='checkbox'] { accent-color: var(--accent); }
select { padding: 6px 8px; border-radius: 7px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink); font-size: 12.5px; font-family: var(--font-ui); }
.fixture { margin-top: 12px; padding: 11px 13px; border: 1px dashed var(--line-2); border-radius: 10px; background: var(--surface-2); }
.plist { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
.pc { display: flex; gap: 8px; align-items: baseline; font-size: 12px; }
.pc b { color: var(--accent-ink); font-size: 11.5px; }
.pc small { color: var(--muted); }
.predicts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.predicts fieldset { margin: 0; padding: 11px 13px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); }
.predicts legend { padding: 0 6px; font-size: 12px; color: var(--muted); }
.radio { display: inline-flex; align-items: center; gap: 6px; margin: 4px 14px 4px 0; font-size: 12.5px; color: var(--ink-2); cursor: pointer; }
.radio input { accent-color: var(--accent); }
.run-row { display: flex; align-items: center; gap: 12px; margin: 14px 0 4px; }
.hint { margin: 8px 0 0; font-size: 12px; color: var(--faint); line-height: 1.65; }
.run-row .hint { margin: 0; }
.result { margin-top: 16px; display: flex; flex-direction: column; gap: 14px; }
.verdict { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); }
.verdict.ok { border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
.verdict.bad { border-color: color-mix(in srgb, var(--bad) 45%, var(--line)); }
.verdict p { margin: 8px 0 0; font-size: 13.5px; line-height: 1.8; color: var(--ink-2); }
.danger { padding: 12px 14px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--bad) 50%, var(--line)); background: color-mix(in srgb, var(--bad) 7%, var(--surface)); font-size: 13px; line-height: 1.8; color: var(--ink-2); }
.danger.soft { border-color: color-mix(in srgb, var(--warn) 50%, var(--line)); background: color-mix(in srgb, var(--warn) 7%, var(--surface)); }
.rows, .cmp { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
.rr { display: grid; grid-template-columns: 58px 90px 1fr 72px; gap: 8px; align-items: center; margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: var(--surface-2); border-left: 3px solid var(--line-2); font-size: 12px; color: var(--muted); }
.rr.ok { border-left-color: var(--ok); }
.rr.bad { border-left-color: var(--warn); }
.rr b { color: var(--faint); font-size: 11px; }
.rr .why { color: var(--ink-2); line-height: 1.6; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
th, td { padding: 7px 8px; text-align: left; border-bottom: 1px solid var(--line); color: var(--ink-2); line-height: 1.6; }
th { color: var(--faint); font-weight: 500; font-size: 11px; }
tr.fail td { color: var(--bad); }
.boundary { padding: 12px 14px; border-radius: 10px; border: 1px dashed var(--line-2); background: var(--surface-2); font-size: 13px; line-height: 1.85; color: var(--ink-2); }
@media (max-width: 860px) {
  .ctl, .predicts, .plist { grid-template-columns: 1fr; }
  .rr { grid-template-columns: 54px 1fr; }
  .rr .why { grid-column: 1 / -1; }
}
</style>
