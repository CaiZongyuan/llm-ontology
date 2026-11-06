<script setup lang="ts">
import { computed, ref } from 'vue'

const Q: [string, string[], number, string][] = [
  [
    '在医院出院协同场景中，“Encounter-2026-089 当前处于待出超声报告状态”属于哪一层认知？',
    ['TBox · 权威本体概念定义', 'ABox · 具体实例的当前运行时状态 (Runtime State)', 'LLM Wiki · 经验知识页', 'Meta-model · 顶层元模型'],
    1,
    'Ontology 首先定义类型、关系、状态机与规则（TBox）；具体哪位患者此刻处于什么状态属于运行时实例状态（ABox），保存在业务数据库中。',
  ],
  [
    '在医院数据治理架构中，HL7 FHIR、OMOP CDM 与 Hospital Ontology 的正确分工是？',
    [
      '直接用 OMOP CDM 驱动医生开立出院医嘱',
      'FHIR 负责系统间标准数据交换，OMOP 负责多中心科研分析，Hospital Ontology 负责业务对象、状态机与受控 Action 执行',
      '有了 FHIR 就不需要业务本体和权限策略了',
      '把所有 HIS 历史数据全转成 OWL 文件替代数据库',
    ],
    1,
    'OMOP 面向二次科研分析，FHIR 面向互操作数据交换，而驱动 Agent 与医护协同的业务对象、状态机和动作契约属于 Hospital Operational Ontology。',
  ],
  [
    'NVIDIA Auto-Ontology 中的 `SQL Attribute` 解决的最核心痛点是什么？',
    [
      '自动修改生产数据库表结构',
      '把经过业务确认的指标计算表达式（如平均出院准备时长）固化并复用，防止不同 Agent 每次猜测出不一致的 SQL',
      '替代事务性业务操作（Action）',
      '跨十几个不同数据库直接执行单条联邦 JOIN SQL',
    ],
    1,
    'SQL Attribute 不仅告诉 AI 字段含义，而且固化了指标的计算逻辑；注意 Auto-Ontology 的 connector_routing.py 不支持跨多个数据源的单条联邦 SQL。',
  ],
  [
    'NVIDIA Auto-Ontology 的 Answerability Coverage = 1.0 意味着什么？',
    [
      '生成的 SQL 100% 语义正确且一定能跨库执行成功',
      '提问中识别出的查询实体在当前 Ontology 中都检索到了候选属性，但关联口径、单库路由和 SQL 仍需验证',
      '数据库里没有任何脏数据',
      '已经自动完成了权限审批',
    ],
    1,
    '源码中 Coverage = 检索到相关属性的查询实体数 / 查询实体总数；Coverage = 1.0 仅代表概念覆盖，不等于跨库可执行或口径无误。',
  ],
  [
    'semantica-agi/semantica 相比纯向量 RAG 的最大架构优势是什么？',
    [
      '完全不需要任何数据库',
      '构建确定性的 Context Graph，将每个决策作为一等公民对象并绑定 W3C PROV-O 溯源链与 SHACL 形状校验',
      '只能处理图片和音频',
      '用随机采样替代实体抽取',
    ],
    1,
    'Semantica 通过确定性图基础设施、5 阶段本体生成流水线、SHACL 校验与 PROV-O 溯源，解决了黑盒 RAG 在医疗/金融等强监管场景无法审计的问题。',
  ],
  [
    'Karpathy 提出的 LLM Wiki 范式与传统 RAG 的本质区别是什么？',
    [
      'LLM Wiki 不保留原始资料 raw/',
      '传统 RAG 每次提问从零检索碎片切片；LLM Wiki 让 LLM 持续增量阅读 raw/，综合编译并维护互联的 wiki/ 知识页（Ingest / Query / Lint）',
      'LLM Wiki 只能存 JSON 不能存 Markdown',
      'LLM Wiki 允许直接删改原始 PDF',
    ],
    1,
    'LLM Wiki 的核心是“持续编译维护的结构化知识网络”，raw/ 只读不可变，wiki/ 由 Agent 持续综合演进并通过 Lint 巡检矛盾与死链。',
  ],
  [
    '当 LLM Wiki 从运行日志中总结出《周末出院带药加速经验》后，能否直接让 Agent 据此跳过药房核对步骤？',
    [
      '可以，只要 LLM 置信度超过 0.95 就自动生效',
      '绝对不能！Wiki 管经验解释与参考，不能直接篡改业务动作；必须转化为候选 Claim 与 Model ChangeSet，经类型检查与人工授权后才能发布新本体',
      '只要写进 Markdown 就能自动改写后端数据库权限',
      '可以直接修改 React 前端代码绕过后端校验',
    ],
    1,
    '这是 ADR-0001 的核心铁律：知识可以推动 Ontology 演化，但未经审批的经验总结绝不等于已获授权的业务规则。',
  ],
  [
    'JetBrains MPS 的投影式编辑（Projectional Editing）给 llm-ontology 带来的最关键启发是？',
    [
      '强制所有医院护士都安装 Java IDE 写代码',
      '底层持久化唯一的结构化 AST（带稳定节点 ID），面向医护、数据工程师和 Agent 投射出三种不同视图，任何视图的语义修改都转化为对同一模型的变更提案',
      '用正则表达式解析自由文本',
      '为每个角色维护一套互不相干的 YAML 文件',
    ],
    1,
    '三个界面不是三份平行维护的业务定义，而是同一份结构化 AST 模型的三种投影（Projections）。',
  ],
  [
    '为什么在 llm-ontology 中必须分离 Evidence Graph（证据图）与 Domain Graph（权威领域图）？',
    [
      '为了多消耗一倍磁盘空间',
      '因为原始规章、绿色通道补充规定与夜班历史日志天然存在冲突或违规记录；Evidence Graph 允许不确定与冲突主张共存，消解并审批后才进入确定性的 Domain Graph',
      '因为 PostgreSQL 不支持存两张表',
      'Evidence Graph 只在测试环境使用',
    ],
    1,
    '把“夜班曾有 42 次未签字放行床位”的观察性事实（observational）与“必须主治签字”的规范性要求（normative）区分开，才能防止系统把违规习惯当成合法规则。',
  ],
  [
    '在 Concept Registry 中，为什么 HIS 数据库里 `patient_id` 与 `payer_id` 即使 98% 相同也不能执行 `MERGE_CONCEPT`？',
    [
      '因为字段名长度不一样',
      '数据取值碰巧相同不等于业务身份（Identity）相同；患者（Patient）与医保/第三方付款人（Payer）在业务语义与未来代付场景下是两个独立概念',
      '因为 Embedding 相似度不够高',
      '因为 SQL 不支持 JOIN 相同字段',
    ],
    1,
    '实体对齐必须结合业务身份、语义角色与反例，决不能仅凭样本值重合就盲目合并概念。',
  ],
  [
    '当用户把 `DischargePathway` 的中文显示名从“出院准备路径”改为“离院协同路径”时，Incremental Compiler 会怎么做？',
    [
      '删除旧数据库表并重建所有 28 个前后端产物',
      '因为模型使用稳定节点 ID（`hospital.discharge_pathway`），身份未变，仅增量更新依赖显示名称的 UI 投影，后端守卫与历史事件零改动',
      '强制要求所有历史出院记录作废',
      '报错拒绝修改任何名称',
    ],
    1,
    '稳定节点 ID（Node Identity）与显示名称（Display Name）解耦，是支持模型平滑演进与增量编译的基石。',
  ],
  [
    '运行时患者触发出院协同任务时，`Ontology Context Resolver` 的职责是什么？',
    [
      '把全院几百个实体和所有 SOP 原文一次性全部塞进 LLM Prompt',
      '根据 `Task + Runtime State + Canonical Ontology` 动态解析出最小相关的 `Ontology Context Package`（当前状态、可用 Action、关联 Wiki），且真正执行时由后端 `Action Executor` 再次强制验权',
      '直接代替后端数据库执行 SQL 写入',
      '关闭所有权限检查以提高响应速度',
    ],
    1,
    '动态解析最小上下文包既保证推理精准与低 Token 消耗，同时遵循“上下文裁剪只是能力发现，最终授权必由后端确定性守卫验证”的安全边界。',
  ],
]

