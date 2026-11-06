---
title: Meta-model 原语与类型化策略 AST
description: 详解 llm-ontology 的四大分组 12 个核心元模型原语、稳定节点 ID、语义关系与物理外键分离，以及类型化策略 AST 编译检查。
---

# Meta-model 原语与类型化策略 AST

在 `llm-ontology` 中，最核心、也最值得自主研发的资产就是位于中间的 **Meta-model（元模型）与语义类型检查器（Semantic Type Checker）**。

设计元模型最容易犯的错误是“贪大求全”——试图一次性把所有编程语言特性、任意脚本逻辑、所有 CSS 样式全塞进本体语言里，结果造出一个无法验证也无法维护的怪兽。我们的原则非常明确：**第一版只保留足以完整表达企业/医院业务结构、行为、数据映射与视图投影的 12 个最小语义原语，并对所有规则采用严格的类型化 AST。**

::: tip 读完这一页你应该能回答
- `llm-ontology` 的第一版元模型包含哪 **四大分组、12 个核心原语**？
- 为什么模型节点必须拥有独立于显示名称的 **稳定身份标识（Stable Node ID）**？
- 为什么 **语义关系（Semantic Relation）** 必须与 **数据库物理外键（Physical Foreign Key）** 分离存储？
- 为什么正式本体的业务规则必须写成 **类型化策略 AST（Typed Policy AST）**，而绝不能保留为自然语言字符串？
:::

## 一、第一版 Meta-model 的四大分组与 12 个核心原语

我们将元模型原语收敛为四个职责清晰的分组：

| 原语分组 | 包含的节点类型 (`NodeKind`) | 核心职责 | 医院出院协同示例 |
|---|---|---|---|
| **1. 领域结构组 (Domain Structure)** | `EntityType`、`Property`、`Relation`、`Enum` | 定义医院业务世界有哪些对象、字段类型、值域枚举与关联契约 | `Encounter`、`Bed`、`DischargePathway`、`PathwayStatus` 枚举 |
| **2. 业务行为组 (Kinetic Behavior)** | `StateMachine`、`Action`、`Policy`、`EventType` | 定义对象生命周期状态流转、可执行动作、权限守卫 AST 与发出的领域事件 | `ConfirmMedicallyFit`、`ReleaseBed`、`MedicallyFitConfirmed` |
| **3. 数据语义组 (Data Semantics)** | `DataSource`、`Mapping`、`Metric` | 连接外部 HIS/EMR/FHIR 数据源、字段映射与可复用的统一统计指标（吸纳 Auto-Ontology） | `HIS_Postgres`、`EncounterMapping`、`AvgDischargePrepHours` |
| **4. 产品投影组 (Product Projection)** | `View`、`Workflow` | 定义面向医护/管理层的可视化看板投影与跨角色协作流程 | `WardDischargeBoardView`、`PreDischargeAuditWorkflow` |

---

## 二、设计铁律一：稳定节点身份（Stable Node ID）与显示名称解耦

假设在系统运行半年后，医院医务科提出：“把系统里所有的‘出院准备单（`DischargeTicket`）’统一改名为‘离院临床路径（`DischargePathway`）’。”

如果系统以名称字符串作为主键，改名就会被误判为“删除了旧实体、创建了新实体”，导致历史事件日志断裂、外键失效、前端组件全部报错。

因此在 `packages/model` 中，每个模型节点都遵循如下结构（实际代码使用 Zod Discriminated Union 对不同 `kind` 实施严格 Schema 校验）：

```typescript
export type NodeKind =
  | "EntityType" | "Property" | "Relation" | "Enum"
  | "StateMachine" | "Action" | "Policy" | "EventType"
  | "DataSource" | "Mapping" | "Metric"
  | "View" | "Workflow";

export interface ModelNode<TDef = unknown> {
  id: string;                // 永久稳定的语义身份，如 "hospital.discharge_pathway"
  kind: NodeKind;            // 原语类型
  namespace: string;         // 租户或领域命名空间，如 "nhs.cardiology"
  name: string;              // 代码标识符，如 "DischargePathway"
  displayName: string;       // 可随时修改的业务显示名，如 "患者出院协同路径"
  definition: TDef;          // 按 kind 严格类型化的 AST 定义体
  provenanceClaimIds: string[]; // 溯源绑定的 Evidence Graph Claim IDs
}
```

