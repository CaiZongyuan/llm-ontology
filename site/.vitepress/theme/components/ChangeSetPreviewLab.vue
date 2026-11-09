<script setup lang="ts">
import { computed, ref } from 'vue'
import LabFrame from './LabFrame.vue'

type ChangeKind = 'rename' | 'add_branch' | 'edit_condition'
type Path = 'direct' | 'changeset'

const KINDS: { id: ChangeKind; label: string; detail: string }[] = [
  { id: 'rename', label: '改显示名', detail: 'DischargePathway 的中文显示名「出院准备路径」→「离院协同路径」' },
  { id: 'add_branch', label: '追加策略分支', detail: '把 Claim-09（日间手术主治单签）并入 SignoffPolicy AST' },
  { id: 'edit_condition', label: '修改策略条件', detail: '把 ConfirmMedicallyFit 的前置条件由 2 项改为 3 项' },
]

const ARTIFACTS = [
  { id: 'guard', label: 'policy-guards.ts', hint: '后端确定性守卫' },
  { id: 'board', label: 'discharge-board.vue', hint: '出院看板投影' },
  { id: 'test', label: 'contract.test.ts', hint: '策略回归契约测试' },
  { id: 'mcp', label: 'mcp-tools.json', hint: 'Agent 工具契约' },
  { id: 'history', label: '历史出院事件', hint: '已发布实例的版本快照' },
  { id: 'all', label: '全院 28 个产物', hint: '全量重编译' },
]

// 课程业务基线：Build Manifest 依赖图的确定性结果，不由界面参数随意生成。
const IMPACT: Record<ChangeKind, string[]> = {
  rename: ['board'],
  add_branch: ['guard', 'board', 'test'],
  edit_condition: ['guard', 'board', 'test', 'mcp'],
}

const WHY: Record<string, string> = {
  guard: '策略 AST 生成后端守卫；分支或条件变化必须重算。',
  board: '显示名与可用动作变化都会更新 UI 投影。',
  test: '契约测试由策略 AST 生成，策略语义变化必须同步重生成。',
  mcp: 'Agent 工具契约绑定动作前置条件，条件变化需同步更新。',
  history: '历史实例保存「当时的模型版本 + 业务快照」，不因新版本回溯重写。',
  all: '增量编译按依赖图裁剪；稳定节点 ID 未变时其余产物复用缓存 Hash。',
}

const COMPARE = [
  { k: '依赖图 / Build Manifest', direct: '没有，只能靠人肉猜测改动面', cs: '沿稳定节点 ID 精确裁剪受影响产物' },
  { k: '审批与发布', direct: '热更新即生效，无审批记录', cs: 'Review + 授权后生成新 modelRevision' },
  { k: '可审计 Diff', direct: '无结构化 Diff', cs: 'ChangeSet 绑定 derivedFromClaims 与逐节点 diff' },
  { k: '历史出院实例', direct: '被新规则追溯重判，看板与守卫口径分叉', cs: '保留旧 modelRevision 快照，零回溯' },
  { k: '回滚', direct: '覆盖回去，旧版本不可考', cs: '按版本回退，变更账本完整保留' },
  { k: '发布门禁判定', direct: 'BLOCKED · 拒绝上线', cs: 'PASS · 允许发布' },
]

const kind = ref<ChangeKind>('add_branch')
const path = ref<Path>('changeset')
const predicted = ref<string[]>([])
const predictedApproval = ref<'yes' | 'no' | ''>('')
const ran = ref(false)

const cur = computed(() => KINDS.find((k) => k.id === kind.value)!)
const actual = computed(() => IMPACT[kind.value])
const needApproval = computed(() => kind.value !== 'rename')
const missing = computed(() => actual.value.filter((id) => !predicted.value.includes(id)))
const extra = computed(() => predicted.value.filter((id) => !actual.value.includes(id)))
const exact = computed(() => missing.value.length === 0 && extra.value.length === 0)
const approvalCorrect = computed(() => (predictedApproval.value === 'yes') === needApproval.value)
const canRun = computed(() => predicted.value.length > 0 && predictedApproval.value !== '')
const verdictOk = computed(() => exact.value && approvalCorrect.value)

function toggle(id: string) {
  if (ran.value) return
  predicted.value = predicted.value.includes(id)
    ? predicted.value.filter((x) => x !== id)
    : [...predicted.value, id]
}
function run() {
  if (canRun.value) ran.value = true
}
function reset() {
  kind.value = 'add_branch'
  path.value = 'changeset'
  predicted.value = []
  predictedApproval.value = ''
  ran.value = false
}
</script>

