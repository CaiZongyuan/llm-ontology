---
title: 最小验证实验（MVP）与综合自测
description: llm-ontology 推荐的轻量级技术栈与代码包结构、三个连续验证实验（Raw→Ontology→SaaS→Recompile）的验收标准，以及 12 道全站综合自测题。
---

# 最小验证实验（MVP）与综合自测

一套架构设计得再优美，如果第一版需要同时部署 Neo4j、RDF Triplestore、独立向量数据库、Kafka、Temporal 工作流引擎和十几个微服务才能跑起来，那它大概率会死在襁褓里。

这一课我们给出 **`llm-ontology` 最务实的低复杂度落地路线**：如何用一套极简的 **TypeScript + Hono + PostgreSQL/SQLite + React/Vue** 单体仓库跑通三个核心闭环，如何用 **三个连续的最小实验（Experiments A / B / C）** 验证整套理论，最后通过 **12 道交互式自测题** 完成全教程的闭环检验。

::: tip 读完这一页你应该能回答
- 第一版 `llm-ontology` 为什么不需要引入专用图数据库和 RDF 三元组库？推荐的 **5 个核心 Package 目录结构** 是什么？
- 验证本架构的 **三个连续实验（实验 A `Raw→Ontology`、实验 B `Ontology→SaaS`、实验 C `Change→Recompile`）** 各自的硬性 PASS 判据是什么？
- 面对全站 12 道核心概念与医院数据治理场景辨析题，你能否全部一次答对？
:::

## 一、低复杂度技术选型与 Monorepo 代码结构

在最初几百到几千个本体语义节点的规模下，**PostgreSQL（或本地优先的 SQLite）加上 JSONB、全文索引（FTS）、pgvector 与递归 CTE 查询**，完全足以支撑 `Evidence Graph` 与 `Domain Graph` 的全部存储、检索与溯源需求。

| 子系统模块 | 第一版轻量选型（Local-first / 单体可跑） | 未来大规模演进方向 |
|---|---|---|
| **Source & Evidence Store** | 本地文件存储（带 SHA-256 Hash）+ SQLite / PostgreSQL 表 | S3/R2 对象存储 + 医院 FHIR / CDC 实时连接器 |
| **Hybrid Retrieval** | PostgreSQL FTS 全文检索 + `pgvector` + 关系图递归查询 | 多模态文档解析 + 专用图遍历缓存 |
| **Meta-model & Type Checker** | **TypeScript + Zod Discriminated Unions + 受控表达式 AST** | 支持双向导出标准 LinkML / W3C SHACL / PROV-O `.ttl` |
| **Model Repository** | 版本化 JSON 快照表 + 结构化 `Model ChangeSet` 账本 | 多租户命名空间分支、合并与行业本体继承（Foundational → Hospital → Dept） |
| **Model Studio & Preview** | Vue / React 三视图投影工作台（业务规则卡 + Schema + Agent 契约） | 支持细粒度画布协同与 Decision Inbox 异步批复 |
| **Compiler & SaaS Runtime** | TypeScript 插件化生成器 + **Hono** 后端 (`Action Executor` 守卫) | 分布式事件总线 + Open Policy Agent (OPA) 独立集群 |
| **Knowledge Consolidation** | 兼容 Obsidian 的 `wiki/*.md`（含 `ontology_anchors`）+ `Ingest/Lint` 任务 | 自动化基准评测集生成与强化学习回流 |

### 推荐的仓库包结构（`llm-ontology`）

```text
llm-ontology/
├── GLOSSARY.md                 # 核心领域统一词汇表（已建立）
├── docs/adr/                   # 关键架构决策记录（如 ADR-0001 三层事实源分离）
├── site/                       # 本交互式架构教程站点 (VitePress + Vue 3)
├── packages/
│   ├── model/                  # M2 Meta-model 定义、12 原语 Zod Schema、Policy AST 与静态类型检查器
│   ├── evidence/               # Source 摄入、Fragment 哈希定位、Claim 提取、五维冲突消解与 PROV-O 溯源
│   ├── compiler/               # Canonical IR、Build Manifest 依赖图、Zod/Guard/UI/MCP/Test 生成器插件
│   ├── runtime/                # Ontology Context Resolver、Deterministic Action Executor 与事件留痕
│   └── agent/                  # Discovery Agent、Ontology Modeler、Independent Reviewer 与 LLM Wiki 维护器
├── apps/
│   └── studio/                 # 集三视图 Preview、Decision Inbox 与出院协同运行看板于一体的 Web 应用
└── examples/
    └── hospital-discharge/     # 第一个端到端纵向切片：智慧医院患者出院协同与床位周转
```

