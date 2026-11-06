---
title: 双图架构：Evidence Graph 与 Domain Graph
description: 深入解析为什么原始资料不能直接写入正式本体，掌握 Source → Fragment → Claim → ChangeSet → Canonical Ontology 五级数据表示与五维冲突消解机制。
---

# 双图架构：Evidence Graph 与 Domain Graph

在构建 `llm-ontology` 时，最核心的第一条设计原则就是：**整个系统必须拆分为两张语义截然不同的逻辑图——证据与主张图（Evidence Graph）和领域模型图（Domain Graph）。** 它们可以共用底层的 PostgreSQL 数据库，但绝不允许混淆语义。

::: tip 读完这一页你应该能回答
- 为什么绝不能让 LLM 从原始文档里边读边直接往正式 Ontology 里写规则？
- 从原始 PDF/数据库到可运行 SaaS，数据依次经过哪 **五种核心表示（5 Core Representations）**？
- 每个 `Claim`（事实主张）为什么要包含 **`modality`（规范性 / 描述性 / 观察性 / 假设性）**？
- 当遇到多份资料相互矛盾时，**五维冲突消解（Identity / Scope / Time / Authority / Semantics）** 与 **概念注册表（Concept Registry）** 是如何工作的？
:::

## 一、为什么我们需要两张不同的图？

想象你走进一家三甲医院采集「患者出院协同」的业务规则，拿到了四份真实材料：
1. **文件 A（《住院患者出院管理制度 2024》）**：“所有病区住院患者办理出院前，必须由主治医师与科主任双签审核。”
2. **文件 B（《日间手术中心绿色通道规定 2026》）**：“符合 24 小时出院标准的日间手术患者，允许主治医师单签确认临床准出。”
3. **录音 C（心内科夜班护士访谈）**：“周末急诊催床太紧时，医生在手术室没空点系统，我们经常先在床位系统里点释放床位，后面再补签。”
4. **数据 D（HIS 历史表扫描）**：“过去半年存在 42 条床位释放时间早于医师签字时间的记录。”

如果只有一个知识图谱，或者让 Agent 按“少数服从多数 / 最新覆盖最旧”直接改写本体，就会发生灾难：
- 要么文件 B 覆盖了文件 A，导致普通重症住院患者也变成了单签放行；
- 要么录音 C 和数据 D 被当成“实际业务规则”，让 AI 自动学会了“周末可以跳过医生签字直接释放床位”的违规操作！

为了彻底解决这一难题，我们将认知过程拆分为两张图：

<div class="wb-grid2">
  <div class="wb-panel">
    <div class="wb-panel-head"><span>1. EVIDENCE GRAPH (证据与主张图)</span><span>EPISTEMIC LAYER</span></div>
    <div class="wb-panel-body">
      <strong>描述“我们为什么相信某个业务主张”</strong>
      <p style="margin-top:8px;font-size:13.5px;color:var(--ink-2)">链路：<code>Source → Fragment → Claim → Decision</code>。<br/><strong>允许不确定、重复、相互矛盾甚至后续被驳回的主张同时共存</strong>。记录每条主张的原始片段 Hash、提取时间与模态（规范要求 vs. 观察事实）。</p>
    </div>
  </div>
  <div class="wb-panel">
    <div class="wb-panel-head"><span>2. DOMAIN GRAPH (权威领域模型图)</span><span>NORMATIVE LAYER</span></div>
    <div class="wb-panel-body">
      <strong>描述“当前正式采用的医院业务契约”</strong>
      <p style="margin-top:8px;font-size:13.5px;color:var(--ink-2)">链路：<code>EntityType → Relation → StateMachine → Action → Policy AST</code>。<br/><strong>要求 100% 类型合法、引用完整、无未消解冲突且具备明确版本号</strong>，是驱动前后端与 Agent 守卫的唯一规范事实源。</p>
    </div>
  </div>
</div>

---

## 二、五级核心数据表示与 W3C PROV-O 溯源链

借鉴编译器的多级中间表示（IR）思想，`llm-ontology` 规定了五种严格分层的数据结构：

| 层级 | 数据表示名称 | 存储的核心内容 | LLM 是否有权直接改写？ | 核心目的 |
|---|---|---|---|---|
| **L1** | **Source Corpus** | 原始 PDF、Word、访谈录音、网页快照、数据库采样快照及 SHA-256 内容哈希 | **严禁改写（只读不可变）** | 永久保留原始证据底座 |
| **L2** | **Evidence Graph** | 精确定位的资料片段（`Fragment`）、提取出的事实主张（`Claim`）及支持/反驳边 | 可追加与修订派生记录 | 忠实表达当前从资料中读到了什么及矛盾所在 |
| **L3** | **Candidate Ontology** | 经冲突消解与实体对齐后生成的候选实体、关系、状态机、策略草案 | 可以生成与修改提案 | 形成供三视图 Preview 审阅与类型检查的模型草案 |
| **L4** | **Canonical Ontology** | 已通过 AST 静态类型检查并获人工签署批准（`ChangeSet`）的正式版本化本体 | **严禁直接覆盖（仅限受控变更集）** | 作为全系统业务语义与权限的唯一规范性权威 |
| **L5** | **Derived Artifacts** | 自动生成的 Zod Schema、数据库迁移、后端 `Policy Guard`、UI 看板、MCP 工具与测试 | 由编译器插件确定性生成 | 将权威本体投入真实生产运行 |

这样一来，生产系统中运行的任何一条策略守卫，都拥有一条坚不可摧的 **W3C PROV-O 逆向溯源链**：

