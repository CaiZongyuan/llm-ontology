---
title: 一条规则改下去，到底会动到什么？
description: 06 分组第 1 课。用同一条出院签批规则的两种发布路径，讲清 Model ChangeSet、依赖图预览、审批门与历史实例快照；含预测式编译预览与来源标记分类两个交互实验。
---

# 一条规则改下去，到底会动到什么？

> 06 受控落地 · 第 1 课 ｜ lessonId `P06-L01` ｜ 基线 `hospital-discharge-1.0` ｜ 执行模式 `BROWSER_EXECUTABLE` + `SIMULATED`

::: tip 读完这一页你应该能回答
- 同一条 `Claim-09`，**直接热改配置**和**提交 `Model ChangeSet`** 会产生哪两种完全不同的后果？
- 为什么改显示名只动 1 个产物，而改策略条件要动 4 个产物，且两者都不该重写历史出院事件？
- 页内的绿色 PASS 为什么**不能**写成 `VERIFIED_EXPERIMENT`？四类来源标记与五类执行标签分别该用在哪？
:::

## 一、本课要解决的问题

医务处拿来一份新文件：《日间手术中心快速周转绿色通道补充规定（2026 版）》第 4 条——符合 24 小时出院标准的日间手术患者，允许主治医师**单签**确认 `MedicallyFit`。这就是 [《双图架构：Evidence Graph 与 Domain Graph》](/architecture/dual-graphs) 里 `Claim-09` 的出处：它在五维消解后并没有和「常规住院双签」的 `Claim-04` 真冲突，而是 Scope 细化出来的新分支。

证据已经消解完了。工程师说：「那我改一行 `discharge-policy.yaml`，热更新一下就好了。」

这一课只回答一件事：**这一行到底会动到什么，以及凭什么相信它没有动到别的东西。**

## 二、沿用哪些定义

本课不重新定义任何术语，只复用 05 分组已建立的产物：

| 复用的定义 | 定位（在哪一节首次定义） | 本课复用它做什么 | 新增的差别 |
|---|---|---|---|
| `Fragment` / `Claim` / 五维消解 | [《双图架构》第二节 · 冲突消解实验](/architecture/dual-graphs) | `Claim-09` 及其 `fragmentHash` 作为变更的唯一证据入口 | 本课不重讲消解算法，只讲消解之后如何**发布** |
| `Model ChangeSet` / 稳定节点 ID | [《Meta-model 原语与类型化策略 AST》](/architecture/meta-model) | 作为修改权威本体的唯一合法途径 | 补上「发布前的依赖图预览」和「审批门」两个环节 |
| `Policy AST` / 类型检查 | [《Meta-model 原语与类型化策略 AST》](/architecture/meta-model) | 解释为什么改条件会扩散到守卫与测试 | 本课不重讲 AST 结构 |
| `Incremental Semantic Compiler` / Build Manifest | [《增量语义编译与运行时上下文解析》第二节](/architecture/compiler-and-runtime)，含 `<IncrementalImpactGraph />` | 复用其稳定 ID 依赖图，作为影响集合的计算依据 | 那个实验台是「选场景看传播」；本课改为**先预测、再运行、并解释预测为什么错**，且加入发布治理对照 |

::: info 与 05 分组的分工
[《增量语义编译与运行时上下文解析》](/architecture/compiler-and-runtime) 回答「变更如何沿依赖图传播」；本课回答「在允许传播之前，谁批准、影响范围是否可证明、历史事实会不会被改写」。两者共用同一份 Build Manifest，不是两套模型。
:::

## 三、当前办法哪里不够

下面是一段**故意失败的教学版本**。它是 `〔COURSE_DESIGN〕` 虚构片段，不是本仓库的真实配置文件：

```yaml
# 〔COURSE_DESIGN〕故意失败版：绕过 ChangeSet 直接热改
hospital.policy.discharge_signoff:
  condition: "(type == 'Inpatient' && chiefSigned) || (type == 'DaySurgery' && attendingSigned)"
  version: 1.5        # 手写版本号，没有审批记录
  # 没有 derivedFromClaims，没有 diff，没有 reviewId
```

把它直接推到运行时，可观察的失败轨迹是 `〔SIMULATED〕` 确定性规则推演，不是真实事故日志：

1. **历史被追溯重判**：`Encounter-2026-089` 等已发布事件原本保存 v1.3 的模型快照，新条件一上线就被当成一直有效，历史看板与当时实际执行的口径分叉。
2. **产物口径分叉**：后端 `policy-guards.ts` 读新 YAML，出院看板仍读旧快照，`contract.test.ts` 完全没更新，三处对「什么算出院合规」给出不同答案。
3. **审计链断裂**：找不到 `derivedFromClaims`、`reviewId`、结构化 diff，无法回答「谁让这条规则生效的」。
4. **不可回滚**：覆盖回去之后没有可考的旧版本，只能靠人回忆。