::: info 为什么设三个职责清晰的 Agent 角色就够了？
第一版完全不需要搞几十个花哨的 Agent 群聊。在 `packages/agent` 中只需在同一个 Harness 上配置三个角色：
1. **Discovery / Extraction Agent**：从 SOP 与数据库采样中提取 `Claim`、标注模态并识别未决问题；
2. **Ontology Modeler Agent**：基于消解后的主张构建候选本体、`Model ChangeSet` 与三视图 Preview；
3. **Independent Reviewer Agent**：**独立于建模 Agent**，专门寻找反例、检查证据覆盖率与医疗合规风险（编译与类型检查则直接交由确定性程序执行）。
:::

---

## 二、最小可验证 MVP：用三个连续实验证明架构成立

不要一上来就试图把整家医院几百个科室全部建完。只需围绕 **「患者出院协同与床位周转」** 依次跑通下面三个实验，就能 100% 验证 `llm-ontology` 的核心主张：

<div class="wb-grid3">
  <div class="wb-panel">
    <div class="wb-panel-head"><span>实验 A</span><span>RAW → ONTOLOGY</span></div>
    <div class="wb-panel-body">
      <strong>从冲突资料到受控本体</strong>
      <p style="margin-top:8px;font-size:13px;color:var(--ink-2)"><strong>输入</strong>：4 份含预设冲突的医院出院 SOP/访谈 + HIS/EMR/LIS 3 张表 Schema。<br/><strong>PASS 判据</strong>：100% 主张绑定 Fragment Hash；准确区分常规双签、日间单签与夜班违规习惯；未经审批的规则无法发布。</p>
    </div>
  </div>
  <div class="wb-panel">
    <div class="wb-panel-head"><span>实验 B</span><span>ONTOLOGY → SAAS</span></div>
    <div class="wb-panel-body">
      <strong>从同一模型编译可运行系统</strong>
      <p style="margin-top:8px;font-size:13px;color:var(--ink-2)"><strong>输入</strong>：实验 A 发布的 <code>Canonical Ontology v1.0</code>。<br/><strong>PASS 判据</strong>：自动生成 Zod Schema、后端守卫、出院看板与 MCP 工具；住院医越权签发或危急值未清零时调用释放床位 100% 被后端拒绝并留痕。</p>
    </div>
  </div>
  <div class="wb-panel">
    <div class="wb-panel-head"><span>实验 C</span><span>CHANGE → RECOMPILE</span></div>
    <div class="wb-panel-body">
      <strong>局部规则变更与增量重编译</strong>
      <p style="margin-top:8px;font-size:13px;color:var(--ink-2)"><strong>输入</strong>：修改一份日间手术 SOP 条款或重命名一个实体显示名。<br/><strong>PASS 判据</strong>：依赖图准确圈定受影响产物（仅重算受影响子图）；历史出院事件记录保持兼容可读；回归契约测试自动捕获行为变化。</p>
    </div>
  </div>
</div>

---

## 三、全站综合自测（12 题交互检验）

下面的 12 道辨析题覆盖了 **Ontology 八层解剖**、**医院数据治理（NHS FDP / FHIR / OMOP）**、**NVIDIA Auto-Ontology**、**Semantica**、**Karpathy LLM Wiki**、**JetBrains MPS 投影式编辑** 以及 **`llm-ontology` 双图与增量编译器** 的全部核心考点。点击选项即可检验你的掌握情况：

<Quiz />

## 下一课预告

上面三个实验的 PASS 判据和 12 道自测题，是**验收标准**，不是已经跑出来的运行结果。那么，当一条新规则要发布、Agent 想调用一个动作、页面上又亮起一排绿色 PASS 时，我们凭什么相信它？

新增的 **06 受控落地** 分组就接在这里：请看 **[一条规则改下去，到底会动到什么？](/practice/change-set)** —— 它会复用本课 Experiments C 的「仅重算受影响子图」判据，补上发布前的依赖图预览、审批门与历史实例快照，并把「先预测、再运行、解释为什么错」做成全组统一的交互契约。
