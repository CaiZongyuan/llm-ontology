<script setup lang="ts">
import { computed, ref } from 'vue'
import LabFrame from './LabFrame.vue'

interface Span {
  id: string
  name: string
  state: 'PASS' | 'WARN' | 'FAIL'
  detail: string
}

const crash = ref(false)
const duplicate = ref(false)
const outOfOrder = ref(false)
const naive = ref(false)
const predictStatus = ref('')
const predictApplied = ref('')
const ran = ref(false)
const expanded = ref<string | null>(null)

const deliveries = computed(() => (duplicate.value ? 2 : 1))
const lost = computed(() => naive.value && crash.value)
const applied = computed(() => (naive.value && duplicate.value ? 2 : 1))
const status = computed(() => (applied.value > 1 ? 'double' : 'released'))
const appliedBucket = computed(() => String(Math.min(applied.value, 2)))

const spans = computed<Span[]>(() => {
  const list: Span[] = [
    { id: 'S1', name: 'UI → API', state: 'PASS', detail: 'POST /actions/release-bed · 固定 traceId=tr-6f3a21c0 · 携带稳定 idempotencyKey。' },
    { id: 'S2', name: 'Context Resolver + Guard', state: 'PASS', detail: '解析最小 Ontology Context Package，策略 AST 与租户边界校验通过。' },
    {
      id: 'S3', name: 'DB Transaction', state: 'PASS',
      detail: naive.value
        ? '仅执行 UPDATE bed SET status=RELEASED；没有 Outbox 表，事件只在进程内存里。'
        : 'UPDATE bed SET status=RELEASED 与 INSERT INTO outbox(BedReleased) 在同一个数据库事务中原子提交。',
    },
    {
      id: 'S4', name: 'Process / Relay', state: crash.value ? (naive.value ? 'FAIL' : 'WARN') : 'PASS',
      detail: crash.value
        ? (naive.value
          ? '提交后进程崩溃：内存中的事件随进程消失，数据库已释放床位但下游永远收不到通知。'
          : '提交后进程崩溃：Outbox 中已持久化的事件不受影响，重启后 relay 继续补投。')
        : '进程正常，relay 读取 Outbox 待投记录。',
    },
    {
      id: 'S5', name: 'Outbox Delivery', state: duplicate.value ? 'WARN' : 'PASS',
      detail: duplicate.value
        ? `relay 超时重试，BedReleased 被投递 ${deliveries.value} 次。Outbox 保证「不丢」，不保证「不重」。`
        : 'BedReleased 投递 1 次，Outbox 记录标记为已投递。',
    },
    {
      id: 'S6', name: 'Consumer', state: naive.value && duplicate.value ? 'FAIL' : 'PASS',
      detail: naive.value
        ? '没有幂等键：重复消息被当成两次独立请求，终末消毒排程被创建 2 份，床位状态被重复写入。'
        : '消费端用稳定 idempotencyKey 去重：投递 2 次，业务效果仅应用 1 次。',
    },
  ]
  if (outOfOrder.value) {
    list.push({
      id: 'S7', name: 'Out-of-order Guard',
      state: naive.value ? 'FAIL' : 'PASS',
      detail: naive.value
        ? '过期消息（version=7）后到，没有版本校验，把已 RELEASED 的床位回写成 OCCUPIED。'
        : '过期消息 version=7 小于当前 version=8，状态机前置校验拒绝回写，保留最新状态。',
    })
  }
  return list
})

const assertions = computed(() => [
  { name: '床位最终状态 = RELEASED', pass: status.value === 'released', detail: `实际 ${status.value === 'released' ? 'RELEASED（1 次）' : '被重复写入 2 次'}` },
  { name: '有效状态变更次数 = 1', pass: applied.value === 1, detail: `实际 ${applied.value} 次` },
  { name: '事件不丢失', pass: !lost.value, detail: lost.value ? '崩溃后事件永久丢失' : 'Outbox 持久化 / 正常投递' },
  { name: '重复投递未造成重复执行', pass: !(naive.value && duplicate.value), detail: naive.value && duplicate.value ? '无幂等键，重复执行' : '稳定幂等键去重' },
  { name: '乱序消息未回写旧状态', pass: !(naive.value && outOfOrder.value), detail: outOfOrder.value ? (naive.value ? '无版本校验，被回写' : '版本校验拒绝') : '未注入乱序' },
])

