<script setup lang="ts">
import { computed, ref } from 'vue'
import LabFrame from './LabFrame.vue'

type Tag = 'SOURCE_NORMATIVE' | 'SOURCE_CLAIM' | 'COURSE_DESIGN' | 'VERIFIED_EXPERIMENT'

const TAGS: { id: Tag; label: string; hint: string }[] = [
  { id: 'SOURCE_NORMATIVE', label: 'SOURCE_NORMATIVE', hint: '原资料规范 / 外部标准 / 项目正式决策' },
  { id: 'SOURCE_CLAIM', label: 'SOURCE_CLAIM', hint: '官方产品能力或作者观点，不是实测结论' },
  { id: 'COURSE_DESIGN', label: 'COURSE_DESIGN', hint: '本课程提出的架构、规则与教学设计' },
  { id: 'VERIFIED_EXPERIMENT', label: 'VERIFIED_EXPERIMENT', hint: '附版本、命令、退出码、日志的真实复现' },
]

const ITEMS: { id: string; text: string; answer: Tag; why: string }[] = [
  {
    id: 'S1',
    text: '《日间手术中心快速周转绿色通道补充规定（2026 版）》第 4 条：符合 24 小时出院标准者，授权主治医师单签确认 MedicallyFit。',
    answer: 'SOURCE_NORMATIVE',
    why: '原始资料中的规范性条款。必须保留版本、条款号与适用范围（Scope），不能静默改写成课程的规则表述。',
  },
  {
    id: 'S2',
    text: 'W3C PROV-O 用 wasDerivedFrom 表达实体之间的派生关系。',
    answer: 'SOURCE_NORMATIVE',
    why: '外部标准的规范性定义。引用须写明标准与谓词，不能用课程自定义 IR 的名称替换它，也不能与 ADR-0001 混为一谈。',
  },
  {
    id: 'S3',
    text: 'ADR-0001 要求任何业务语义修改都必须走 Fragment → Claim → Model ChangeSet → Type Check & Review → Release。',
    answer: 'SOURCE_NORMATIVE',
    why: '本项目冻结的架构决策，对全书章节有约束力，属于项目内部正式规范，不是某个作者的建议。',
  },
  {
    id: 'S4',
    text: 'NVIDIA Auto-Ontology 文档称 Answerability Coverage = 1.0 表示提问中识别的查询实体都检索到了候选属性。',
    answer: 'SOURCE_CLAIM',
    why: '官方对自家产品能力的说明。要准确转述并限定范围，不能自动升级为「已在真实 HIS 上验证」的实测结论。',
  },
  {
    id: 'S5',
    text: '本分组把「读者先预测、再点击运行、并解释为什么对 / 错」设为每个实验台的必需步骤。',
    answer: 'COURSE_DESIGN',
    why: '课程采用的教学设计与统一组件契约，不是任何外部标准，也不是原始附件的规定。',
  },
  {
    id: 'S6',
    text: '本页实验台由浏览器执行确定性纯逻辑，展示课程虚构的出院协同 fixture，不连接真实 HIS。',
    answer: 'COURSE_DESIGN',
    why: '课程设计 + 执行标签声明。若把它改写成「已在真实 HIS 跑通，退出码 0」却拿不出命令与日志，就构成假证据，属于发布阻断项。',
  },
]

const MODES = [
  { id: 'READ_ONLY', desc: '代码或模型阅读，不发生执行', here: '未使用' },
  { id: 'SIMULATED', desc: '教学模拟，展示明确的模型规则，不访问真实服务', here: '是 · 业务语义' },
  { id: 'BROWSER_EXECUTABLE', desc: '浏览器实际执行纯逻辑 / 校验', here: '是 · 计算过程' },
  { id: 'LOCAL_EXECUTABLE', desc: '需按文档启动本地服务或 MPS', here: '未提供' },
  { id: 'EXTERNAL_SERVICE', desc: '需外部账号、模型、密钥或费用', here: '未提供' },
]

const emptyPicks = (): Record<string, Tag | ''> =>
  ITEMS.reduce((acc, i) => {
    acc[i.id] = ''
    return acc
  }, {} as Record<string, Tag | ''>)

