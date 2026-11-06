<script setup lang="ts">
import { computed, ref } from 'vue'

interface EvidenceClaim {
  id: string
  title: string
  modality: 'normative' | 'observational'
  sourceDoc: string
  fragmentHash: string
  excerpt: string
  scope: string
  authority: string
  resolution: 'approved_scoped' | 'rejected_violation'
  resolutionWhy: string
}

const CLAIMS: EvidenceClaim[] = [
  {
    id: 'Claim-04',
    title: '所有住院患者出院医嘱须经主治医师与科主任双签后方可放行床位',
    modality: 'normative',
    sourceDoc: '《医院住院患者出院管理制度 (2024版)》第 3 章第 12 条',
    fragmentHash: 'frag_sop2024_p12#sha256:8a91f',
    excerpt: '“各普通病区患者办理出院结算与床位释放前，必须由主治医师完成出院小结并经科主任（或授权副主任医师）二级审核签字。”',
    scope: 'encounter.type == "Inpatient" (常规普通住院)',
    authority: '院级正式规章 (Level-1 SOP)',
    resolution: 'approved_scoped',
    resolutionWhy: '保留为常规住院（Inpatient）的标准策略分支。',
  },
  {
    id: 'Claim-09',
    title: '日间手术患者术后评估达标后，允许主治医师单签直接放行出院',
    modality: 'normative',
    sourceDoc: '《日间手术中心快速周转绿色通道补充规定 (2026版)》第 4 条',
    fragmentHash: 'frag_daysurg2026_p2#sha256:3c42b',
    excerpt: '“为提升日间手术床位周转率，对符合 24 小时出院标准的日间手术患者，授权主治医师根据 Post-Anesthesia 评分单签确认 MedicallyFit。”',
    scope: 'encounter.type == "DaySurgery" (日间手术病房)',
    authority: '院级专项补充规章 (2026 更新)',
    resolution: 'approved_scoped',
    resolutionWhy: '与 Claim-04 并非真矛盾，而是适用范围（Scope）与生效时间（Time）细化：作为 DaySurgery 分支并入同一 Policy AST。',
  },
  {
    id: 'Claim-12',
    title: '夜班或周末高峰时，护士站经常不等医师系统签字先口头释放床位',
    modality: 'observational',
    sourceDoc: '心内科夜班护理交班访谈录音 + HIS 历史异常日志扫描 (42 条)',
    fragmentHash: 'frag_interview_07#sha256:f19d0',
    excerpt: '访谈：“有时候周末急诊催床太紧，医生在手术室没空点系统，我们就先在床位系统里点释放了。” HIS 扫描发现 42 条 `release_at < signoff_at` 记录。',
    scope: 'Weekend / NightShift 实际操作习惯',
    authority: '观察事实 (Observational · 未获合规授权)',
    resolution: 'rejected_violation',
    resolutionWhy: '虽然在历史数据中真实存在（Supported Evidence），但属于违反医疗安全规定的操作习惯。严禁写入 Canonical Ontology，而应转化为出院协同预审优化需求！',
  },
]

const selId = ref('Claim-09')
const reconciled = ref(false)
const cur = computed(() => CLAIMS.find((c) => c.id === selId.value)!)
</script>