const statusCorrect = computed(() => predictStatus.value === status.value)
const appliedCorrect = computed(() => predictApplied.value === appliedBucket.value)
const canRun = computed(() => predictStatus.value !== '' && predictApplied.value !== '')

function toggle(id: string) {
  expanded.value = expanded.value === id ? null : id
}
function run() {
  if (canRun.value) {
    ran.value = true
    expanded.value = null
  }
}
function reset() {
  crash.value = false
  duplicate.value = false
  outOfOrder.value = false
  naive.value = false
  predictStatus.value = ''
  predictApplied.value = ''
  ran.value = false
  expanded.value = null
}
</script>

<template>
  <LabFrame
    lab-id="LAB-06-04"
    title="可靠性故障注入 · Trace 与幂等"
    note="固定同一笔 bed release 请求，注入提交后崩溃、重复投递与乱序消息。先预测最终状态与有效状态变更次数，再展开每一段 span 看故障发生在哪里。"
    @reset="reset"
  >
    <div class="inject">
      <label><input v-model="crash" type="checkbox" :disabled="ran" @change="ran = false" /><span>提交后进程崩溃</span></label>
      <label><input v-model="duplicate" type="checkbox" :disabled="ran" @change="ran = false" /><span>Outbox relay 重复投递</span></label>
      <label><input v-model="outOfOrder" type="checkbox" :disabled="ran" @change="ran = false" /><span>消息乱序到达</span></label>
      <label class="danger"><input v-model="naive" type="checkbox" :disabled="ran" @change="ran = false" /><span>关闭 Outbox 与幂等（故意失败版）</span></label>
    </div>

    <div class="predicts">
      <fieldset>
        <legend>先预测：床位最终状态</legend>
        <label v-for="o in [{ id: 'released', t: 'RELEASED · 正常释放一次' }, { id: 'double', t: '被重复写入 · 状态变更 2 次' }]" :key="o.id" class="radio">
          <input v-model="predictStatus" type="radio" :value="o.id" :disabled="ran" /><span>{{ o.t }}</span>
        </label>
      </fieldset>
      <fieldset>
        <legend>先预测：有效状态变更次数</legend>
        <label v-for="n in [1, 2]" :key="n" class="radio">
          <input v-model="predictApplied" type="radio" :value="String(n)" :disabled="ran" /><span>{{ n }} 次{{ n === 2 ? '（含重复执行）' : '' }}</span>
        </label>
      </fieldset>
    </div>

    <div class="run-row">
      <button type="button" class="wb-btn wb-btn--primary" :disabled="!canRun || ran" @click="run">
        {{ ran ? '✓ 已运行故障注入' : '▶ 运行并生成 Trace' }}
      </button>
      <span v-if="!canRun" class="hint">请完成两项预测。</span>
    </div>

    <div v-if="ran" class="result">
      <div class="verdict" :class="statusCorrect && appliedCorrect ? 'ok' : 'bad'">
        <span class="wb-tag" :class="statusCorrect && appliedCorrect ? 'PASS' : 'FAIL'">
          {{ statusCorrect && appliedCorrect ? '两项预测都正确' : '预测有偏差' }}
        </span>
        <p>
          实际：床位 <b>{{ status === 'released' ? 'RELEASED' : '被重复写入' }}</b>，有效状态变更 <b>{{ applied }} 次</b>，
          BedReleased 投递 <b>{{ deliveries }} 次</b>{{ lost ? '，且事件永久丢失' : '' }}。
          投递次数与业务效果次数不是同一个数——这正是要分开解释的两件事。
        </p>
      </div>

      <div class="trace">
        <span class="wb-eyebrow">Trace 时间线 · 点击任意 span 展开细节</span>
        <div v-for="s in spans" :key="s.id" class="sp" :class="s.state.toLowerCase()">
          <button type="button" class="sp-top" :aria-expanded="expanded === s.id" @click="toggle(s.id)">
            <b class="wb-mono">{{ s.id }}</b>
            <span class="nm">{{ s.name }}</span>
            <span class="wb-tag" :class="s.state === 'PASS' ? 'PASS' : s.state === 'FAIL' ? 'FAIL' : 'BLOCKED'">{{ s.state }}</span>
            <span class="chev">{{ expanded === s.id ? '−' : '+' }}</span>
          </button>
          <p v-if="expanded === s.id" class="sp-detail">{{ s.detail }}</p>
        </div>
      </div>

      <div class="snap">
        <span class="wb-eyebrow">状态快照与断言（浏览器内确定性计算，不是真实 CI 报告）</span>
        <div class="snapshot wb-term"><span class="dim"># post-run snapshot</span>
