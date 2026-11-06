---
title: Karpathy LLM Wiki：从即时 RAG 到持续编译
description: 解析 Andrej Karpathy 的 LLM Wiki 核心思想：为什么每次从零切块检索的传统 RAG 无法积累认知，以及 raw/ → wiki/ → Schema 的持续编译工作流。
---

# Karpathy LLM Wiki：从即时 RAG 到持续编译

核心参考：Andrej Karpathy 提出的 [LLM Wiki Pattern Gist (`442a6bf555914893e9891c11519de94f`)](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 与 Microsoft / 社区演进实践。

在构建知识密集型 Agent 系统时，过去几年的主流范式一直是 **RAG（Retrieval-Augmented Generation，检索增强生成）**：把 PDF、Word、聊天记录切成 500 字的小块（Chunks），算完 Embedding 存进向量数据库；每次用户提问时，实时搜出 Top-K 个切片塞进 Prompt。

Andrej Karpathy 尖锐地指出了传统 RAG 的根本缺陷，并提出了 **LLM Wiki** 范式：**不要让大模型每次提问时都像失忆一样从零翻找原始碎片，而要让大模型像一位专职图书管理员一样，在资料进入时就将其“持续编译（Compile）”并维护成一套互联、自洽的知识维基。**

::: tip 读完这一页你应该能回答
- 传统 Vector RAG 在面对医院长周期规章演进与复盘沉淀时，为什么会出现严重的“碎片盲区”与口径矛盾？
- Karpathy LLM Wiki 的 **三层目录结构（`raw/`、`wiki/`、`AGENTS.md` Schema）** 各自遵循什么铁律？
- **`Ingest`（增量编译）**、**`Query`（结构化检索）** 与 **`Lint`（知识自检）** 三个核心工作流是如何运转的？
- 为什么我们说“本项目 `llm-ontology` 本质上是把 LLM Wiki 的思想从 Markdown 维基升级成了类型化业务本体编译器”？
:::

## 一、为什么传统 RAG 无法真正“积累认知”？

假设医院在两年内先后产生了三份关于“出院带药核对”的文档：
1. **2024 年旧版 SOP**：写着“出院带药由中心药房按序人工审方，基准耗时 45 分钟”。
2. **2026 Q3 心内科复盘报告**：写着“周五下午集中出院高峰期，带药审方实际中位耗时达 135 分钟，成为床位周转最大瓶颈”。
3. **2026 年 10 月药事新规**：写着“启用预出院医嘱前置预审机制后，次日出院发药压缩至 15 分钟”。

在传统 Vector RAG 中，这三份文档被切成几十个孤立的 Chunk 躺在向量库里。当你问 Agent：“*我院出院带药核对需要多久？有什么瓶颈？*”时：
- **没有知识综合（No Synthesis）**：向量库从来没有把这三份跨越两年的材料综合成一幅完整图景；
- **时间与版本失明**：Chunk #14（45分钟）和 Chunk #89（135分钟）的余弦相似度几乎一样，每次提问随机召回，导致不同 Agent 给出自相矛盾的回答；
- **重复消耗算力**：每次提问都要重新阅读原始碎片、重新做上下文对齐，做完即丢，下一次提问又从零开始。

---

## 二、LLM Wiki 的核心架构：把原始资料“编译”为互联知识页

Karpathy 提出的 LLM Wiki 将知识库明确划分为三个层次：

```text
knowledge-workspace/
├── raw/                        # 1. 原始资料层（只读、不可变，LLM 严禁改写）
│   ├── 2024-pharmacy-sop.md
│   ├── 2026-q3-cardio-retro.pdf
│   └── 2026-10-pre-audit-notice.md
├── wiki/                       # 2. 编译后的知识层（由 LLM 持续综合、更新和维护）
│   ├── index.md                # 全局知识地图与概念索引
│   ├── concepts/
│   │   ├── discharge-pathway.md
│   │   └── take-home-medication.md
│   └── insights/
│       └── friday-discharge-bottleneck.md
└── AGENTS.md                   # 3. 知识组织 Schema（规定分类、命名、双链格式与维护工作流）
```

### 三层职责铁律

1. **`raw/`（不可变原始证据层）**：所有原始文件、录音转写、网页快照原封不动保存在 `raw/` 中。**LLM 永远只有读取权，绝不允许修改或覆写 `raw/`**——因为一旦模型总结出错，`raw/` 是唯一能重新编译和溯源核查的真相底座。
2. **`wiki/`（持续演进的合成知识层）**：这里不再是原始文档的切片，而是按主题、概念、实体组织好的结构化 Markdown 页面。每当 `raw/` 新增一份资料，Agent 都会主动读取它，并**增量修改（Update / Synthesize）** `wiki/` 中受影响的多个页面，建立 `[[wikilinks]]` 双向链接并附上 `raw/` 来源引用。
3. **`AGENTS.md`（知识编译器规范 / Schema）**：规定 `wiki/` 允许有哪些目录分类、Frontmatter 元数据字段怎么写、什么情况下拆新页、什么情况下合并旧页。

---

## 三、交互模拟器：亲手对比传统 RAG 与 LLM Wiki 的三大操作

LLM Wiki 围绕三个标准动作运转：**`Ingest`（摄入与增量综合）**、**`Query`（基于综合视图的检索）** 与 **`Lint`（定期知识库健康巡检）**。

在下方模拟器中，依次点击 **批次 1 → 批次 2 → 批次 3** 投喂增量医院资料，并切换 **`Ingest / Query / Lint`** 模式，观察传统 RAG 与 LLM Wiki 的巨大反差：

<RagVsWikiSimulator />

---

## 四、从 LLM Wiki 到 `llm-ontology` 的关键跃迁

你在对话中提出了一个极其敏锐的洞察：

> 「原始资料不可更改但是格式多样、内容繁杂、噪音非常多，需要 Agent 分析。LLM Wiki 是一种非常好的数据分析方法，它本身是面向 Wiki 的，做了一套定义——这完全可以改成 Ontology 的定义，直接叫做 **LLM Ontology**，本质上就是从原始数据编译成定义好的知识架构，然后捕捉关系！」

完全正确！对比两者可以看到一条清晰的进化脉络：

| 对比维度 | Karpathy LLM Wiki | 本项目 `llm-ontology` |
|---|---|---|
| **不可变输入层** | `raw/`（文档、论文、笔记） | **Source Corpus**（医院 SOP、访谈录音、HIS/EMR/LIS 数据库快照、运行日志） |
| **编译规则定义** | `AGENTS.md`（自然语言编写的 Wiki 维护规范） | **Typed Meta-model**（严格规定 `EntityType`、`Relation`、`StateMachine`、`Action`、`Policy AST` 的元模型） |
| **中间消歧层** | 由 Agent 在合入 Markdown 时直接综合 | 独立设置 **Evidence & Claim Graph**（显式保存未消解冲突、模态与 Fragment Hash） |
| **编译输出产物** | `wiki/*.md`（面向人类与 Agent 阅读的互联 Markdown 知识网） | **Canonical Ontology + Derived SaaS Artifacts**（可驱动前后端、数据库、策略守卫与 Agent 工具的正式业务契约） |
| **健康巡检 (Lint)** | 检查死链、孤立笔记、文字表述矛盾 | **确定性编译器验证门**：AST 静态类型检查、状态机死锁检测、正负例契约测试 |

换句话说：**`llm-ontology` 吸收了 LLM Wiki “保持原始资料不可变、通过持续增量编译而非临时切片检索来构建结构化认知”的灵魂，并将其输出目标从“非正式的 Markdown 维基”升级为“类型安全、可执行、可编译出 SaaS 的正式业务本体”**，同时保留 LLM Wiki 作为第三闭环（学习闭环）的经验沉淀层！

## 下一课预告

在社区围绕 Karpathy 蓝图构建的众多开源项目里，最受欢迎的工程化实现是 [`nashsu/llm_wiki`](https://github.com/nashsu/llm_wiki)。它的内部图算法是怎么设计的？在我们的系统里，**LLM Wiki 与 Canonical Ontology 究竟如何通过稳定 ID 实现双向锚定，又为什么要严守“Wiki 不直接控制业务动作”的红线？** 请看下一课：**[nashsu/llm_wiki 与本体双向锚定](/wiki/nashsu-implementation)**。
