---
title: NVIDIA Auto-Ontology 深度剖析
description: 深入解析 NVIDIA/auto-ontology 的四元语义模型、run_semantic_compilation 编译流水线、LangGraph NL2SQL、Answerability 覆盖率机制与源码级局限。
---

# NVIDIA Auto-Ontology：面向数据库的语义治理层

开源仓库：[`https://github.com/NVIDIA/auto-ontology`](https://github.com/NVIDIA/auto-ontology)（Apache 2.0）

在第一模块中我们看到，医院和企业内部的数据库充满了只有原系统开发者才懂的缩写表名与字段名（如 `t_zy_brdj`、`status_flag`、`extendedprice`）。**NVIDIA Auto-Ontology 的核心价值，就是在关系型数据库与 AI Agent 之间自动发现并构建一层可复用、可人工认证的业务语义治理层（Semantic Governance Layer）。**

::: tip 读完这一页你应该能回答
- Auto-Ontology 构建的本体由哪 **四个核心元素**（`Term`、`Column Attribute`、`SQL Attribute`、`Relationship`）组成？
- 源码中的 `run_semantic_compilation()` 是如何通过 **数据采样画像（Profiling）+ LLM 提取 + 隐式外键推断（`semantic_fk.py`）** 自动生成语义初稿的？
- 问答链路中的 **Answerability（可回答性覆盖率）** 是如何计算的？为什么 `Coverage = 1.0` 不代表一定能执行成功？
- 读完源码后，Auto-Ontology 有哪 **三个关键工程局限**（跨库联邦查询限制、历史使用频次打分未生效、缺乏业务 Action 层）？
:::

## 一、它解决的本质问题：从“每次猜 Schema”到“受约束的语义检索”

对比传统 Text-to-SQL 与 Auto-Ontology 的路径差异：

- **传统 Text-to-SQL**：`用户自然语言提问 → LLM 现场猜测表名和字段含义 → 直接拼凑 SQL → 执行返回（口径随心情漂移）`
- **NVIDIA Auto-Ontology**：`离线语义编译 + 人工审核认证 Ontology（业务概念 · 字段映射 · 关系路径 · 统一指标 SQL 表达式） → 在线 pgvector 语义检索 + Answerability 检查 → LangGraph 生成与验证修复 SQL → 可追溯的查询结果`

这里最关键的变化是：**LLM 不再需要每次提问时重新猜测“平均出院准备时长怎么算”或“发票收入用哪个字段”，而是直接检索预先编译并经业务专家认证的结构化语义定义。**

---

## 二、四元语义模型：Auto-Ontology 构建的本体长什么样？

Auto-Ontology 并不构建通用领域的形式逻辑公理，而是围绕关系型数据分析定义了四个紧密耦合的原语：

| 原语名称 | 定义与职责 | 医院出院治理示例 (`HIS.inpatient_visits`) | 官方 WWI 零售示例 (`sales.invoicelines`) |
|---|---|---|---|
| **1. Term（业务概念）** | 描述业务世界中的一类对象，包含名称、描述、同义词及物理表映射（`REPRESENTS`）。注意 Term 是一类概念，不是表里的一行记录。 | `InpatientEncounter`（住院就诊）→ 映射 `inpatient_visits` 表 | `InvoiceLine`（发票明细）→ 映射 `sales.invoicelines` 表 |
| **2. Column Attribute（字段属性）** | 将业务属性名映射到具体物理列，屏蔽不同系统的字段命名差异（如 `visit_no` vs `inp_id`）。 | `MedicallyFitTimestamp` → `inpatient_visits.medically_fit_at` | `LineExtendedPrice` → `invoicelines.extendedprice` |
| **3. SQL Attribute（指标计算属性）** | 保存经过业务确认的 **SQL 计算表达式**。它不只告诉 AI 字段是什么意思，而是告诉 AI **一个业务指标应该怎样计算**。 | `AvgDischargePrepHours` → `AVG(EXTRACT(EPOCH FROM actual_discharge_at - medically_fit_at)/3600) WHERE status_flag != '99'` | `PaidRevenue` → `SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)` |
| **4. Relationship（实体关联）** | 表达两个 Term 之间的连接关系与 SQL JOIN 路径（支持显式外键与隐式语义推断）。 | `InpatientEncounter.bed_code → Bed.bed_no` | `InvoiceLine.invoiceid → Invoice.invoiceid` |

---

## 三、交互推演台：从采样编译到 Answerability 问答全流程

源码中最核心的离线入口是 `auto_ontology/semantic/compile.py` 中的 `run_semantic_compilation()`，在线问答入口是 `auto_ontology/retrieval/text_to_sql/text_to_sql_graph.py`。

点击下方交互推演台中的 **01 ~ 04 步骤**，并切换 **「医院出院数据治理案例」** 与 **「官方 Wide World Importers 案例」**，亲手验证采样画像、语义外键推断与 `Answerability Coverage` 拦截机制：

<AutoOntologyWalkthrough />

---

## 四、源码级拆解：三个最值得学习的工程细节

### 1. 数据画像（Data Profiling）：不看样本数据的 Schema 提取都是耍流氓

在 `auto_ontology/semantic/visit_enter.py` 中，系统绝不只是把 `CREATE TABLE` DDL 发给大模型：
- 对每张表抽取最多 **1,000 行样本数据**；
- 分析列的空值率、唯一性（基数 Cardinality）、日期格式与数值分布；
- 对低基数文本/编码字段（如医院 HIS 中的 `status_flag` 或 `delay_reason`）进行额外的**枚举取值探测**。
- 在 `term_extractor.py` 中，Prompt 明确约束 LLM：**通常一张物理表对应一个主 Term，且禁止大模型凭空捏造 `IS_A`、`PART_OF` 等脱离物理表支撑的抽象哲学关系**。

### 2. 缺失外键的混合推断（`semantic_fk.py`）

大量医院 HIS 和老旧 ERP 数据库为了性能或历史原因，根本没有在数据库层声明 `FOREIGN KEY`。`auto_ontology/semantic/semantic_fk.py` 采用了三步混合推断：
1. **向量召回候选列**：基于列名与所在 Term 描述的 Embedding 相似度召回潜在目标列；
2. **数据样本重合度验证**：对比源列与目标列实际采样值的集合重叠率（Inclusion / Jaccard Overlap）；
3. **LLM 综合裁决与 Bridge Table 识别**：由结构化输出模型确认外键方向，并自动识别多对多中间桥接表（Bridge Table）。

### 3. 可回答性门限（`CoverageGradeAgent`）

在执行昂贵的 SQL 生成和数据库查询前，`auto_ontology/retrieval/entity_coverage/agents/coverage.py` 会先计算当前 Ontology 对用户问题的语义覆盖率：

$$\text{Coverage} = \frac{\text{在 Ontology 中检索到相关属性的查询实体数}}{\text{从用户问题中拆解出的查询实体总数}}$$

如果用户询问“心内科出院延迟患者的院外社区护理随访满意度”，而当前数据库只接入了院内 HIS、没有接入社区随访系统，`CoverageGradeAgent` 会立即识别出缺失实体并返回 `Answerable = False`，从根源上杜绝大模型瞎编字段名。

---

## 五、架构与 MCP 工具集成

Auto-Ontology 采用现代全栈微服务架构：
- **前端与网关**：Next.js 16 / React 19 + Better Auth + Prisma；
- **查询与编排后端**：FastAPI + **LangGraph**（包含候选检索、候选准备、SQL 生成、语法与语义验证、执行失败自动修复节点）；
- **存储底座**：**PostgreSQL + pgvector**（注意：它的语义图和向量索引直接保存在 PostgreSQL 中，**并不依赖 Neo4j**）；
- **外部 Agent 接入（FastMCP）**：提供独立的只读 MCP Server，推荐调用顺序为：
  `check_readiness → search_terms → check_answerable → ask_question`。

---

## 六、读完源码后必须警惕的三个局限

如果你打算在生产环境或 `llm-ontology` 中复用它，必须清楚它的源码边界：

| 局限维度 | 源码位置与真实表现 | 在 `llm-ontology` 中的应对方案 |
|---|---|---|
| **1. 不支持跨数据库联邦 JOIN** | `retrieval/text_to_sql/connector_routing.py` 会强制检查候选表是否属于同一个数据库连接器；若涉及 HIS (PostgreSQL) 与 PACS (ClickHouse) 两个独立源，会直接拒绝生成单条跨库 SQL。 | 通过 FHIR / CDC 数据集成层归集，或在 Trino / DuckDB 联邦层之上运行语义映射。 |
| **2. 历史查询频次打分尚未生效** | `semantic/sql_attribute_suggester.py` 中的 `_usage_score()` 当前硬编码返回 `0.0`（源码注释标明 Known Issue），即虽能从历史 SQL 提取候选表达式，但尚未实现按高频使用自动排序。 | 在 `llm-ontology` 的学习闭环中，基于真实的 `Domain Event` 与 `Agent Trace` 统计指标与动作的实际调用频次。 |
| **3. 只有只读语义层，无 Kinetic Action** | 它本质上是“面向数据分析的语义治理与 Text-to-SQL 层”，没有状态机、没有权限策略 AST、也没有事务性业务动作（如排程床位消毒、签发临床准出）。 | 将 Auto-Ontology 定位为底层 **数据库语义发现与 Mapping 模块**，在其上构建完整的 `Canonical Ontology + Action Executor`。 |

## 下一课预告

Auto-Ontology 解决了“结构化关系数据库如何提取查询语义”，但医院和企业里还有海量**非结构化规章文档（SOP）**，且医疗场景强制要求**每一次 AI 决策都具备符合法规的证据溯源（W3C PROV-O）与形状校验（SHACL）**。下一课我们将剖析第二个关键开源实现：**[Semantica：面向可审计 AI 的 Context Graph](/opensource/semantica)**。
