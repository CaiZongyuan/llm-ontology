---
title: Ontology 的八层解剖
description: 用医院患者出院协同实例拆解 Ontology 的八个认知层次，区分 RDF/OWL、知识图谱、语义层、状态机与工作流。
---

# Ontology 的八层解剖

很多工程师第一次接触 Ontology（本体）时，容易陷入两个极端：要么把它想成十年前语义网（Semantic Web）里晦涩难懂的 `RDF / OWL / SPARQL` 学术规范；要么把它简单等同于 Neo4j 图数据库里的一堆节点和连线。

要让 Ontology 在 Agent 时代真正落地，我们必须先把附着在同一个业务对象上的**八个不同层次的信息**剥离开来。

::: tip 读完这一页你应该能回答
- 同样面对“心内科 302 床患者张某准备出院”这件事，哪些属于 **权威本体（TBox）**、哪些属于 **运行时状态与事件（ABox）**、哪些属于 **经验知识（LLM Wiki）**？
- **Ontology Graph（本体关系图）**、**State Machine（状态机）** 与 **Workflow Graph（工作流图）** 这三张“图”有什么本质区别？
- 为什么传统知识图谱（Knowledge Graph）、数据语义层（Semantic Layer）和可执行业务本体（Operational Ontology）不能混为一谈？
:::

## 交互实验：解剖住院患者 `Encounter-2026-089` 的八个层次

假设医院心内科三病区 302 床有一位术后恢复良好的患者张某（就诊流水号 `Encounter-2026-089`），主治医师已签发临床准予出院（`MedicallyFit`），但因为还有一项复查心脏超声未出报告、出院带药尚未经中心药房核对，床位暂未释放。

点击下方解剖器中的 **L1 ~ L8**（或按顶部分类过滤），观察每一层的真实数据结构、权威存储位置以及最容易踩中的工程误区：

<OntologyLayerExplorer />

---

## 核心辨析一：为什么不能把前四层与后四层混成一个图？

从上面的交互解剖中可以看到，最关键的分界线在于 **TBox（类型与契约定义）**、**ABox（运行实例与历史事件）** 和 **Knowledge（综合经验）** 的分离：

1. **L1 概念、L2 关系、L3 约束、L7 动作动作契约** 定义的是**“这家医院的业务规则是什么”**。它们变化频率低、要求绝对严谨、必须经过版本控制与人工审批，构成了 **Canonical Ontology（权威本体）**。
2. **L4 具体实例、L5 当前状态、L6 历史事件** 记录的是**“今天病房里实际发生了什么”**。它们每秒钟都在高速变化，应当存储在事务型关系数据库（PostgreSQL / HIS）与事件日志中，而**不应当**塞进本体定义文件里。
3. **L8 经验知识** 记录的是**“我们从过去三个月的运行轨迹中学到了什么规律”**。它由 LLM Wiki 持续编译维护，通过稳定的本体 ID（如 `hospital.encounter`、`hospital.discharge_pathway`）挂载在概念上，为 Agent 提供上下文参考，但绝不能直接越权修改 L3 的约束或绕过 L7 的动作守卫。

---

## 核心辨析二：三张不同的“图”（Ontology vs. 状态机 vs. Workflow）

在讨论业务系统时，很多人会问：“万物是不是都可以抽象成状态机？或者抽象成一张 DAG 工作流图？”

答案是：**状态机非常适合描述单个业务对象的生命周期，但绝对无法替代完整的业务世界模型。** 真实 SaaS 必须同时组合三张不同维度的“图”：

| 图的类型 | 负责描述的维度 | 拓扑特征 | 医院出院协同示例 |
|---|---|---|---|
| **1. Ontology Graph（本体语义图）** | 业务对象类型及跨对象关联 | **允许存在环路（Cyclic）** 与双向逆关系 | `Patient` 产生 `Encounter`；`Encounter` 占用 `Bed`；`Bed` 属于 `Ward`；`Ward` 排班 `Nurse`；`Nurse` 照护 `Patient`（形成业务闭环）。 |
| **2. State Machine（对象状态机）** | **单个业务对象**内部允许发生的状态跃迁 | 有限状态有向图（含守卫条件 Guard 与不变量 Invariant） | 单个 `DischargePathway` 从 `InTreatment` → `MedicallyFit` → `DischargeTasksPending` → `ReadyForDischarge` → `Discharged`。 |
| **3. Workflow Graph（任务工作流图）** | 一项跨角色、跨系统的**协作任务**如何推进 | 包含并行分支、条件等待、超时重试与补偿事务（Saga） | 出院准备任务流：并行触发「LIS/PACS 催检」与「药房带药预审」→ 汇总完成后触发「床位终末消毒排程」→ 超时未完成则升级通知住院总。 |

当我们吸收 **JetBrains MPS** 的结构化建模思想时，这三张图不再是割裂的三套系统，而是统一在同一个 **Meta-model（元模型）** 下的不同原语：`EntityType` 与 `Relation` 构成第一张图，`StateMachine` 绑定在实体上构成第二张图，`Action` 与 `Workflow` 引用实体状态构成第三张图。

---

## 核心辨析三：RDF/OWL、知识图谱、语义层与 Operational Ontology

为了在阅读开源项目时不迷失方向，我们可以用下面这张对比表给四个常见概念定坐标：

| 体系名称 | 核心关注点 | 典型存储 / 工具 | 在医院出院场景中的局限或定位 |
|---|---|---|---|
| **RDF / OWL 形式化本体** | 概念分类学（Taxonomy）、形式逻辑公理（Axioms）与开放世界逻辑推理 | OWL、SPARQL、Protégé、RDF Triplestore | 适合医学标准词表（如 SNOMED CT、ICD-11），但直接用来做 SaaS 事务、权限守卫与 UI 生成过于笨重。 |
| **传统知识图谱 (Knowledge Graph)** | 聚焦实体实例及其关系三元组（如 `张某 - 确诊 -> 冠心病`） | Neo4j、FalkorDB、图向量混合检索 | 擅长跨文档关联问答，但通常缺乏严格的业务状态机、指标口径定义与写操作事务契约。 |
| **数据语义层 (Semantic Layer)** | 聚焦物理数据库表到业务概念与统计指标的映射 | **NVIDIA Auto-Ontology**、dbt Semantic Layer、Cube | 解决了 Text-to-SQL 的“找表、找字段、统一指标计算口径”问题，但默认是**只读分析层**，不包含业务动作（Action）。 |
| **可执行业务本体 (Operational Ontology)** | 同时包含**语义层（对象/属性/关系/指标）**与**动力层（状态机/动作/权限策略）** | **Palantir Foundry Ontology**、本项目 **`llm-ontology`** | 既能回答“平均出院准备时长是多少”，又能受控执行“确认临床准出并排程床位消毒”，是 Agentic SaaS 的完整核心。 |

## 下一课预告

既然我们要把主线案例放在**智慧医院与医疗数据治理**，那么医院信息化领域目前最权威的参考标准是什么？英国 NHS 是如何用 Palantir Ontology 管理全国医院床位与手术周转的？下一课我们将完整拆解 **[医院数据治理与 Agentic Hospital 参考框架](/ontology/hospital-governance)**。