$$\text{Running Policy Guard} \xrightarrow{\text{compiledFrom}} \text{Canonical Policy Node} \xrightarrow{\text{approvedIn}} \text{ChangeSet \#042} \xrightarrow{\text{wasDerivedFrom}} \text{Claim-09} \xrightarrow{\text{extractedFrom}} \text{Fragment (Page 2, Hash 3c42b)} \xrightarrow{\text{partOf}} \text{Original SOP PDF}$$

---

## 三、`Claim` 的核心数据结构：为什么要区分四种模态（Modality）？

在 `packages/evidence` 中，每条从 `Fragment` 提取出的 `Claim` 都不是一句简单的自然语言，而是带有严格模态标注的结构化对象：

```typescript
export interface Claim {
  id: string;                     // 如 "claim-09"
  subject: string;                // 关联的候选概念或稳定 ID
  predicate: string;              // 断言谓词，如 "requiresSignoffBy"
  object: unknown;                // 断言目标或规则结构

  // 核心设计：严格区分主张的认识论模态！
  modality:
    | "normative"                 // 规范性要求（SOP/法规规定“必须/应当如何”）
    | "descriptive"               // 描述性定义（业务字典定义“什么是日间手术”）
    | "observational"             // 观察性事实（日志/访谈反映“实际发生过什么”）
    | "hypothetical";             // 假设性推论（Agent 在信息不全时提出的待确认假设）

  scope: Record<string, unknown>; // 适用条件，如 { encounterType: "DaySurgery" }
  evidenceFragmentIds: string[];  // 绑定的原始 Fragment ID 列表

  evidenceStatus:
    | "proposed"                  // 刚提取出
    | "supported"                 // 有多源或强证据支持
    | "disputed"                  // 存在未消解冲突
    | "rejected";                 // 证据证伪或被判无效
}
```

**为什么要把 `evidenceStatus`（证据评估状态）与正式模型的 `modelStatus`（业务批准状态）彻底分开？**
因为“夜班曾有 42 次未签字先释放床位”（`Claim-12`）在 `evidenceStatus` 上是 **`supported`（确有其事，证据确凿）**，但它的 `modality` 是 **`observational`（观察到的历史违规事实）**——它在正式业务规则准入（`modelStatus`）上必须被判定为 **`Rejected`（严禁成为系统合法规则）**！

---

## 四、交互实验台：亲手消解医院四份冲突资料并生成 ChangeSet

当两条 `Claim` 看似矛盾时，Agent 绝不能简单按出现频次投票，而是必须从五个维度进行比较消解：
1. **Identity（身份维度）**：两份材料谈论的是同一个业务实体吗？
2. **Scope（范围维度）**：是否分别适用于不同院区、不同就诊类型（普通住院 vs. 日间手术）或不同紧急程度？
3. **Time（时间维度）**：是否存在明确的生效日期与废止替代关系（2026 新规补充 2024 旧规）？
4. **Authority（权威维度）**：院级红头 SOP、个人访谈吐槽与历史脏数据的规范效力是否不同？
5. **Semantics（语义维度）**：是一般规定与特例豁免（Exception），还是真正的逻辑互斥？

在下方双图实验台中，点击 **`Claim-04`、`Claim-09`、`Claim-12`** 查看它们各自的原始文档片段溯源，然后点击右上角 **「运行五维冲突消解」**，观察系统如何将前两条合成为带 `Scope` 分支的 `Model ChangeSet #042`，同时将 `Claim-12` 拦截在权威本体门外：

<EvidenceReconcileLab />

---

## 五、Semantic Reconciliation：概念注册表（Concept Registry）与实体对齐

除了规则冲突，多源数据治理的另一大难题是**“同物异名”与“同名异物”**：
- **同物异名**：HIS 里的 `inpatient_visits`、EMR 里的 `admission_records`、护理看板上的“在院患者登记单”，指的都是同一个业务概念 `hospital.encounter`。
- **同名异物 / 取值巧合**：HIS 表里 `patient_id`（患者）和 `payer_id`（付款人/参保人）在 95% 的自费/本人医保记录里完全相同；或者“危急值通报单”与“不良事件上报单”表面都叫“医疗预警单”，但业务生命周期完全不同。

因此，`llm-ontology` 设立了独立的 **Concept Registry（概念注册表）**，规定 Agent 发现候选概念时只能提出以下三种受控原语操作之一：

| 注册表操作原语 | 语义含义 | 医院数据治理示例 | 审查级别 |
|---|---|---|---|
| **`LINK_ALIAS`** | 仅向已有概念追加一个同义词或物理字段别名 | 将 EMR 的 `inp_id` 和 LIS 的 `encounter_id` 关联为 `hospital.encounter` 的别名 | 低风险（通过字段画像重合度验证即可） |
| **`MERGE_CONCEPT`** | 认定两个候选概念在**业务身份（Identity）与生命周期**上完全等价，合并其属性与关系 | 将两套旧院区系统的 `WardBed` 与 `InpatientBed` 合并为 `hospital.bed` | **高风险（强制人工审批）**，一旦合错会污染下游外键与历史数据 |
| **`CREATE_CONCEPT`** | 创建一个拥有全新稳定 ID 的独立业务概念 | 拒绝将 `Payer`（付款方）合并入 `Patient`（患者），独立创建 `hospital.payer` 以支持亲属代付与商业保险场景 | 中风险（需通过元模型必填项检查） |

## 下一课预告

经过 `Evidence Graph` 的五维消解与 `Concept Registry` 的实体对齐，我们终于得到了干净的业务认知。接下来，在 **Domain Graph（权威本体）** 内部，我们究竟应该用哪些**最小元模型原语（Meta-model Primitives）**来表达这些概念、状态机、动作和权限策略？请看下一课：**[Meta-model 原语与类型化策略 AST](/architecture/meta-model)**。