<template>
  <LabFrame
    lab-id="LAB-06-01"
    title="Model ChangeSet 编译预览 · 影响范围预测"
    note="同一条业务变更，走「直接改配置」和「提交 ChangeSet」两条路径。运行前先勾选你预测会受影响的产物，并判断是否需要人工审批。"
    @reset="reset"
  >
    <div class="ctl">
      <label>
        <span>① 选择变更类型</span>
        <select v-model="kind" :disabled="ran" @change="ran = false">
          <option v-for="k in KINDS" :key="k.id" :value="k.id">{{ k.label }}</option>
        </select>
      </label>
      <label>
        <span>② 选择发布路径</span>
        <select v-model="path" :disabled="ran" @change="ran = false">
          <option value="changeset">提交 Model ChangeSet（受控路径）</option>
          <option value="direct">直接热改 discharge-policy.yaml（故意失败）</option>
        </select>
      </label>
    </div>
    <p class="case">{{ cur.detail }}</p>

    <div class="two">
      <fieldset class="pred">
        <legend>③ 先预测：哪些产物会被重编译？</legend>
        <label v-for="a in ARTIFACTS" :key="a.id" class="chk">
          <input type="checkbox" :checked="predicted.includes(a.id)" :disabled="ran" @change="toggle(a.id)" />
          <span><b class="wb-mono">{{ a.label }}</b><small>{{ a.hint }}</small></span>
        </label>
        <p class="hint">可多选。选完再运行，答案不会提前显示。</p>
      </fieldset>

      <fieldset class="pred">
        <legend>④ 先预测：这次变更需要人工审批吗？</legend>
        <label class="radio"><input v-model="predictedApproval" type="radio" value="yes" :disabled="ran" /><span>需要审批后发布</span></label>
        <label class="radio"><input v-model="predictedApproval" type="radio" value="no" :disabled="ran" /><span>无需审批，编译通过即生效</span></label>
        <div class="fixture">
          <span class="wb-eyebrow">固定 fixture · 不复用上次实验状态</span>
          <p>canon = hospital-discharge-1.0 · 基线 v1.4 · 28 个已发布产物 · 历史事件 Encounter-2026-089 保留 v1.3 快照</p>
        </div>
      </fieldset>
    </div>

    <div class="run-row">
      <button type="button" class="wb-btn wb-btn--primary" :disabled="!canRun || ran" @click="run">
        {{ ran ? '✓ 已运行编译预览' : '▶ 运行编译预览' }}
      </button>
      <span v-if="!canRun" class="hint">请先完成两项预测，运行按钮才会解锁。</span>
      <span v-else-if="!ran" class="hint">预测已锁定；点击后不可再改，可用右上角重置。</span>
    </div>

    <div v-if="ran" class="result">
      <div class="verdict" :class="verdictOk ? 'ok' : 'bad'">
        <span class="wb-tag" :class="verdictOk ? 'PASS' : 'FAIL'">{{ verdictOk ? '预测完全正确' : '预测有偏差' }}</span>
        <p v-if="verdictOk">你同时答对了影响集合与审批门。关键点：历史出院事件从不进入重编译清单，增量编译也不会全量重建 28 个产物。</p>
        <p v-else>
          影响集合{{ exact ? '正确' : `漏选 ${missing.length} 项、多选 ${extra.length} 项` }}；审批判断{{ approvalCorrect ? '正确' : '错误' }}。
          请逐行看下面的解释——错误答案比绿色对勾更有信息量。
        </p>
      </div>

      <div class="impact">
        <span class="wb-eyebrow">Build Manifest 实际计算出的影响集合（{{ actual.length }} 项）</span>
        <table>
          <thead><tr><th>产物</th><th>你的预测</th><th>实际</th><th>为什么</th></tr></thead>
          <tbody>
            <tr v-for="a in ARTIFACTS" :key="a.id" :class="{ hit: actual.includes(a.id) }">
              <td class="wb-mono">{{ a.label }}</td>
              <td>{{ predicted.includes(a.id) ? '✓ 受影响' : '— 未选' }}</td>
              <td>{{ actual.includes(a.id) ? '↻ 重编译' : '✓ 缓存复用' }}</td>
              <td>{{ WHY[a.id] }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="compare">
        <span class="wb-eyebrow">同数据前后对照 · 两条路径的发布结果</span>
        <table>
          <thead><tr><th>维度</th><th :class="{ on: path === 'direct' }">直接热改配置</th><th :class="{ on: path === 'changeset' }">提交 ChangeSet</th></tr></thead>
          <tbody>
            <tr v-for="c in COMPARE" :key="c.k">
              <td>{{ c.k }}</td>
              <td :class="{ on: path === 'direct', bad: c.k === '发布门禁判定' }">{{ c.direct }}</td>
              <td :class="{ on: path === 'changeset', good: c.k === '发布门禁判定' }">{{ c.cs }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="path === 'direct'" class="alert">
        <b>失败轨迹（可观察）：</b>写入 YAML → 热更新运行时 → 历史出院事件被新规则追溯重判 → 看板仍读旧快照 → 前后端口径分叉 → 无审批记录、无 derivedFromClaims、无法回滚到可考版本。
        <p>注意：你上面预测的是依赖图算出的正确影响集合；而直接改配置这条路，连这张影响清单都拿不到。发布门禁在此拦截，不是「编译慢一点」的问题。</p>
      </div>
      <div v-else class="pass-note">
        生成的 Model ChangeSet：derivedFromClaims = ["Claim-09"] · modelRevision v1.4 → v1.5 · 历史事件仍指向 v1.3 快照。
        审批与类型检查通过后才允许发布；未发布的 ChangeSet 不影响任何运行中的实例。
      </div>
    </div>
  </LabFrame>
</template>

<style scoped>
.ctl { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.ctl label, .pred { border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); }
.ctl label { padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
.ctl label > span, .pred legend { font-size: 12px; color: var(--muted); font-weight: 500; }
select { padding: 7px 9px; border-radius: 7px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink); font-size: 13px; font-family: var(--font-ui); }
.case { margin: 0 0 12px; font-size: 13px; color: var(--ink-2); line-height: 1.7; }
.two { display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; }
.pred { margin: 0; padding: 12px 14px; }
.pred legend { padding: 0 6px; }
.chk, .radio { display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; font-size: 13px; color: var(--ink-2); cursor: pointer; }
.chk input, .radio input { margin-top: 3px; accent-color: var(--accent); }
.chk span { display: flex; flex-direction: column; }
.chk b { font-size: 12.5px; color: var(--ink); font-weight: 500; }
.chk small { font-size: 11.5px; color: var(--faint); }
.hint { margin: 8px 0 0; font-size: 12px; color: var(--faint); line-height: 1.6; }
.fixture { margin-top: 12px; padding: 10px; border-radius: 8px; background: var(--surface); border: 1px dashed var(--line-2); }
.fixture p { margin: 6px 0 0; font-size: 12px; line-height: 1.65; color: var(--muted); }
.run-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 14px 0 4px; }
.run-row .hint { margin: 0; }
.result { margin-top: 16px; display: flex; flex-direction: column; gap: 14px; }
.verdict { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); }
.verdict.ok { border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
.verdict.bad { border-color: color-mix(in srgb, var(--warn) 55%, var(--line)); }
.verdict p { margin: 8px 0 0; font-size: 13.5px; line-height: 1.75; color: var(--ink-2); }
table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12.5px; }
th, td { padding: 7px 9px; text-align: left; border-bottom: 1px solid var(--line); color: var(--ink-2); line-height: 1.6; vertical-align: top; }
th { color: var(--faint); font-weight: 500; font-size: 11.5px; }
tr.hit td:first-child { color: var(--accent-ink); }
td.on { background: color-mix(in srgb, var(--accent) 8%, transparent); }
td.good { color: var(--ok); }
td.bad { color: var(--bad); }
.impact, .compare { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
.alert { padding: 12px 14px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--bad) 45%, var(--line)); background: color-mix(in srgb, var(--bad) 6%, var(--surface)); font-size: 13px; line-height: 1.75; color: var(--ink-2); }
.alert p { margin: 8px 0 0; }
.pass-note { padding: 12px 14px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--ok) 45%, var(--line)); background: color-mix(in srgb, var(--ok) 6%, var(--surface)); font-size: 13px; line-height: 1.75; color: var(--ink-2); }
@media (max-width: 860px) {
  .ctl, .two { grid-template-columns: 1fr; }
  table { font-size: 11.5px; }
}
</style>
