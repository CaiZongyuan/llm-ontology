---
title: Agent 提议释放床位，谁能让它真的执行？
description: 06 分组第 2 课。从 Agent 动作提案到确定性执行，逐门拆解租户隔离、审批、幂等与策略 AST，并注入崩溃、重复投递与乱序消息观察可靠性边界。
---

# Agent 提议释放床位，谁能让它真的执行？

> 06 受控落地 · 第 2 课 ｜ lessonId `P06-L02` ｜ 基线 `hospital-discharge-1.0` / `modelRevision=v1.5` ｜ 执行模式 `BROWSER_EXECUTABLE` + `SIMULATED`

::: tip 读完这一页你应该能回答
- 为什么 `Ontology Context Package` 里出现某个 `Action` 只代表**能力发现**，不代表授权？
- 同一笔 `hospital.action.release_bed` 调用，为什么可能被租户隔离、审批门、幂等去重或策略 AST 这四道不同的门分别拦下？
- 声明「exactly-once」、画出流程图，为什么都不构成可靠性证明？
:::

## 一、本课要解决的问题

上一课发布的 `modelRevision=v1.5` 已经生效。现在出院看板上，日间手术患者 `E-202` 的术后评估达标，Discovery Agent 读完 [《增量语义编译与运行时上下文解析》第三节](/architecture/compiler-and-runtime) 描述的 `Ontology Context Package`，发现当前可用动作里有 `hospital.action.release_bed`，于是生成了一条提案：

```json
{
  "kind": "ActionProposal",
  "actionId": "hospital.action.release_bed",
  "encounterId": "E-202",
  "reason": "术后评估达标，建议释放床位",
  "modelRevision": "v1.5"
}
```

一个很自然的偷懒做法是：把 `release_bed` 注册成 Agent 的普通工具，让它自己调。

这一课只回答一件事：**这条提案要变成一次真实的状态变更，中间必须经过哪些独立判定，以及故障发生时哪一层会兜住。**

## 二、沿用哪些定义

| 复用的定义 | 定位 | 本课复用它做什么 | 新增的差别 |
|---|---|---|---|
| `Ontology Context Package` / `Ontology Context Resolver` | [《增量语义编译与运行时上下文解析》第三节](/architecture/compiler-and-runtime)，含「运行时安全的最后一道铁闸」 | 复用「上下文裁剪只是能力发现，最终授权由后端守卫独立验证」这条结论 | 把这条结论展开成**可逐门观察的判定轨迹**，而不只是一句警告 |
| `Policy` / `Action` / `Action Executor` | [《Meta-model 原语与类型化策略 AST》](/architecture/meta-model)，含 `<PolicyAstSandbox />` | 复用策略 AST 与运行时守卫的规则语义 | 那个沙盒改参数即时出结果；本课改为**先预测被哪道门拦下**，并加入租户、审批、幂等三道前置门 |
| 三个闭环与两大引擎 | [《三个闭环与两大引擎总览》](/architecture/overview) | 明确「LLM 负责归纳提议，编译器与执行器负责铁面校验」的分工 | 落到一次具体调用，不重讲宏观闭环 |
| `Model ChangeSet` / `modelRevision` | [《一条规则改下去，到底会动到什么？》](/practice/change-set) | 复用本课发布的 v1.5 与 `derivedFromClaims` 记录 | 从「模型层发布」推进到「动作层执行」 |

## 三、当前办法哪里不够

把工具权限直接交给 Agent，等于把下面四件事压成一句话「模型自己会判断」。它们其实是四种完全不同的失败：

| 失败 | 业务损害 | 该由哪一层拦 |
|---|---|---|
| 跨租户读取 / 写入 | 主线演示账号读到 `TENANT-OTHER` 的患者数据 | 租户隔离层，且**读与写都要测** |
| 未审批或已驳回的提案被执行 | Agent 自己批准自己，绕过人工授权 | 审批门；驳回后不能靠重试绕过 |
| 同一提案被重复执行 | 床位重复释放，终末消毒排程建两份 | 稳定幂等键 |
| 危急值未清零仍放行 | 医疗安全红线被突破，角色再高也不能豁免 | 策略 AST 中的不变量 `inv.zero_critical_labs` |