只要 `id: "hospital.discharge_pathway"` 不变，无论 `displayName` 或 `name` 怎么改，所有引用该 ID 的 `Relation`、`Action`、`Policy`、历史 `Domain Event` 与 `LLM Wiki` 锚点都稳如泰山。

---

## 三、设计铁律二：语义关系（Relation）与物理外键（Binding）解耦

在传统数据库建模或简单 Text-to-SQL 工具中，“关系”往往被等同于一句 `JOIN his.visits.bed_code = beds.code`。但在企业级 Ontology 中，一个 `Relation` 节点必须包含完整的业务契约，并将物理绑定拆到 `Mapping` 层：

| 关系契约属性 | 示例值 | 为什么要这样设计？ |
|---|---|---|
| **Source & Target Ref** | `hospital.encounter` → `hospital.bed` | 引用稳定 EntityType ID |
| **Semantic Role & Inverse** | 正向 `occupiesBed` / 逆向 `currentEncounter` | 让 Agent 从患者查床位、从床位反查患者都具备明确语义 |
| **Cardinality（基数约束）** | `0..1`（一位在院患者同时最多占用一张编制床位） | 编译期即可生成数据唯一性校验与 UI 选择器形态（单选 vs 多选） |
| **Physical Binding（物理映射）** | 绑定至 `Mapping` 节点：`HIS.inpatient_visits.bed_code = BedMgmt.beds.bed_no` | **当医院明年升级替换后勤床位系统时，只需更新 `Mapping` 绑定，整个上层业务 Ontology、策略 AST 与 Agent 工具契约一行都不用改！** |

---

## 四、设计铁律三：所有规则必须采用类型化策略 AST（Typed Policy AST）

绝不能让正式 Ontology 里的规则停留在自然语言字符串：

```yaml
# ❌ 错误示范：把自然语言留在正式模型里让 LLM 运行时自己猜
rule: "常规住院必须科主任签字，日间手术主治医师签字即可，且不能有未处理危急值"
```

自然语言规则不仅无法做编译期检查，而且在运行时交给 LLM 判断权限会有极高的越权与注入风险。在 `llm-ontology` 中，所有 `Policy` 和状态机 `Invariant` 都必须编译为**受控的表达式抽象语法树（Expression AST）**。

第一版规则语言保持极度克制（类似 Open Policy Agent / CEL 的安全子集），仅支持布尔逻辑（`and / or / not`）、比较运算（`eq / ne / lt / lte / gt / gte / in`）、受检属性路径访问（`path`）与内置角色/权限原语（`hasPermission / roleAtLeast`），**严禁执行任意脚本代码（No `eval`）**。

---

## 五、交互沙盒：亲手测试 Policy AST 的编译期类型检查与运行时守卫

在下方沙盒中，你可以同时体验 **Semantic Compiler Engine** 的两道防线：
1. **勾选右上角「注入 AST 类型错误」**：观察编译器如何在模型发布前，静态抓出“把整数类型的 `pending_critical_labs` 与字符串 `"none"` 比较”的类型错误并拒绝发布；
2. **调整调用者角色（住院医 / 主治医师 / 科主任）、就诊类型（日间手术 / 常规住院）与未处理危急值数量**：观察确定性 `Action Executor` 如何根据同一棵 AST 实时做出放行或拦截裁决：

<PolicyAstSandbox />

## 下一课预告

当 `Canonical Ontology` 通过了静态类型检查、状态机验证与人工审批正式发布后，**Model Compiler 究竟是如何把这份模型编译成可运行的 SaaS 的？当医院更新了一份 SOP 时，Incremental Semantic Compiler 又是如何做到只重编译受影响的 4 个产物而不是推倒重来的？** 请看下一课：**[增量语义编译与运行时上下文解析](/architecture/compiler-and-runtime)**。