::: danger 这不是「流程没走全」而已
缺少依赖图、版本快照和审批记录，会让**同一个业务事实在不同层不可恢复地分叉**。补一张工单追不平，必须换一条发布路径。
:::

## 四、新概念及最小例子

### Model Plane 与 Data Plane 是职责划分，不是部署要求

`〔COURSE_DESIGN〕` 本课把「模型定义与其版本」归为 **Model Plane**，把「某位患者某次出院的运行状态」归为 **Data Plane**。两者分开是为了让新版本**不回溯改写旧实例**；它不意味着要拆成两个独立服务，第一版模块化单体完全够用。

历史实例里存的是「当时的 `modelRevision` + 业务快照」，而不是一条指向「当前规则」的指针：

```json
{
  "eventId": "evt-2026-089-released",
  "encounterId": "Encounter-2026-089",
  "modelRevision": "v1.3",
  "snapshot": { "signoff": "chief+attending", "criticalLabs": 0 }
}
```

### 最小可用的 Model ChangeSet

```json
{
  "changeSetId": "cs-042",
  "baseCanonVersion": "hospital-discharge-1.0",
  "baseModelRevision": "v1.4",
  "derivedFromClaims": ["Claim-09"],
  "op": "upsert_policy_branch",
  "targetNodeId": "hospital.policy.discharge_signoff",
  "reviewId": "APR-2026-113"
}
```

`〔COURSE_DESIGN〕` 这是课程自用的结构化 IR，用来演示「变更提案」应携带哪些信息；它不是 W3C 标准，也不是任何产品的官方 Schema。真正发布前还要经过类型检查、影响预览与人工授权。

### 同一基线下的三种变更，影响面并不一样

| 变更 | 受影响产物 | 需要审批 | 历史实例 |
|---|---|---|---|
| 改显示名（名称变化） | UI 投影字典 1 个 | 否（语义未变） | 零改动 |
| 追加 `Claim-09` 策略分支 | 后端守卫、看板、契约测试 3 个 | 是 | 零改动 |
| 修改动作前置条件 | 后端守卫、看板、契约测试、Agent 工具契约 4 个 | 是 | 零改动 |

注意两个恒定项：**历史实例永远不进重编译清单**，**增量编译永远不会全量重建 28 个产物**。

## 五、本分组的记录契约

制作规范要求把「资料怎么说」「课程怎么设计」「实际跑过什么」分开记录。本分组沿用四类来源标记：

| 标记 | 含义 | 本分组的例子 |
|---|---|---|
| `SOURCE_NORMATIVE` | 原资料中的规范、外部标准、项目冻结决策 | SOP 第 4 条；W3C PROV-O；ADR-0001 的 ChangeSet 流水线 |
| `SOURCE_CLAIM` | 官方产品能力或作者观点，不作实测结论 | Auto-Ontology 文档对 `Answerability Coverage` 的说明 |
| `COURSE_DESIGN` | 本课程提出的架构、规则、fixture 与教学设计 | 本页两个实验台、4 位患者 fixture、预测→运行契约 |
| `VERIFIED_EXPERIMENT` | 附版本、命令、退出码、日志的真实复现 | **本分组 0 条**：没有真实后端与运行日志 |

执行标签同样要标清楚：`READ_ONLY`（只读）｜`SIMULATED`（教学模拟）｜`BROWSER_EXECUTABLE`（浏览器执行纯逻辑）｜`LOCAL_EXECUTABLE`（需本地起服务）｜`EXTERNAL_SERVICE`（需外部账号/密钥）。

本页两个实验台是**两类标签同时成立**：计算确实在浏览器里跑（`BROWSER_EXECUTABLE`），但业务数据、HIS 连接、审批与编译产物全是教学模拟（`SIMULATED`）。二者不能互相升级：浏览器执行过 ≠ 真实系统跑通。

## 六、交互实验

### 实验 LAB-06-01 · Model ChangeSet 编译预览