再加一个更隐蔽的误读：**前端把按钮藏起来、上下文里不给某个 `Action`，都不等于后端已经授权**。前端与上下文解决的是「给谁看什么」，授权必须由 `Action Executor` 用真实会话身份独立再算一次。

## 四、新概念及最小例子

### Proposal 与 Execution 是两个对象

`〔COURSE_DESIGN〕` 本课把 Agent 的输出定义为 `ActionProposal`（可失败、可驳回、可重复、不含权限），把真正改变业务状态的对象定义为 `ActionExecution`（绑定 `traceId`、`modelRevision`、`idempotencyKey` 与审批记录）。两者之间必须有一道确定性的门，而不是一段提示词。

### 幂等键必须稳定

```text
正确：hospital.action.release_bed | Encounter-2026-089 | modelRevision=v1.5
错误：hospital.action.release_bed | Encounter-2026-089 | ts=1762684397000
```

`〔COURSE_DESIGN〕` 键里含每次重试重新生成的时间戳，去重就会失效。这一点与 [《一条规则改下去》](/practice/change-set) 里「历史实例绑定当时版本快照」是同一个思路：**身份要稳定，时间要显式记录，不能拿时间当身份**。

### 六道门的判定顺序

`G0` 上下文解析（恒 PASS，仅能力发现）→ `G1` 租户隔离 → `G2` 审批门 → `G3` 幂等去重 → `G4` 策略 AST / 不变量 → `G5` `Action Executor` 原子写入。

任意一道 `BLOCK` 之后执行器**不会被调用**，业务数据库零写入。短路本身是重要信息：它告诉你这次失败发生在哪一层，而不是笼统地返回「操作失败」。

## 五、交互实验

### 实验 LAB-06-03 · Agent 动作提案与六道守卫

| 实验规格 | 值 |
|---|---|
| labId / lessonId | `LAB-06-03` / `P06-L02` |
| learningObjective | 能先预测结果与拦截门，再沿轨迹定位第一道 `BLOCK`，并说明边界 |
| canonVersion / modelRevision | `hospital-discharge-1.0` / `v1.5` |
| executionMode | `BROWSER_EXECUTABLE` + `SIMULATED`；固定 `traceId` 由参数确定性生成 |
| fixture | 单笔 `hospital.action.release_bed`；`Encounter-2026-089`；每次重置回到默认参数 |
| preconditions | 无网络、无密钥、无后端 |
| learnerInputs | 角色、就诊类型、危急值、租户、审批状态、是否重复提交；以及预测结果（5 选 1） |
| predictionQuestion | 「这次调用会放行，还是被 G1/G2/G3/G4 中的哪一道拦下？」——**未预测不能提交** |
| actions | 调参数 → 锁定预测 → 提交 → 展开逐门轨迹与状态快照 |
| expectedTrace | 短路后 `G5` 为 `SKIP`；放行时 `bed.status=RELEASED` 且仅 1 次状态变更 |
| oracle | 预测结果与 `firstBlock` 精确比对；每条门给出 `policyId` 与原因 |
| reset | 右上角重置清空全部参数、预测与结果 |
| negativeCases | 跨租户读取（G1）、未提交审批（G2）、重复提交（G3）、危急值未清零且调用者为科主任（G4） |
| accessibility | 原生 `select` / `radio` / `checkbox` / `button`；颜色判定均附文字原因；无自动动画 |
| evidence | `〔未运行〕` 无真实后端、无 trace 导出；`traceId` 为教学确定性标识，不是 OpenTelemetry 真实 span |
| safeMode | 纯浏览器只读沙箱，零业务写入、零外部调用 |

<ActionProposalLab />

