---
title: 一页看懂 Agent 时代的 Ontology
description: 为什么大模型直连数据库与纯 RAG 会失败，认知世界、业务世界与行动世界如何连接，以及「问→定→映→跑→记→改」六字框架。
---

# 一页看懂 Agent 时代的 Ontology

在构建企业级或智慧医院 **Agentic SaaS** 时，最常见的误区是把问题简化为“给大模型接一个向量知识库（RAG）”或者“给大模型开放 Text-to-SQL 数据库查询权限”。这两条路在真实生产环境中都会迅速撞墙。

这一课帮你建立一套可以反复复用的顶层认知框架：为什么 Agent 时代比以往任何时候都更需要 **Ontology（本体）**？它与 **JetBrains MPS**、**NVIDIA Auto-Ontology**、**Semantica**、**LLM Wiki** 各自负责什么问题？以及它们如何串成一个闭环？

::: tip 读完这一页你应该能回答
- 为什么让 LLM 直接连医院 HIS/EMR 数据库或只靠传统 RAG，既算不准指标也做不了受控操作？
- **认知世界**、**业务世界**与**行动世界**分别指什么？Ontology 在其中扮演什么角色？
- 「**问 → 定 → 映 → 跑 → 记 → 改**」六个字如何把所有关键技术串成一条完整工程流水线？
:::

## 为什么大模型直连业务系统会失控？

假设你正在为一家三甲医院建设**「患者出院协同与床位周转平台」**。医院内部已经存在三套核心异构系统：

- **HIS（医院信息系统）**：管理门诊/住院登记、床位计费、医保结算（表名如 `inpatient_visits`、`bed_charges`）。
- **EMR（电子病历系统）**：管理病程记录、出院小结、临床路径与医师签字（表名如 `admissions`、`discharge_summaries`）。
- **LIS / PACS（检验与影像系统）**：管理检验危急值与待出影像报告（表名如 `lab_orders`、`critical_alerts`）。

现在，住院总医师对 AI Agent 说了一句看似简单的话：

> 「帮我查一下上个月心内科出院患者的**平均出院准备时长**是多少？把今天已经满足出院条件但被**检验报告延迟**卡住的床位列出来，并通知后勤安排床位终末消毒。」

人类医务人员完全理解这句话里的每一个词。但如果让大模型直接连接数据库或检索文档，它会立刻遇到五道鸿沟：

1. **不知道数据在哪里、叫什么名字**：同一个“住院就诊”，在 HIS 里叫 `visit_no`，在 EMR 里叫 `inp_id`，在 LIS 里叫 `encounter_id`。
2. **不知道指标口径怎样算才合法**：“出院准备时长”的起点是医生下达预出院医嘱的时间、主治医师签发 `MedicallyFit` 的时间，还是护士打印结算单的时间？已取消入院或转科的患者算不算？
3. **无法保证跨 Agent 的一致性**：医务科的 Agent 和护理部的 Agent 每次现场猜 SQL，针对同一个问题会算出两个截然不同的数字。
4. **分不清“规范要求”与“历史违规习惯”**：如果 RAG 从某份夜班交班记录里检索到“周末医生忙，护士可以先在系统里点释放床位”，大模型可能会把违规习惯当成合法操作建议。
5. **缺乏可审计的行动边界（Kinetic Boundary）**：“通知后勤安排终末消毒”并释放床位，涉及状态流转、角色权限校验（主治医师是否已确认临床准出？危急值是否清零？）与事务写回——这不是一句 Text-to-SQL 能解决的。

---

## 连接三个世界的桥梁

要彻底解决上述问题，核心在于认识到企业与医院软件实际上同时运行在**三个世界**中：

<div class="wb-grid3">
  <div class="wb-panel">
    <div class="wb-panel-head"><span>1. 认知世界</span><span>WHAT SHOULD BE</span></div>
    <div class="wb-panel-body">
      <strong>业务概念、需求、规则、知识与证据</strong>
      <p style="margin-top:8px;font-size:13.5px;color:var(--ink-2)">什么是“住院就诊”？日间手术和普通住院的出院审批规则有何不同？有哪些法规、SOP 片段和历史经验支撑这些认识？</p>
    </div>
  </div>
  <div class="wb-panel">
    <div class="wb-panel-head"><span>2. 业务世界</span><span>WHAT IS NOW</span></div>
    <div class="wb-panel-body">
      <strong>真实对象、实时状态、事件与历史</strong>
      <p style="margin-top:8px;font-size:13.5px;color:var(--ink-2)">心内科 302 床的张某（<code>Encounter-2026-089</code>）此刻处于什么状态？他的心脏超声报告出来了吗？主治医师签字了吗？</p>
    </div>
  </div>
  <div class="wb-panel">
    <div class="wb-panel-head"><span>3. 行动世界</span><span>WHAT CAN WE DO</span></div>
    <div class="wb-panel-body">
      <strong>决策、工具调用、受控动作与反馈</strong>
      <p style="margin-top:8px;font-size:13.5px;color:var(--ink-2)">当前状态下允许调用哪些动作（<code>Action</code>）？谁有权限确认临床准出？执行后产生了什么领域事件与业务结果？</p>
    </div>
  </div>