| 实验规格 | 值 |
|---|---|
| labId / lessonId | `LAB-06-01` / `P06-L01` |
| learningObjective | 能先预测影响集合与审批需求，再用依赖图结果解释预测偏差 |
| canonVersion / modelRevision | `hospital-discharge-1.0` / 基线 `v1.4` |
| executionMode | `BROWSER_EXECUTABLE`（确定性规则计算） + `SIMULATED`（业务语义） |
| fixture | 28 个已发布产物；历史 `Encounter-2026-089` 保留 v1.3 快照；每次重置从干净状态启动 |
| preconditions | 无密钥、无网络、无后端；浏览器即可 |
| learnerInputs | 变更类型（3 选 1）、发布路径（2 选 1）、影响产物（多选）、是否需要审批（单选） |
| predictionQuestion | 「哪些产物会被重编译？这次变更需要人工审批吗？」——**未预测不能运行** |
| actions | 选参数 → 锁定预测 → 运行编译预览 → 看逐行解释与两路径对照 |
| expectedTrace | 影响集合按 Build Manifest 计算；`history` 与 `all` 恒不入选；直接改配置路径被发布门禁 `BLOCKED` |
| oracle | 影响集合与 `IMPACT` 基线表精确比对；审批需求由「语义是否变化」判定 |
| reset | 右上角「重置实验」清空预测、结果与参数，回到默认 fixture |
| negativeCases | 直接热改配置（结构错误 + 发布门禁拒绝）；误选「历史实例」或「全院 28 个产物」（认知错误） |
| accessibility | 全部控件为原生 `select` / `checkbox` / `radio` / `button`，可键盘操作；无自动动画；文本解释与颜色并存 |
| evidence | `〔未运行〕` 无真实后端日志；站点构建验证不等同业务规则验证 |
| safeMode | 纯浏览器只读沙箱，不写入任何业务数据、不调用外部服务 |

<ChangeSetPreviewLab />

### 实验 LAB-06-02 · 来源四类标记与执行标签

| 实验规格 | 值 |
|---|---|
| labId / lessonId | `LAB-06-02` / `P06-L01` |
| learningObjective | 能区分「规范 / 产品声明 / 课程设计 / 实测结论」，并识别假证据 |
| executionMode | `BROWSER_EXECUTABLE` + `SIMULATED` |
| fixture | 6 条固定论断，独立于其他实验；重置后重新作答 |
| predictionQuestion | 「这 6 条里，有几条能诚实标成 `VERIFIED_EXPERIMENT`？」 |
| actions | 逐条选标记 → 完成预测 → 提交核验 → 看逐条解析与执行标签表 |
| oracle | 正确答案 0 条实测；分类逐条与固定答案比对 |
| reset / negativeCases | 可重置；陷阱项是「把 SIMULATED 写成已跑通」 |
| accessibility / safeMode | 原生控件、无动画；纯前端判定 |

<SourceTagLab />

## 七、实现与验证的证据边界

- 已实现：两个 Vue 3 实验台，浏览器内执行确定性纯逻辑，含预测、判定、逐条解释与完整 reset。
- 未实现、也不宣称已实现：Hono 后端、真实 HIS 连接、`Vitest` / `Playwright` 运行、MPS 或任何外部服务。
- 因此本课 **不填写 `VERIFIED_EXPERIMENT`**，也不提供虚构的命令、退出码与截图。站点 `pnpm build` 通过只说明页面能编译，不能证明业务规则在真实运行时成立。
- 所有金额、患者、事件 ID 与规则均为课程虚构的教学 fixture；沿用 `GLOSSARY.md` 的术语，不引入第二个案例。

## 八、反例与取舍

- **什么时候不需要 ChangeSet**：纯文案、静态展示内容、与权威本体无关的页面文本。把它们也纳入审批只会拖慢发布。
- **本层该发现的错误**：缺 `derivedFromClaims`、缺审批、影响范围不可计算、试图回溯改写历史实例。
- **必须留到运行时才发现的错误**：真实并发下的库存/床位争用、真实会话身份的越权、外部不可逆副作用。这些不能靠编译预览「证明」掉了。
- **不承诺**：任意文档能无歧义自动变成软件；把逻辑全放进 YAML 就等于单一事实源；所有场景都适合这套流水线。

## 九、自测与答案

每题都有可判定答案与解析，其中标注「迁移题」的是把数字、角色或变更类型换掉之后仍需会判断的题目。

<LessonCheck lesson="L01" />

## 十、本课输出与后续

**本篇解决什么**：一条规则从证据到发布，影响范围可预测、可核验，历史事实不被改写，且每一句论断都有对应的记录类型。

**仍不能解决什么**：规则发布之后，Agent 想调用 `hospital.action.release_bed` 时，谁来保证它真的有权限、危急值已清零、且不会重复执行？编译预览管不到运行时的每一次调用。

**下一课为什么出现**：[《Agent 提议释放床位，谁能让它真的执行？》](/practice/action-guard) 将复用本课的 `modelRevision=v1.5` 与 `derivedFromClaims` 记录，把判定从「模型层」推进到「动作层」——用 LAB-06-03 的六道守卫轨迹检验「能力发现 ≠ 授权」，再用 LAB-06-04 的故障注入说明为什么通过一次校验仍不等于可靠。
