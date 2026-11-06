---
title: 投影式编辑：模型才是唯一事实源
description: 深入理解 JetBrains MPS 的 Projectional Editing（投影式编辑）设计哲学：为什么代码和界面都只是同一份结构化 AST 模型的不同投影。
---

# 投影式编辑：模型才是唯一事实源

核心参考：[JetBrains MPS (Meta Programming System)](https://www.jetbrains.com/help/mps/basic-notions.html) 与 [MPS 2026.1 Projectional Agent Toolkit](https://www.jetbrains.com/help/mps/mps-projectional-agent-toolkit.html)。

在将业务需求转化为软件系统的过程中，传统软件工程一直存在一道巨大的裂痕：
- **业务方（医院医务科、临床主任、运营主管）** 看的是 Word 版的 PRD、流程图和原型图；
- **前后端工程师** 看的是 TypeScript 代码、SQL 表结构和接口文档；
- **AI Agent** 看的是 System Prompt 和 JSON Tool Schema。

很快，这三份东西就会各自演化、互相打架：**PRD 早就过期了，前端改了一个校验逻辑没同步给后端，而 Agent 还在按三个月前的 Prompt 调工具。**

**JetBrains MPS（Meta Programming System）** 为我们提供了一把解开这道死结的钥匙。它最核心的贡献不是某一种具体的 DSL 语法，而是 **Projectional Editing（投影式编辑）** 的设计哲学：**结构化模型（Typed AST）才是唯一的规范性事实源，而业务表单、代码定义与 Agent 契约都只是同一份底层模型的不同“投影（Projections）”。**

::: tip 读完这一页你应该能回答
- **传统文本解析（Parser-based）** 与 **MPS 投影式编辑（Projectional Editing）** 的工作流有什么本质差异？
- 为什么同一份 `DischargePathway`（出院协同路径）底层模型，可以同时向 **医务科人员、数据治理工程师、AI Agent** 投射出截然不同但 100% 同步的视图？
- 当用户在可视化界面上操作时，如何区分 **语义修改（触发 Model ChangeSet）** 与 **纯视觉修改（仅改 UI 样式）**？
:::

## 一、传统文本编辑 vs. MPS 投影式编辑

在传统软件开发（包括用 YAML / Markdown 写配置）中，人类和 Agent 操作的都是**纯文本字符流**：

- **传统文本解析路径**：
  $$\text{编辑字符文本 (Text)} \xrightarrow{\text{Lexer / Parser 解析}} \text{抽象语法树 (AST)} \xrightarrow{\text{校验与编译}} \text{可执行程序}$$
  只要文本语法稍微写错一个缩进、或者改了一个名字忘了全局替换引用，Parser 就会报错，且纯文本天然只能呈现一种固定形态（代码形态）。

- **JetBrains MPS 投影式编辑路径**：
  $$\text{底层结构化模型 (Typed AST with Stable IDs)} \xleftrightarrow{\text{双向投影引擎 (Projector)}} \begin{cases} \text{投影 1：面向业务人员的自然语言/表格/状态流视图} \\ \text{投影 2：面向工程师的强类型 Schema 与约束代码视图} \\ \text{投影 3：面向 AI Agent 的 MCP Tool & Policy 契约视图} \end{cases}$$

在 MPS 中，模型从诞生起就以**带有稳定唯一标识（Node ID）的抽象语法树（AST）与交叉引用图**持久化。无论是人类在界面上勾选一个开关，还是 Agent 调用结构化工具修改一个节点，本质上都是在**直接编辑同一棵 AST 的节点属性**，随后三个视图瞬间同步重绘！

---

## 二、交互沙盒：体验同一份出院协同模型的三种角色投影

下面是根据 MPS 投影式编辑思想构建的交互沙盒。底层只有**唯一一份** `hospital.discharge_pathway` 结构化 AST 节点。

请你尝试在顶部的控制栏中：
1. 修改概念的中文显示名称（观察稳定 ID `hospital.discharge_pathway` 是否保持不变）；
2. 切换 **「启用日间手术主治医师单签放行」** 开关；
3. 调整 **「允许未处理危急值上限」** 或 **「带药前置预审提前量」**；
4. 来回切换 **投影 ①（医务科视图）**、**投影 ②（数据治理工程师视图）** 与 **投影 ③（AI Agent 视图）**，观察它们如何与右侧的底层 AST 实时保持零漂移同步：

<ProjectionalViewSwitcher />

---

## 三、为什么这种哲学对 Agentic SaaS 具有决定性意义？

在你在对话中构想的“乙方全部由 Agent 承担”的闭环中，最大的挑战是：**客户不可能看懂几千行代码或 OWL 本体文件，但客户又必须对核心业务规则拍板负责。**

通过引入 MPS 式的投影机制，我们实现了两全其美：

1. **业务人员只审阅他能100%看懂的投影（Preview as Evidence Gathering）**：
   医务科主任在“投影 ①”里看到的是清晰的中文规则卡片、流程图和仿真工单界面。当他在界面上把“日间手术要求科主任双签”改为“允许主治单签”时，他不需要懂任何 AST 或 JSON——**他的这次点击本身就被转换成了对底层模型的结构化变更提案（Model ChangeSet），并附带了他的审批签名证据！**
2. **唯一规范性事实源（Single Normative Source of Truth）**：
   注意，这里的“唯一事实源”并不是说全医院只能有一个物理数据库，而是**同一条业务规则绝不允许存在多份互相冲突的权威定义**。一旦底层 AST 模型更新并通过验证门，前端表单校验、后端 `Action Executor` 守卫、API 文档、Agent Tool Schema 以及自动化回归测试全部由同一个模型驱动更新。

---

## 四、重要工程边界：区分「语义修改」与「纯视觉修改」

在设计可视化 Model Studio 与 Preview 工作台时，必须画清一条边界——**并不是用户在界面上的每一次点击都要触发完整的 Ontology 审批与重编译流程**：

| 用户在 Preview 界面上的操作 | 变更性质 | 系统处理路径 |
|---|---|---|
| 删除“主治医师临床准出审核”步骤、修改危急值拦截阈值、新增一个床位状态枚举 | **业务语义修改 (Semantic Change)** | 生成结构化 `Model ChangeSet` → 触发依赖影响分析 → 静态类型检查 → 走授权审批流程 → 发布新版本 `Canonical Ontology` |
| 调整看板卡片圆角、修改柱状图配色、拖拽列宽、切换深浅色主题 | **纯视觉展示修改 (Visual/UI Change)** | 仅更新 `View Projection` 的本地样式配置（UI Theme / Layout State），**不改变**领域模型版本号，也无需重新编译后端守卫 |

## 下一课预告

既然 MPS 里的模型也是由“概念（Concept）”组成的，而我们的业务 Ontology 里也有“概念（Concept）”，这两者究竟处于什么抽象层级？JetBrains 在 MPS 2026.1 新推出的 **Projectional Agent Toolkit** 又是如何让 Agent 安全操作 AST 的？下一课我们将深入 **[三层抽象阶梯：Meta-model、Domain Model 与 Runtime Instance](/mps/meta-modeling)**。
