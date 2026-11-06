export interface PipelineStage {
  id: string
  n: string
  dir: string
  loop: '需求闭环' | '构建与编译' | '运行闭环' | '学习闭环'
  name: string
  handoff: string
  question: string
  input: string[]
  output: string[]
  tools: string[]
  gate: string[]
  pitfall: string
  approval?: 1 | 2
  link: string
  lesson: string
}

export const STAGES: PipelineStage[] = [
  {
    id: 'discovery',
    n: '01',
    dir: '01-discovery',
    loop: '需求闭环',
    name: '资料采集与主张提取',
    handoff: 'evidence-graph.json',
    question: '医院现有文档、访谈与异构数据库里到底主张了哪些业务事实与规则？',
    input: [
      '医院出院管理 SOP、日间手术绿色通道规范',
      '住院总与护理交班访谈录音、HIS/EMR/LIS 表结构快照',
    ],
    output: ['sources/*.json', 'fragments/*.json', 'claims.json'],
    tools: ['Source Ingestor', 'Auto-Ontology Profiler', 'Uncertainty-aware Grilling'],
    gate: [
      '每条 Claim 必须绑定至少 1 个带 Hash 的 Source Fragment',
      '明确标注模态：normative / descriptive / observational / hypothetical',
      '高风险缺失边界已生成 Decision Request 待确认清单',
    ],
    pitfall: '把历史数据库里“夜班未签字直接放行床位”的违规观察事实（observational）直接当成规范性规则（normative）。',
    link: '/architecture/dual-graphs',
    lesson: '05 双图架构 · Evidence Graph',
  },
  {
    id: 'reconcile',
    n: '02',
    dir: '02-reconcile',
    loop: '需求闭环',
    name: '冲突消解与概念对齐',
    handoff: 'candidate-ontology.json',
    question: '多份互相矛盾的规章与异构表字段如何对齐为无歧义的候选本体？',
    input: ['claims.json', 'HIS/EMR/LIS 字段画像', 'Concept Registry'],
    output: ['concept-registry.json', 'candidate-ontology.json', 'preview-bundle/'],
    tools: ['Semantic Reconciler', 'Concept Registry', 'Three-View Previewer'],
    gate: [
      '跨源同义词（visit_no / inp_id / encounter_id）已通过稳定 ID 对齐',
      '冲突 Claim 已按 Identity / Scope / Time / Authority / Semantics 五维消解或显式挂起',
      '生成业务逻辑、UI/UX、MVP 范围三视图 Preview 供业务方确认',
    ],
    pitfall: '因为 HIS 里“患者 ID”与“医保付款人 ID”在 95% 记录里相同，就错误地将 Patient 与 Payer 合并为同一个概念。',
    approval: 1,
    link: '/architecture/dual-graphs',
    lesson: '05 冲突消解与实体对齐',
  },
  {
    id: 'canonical',
    n: '03',
    dir: '03-canonical',
    loop: '构建与编译',
    name: '类型检查与正式本体发布',
    handoff: 'canonical-v1.2.json',
    question: '候选业务模型在结构、类型、状态机与策略 AST 上是否合法且获得授权？',
    input: ['candidate-ontology.json', 'Model ChangeSet', '审批点 ① 决策记录'],
    output: ['canonical-ontology.json', 'changeset-042.json', 'prov-lineage.json'],
    tools: ['Meta-model Type Checker', 'Policy AST Validator', 'SHACL / LinkML Exporter'],
    gate: [
      '所有 EntityType、Relation、Action、Policy 均具备稳定节点 ID',
      '策略规则通过严格 AST 类型检查（拒绝自然语言字符串充当执行规则）',
      '状态机不存在死锁或悬空转换，且不变量通过正负例验证',
    ],
    pitfall: '用自然语言提示词 "仅主治医师可确认出院" 代替结构化 Policy AST，导致大模型在上下文变长时产生幻觉越权。',
    approval: 2,
    link: '/architecture/meta-model',
    lesson: '05 Meta-model 与类型化策略 AST',
  },
  {
    id: 'compile',
    n: '04',
    dir: '04-compile',
    loop: '构建与编译',
    name: '模型编译与 SaaS 生成',
    handoff: 'build-manifest.json',
    question: '如何让同一份 Canonical Ontology 驱动数据库、后端守卫、前端看板与 Agent 工具？',
    input: ['canonical-ontology.json', 'Generator Plugins'],
    output: ['schema.zod.ts', 'policy-guards.ts', 'discharge-board.vue', 'mcp-tools.json', 'contract.test.ts'],
    tools: ['Model Compiler', 'Incremental Dependency Graph', 'Build Manifest Tracker'],
    gate: [
      '前后端 Schema、API 契约与 Agent Tool 定义 100% 由同一版本本体生成',
      '生成的契约测试与非法状态转换负例测试全部 PASS',
      'Build Manifest 完整记录每个产物的 modelVersion 与依赖节点 Hash',
    ],
    pitfall: '允许开发 Agent 直接手改前端或后端状态校验代码而不回写本体，导致 Canonical Ontology 与真实运行系统漂移。',
    link: '/architecture/compiler-and-runtime',
    lesson: '05 增量语义编译与代码生成',
  },
  {
    id: 'runtime',
    n: '05',
    dir: '05-runtime',
    loop: '运行闭环',
    name: '受控运行与动作执行',
    handoff: 'events-traces.jsonl',
    question: '真实患者出院协同事件发生时，Agent 如何在确定性约束下安全决策并执行？',
    input: ['canonical-ontology.json', 'HIS/EMR/LIS 实时状态', '用户请求 / 危急值事件'],
    output: ['context-package.json', 'domain-events.jsonl', 'agent-traces.jsonl'],
    tools: ['Ontology Context Resolver', 'Deterministic Action Executor', 'PROV-O Audit Logger'],
    gate: [
      'Context Resolver 仅装载当前 Encounter 状态相关的规则、动作与 Wiki 锚点',
      '所有写操作必须经过 Action Executor 的权限、前置条件与幂等性校验',
      '每条状态变更均留下绑定模型版本号与对象 ID 的领域事件与审计链',
    ],
    pitfall: '把全院所有科室的本体和文档一次性塞进 Agent Context，或者信任 LLM 自行判断当前操作者是否有权放行床位。',
    link: '/architecture/compiler-and-runtime',
    lesson: '05 运行时上下文解析与动作守卫',
  },
  {
    id: 'learning',
    n: '06',
    dir: '06-learning',
    loop: '学习闭环',
    name: 'LLM Wiki 沉淀与增量演化',
    handoff: 'changeset-next.json',
    question: '运行中的排障经验如何沉淀为可复用知识，并安全地推动下一版本体增量升级？',
    input: ['domain-events.jsonl', 'agent-traces.jsonl', '出院延迟复盘报告'],
    output: ['wiki/discharge-bottlenecks.md', 'eval-cases.json', 'changeset-043.json'],
    tools: ['LLM Wiki Ingest / Lint', 'Impact Analyzer', 'Incremental Recompiler'],
    gate: [
      '新增或更新的 Wiki 页面必须带有双向 Ontology ID 锚点与原始事件引用',
      'Wiki 经验严禁直接修改运行时行为，必须先转化为候选 Claim 与 Model ChangeSet',
      '增量重编译仅触发 Dependency Graph 中受影响的下游产物与回归测试',
    ],
    pitfall: '把 LLM 自动总结的一篇《周末出院带药加速技巧》Wiki 直接当成已批准的医院规则去自动绕过药房核对。',
    link: '/wiki/karpathy-pattern',
    lesson: '03 LLM Wiki 与 05 学习闭环',
  },
]
