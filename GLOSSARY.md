# LLM Ontology

从杂乱、有冲突的业务原始资料中提取可追溯证据，编译为类型安全、受控演化的业务本体（Canonical Ontology），并持续驱动 Agentic SaaS（如智能医院患者出院协同与数据治理平台）构建、业务运行与知识沉淀的领域模型编译系统。

## Language

### 核心图层与知识边界

**原始资料 (Source)**:
未经 LLM 改写的原始业务输入，如医院规章制度、临床路径 SOP、日间手术绿色通道文件、交班访谈录音、HIS/EMR/LIS 数据库快照与运行日志。
_Avoid_: 知识库文档, 语料, 训练数据

**资料片段 (Fragment)**:
原始资料中可精确定位与引用的最小证据单元，如规章文档的某个段落、表格行、录音时间戳或单条表结构定义。
_Avoid_: 切片, chunk, 文本块

**事实主张 (Claim)**:
从资料片段中提取出的、带有模态（规范性 `normative`、描述性 `descriptive`、观察性 `observational`、假设性 `hypothetical`）与适用范围（`scope`）的业务断言；允许在消解前存在重复或相互冲突。
_Avoid_: 事实, 规则, 知识点

**证据图 (Evidence Graph)**:
记录“我们为什么相信某个业务主张”的溯源网络，连接原始资料、资料片段、事实主张及其支持或冲突关系。
_Avoid_: 知识图谱, RAG 索引

**概念注册表 (Concept Registry)**:
管理业务概念稳定身份、正式名称、同义词别名与跨源对齐关系的注册中心（如将 HIS 的 `visit_no`、EMR 的 `inp_id`、LIS 的 `encounter_id` 映射到同一业务概念），严格区分“同义词关联（`LINK_ALIAS`）”与“概念合并（`MERGE_CONCEPT`）”。
_Avoid_: 词典, 映射表, 术语表

**候选本体 (Candidate Ontology)**:
基于证据图与概念注册表生成的业务模型草案，供类型检查、影响分析与人工审查，尚未获得生产执行授权。
_Avoid_: 临时模型, 预览模型

**权威本体 (Canonical Ontology)**:
经过冲突消解、严格类型校验与授权批准的正式版本化业务模型（位于领域图 Domain Graph），是业务概念、关系、状态机、动作与策略的唯一规范性事实源。
_Avoid_: 知识库, 数据库 Schema, 提示词规则

**经验知识页 (Wiki Page)**:
在业务运行与学习闭环中由 LLM 持续综合、维护的富文本经验与解释页面（LLM Wiki，如《出院延迟与跨科床位周转复盘 Wiki》），通过稳定本体 ID 与权威本体双向锚定，仅供诊断与决策参考，无权直接触发业务动作或绕过策略约束。
_Avoid_: 业务规则, SOP 正文, 向量切片

### 医院数据治理三类资产

**数据资产 (Data Asset)**:
临床记录、HIS/EMR/LIS 结构化表字段、DICOM 影像、检验结果以及经 FHIR / HL7 / OMOP 标准化后的数据来源、质量评分与血缘关系。
_Avoid_: 业务模型, 本体实例

**语义资产 (Semantic Asset)**:
患者（`Patient`）、住院就诊（`Encounter`）、床位（`Bed`）、出院准备路径（`DischargePathway`）等业务概念、跨源映射、状态机与统一指标口径（如平均出院准备时长）。
_Avoid_: 物理表, 元数据字典

**操作资产 (Operational Asset)**:
在权威本体中声明并绑定到后端确定性守卫的可执行业务能力，如临床出院确认（`ConfirmMedicallyFit`）、待检项目催办（`ExpeditePendingLab`）、床位终末消毒排程（`ScheduleBedCleaning`）。
_Avoid_: 自由接口, 提示词工具

### 元模型原语与演化控制

**元模型 (Meta-model)**:
规定权威本体中允许出现哪些语义原语（`EntityType`、`Property`、`Relation`、`StateMachine`、`Action`、`Policy`、`EventType`、`DataSource`、`Mapping`、`Metric`、`View`、`Workflow`）及其组合规则的顶层语言定义。
_Avoid_: 数据表结构, 配置文件格式

**模型投影 (Projection)**:
同一份底层结构化本体面向不同角色（医护/运营人员、数据治理与建模工程师、AI Agent）生成的特定视图与交互界面。
_Avoid_: 多套模型, 静态原型, 独立页面

**业务动作 (Action)**:
权威本体中定义的、允许改变业务对象状态的受控操作契约，包含输入类型、前置条件、权限策略、状态变更效果与发出的领域事件。
_Avoid_: 接口调用, SQL 更新, Agent 自由工具

**策略约束 (Policy)**:
以类型化抽象语法树（AST）表达的权限与业务守卫规则，在业务动作执行前由确定性执行层强制校验，而非交由 LLM 自行判断。
_Avoid_: 自然语言规则, Prompt 约束

**模型变更集 (Model ChangeSet)**:
对权威本体发起的结构化增量修改提案，绑定所依据的事实主张 ID、受影响节点清单与版本基线，是修改权威本体的唯一合法途径。
_Avoid_: 直接覆盖, 代码热改, 全量重建

**本体上下文包 (Ontology Context Package)**:
根据当前任务、运行状态与角色权限，从权威本体与关联经验知识页中按需解析出的最小相关上下文与可用动作集合。
_Avoid_: 全量本体提示词, 全局系统提示词
