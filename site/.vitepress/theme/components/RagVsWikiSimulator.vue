<script setup lang="ts">
import { computed, ref } from 'vue'

const op = ref<'ingest' | 'query' | 'lint'>('ingest')
const docBatch = ref(1)

const BATCHES = [
  {
    id: 1,
    title: '第 1 批资料：2024 旧版《住院出院药房核对规程》',
    raw: 'raw/2024-pharmacy-sop.md："所有病区出院带药医嘱提交后，由中心药房按提交先后顺序统一人工审方配药，预计耗时 45 分钟。"',
    ragResult: '检索到 Chunk #14 (相似度 0.86)："由中心药房按提交先后顺序统一人工审方配药，预计耗时 45 分钟。" —— 每次提问临时拼凑切片，无全局概念沉淀。',
    wikiPage: `---
title: 出院带药审方与配送协同
ontology_anchors: [hospital.discharge_pathway, hospital.take_home_medication]
updated_by: smart-ingest (batch #1)
---
## 核心流程
出院带药医嘱提交后进入中心药房队列（参见 [[中心药房审方规范]]）。
- 基准耗时：约 **45 分钟**（来源：\`raw/2024-pharmacy-sop.md\`）。`,
    lintStatus: 'PASS · 无孤立页面，无未消解矛盾。',
  },
  {
    id: 2,
    title: '第 2 批增量资料：2026 Q3《心内科周五出院延迟复盘报告》',
    raw: 'raw/2026-q3-cardio-retro.pdf："统计显示周五 14:00–17:00 心内科集中出院高峰期，带药审方实际中位耗时达 135 分钟，导致 28% 床位无法在当日 18:00 前完成周转。"',
    ragResult: 'Chunk #14 (0.86) 说耗时 45 分钟，Chunk #89 (0.84) 说耗时 135 分钟。传统 RAG 每次随机召回 Top-K，两个 Agent 问同一个问题会给出截然相反的回答！',
    wikiPage: `---
title: 出院带药审方与配送协同
ontology_anchors: [hospital.discharge_pathway, hospital.take_home_medication]
updated_by: smart-ingest (batch #2 · 增量综合)
---
## 核心流程与时段差异
- **常规时段**：中心药房审方基准耗时约 **45 分钟**（来源：\`raw/2024-pharmacy-sop.md\`）。
- **周五高峰瓶颈（14:00–17:00）**：心内科等大科集中出院时，实际中位耗时飙升至 **135 分钟**，造成 28% 床位周转延迟（来源：\`raw/2026-q3-cardio-retro.pdf\`，关联 [[心内科床位周转瓶颈]]）。`,
    lintStatus: 'WARN · Lint 检测到 SOP 基准值(45m)与实测峰值(135m)偏差 > 200%，已自动生成候选优化提案推送至 Evidence Graph。',
  },
  {
    id: 3,
    title: '第 3 批增量资料：2026.10《日间手术与预出院药房前置预审通知》',
    raw: 'raw/2026-10-pre-audit-notice.md："即日起，主治医师标记明日预计出院（Pre-Discharge）后，药房系统提前一晚完成带药前置预审，次日出院发药缩短至 15 分钟。"',
    ragResult: '向量库里同时存在 45分钟、135分钟、15分钟三个碎片。因为没有时间戳与知识综合（Synthesis），传统 RAG 完全分不清哪条是最新机制、哪条是历史瓶颈。',
    wikiPage: `---
title: 出院带药审方与配送协同
ontology_anchors: [hospital.discharge_pathway, hospital.action.pre_audit_meds]
updated_by: smart-ingest (batch #3 · 演进更新)
---
## 现行机制（2026.10 起生效）
引入 **前置预审机制**（关联 [[预出院医嘱预审]]）：主治医师提前一晚触发预出院标记后，次日发药耗时由周五高峰期的 **135 分钟** 压缩至 **15 分钟**（来源：\`raw/2026-10-pre-audit-notice.md\`）。
> 历史基线归档：2024 常规 45 分钟 / 2026Q3 高峰 135 分钟。`,
    lintStatus: 'PASS · 已更新双向 [[wikilinks]] 并同步本体锚点 `hospital.action.pre_audit_meds`。',
  },
]

const cur = computed(() => BATCHES[docBatch.value - 1])
</script>