<pre>{
  "bed.status": "{{ status === 'released' ? 'RELEASED' : 'RELEASED (written twice)' }}",
  "applied_transitions": {{ applied }},
  "outbox_deliveries": {{ deliveries }},
  "event_lost": {{ lost }},
  "modelRevision": "v1.5"
}</pre>
        </div>
        <div v-for="a in assertions" :key="a.name" class="as" :class="a.pass ? 'ok' : 'bad'">
          <span>{{ a.pass ? '✓' : '✗' }} {{ a.name }}</span><small>{{ a.detail }}</small>
        </div>
      </div>

      <div class="boundary">
        <b>三条不能省略的边界：</b>
        ① 只声明 EXACTLY_ONCE 不构成证明，Outbox 不消除重复投递，仍需稳定幂等键；
        ② 幂等键必须在重试中保持不变，不能每次重生时间戳；
        ③ 补偿不是时光倒流——已经发出的终末消毒排程，不能靠「撤回一条消息」收回。
      </div>
    </div>
  </LabFrame>
</template>

<style scoped>
.inject { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.inject label { display: flex; align-items: center; gap: 8px; padding: 9px 11px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-2); font-size: 12.5px; color: var(--ink-2); cursor: pointer; }
.inject label.danger { border-color: color-mix(in srgb, var(--bad) 40%, var(--line)); color: var(--bad); }
.inject input { accent-color: var(--accent); }
.predicts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
.predicts fieldset { margin: 0; padding: 11px 13px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); }
.predicts legend { padding: 0 6px; font-size: 12px; color: var(--muted); }
.radio { display: flex; align-items: center; gap: 7px; padding: 4px 0; font-size: 12.5px; color: var(--ink-2); cursor: pointer; }
.radio input { accent-color: var(--accent); }
.run-row { display: flex; align-items: center; gap: 12px; margin: 14px 0 4px; }
.hint { margin: 0; font-size: 12px; color: var(--faint); }
.result { margin-top: 16px; display: flex; flex-direction: column; gap: 14px; }
.verdict { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); }
.verdict.ok { border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
.verdict.bad { border-color: color-mix(in srgb, var(--bad) 45%, var(--line)); }
.verdict p { margin: 8px 0 0; font-size: 13.5px; line-height: 1.8; color: var(--ink-2); }
.trace, .snap { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
.sp { margin-top: 8px; border-radius: 8px; border-left: 3px solid var(--line-2); background: var(--surface-2); }
.sp.pass { border-left-color: var(--ok); }
.sp.warn { border-left-color: var(--warn); }
.sp.fail { border-left-color: var(--bad); }
.sp-top { width: 100%; display: flex; align-items: center; gap: 9px; padding: 8px 10px; border: 0; background: transparent; cursor: pointer; text-align: left; font-family: var(--font-ui); }
.sp-top b { font-size: 11px; color: var(--faint); }
.sp-top .nm { flex: 1; font-size: 12.5px; color: var(--ink); }
.sp-top .chev { color: var(--faint); font-family: var(--font-mono); }
.sp-detail { margin: 0; padding: 0 12px 10px 30px; font-size: 12.5px; line-height: 1.7; color: var(--ink-2); }
.snapshot { margin-top: 9px; }
.snapshot pre { margin: 4px 0 0; font-family: var(--font-mono); font-size: 11.5px; line-height: 1.6; white-space: pre-wrap; }
.as { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; border-top: 1px solid var(--line); font-size: 12.5px; }
.as.ok span { color: var(--ok); }
.as.bad span { color: var(--bad); }
.as small { color: var(--faint); font-size: 11.5px; }
.boundary { padding: 12px 14px; border-radius: 10px; border: 1px dashed var(--line-2); background: var(--surface-2); font-size: 13px; line-height: 1.85; color: var(--ink-2); }
@media (max-width: 860px) {
  .inject, .predicts { grid-template-columns: 1fr; }
}
</style>