const picks = ref<Record<string, Tag | ''>>(emptyPicks())
const predictedVerified = ref('')
const ran = ref(false)

const verifiedCount = ITEMS.filter((i) => i.answer === 'VERIFIED_EXPERIMENT').length
const correctCount = computed(() => ITEMS.filter((i) => picks.value[i.id] === i.answer).length)
const canRun = computed(
  () => ITEMS.every((i) => picks.value[i.id] !== '') && predictedVerified.value !== '',
)
const predictedOk = computed(() => Number(predictedVerified.value) === verifiedCount)

function run() {
  if (canRun.value) ran.value = true
}
function reset() {
  picks.value = emptyPicks()
  predictedVerified.value = ''
  ran.value = false
}
</script>

<template>
  <LabFrame
    lab-id="LAB-06-02"
    title="来源四类标记与执行标签 · 分类判定"
    note="把 6 条论断分别归到正确的记录类型，并先预测其中有几条能诚实标成 VERIFIED_EXPERIMENT。这是发布门禁最常被违反的一条。"
    @reset="reset"
  >
    <div class="legend">
      <div v-for="t in TAGS" :key="t.id" class="lg">
        <b class="wb-mono">{{ t.label }}</b><small>{{ t.hint }}</small>
      </div>
    </div>

    <div class="rows">
      <div v-for="(it, idx) in ITEMS" :key="it.id" class="row">
        <div class="num wb-mono">{{ it.id }}</div>
        <p class="txt">{{ idx + 1 }}. {{ it.text }}</p>
        <select v-model="picks[it.id]" :disabled="ran" :aria-label="`为论断 ${it.id} 选择记录类型`">
          <option value="">选择标记…</option>
          <option v-for="t in TAGS" :key="t.id" :value="t.id">{{ t.label }}</option>
        </select>
      </div>
    </div>

    <fieldset class="predict">
      <legend>先预测：这 6 条里，有几条能诚实标成 VERIFIED_EXPERIMENT？</legend>
      <label v-for="n in [0, 1, 2, 3]" :key="n" class="radio">
        <input v-model="predictedVerified" type="radio" :value="String(n)" :disabled="ran" />
        <span>{{ n }} 条{{ n === 3 ? ' 及以上' : '' }}</span>
      </label>
    </fieldset>

    <div class="run-row">
      <button type="button" class="wb-btn wb-btn--primary" :disabled="!canRun || ran" @click="run">
        {{ ran ? '✓ 已提交分类' : '▶ 提交分类并核验' }}
      </button>
      <span v-if="!canRun" class="hint">请为全部 6 条选择标记，并完成预测。</span>
    </div>

    <div v-if="ran" class="result">
      <div class="verdict" :class="correctCount === ITEMS.length && predictedOk ? 'ok' : 'warn'">
        <span class="wb-tag" :class="predictedOk ? 'PASS' : 'FAIL'">
          分类 {{ correctCount }} / {{ ITEMS.length }} 正确 · 预测{{ predictedOk ? '正确' : '错误' }}
        </span>
        <p>
          实际可标 <b>VERIFIED_EXPERIMENT</b> 的论断是 <b>{{ verifiedCount }} 条</b>。
          本分组没有启动 Hono 后端、没有真实 HIS 连接、没有命令退出码与运行日志，因此一条实测结论都不能填。
          把浏览器 SIMULATED 结果写成「已跑通」不是措辞问题，而是发布阻断项。
        </p>
      </div>

      <div class="detail">
        <span class="wb-eyebrow">逐条判定与解释（错误答案也给出理由）</span>
        <div v-for="it in ITEMS" :key="it.id" class="d-row" :class="picks[it.id] === it.answer ? 'ok' : 'bad'">
          <div class="d-top">
            <b class="wb-mono">{{ it.id }}</b>
            <span class="wb-tag" :class="picks[it.id] === it.answer ? 'PASS' : 'FAIL'">
              {{ picks[it.id] === it.answer ? '✓ 正确' : '✗ 应为 ' + it.answer }}
            </span>
            <span class="mine">你的选择：{{ picks[it.id] }}</span>
          </div>
          <p>{{ it.why }}</p>
        </div>
      </div>

      <div class="modes">
        <span class="wb-eyebrow">本分组使用的执行模式标签</span>
        <table>
          <thead><tr><th>标签</th><th>含义</th><th>本分组</th></tr></thead>
          <tbody>
            <tr v-for="m in MODES" :key="m.id" :class="{ on: m.here.startsWith('是') }">
              <td class="wb-mono">{{ m.id }}</td><td>{{ m.desc }}</td><td>{{ m.here }}</td>
            </tr>
          </tbody>
        </table>
        <p class="hint">两类标签要一起读：计算确实在浏览器里执行（BROWSER_EXECUTABLE），但业务数据与服务调用是教学模拟（SIMULATED）。二者不矛盾，也不互相升级。</p>
      </div>

      <div class="needed">
        <b>要真正写下 VERIFIED_EXPERIMENT，至少还缺：</b>锁定的 runtime 与依赖版本、仓库 commit、可复现命令、
        退出码、环境说明、原始日志路径，以及独立复核人。缺任一项就只能停在 <span class="wb-mono">COURSE_DESIGN / SIMULATED</span>。
      </div>
    </div>
  </LabFrame>