const ans = ref<(number | null)[]>(Q.map(() => null))
const done = computed(() => ans.value.filter((a) => a !== null).length)
const right = computed(() => ans.value.filter((a, i) => a === Q[i][2]).length)
function pick(i: number, j: number) {
  if (ans.value[i] === null) ans.value[i] = j
}
function reset() {
  ans.value = Q.map(() => null)
}
</script>

<template>
  <div class="qz vp-raw">
    <div class="top-bar">
      <p class="score">
        {{ done ? `已作答 ${done} / ${Q.length} 题 · 答对 ${right} 题` : `共 ${Q.length} 道核心架构与场景辨析题，点击选项立即检验并查看解析。` }}
      </p>
      <button v-if="done" type="button" class="wb-btn" @click="reset">重新作答</button>
    </div>
    <div v-for="(q, i) in Q" :key="i" class="q wb-panel">
      <p class="t">{{ i + 1 }}. {{ q[0] }}</p>
      <div class="opts">
        <button
          v-for="(o, j) in q[1]"
          :key="j"
          type="button"
          :class="{ right: ans[i] !== null && j === q[2], wrong: ans[i] === j && j !== q[2] }"
          :disabled="ans[i] !== null"
          @click="pick(i, j)"
        >
          {{ o }}
        </button>
      </div>
      <p v-if="ans[i] !== null" class="why">{{ ans[i] === q[2] ? '✓ 解析：' : '✗ 解析：' }}{{ q[3] }}</p>
    </div>
  </div>
</template>

<style scoped>
.qz { margin: 20px 0; display: flex; flex-direction: column; gap: 10px; }
.top-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.score { margin: 0; font-size: 14px; color: var(--muted); }
.q { padding: 14px 16px; }
.t { margin: 0 0 10px; font-size: 14.5px; color: var(--ink); font-weight: 500; line-height: 1.55; }
.opts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.opts button { text-align: left; padding: 9px 12px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink-2); font-size: 13.5px; cursor: pointer; font-family: var(--font-ui); line-height: 1.5; transition: border-color .2s var(--ease); }
.opts button:hover:not(:disabled) { border-color: var(--accent); }
.opts button:disabled { cursor: default; }
.opts button.right { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 12%, transparent); color: var(--ok); font-weight: 500; }
.opts button.wrong { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 10%, transparent); color: var(--bad); }
.why { margin: 10px 0 0; padding-top: 8px; border-top: 1px solid var(--line); font-size: 13.5px; line-height: 1.7; color: var(--ink-2); }
@media (max-width: 680px) {
  .opts { grid-template-columns: 1fr; }
}
</style>