::: warning 关于 traceId
实验里显示的 `tr-*` 是由当前参数确定性算出的**教学标识**，用来说明「同一次调用应共享一个稳定 trace」。它不是 OpenTelemetry 的真实 trace ID，也没有 span 上报。把两者混为一谈是常见的过度外推。
:::

### 实验 LAB-06-04 · 故障注入、Outbox 与幂等

一次通过校验的调用，还要经得起进程崩溃、重复投递和乱序。这一层要区分**投递保证**与**处理效果**：Outbox 保证事件不丢，但**不消除重复投递**；真正避免重复执行的是稳定幂等键。

| 实验规格 | 值 |
|---|---|
| labId / lessonId | `LAB-06-04` / `P06-L02` |
| learningObjective | 能解释故障位置、业务损害与对应防线，而不是背模式名 |
| executionMode | `BROWSER_EXECUTABLE` + `SIMULATED`；状态快照为确定性推演 |
| fixture | 与 LAB-06-03 同一笔请求；4 个注入开关默认全关；重置后回到干净状态 |
| predictionQuestion | 「床位最终状态是什么？有效状态变更几次？」 |
| actions | 勾选故障 → 完成预测 → 运行 → 逐段展开 span → 看断言与状态快照 |
| expectedTrace | 正常路径：投递 1 次、应用 1 次；重复投递路径：投递 2 次、应用仍 1 次 |
| oracle | 5 条独立断言（状态、变更次数、不丢事件、不重复执行、乱序不回写） |
| reset / negativeCases | 可重置；「关闭 Outbox 与幂等」为故意失败版；另可注入崩溃、重复、乱序 |
| accessibility / safeMode | 可键盘展开的原生 `button`，`aria-expanded` 可见；纯只读沙箱 |

<ReliabilityTraceLab />

## 六、实现与验证的证据边界

- 已实现：两个实验台的确定性规则计算、逐门轨迹、故障注入与断言输出，全部在浏览器内完成。
- 未实现、也不宣称已实现：真实 `Action Executor`、数据库事务、Outbox 表、消息中间件、OpenTelemetry 导出、真实跨租户负向测试。
- 本课的 span 与状态快照是 `〔SIMULATED〕` 推演，不是进程真实崩溃后的恢复日志；因此同样**不填写 `VERIFIED_EXPERIMENT`**。
- 真实并发与隔离行为必须在锁版本的本地后端上重测，不能由 SQLite 或浏览器模拟推断生产数据库表现。

## 七、反例与取舍

- **什么时候不必上这套门**：纯只读查询、无副作用的展示型工具。给每次检索都配审批门只会让系统不可用。
- **本层该发现的错误**：越权、未审批、重复执行、违反不变量、跨租户访问。
- **必须留到运行时的错误**：真实并发争用、外部系统不可逆副作用、网络分区下的超时语义。
- **三条不能省的说明**：只声明 `EXACTLY_ONCE` 不构成证明；补偿不是时光倒流；已发出的外部排程无法靠「撤回一条消息」收回。
- **不承诺**：流程图自动具备持久执行能力；工作流引擎自动保证所有外部副作用恰好一次。

## 八、自测与答案

<LessonCheck lesson="L02" />

## 九、本课输出与后续

**本篇解决什么**：Agent 只能提议，不能自己授予执行权；一次调用是否放行由六道确定性门逐层判定，故障注入能定位损害发生在哪一段。

**仍不能解决什么**：上面所有轨迹都还是浏览器里的模拟。规则本身对不对、数值有没有被 JOIN 放大、测试能不能独立检出错——这些没有任何一条绿色 PASS 能证明。

**下一课为什么出现**：[《怎么证明它不是一段演示动画？》](/practice/golden-cases) 将复用 `modelRevision=v1.5`、LAB-06-03 的负向用例与「独立验证」要求，引入来自课程业务基线的人工核对期望值，并用一个故意失败的反例演示「生成器与测试共享同一个错误时，断言会全绿」。