<template>
  <div class="rvs wb-panel vp-raw">
    <div class="wb-panel-head">
      <span>传统 Vector RAG vs. Karpathy LLM Wiki 持续编译模拟器</span>
      <span class="wb-mono">raw/ → wiki/ → AGENTS.md (Ingest · Query · Lint)</span>
    </div>

    <div class="wb-panel-body">
      <div class="controls">
        <div>
          <span class="wb-eyebrow">1. 模拟时间线：向系统依次投喂第 1 ~ 3 批增量医院资料</span>
          <div class="wb-seg" style="margin-top: 6px">
            <button v-for="b in BATCHES" :key="b.id" type="button" :aria-pressed="docBatch === b.id" @click="docBatch = b.id">
              批次 {{ b.id }}：{{ b.title.split('：')[1].slice(0, 12) }}…
            </button>
          </div>
        </div>
        <div>
          <span class="wb-eyebrow">2. LLM Wiki 核心动作</span>
          <div class="wb-seg" style="margin-top: 6px">
            <button type="button" :aria-pressed="op === 'ingest'" @click="op = 'ingest'">Ingest (增量编译)</button>
            <button type="button" :aria-pressed="op === 'query'" @click="op = 'query'">Query (结构化检索)</button>
            <button type="button" :aria-pressed="op === 'lint'" @click="op = 'lint'">Lint (自检与巡检)</button>
          </div>
        </div>
      </div>

      <div class="raw-bar">
        <span class="wb-tag PASS">raw/ 不可变原始资料</span>
        <span class="wb-mono">{{ cur.raw }}</span>
      </div>

      <div class="compare">
        <div class="col bad-col">
          <div class="c-head">
            <b>传统 Vector RAG（每次从零切片检索）</b>
            <span class="wb-tag FAIL">无持久认知综合</span>
          </div>
          <p class="explain">把新文档切成孤立 Chunk 丢进向量库，从不修改已有认知，每次提问临时拼凑 Top-K：</p>
          <div class="wb-term">
            <div class="dim"># Vector Top-K Chunks 召回结果</div>
            <div class="warn">{{ cur.ragResult }}</div>
          </div>
        </div>

        <div class="col good-col">
          <div class="c-head">
            <b>Karpathy LLM Wiki / nashsu/llm_wiki</b>
            <span class="wb-tag PASS">持续编译知识网络</span>
          </div>
          <p class="explain">
            <template v-if="op === 'ingest'"><strong>Ingest 阶段</strong>：LLM 像图书管理员一样阅读新资料，主动更新关联的 Markdown 知识页并维护双向链接：</template>
            <template v-else-if="op === 'query'"><strong>Query 阶段</strong>：通过 Ontology 稳定锚点与双链图谱精确定位演进后的完整上下文，而非盲搜碎片：</template>
            <template v-else><strong>Lint 阶段</strong>：定期巡检死链、孤立节点、数据口径偏差，并将候选规则变更推送至 Evidence Graph：</template>
          </p>
          <div class="wb-term">
            <pre v-if="op !== 'lint'">{{ cur.wikiPage }}</pre>
            <div v-else>
              <div class="dim">$ llm-wiki lint ./wiki --check-ontology-anchors</div>
              <div :class="cur.lintStatus.startsWith('PASS') ? 'ok' : 'warn'">{{ cur.lintStatus }}</div>
              <div class="acc">→ 严格职责边界：Wiki 仅更新经验解释，不直接篡改 HIS 药房发药权限！</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rvs { margin: 22px 0; }
.controls { display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
.raw-bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); font-size: 12.5px; color: var(--ink-2); margin-bottom: 14px; flex-wrap: wrap; }
.compare { display: grid; grid-template-columns: 1fr 1.15fr; gap: 14px; }
.col { padding: 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); display: flex; flex-direction: column; gap: 10px; }
.bad-col { border-color: color-mix(in srgb, var(--bad) 35%, var(--line)); }
.good-col { border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); background: color-mix(in srgb, var(--ok) 4%, var(--surface)); }
.c-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.c-head b { font-size: 14.5px; color: var(--ink); }
.explain { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.65; }
.wb-term pre { margin: 0; font-family: var(--font-mono); font-size: 12px; line-height: 1.6; white-space: pre-wrap; }
@media (max-width: 860px) {
  .compare { grid-template-columns: 1fr; }
}
</style>
