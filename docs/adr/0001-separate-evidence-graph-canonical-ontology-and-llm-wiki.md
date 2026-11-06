# 分离证据图（Evidence Graph）、权威本体（Canonical Ontology）与经验知识库（LLM Wiki）

原始业务资料（医院规章制度、急诊/日间手术绿色通道文件、医护访谈、HIS 历史日志）天然存在口径冲突、例外条件与历史违规记录，而运行期沉淀的经验总结（LLM Wiki）具有描述性与探索性。我们决定将系统拆分为三层严格隔离但通过稳定 ID 双向链接的表示：**证据图（Evidence Graph）** 允许不确定、重复与相互冲突的事实主张（`Claim`）共存并保留 `Fragment` 级溯源；**权威本体（Canonical Ontology）** 仅保存经过冲突消解、AST 类型检查与人工授权批准（通过 `Model ChangeSet`）的确定性业务契约（实体、关系、状态机、动作、策略）；**经验知识库（LLM Wiki）** 负责持续编译和综合运行经验以提供决策参考，但严禁直接控制业务动作（`Action`）或绕过策略约束（`Policy`）。

## Considered Options

- **单一知识图谱 / 直接从 RAG 生成业务规则**：将文档提取出的三元组和规则直接写入同一个图谱并驱动 Agent 执行。被否决，因为无法区分“规范要求（`normative`）”与“历史违规观察事实（`observational`）”，极易把夜班借号操作或缺失审批的历史脏数据当作合法规则执行。
- **纯 LLM Wiki（Markdown 知识网络）驱动业务**：直接用 `AGENTS.md` + Markdown 维基页同时承担知识沉淀与业务契约。被否决，因为自然语言 Markdown 缺乏严格身份标识、状态机不变量与策略 AST 类型检查，无法编译为确定性的前后端守卫与增量依赖图。

## Consequences

- 任何对生产业务语义、状态机、指标口径或动作权限的修改，都必须走 `Source Fragment → Claim → Model ChangeSet → Type Check & Review → Canonical Ontology Release` 的受控编译流水线。
- 医院数据治理中的三类资产得以清晰映射：数据集成与元数据对应 **数据资产（Data Asset）**，概念/指标/状态契约对应 **语义资产（Semantic Asset）**，受策略守卫的动作与工作流对应 **操作资产（Operational Asset）**。