<template>
  <div class="erl wb-panel vp-raw">
    <div class="wb-panel-head">
      <span>双图架构实验台 · Evidence Graph 冲突消解与 PROV-O 溯源</span>
      <button type="button" class="wb-btn" :class="{ 'wb-btn--primary': !reconciled }" @click="reconciled = !reconciled">
        {{ reconciled ? '✓ 已完成五维冲突消解 (查看 ChangeSet)' : '▶ 运行五维冲突消解 (Identity/Scope/Time/Authority)' }}
      </button>
    </div>

    <div class="wb-panel-body">
      <div class="claims-row">
        <button
          v-for="c in CLAIMS"
          :key="c.id"
          type="button"
          class="c-card"
          :class="{ on: selId === c.id, rej: reconciled && c.resolution === 'rejected_violation' }"
          @click="selId = c.id"
        >
          <div class="top">
            <b class="wb-mono">{{ c.id }}</b>
            <span class="wb-tag" :class="c.modality === 'normative' ? 'PASS' : 'BLOCKED'">{{ c.modality }}</span>
          </div>
          <p>{{ c.title }}</p>
        </button>
      </div>

      <div class="split">
        <div class="box">
          <span class="wb-eyebrow">1. Evidence Graph 节点溯源 (W3C PROV-O wasDerivedFrom)</span>
          <h5>{{ cur.id }}：{{ cur.title }}</h5>
          <dl class="kv">
            <div><dt>原始出处</dt><dd>{{ cur.sourceDoc }}</dd></div>
            <div><dt>Fragment Hash</dt><dd class="wb-mono">{{ cur.fragmentHash }}</dd></div>
            <div><dt>原文片段</dt><dd class="quote">{{ cur.excerpt }}</dd></div>
            <div><dt>主张模态</dt><dd class="wb-mono">{{ cur.modality === 'normative' ? 'normative (规范要求)' : 'observational (观察事实)' }}</dd></div>
          </dl>
        </div>

        <div class="box">
          <span class="wb-eyebrow">2. 五维冲突消解与 Domain Graph 准入判定</span>
          <dl class="kv">
            <div><dt>Scope (适用范围)</dt><dd class="wb-mono">{{ cur.scope }}</dd></div>
            <div><dt>Authority (权威等级)</dt><dd>{{ cur.authority }}</dd></div>
            <div>
              <dt>编译器裁决</dt>
              <dd :class="cur.resolution === 'approved_scoped' ? 'ok' : 'bad'">
                <strong>{{ cur.resolution === 'approved_scoped' ? '✓ 准予按 Scope 编译入 Canonical Ontology' : '✗ 拦截！禁止将历史违规观察事实编译为系统规则' }}</strong>
                <p style="margin: 4px 0 0">{{ cur.resolutionWhy }}</p>
              </dd>
            </div>
          </dl>

          <div v-if="reconciled" class="wb-term" style="margin-top: 10px">
            <div class="dim"># 生成的受控 Model ChangeSet #042</div>
            <pre>{
  "id": "changeset-042",
  "derivedFromClaims": ["Claim-04", "Claim-09"],
  "rejectedClaims": ["Claim-12"],
  "op": "upsert_policy_ast",
  "nodeId": "hospital.policy.discharge_signoff",
  "condition": "(type == 'Inpatient' && chiefSigned) || (type == 'DaySurgery' && attendingSigned)"
}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.erl { margin: 22px 0; }
.claims-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
.c-card { padding: 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); text-align: left; cursor: pointer; font-family: var(--font-ui); transition: all .2s var(--ease); }
.c-card:hover { border-color: var(--line-2); }
.c-card.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); box-shadow: var(--shadow-1); }
.c-card.rej { border-color: color-mix(in srgb, var(--bad) 45%, var(--line)); }
.c-card .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.c-card b { font-size: 12.5px; color: var(--accent-ink); }
.c-card p { margin: 0; font-size: 13px; color: var(--ink); line-height: 1.5; }
.split { display: grid; grid-template-columns: 1fr 1.1fr; gap: 14px; }
.box { padding: 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); }
.box h5 { margin: 6px 0 10px; font-family: var(--font-display); font-size: 17px; color: var(--ink); }
.kv { margin: 0; display: flex; flex-direction: column; gap: 8px; }
.kv > div { display: grid; grid-template-columns: 110px 1fr; gap: 10px; font-size: 13px; line-height: 1.6; border-top: 1px solid var(--line); padding-top: 8px; }
.kv > div:first-child { border-top: 0; padding-top: 0; }
.kv dt { color: var(--faint); font-size: 12px; }
.kv dd { margin: 0; color: var(--ink-2); }
.kv dd.quote { font-style: italic; background: var(--surface); padding: 6px 10px; border-radius: 6px; border-left: 3px solid var(--accent); }
.kv dd.ok { color: var(--ok); }
.kv dd.bad { color: var(--bad); }
.wb-term pre { margin: 4px 0 0; font-family: var(--font-mono); font-size: 11.5px; line-height: 1.55; white-space: pre-wrap; }
@media (max-width: 860px) {
  .claims-row, .split { grid-template-columns: 1fr; }
}
</style>
