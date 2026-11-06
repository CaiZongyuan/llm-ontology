---
title: Semantica：面向可审计 AI 的 Context Graph
description: 深度剖析 semantica-agi/semantica 的模块化架构、确定性 Context Graph、5 阶段自动本体构建流水线、SHACL 校验与 W3C PROV-O 决策溯源。
---

# Semantica：面向可审计 AI 的 Context Graph

开源仓库：[`https://github.com/semantica-agi/semantica`](https://github.com/semantica-agi/semantica)

如果说 `NVIDIA/auto-ontology` 聚焦于“让 AI 读懂关系型数据库表并生成一致的 SQL”，那么 **`semantica-agi/semantica`** 则直击医疗、金融、法律等强监管行业的另一个核心痛点：**如何把黑盒、概率性的 LLM 输出，转化为确定性、可追溯、可审计的结构化上下文图谱（Context Graph）与决策记录？**

::: tip 读完这一页你应该能回答
- 什么是 **Context Graph（上下文图谱）**？它与传统概率性 Vector RAG 的本质区别是什么？
- `semantica` 的 **8 大核心 Python 模块** 是如何从非结构化文档一步步构建出知识图谱与决策溯源链的？
- `semantica.ontology` 的 **5 阶段本体生成流水线（`Semantic Network → YAML → Types → Hierarchy → TTL`）** 与 **SHACL 校验** 是怎样工作的？
- 在医院电子病历使用留痕（卫健委 2025 规定）与 EU AI Act / HIPAA 合规要求下，**W3C PROV-O 决策溯源** 如何落地？
:::

## 一、为什么强监管场景不能只靠概率性 Vector RAG？

在医院临床运营或医保合规审查中，当 AI Agent 给出一条建议：“*患者 `Encounter-2026-089` 符合日间手术 24 小时快速出院标准，建议单签放行床位*”时，医务科和监管机构会立刻追问三个问题：

1. **依据哪条规定？** 这条判断来自哪份院内 SOP 的哪一页，还是大模型自己的训练语料幻觉？
2. **遇到冲突了吗？** 当《普通住院双签规定》与《日间手术单签规定》同时存在时，系统是如何裁决的？
3. **决策链可复现吗？** 三个月后发生医疗纠纷或合规审计时，能否精确定位当时触发了哪一版规则、输入了哪些患者事实？

传统 Vector RAG 把文档切成碎片算余弦相似度，无法回答上述问题。**Semantica 的定位正是位于向量数据库与 Agent 运行时之下的「图原生确定性基础设施（Graph-Native Accountable Infrastructure）」。**

### Context Graph vs. 传统 Vector RAG

| 维度 | 传统 Vector RAG | Semantica Context Graph |
|---|---|---|
| **基本单元** | 无结构的文本切片（Text Chunks）与高维浮点向量 | 一等公民对象：**实体（Entity）、关系（Relation）、主张（Claim）与决策对象（Decision Object）** |
| **检索与推理机制** | 纯概率性余弦相似度近似匹配 | 混合检索（向量语义召回 + 确定性图遍历 + 规则推理链） |
| **多源事实冲突** | 盲目把冲突切片一起塞进 Prompt，由 LLM 随机采信 | 显式标记冲突边（Conflict Tracking），通过可配置策略与时间戳消解 |
| **合规与溯源（Provenance）** | 仅能附带粗粒度文档链接，无决策因果链 | 原生内置 **W3C PROV-O** 审计谱系，记录 `Decision → RuleFired → Fact → SourceNode` |

---

## 二、Semantica 的八大核心模块架构

Semantica 采用高度模块化的 Python 包设计，覆盖从多源数据摄入到本体治理与 MCP 暴露的完整生命周期：

1. **数据摄入与解析（`semantica.ingest` & `semantica.parse`）**：支持从本地文档（PDF/Docx/Markdown）、网页以及数据仓库（Snowflake / Databricks）摄入原始资料并解析为结构化块。
2. **归一化与实体感知切分（`semantica.normalize` & `semantica.split`）**：清洗噪声文本，按语义与实体边界切分资料片段（`Fragment`），避免生硬截断医疗规章条款。
3. **语义三元组抽取（`semantica.semantic_extract`）**：结合确定性模式匹配与可选 LLM 提供商（`semantica.llms`），抽取实体、关系与属性三元组。
4. **多后端知识图谱与三元组存储（`semantica.kg`、`semantica.graph_store`、`semantica.triplet_store`）**：支持时序知识图谱（Temporal KG），底层可对接属性图（Neo4j、FalkorDB、Apache AGE、AWS Neptune）与 RDF/SPARQL 存储。
5. **混合向量检索（`semantica.vector_store` & `semantica.embeddings`）**：将向量索引与图节点对齐，实现“向量找入口节点 + 图遍历找完整结构上下文”。
6. **上下文与决策智能（`semantica.context` & `semantica.reasoning`）**：管理 Agent 长期记忆、**把每一次 Agent 决策保存为一等公民节点（Decision Node）**，连接前因后果与历史先例（Searchable Precedent）。
7. **本体治理与校验（`semantica.ontology`）**：包含 `LLMOntologyGenerator`、5 阶段自动化本体管线、命名空间管理与 **W3C SHACL** 形状验证。
8. **服务与生态接口（`semantica-server`、`semantica-explorer`、`semantica-mcp`）**：提供 REST API、基于 React/Sigma.js 的可视化图谱浏览器，以及可直接接入 Claude Code / VS Code 的 MCP Server。

---

## 三、交互演练：Semantica 5 阶段本体生成流水线与四大方案对比

在 `semantica.ontology` 中，从非结构化业务文本到标准受控本体并非一步跳达，而是经过严谨的 **5 阶段流水线（`Semantic Network → YAML → Types → Hierarchy → TTL & SHACL`）**。

点击下方交互实验台中的 **01 ~ 05 阶段** 查看其在医院出院场景下的具体转换产物，并在下方表格中对比 **NVIDIA Auto-Ontology**、**Semantica**、**Palantir Ontology** 与本项目 **`llm-ontology`** 的能力边界：

<OpenSourceCompare />

---

## 四、W3C PROV-O 决策溯源：满足医疗电子病历留痕与合规审计

Semantica 最值得 `llm-ontology` 吸收的设计之一，是它对 **W3C PROV-O（Provenance Ontology，溯源本体标准）** 的工程化落地。

在 W3C PROV-O 标准中，任何可审计系统都围绕三个核心基类构建溯源三角：
- **`prov:Entity`（实体/数据物）**：原始 SOP 文档、提取出的 `Claim`、发布的 `Canonical Ontology v1.2`、患者的出院评估记录；
- **`prov:Activity`（活动/处理过程）**：一次文档抽取任务、一次冲突消解审核、一次 `ConfirmMedicallyFit` 动作执行；
- **`prov:Agent`（责任主体）**：执行抽取的 LLM 模型版本、签署批准的医务科主任（`Supervisor-12`）、调用工具的出院协同 Agent。

它们之间通过标准谓词连接：
- `wasDerivedFrom`（派生自）：正式规则 `Policy:discharge_signoff` **派生自** `Claim-04` 与 `Claim-09`，后者**派生自**《日间手术绿色通道规定》第 4 条（`frag_daysurg2026_p2`）；
- `wasGeneratedBy`（生成于）：出院状态变更事件由 `Activity:ActionExec-8821` 生成；
- `wasAttributedTo`（归属责任人）：该临床准出确认归属于 `AttendingPhysician:Wang`。

::: info 对本项目的直接启发
在 `llm-ontology` 的第一版实现中，我们**不需要**为了使用 PROV-O 而被迫引入笨重的 RDF Triplestore。我们完全可以直接在 PostgreSQL / SQLite 的关系表（`sources`、`fragments`、`claims`、`changesets`、`audit_events`）中实现 PROV-O 的溯源关系模型，并在需要对接医院外部监管审计平台时一键导出标准 JSON-LD 或 Turtle（`.ttl`）格式。
:::

## 下一课预告

到目前为止，我们已经看清了 **Ontology 的基础概念** 与 **两个代表性开源实现（Auto-Ontology 与 Semantica）**。但在系统长期运行过程中，每天都会产生新的排障经验、复盘报告与非结构化笔记——这些动态经验该如何沉淀与维护？下一课我们将进入第三模块：**[Karpathy LLM Wiki 范式：从即时 RAG 到持续编译](/wiki/karpathy-pattern)**。