</template>

<style scoped>
.legend { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
.lg { padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); display: flex; flex-direction: column; gap: 3px; }
.lg b { font-size: 11.5px; color: var(--accent-ink); }
.lg small { font-size: 11.5px; color: var(--muted); }
.rows { display: flex; flex-direction: column; gap: 8px; }
.row { display: grid; grid-template-columns: 34px 1fr 210px; gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
.num { font-size: 11px; color: var(--faint); }
.txt { margin: 0; font-size: 13px; line-height: 1.65; color: var(--ink-2); }
select { width: 100%; padding: 7px 8px; border-radius: 7px; border: 1px solid var(--line-2); background: var(--surface-2); color: var(--ink); font-size: 11.5px; font-family: var(--font-mono); }
.predict { margin: 14px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); }
.predict legend { padding: 0 6px; font-size: 12px; color: var(--muted); }
.radio { display: inline-flex; align-items: center; gap: 6px; margin-right: 18px; font-size: 13px; color: var(--ink-2); cursor: pointer; }
.radio input { accent-color: var(--accent); }
.run-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 14px 0 4px; }
.hint { margin: 8px 0 0; font-size: 12px; color: var(--faint); line-height: 1.65; }
.run-row .hint { margin: 0; }
.result { margin-top: 16px; display: flex; flex-direction: column; gap: 14px; }
.verdict { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); }
.verdict.ok { border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
.verdict.warn { border-color: color-mix(in srgb, var(--warn) 50%, var(--line)); }
.verdict p { margin: 8px 0 0; font-size: 13.5px; line-height: 1.8; color: var(--ink-2); }
.detail, .modes { padding: 12px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
.d-row { margin-top: 8px; padding: 9px 11px; border-radius: 8px; border-left: 3px solid var(--line-2); background: var(--surface-2); }
.d-row.ok { border-left-color: var(--ok); }
.d-row.bad { border-left-color: var(--bad); }
.d-top { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; font-size: 11.5px; }
.d-top b { color: var(--faint); }
.mine { color: var(--faint); font-family: var(--font-mono); font-size: 11px; }
.d-row p { margin: 6px 0 0; font-size: 12.5px; line-height: 1.7; color: var(--ink-2); }
table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid var(--line); color: var(--ink-2); line-height: 1.6; }
th { color: var(--faint); font-weight: 500; font-size: 11px; }
tr.on td { color: var(--accent-ink); }
.needed { padding: 12px 14px; border-radius: 10px; border: 1px dashed var(--line-2); background: var(--surface-2); font-size: 13px; line-height: 1.8; color: var(--ink-2); }
@media (max-width: 860px) {
  .legend { grid-template-columns: 1fr; }
  .row { grid-template-columns: 28px 1fr; }
  .row select { grid-column: 1 / -1; }
}
</style>
