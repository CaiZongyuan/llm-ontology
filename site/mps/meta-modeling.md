---
title: 三层抽象阶梯：元模型、领域模型与实例
description: 厘清 Meta-model（M2）、Domain Model（M1 / TBox）与 Runtime Instance（M0 / ABox）的三层抽象关系，以及如何借鉴 MPS 思想构建轻量级 Web-first 元模型。
---

# 三层抽象阶梯：元模型、领域模型与实例

在深入学习 JetBrains MPS 和本体工程时，最容易让人绕晕的一个词就是 **`Concept`（概念）**：
- 在 MPS 的语言设计文档里，定义一个建模原语叫创建一个 `Concept`；
- 在医院业务本体里，定义“住院就诊（`Encounter`）”或“床位（`Bed`）”也叫创建一个 `Concept`。

它们是一回事吗？**完全不是，它们处在不同的抽象阶梯上。** 把这三个抽象层次彻底分清，你就能瞬间看懂任何复杂建模系统（包括 MPS、LinkML、OWL 以及我们的 `llm-ontology`）的底层骨架。

::: tip 读完这一页你应该能回答
- **Meta-model（元模型 M2）**、**Domain Model（领域模型 M1 / TBox）** 与 **Runtime Instance（运行时实例 M0 / ABox）** 各自規定什么？
- 为什么 Agent **可以提议修改领域模型（M1）**，却**绝不能绕过权限直接伪造运行时业务事实（M0）**，更**不能随意篡改元模型（M2）**？
- MPS 是如何用 **树形 Containment（包含树）+ Cross-References（跨节点引用）** 同时兼顾 AST 的严谨性与知识图谱的网状关联的？
- 面对 Web-first 的 Agentic SaaS，我们应该直接把 JetBrains MPS (Java/JVM) 搬上服务器，还是吸收其思想用 TypeScript 实现轻量级元模型？
:::

## 一、一张表看懂三层抽象阶梯（M2 → M1 → M0）

借用模型驱动工程（MDE / OMG MOF）与描述逻辑（TBox / ABox）的经典分层，我们的系统由上至下分为三层：

| 抽象层级 | 名称 | 核心职责（一句话定义） | 在 `llm-ontology` 中的具体体现 | 谁有权修改？ |
|---|---|---|---|---|
| **M2 层** | **Meta-model（元模型）** | 定义**“如何描述一个业务世界”**（规定建模语言的语法与合法原语） | 规定模型里只允许出现 `EntityType`、`Property`、`Relation`、`StateMachine`、`Action`、`Policy` 等 12 种节点类型及其类型检查规则。 | **平台核心架构师**（极少变动，是编译器的基石） |
| **M1 层** | **Domain Model（领域模型 / TBox）** | 定义**“这家医院的业务世界是什么样的”**（即 Canonical Ontology） | 用 M2 的原语定义医院里的 `Patient`、`Encounter`、`DischargePathway`、`ConfirmMedicallyFit` 动作与签字审批策略。 | **建模 Agent 提议 (`ChangeSet`) + 医院业务专家审批** |
| **M0 层** | **Runtime Instance（运行时实例 / ABox）** | 记录**“病房里实际发生了什么具体事实”** | `Encounter-2026-089`（张某）、`Bed-302`、`MedicallyFitConfirmed` 事件记录。 | **真实业务操作 / Agent 调用受控 `Action` 经后端守卫写入** |

### 为什么分清这三层对 Agent 安全至关重要？

如果把 M1（领域模型）和 M0（运行时实例）混在一起，就会发生两类灾难：
1. **灾难一（拿推测当事实）**：Agent 在阅读历史资料时推测“张某应该已经办完出院了”，如果它没有 M1/M0 隔离，直接去改 M0 数据库状态，就会造成严重的账实不符；在 `llm-ontology` 中，Agent 在运行期只能调用 M1 中声明的 `Action`，由确定性守卫校验通过后才能变更 M0。
2. **灾难二（越权改规则）**：当运行期遇到一次报错（例如权限不足被拦截），如果没有 M1 的受控发布机制，失控的 Agent 可能会试图直接去修改 M1 的 `Policy` 定义来让自己通过检查！因此，M1 的任何修改都必须走独立的 **需求与学习闭环（ChangeSet + 人工审批）**，运行期的 Agent 对 M1 只有**只读引用权**。

---