</div>

**Ontology（本体）的核心使命，就是用机器可验证的结构化契约把这三个世界连接起来。**

在工程实践中，你可以用一个简洁的公式记住 Ontology 的最小认知模型：

$$\boxed{\text{Ontology} = \text{业务概念 (Entity)} + \text{语义关系 (Relation)} + \text{规则约束 (Policy)} + \text{受控动作 (Action)}}$$

Palantir Foundry 将前两者称为 **Semantic Layer（语义层：定义世界里有什么、如何映射数据）**，将后两者称为 **Kinetic Layer（动力/操作层：定义允许执行什么动作、遵循什么权限与状态机）**。两者结合，才构成真正面向 Agentic SaaS 的 **Operational Ontology（可执行业务本体）**。

---

## 用六个字记住整套技术体系：「问 → 定 → 映 → 跑 → 记 → 改」

在我们的对话中涉及了多项技术与开源方案。把它们放进**「问 → 定 → 映 → 跑 → 记 → 改」**的生命周期里，每一项技术的位置就一目了然：

| 环节 | 核心动作 | 负责回答的问题 | 对应的技术 / 开源标杆 |
|---|---|---|---|
| **1. 问 (Discover)** | 需求访谈与证据提取 | 散乱的 SOP、录音和老库里到底主张了哪些事实？存在什么冲突？ | **Uncertainty-aware Grilling** + **Evidence Graph** + `semantica` 溯源 |
| **2. 定 (Model)** | 结构化建模与类型校验 | 业务世界有哪些实体、状态机、动作与权限契约？如何向不同角色展示？ | **JetBrains MPS 投影式编辑思想** + **Canonical Ontology (Typed AST)** |
| **3. 映 (Map)** | 异构数据库语义发现与编译 | 逻辑模型如何映射到 HIS/EMR/LIS 物理表？如何生成前后端与工具？ | **NVIDIA Auto-Ontology**（数据发现与指标映射）+ **Model Compiler** |
| **4. 跑 (Operate)** | 受控业务运行与守卫拦截 | 真实事件触发时，Agent 装载什么上下文？写操作如何通过确定性权限校验？ | **Agent Harness** + **Ontology Context Resolver** + **Action Executor** |
| **5. 记 (Consolidate)** | 运行经验持续编译沉淀 | 运行轨迹、异常复盘与排障经验如何长期维护，而不退化为碎片切片？ | **Karpathy LLM Wiki** + **`nashsu/llm_wiki`**（`Ingest / Query / Lint`） |
| **6. 改 (Evolve)** | 受控变更提案与增量重编译 | 新发现的知识如何转化为模型变更提案，并只重编译受影响的下游模块？ | **Model ChangeSet** + **Incremental Semantic Compiler** |

::: warning 两条最重要的架构铁律（详见 ADR-0001）
1. **MPS 不是 Ontology 的竞争者**：MPS 解决“如何以结构化 AST 定义、校验和向不同角色投影模型”，而 Ontology 是我们用这种建模语言表达的“医院/企业业务世界”。
2. **LLM Wiki 绝不能替代 Ontology 直接控制业务动作**：LLM Wiki 擅长综合、解释和沉淀排障经验（如《周末出院带药拥堵复盘》），但经验知识不等于已批准的医院规则。任何对状态机、权限或动作的修改，必须生成结构化的 **Model ChangeSet**，通过静态类型检查与人工授权后，再发布为新版本 **Canonical Ontology**。
:::

---

## 交互预览：三个闭环与六个阶段如何接力？

点击下方六个阶段卡片（或点击“依次播放”），查看在「智慧医院出院协同」项目中，每个阶段如何接收上一阶段的产物、通过什么验证门，并在哪两处需要人类专家出场审批：

<LoopStageFlow :initial="0" />

## 接下来读什么？

- 立刻进入下一课 **[Ontology 的八层解剖](/ontology/anatomy)**：用住院患者 `Encounter-2026-089` 的真实数据，亲手在交互解剖器中拆解概念、关系、约束、实例、状态、事件、动作与经验知识。
- 或者查看 **[医院数据治理与 Agentic Hospital 参考框架](/ontology/hospital-governance)**：了解英国 NHS FDP、国内互联互通/DCMM 2025 与 FHIR / openEHR / OMOP 标准如何与本架构结合。