## 二、树与图的统一：AST 包含树 + 交叉引用（Cross-References）

在软件工程中，编译器喜欢**树（AST）**，因为树有明确的父子所有权（Containment）、易于做作用域分析和递归类型检查；而领域知识天然是**图（Graph）**，因为实体之间充满交叉引用甚至环路。

JetBrains MPS 给出了一个极其优雅的混合结构，这也是 `llm-ontology` 采用的内部表示：**以树形包含（Containment Tree）为骨架，以稳定 ID 交叉引用（Cross-References）为经纬。**

```text
Namespace: hospital.discharge (树形包含骨架 Containment)
├── EntityType [id: hospital.encounter]
│   ├── Property [id: hospital.encounter.type] (Enum: Inpatient | DaySurgery)
│   └── Property [id: hospital.encounter.pending_critical_labs] (Integer)
├── EntityType [id: hospital.bed]
│   └── Property [id: hospital.bed.cleaning_status] (Enum)
├── Relation [id: hospital.rel.occupies_bed]
│   ├── sourceRef ──(稳定 ID 引用)──> hospital.encounter
│   └── targetRef ──(稳定 ID 引用)──> hospital.bed
└── Action [id: hospital.action.confirm_medically_fit]
    ├── targetEntityRef ──(稳定 ID 引用)──> hospital.encounter
    └── policyRef ──(稳定 ID 引用)──> hospital.policy.signoff
        └── Condition AST (树形表达式节点，支持严格类型推导)
```

你看：
- **每个实体有哪些属性、每条策略的布尔表达式怎么嵌套**，是严格的**树（AST）**，因此编译器可以瞬间完成静态类型检查；
- **关系连接哪两个实体、动作受哪条策略约束、视图绑定哪个动作**，是通过稳定 ID 连接的**有向图（Semantic Graph）**。

---

## 三、MPS 2026.1 Projectional Agent Toolkit 与我们的技术选型

在 2026 年发布的 **JetBrains MPS 2026.1** 中，官方推出了实验性的 **[Projectional Agent Toolkit](https://www.jetbrains.com/help/mps/mps-projectional-agent-toolkit.html)**：它通过 MCP 协议向外部 AI Agent 暴露结构化的 AST 节点读写、约束检查、类型诊断与生成器调用接口，让 Agent 直接按节点 ID 操作模型，而不是去硬改 MPS 底层复杂的 XML 存储文件。

这印证了我们的判断：**“让 AI Agent 通过结构化模型接口而非自由文本去构建和维护业务系统”已经是行业最前沿的共识。**

### 为什么我们在 `llm-ontology` 中选择“吸收 MPS 思想，自建轻量级 TypeScript 元模型”？

既然 MPS 这么强大，为什么不直接把 JetBrains MPS 作为 SaaS 的运行时底座？

| 考量维度 | 直接依赖 JetBrains MPS (Java/JVM) | `llm-ontology` 方案：自建 TypeScript Meta-model + AST |
|---|---|---|
| **目标用户与部署形态** | 面向桌面端重度语言工程师的重量级 IDE | Web-first 的企业/医院 Agentic SaaS，需在浏览器内直接向医务科与业务方渲染交互式三视图 Preview |
| **与现代全栈与 Agent 生态集成** | 需要跨 JVM 桥接，Agent Toolkit 仍处于官方标记的 Experimental 阶段 | 原生采用 **TypeScript + Zod + JSON AST**，与 React/Vue、Hono、PostgreSQL 及 MCP 工具链零阻抗融合 |
| **复杂度控制** | 包含完整的通用编程语言生成器体系，初期心智负担极重 | 紧扣业务本体所需的 **12 个核心原语**，几百行代码即可实现完整的静态类型检查器与多目标编译器 |

因此，最明智的工程路线是：**全面吸收 MPS 的「投影式编辑、稳定节点身份、树+图混合表示、静态类型检查与代码生成」五大核心哲学，用轻量的 TypeScript + PostgreSQL 构建专为 Agentic SaaS 量身定制的 `llm-ontology` 编译器。**

## 下一课预告

铺垫完了四大基石（Ontology 八层解剖与医院数据治理、Auto-Ontology 与 Semantica、Karpathy LLM Wiki、JetBrains MPS），现在我们正式进入第五模块——全面揭晓 **[本项目 `llm-ontology` 的终极内部架构](/architecture/overview)**！
