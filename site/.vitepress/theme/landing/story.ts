export const DURATION = 60

export const HERO = {
  eyebrow: 'EVIDENCE-GROUNDED DOMAIN MODEL COMPILER · 交互式架构教程',
  title: ['从杂乱业务资料，', '到可验证、可执行的', 'Agentic 业务本体'],
  lede: '串联 Ontology、NVIDIA Auto-Ontology、Semantica、Karpathy LLM Wiki 与 JetBrains MPS，用一个真实的「智慧医院数据治理与患者出院协同」项目，把 llm-ontology 的三个闭环与六个阶段从头走通。',
}

export interface Chapter {
  id: 'discovery' | 'reconcile' | 'canonical' | 'compile' | 'runtime' | 'learning'
  n: string
  kicker: string
  title: string
  body: string
  start: number
  end: number
  key: number
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'discovery',
    n: '01',
    kicker: '原始资料与主张提取',
    title: '不急着建图：先把杂乱 SOP 与异构表变成带出处的 Claim',
    body: '接入 HIS、EMR、LIS 三套医院异构表与 4 份规章/访谈资料。Auto-Ontology 采样探测字段语义，提取器将每段规章拆解为绑定原文 Hash 的事实主张（Claim），并严格区分规范要求（normative）与历史违规观察（observational）。',
    start: 0,
    end: 10,
    key: 5,
  },
  {
    id: 'reconcile',
    n: '02',
    kicker: '冲突消解与三视图预览',
    title: '五维消解规则矛盾，用三视图 Preview 与业务方对齐',
    body: '“住院出院须主任双签”与“日间手术主治单签放行”并非真矛盾，而是适用范围（Scope）不同；而“夜班口头放行”被识别为违规记录拦截。概念注册表对齐跨库同义词，生成业务逻辑、UI、MVP 三视图供第一次人工审批。',
    start: 10,
    end: 20,
    key: 15,
  },
  {
    id: 'canonical',
    n: '03',
    kicker: '类型检查与正式本体',
    title: '用稳定 ID 与类型化策略 AST 锁定唯一规范事实源',
    body: '借款自 JetBrains MPS 的结构化 AST 思想：实体、关系、状态机与策略全部通过静态类型检查。拒绝用自然语言提示词充当权限规则，经 Model ChangeSet #042 审批后发布不可变的 Canonical Ontology v1.2。',
    start: 20,
    end: 30,
    key: 25,
  },
  {
    id: 'compile',
    n: '04',
    kicker: '模型编译与契约生成',
    title: '同一份本体，同时编译出数据库、后端守卫、UI 与 Agent 工具',
    body: 'Model Compiler 从 Canonical IR 自动生成 Zod/TypeScript 类型、HIS/FHIR 映射视图、确定性 Policy Guard、出院协同看板与 MCP 工具契约，并运行 16 项正负例契约测试，确保模型与代码零漂移。',
    start: 30,
    end: 40,
    key: 35,
  },
  {
    id: 'runtime',
    n: '05',
    kicker: '运行闭环与动作守卫',
    title: '按需解析最小上下文，所有写操作必过确定性 Action 守卫',
    body: '患者 Encounter-2026-089 进入待出院状态。Ontology Context Resolver 按当前状态动态装配最小上下文包；Agent 提议催检与排程消毒，而未获主治医师 MedicallyFit 签字前的“提前释放床位”动作被后端 Policy AST 当场拦截。',
    start: 40,
    end: 50,
    key: 45,
  },
  {
    id: 'learning',
    n: '06',
    kicker: 'LLM Wiki 与增量演化',
    title: '运行轨迹沉淀为双向锚定的 LLM Wiki，驱动增量重编译',
    body: '借鉴 Karpathy LLM Wiki：30 天运行事件与复盘被编译为绑定本体 ID 的《周末出院带药卡点 Wiki》。发现新规则提案后，Incremental Semantic Compiler 沿着依赖图仅重编译受影响的 4 个下游产物。',
    start: 50,
    end: 60,
    key: 55,
  },
]

export function clamp(v: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v))
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp(t)
}

export function smooth(t: number) {
  const x = clamp(t)
  return x * x * (3 - 2 * x)
}

export function ramp(t: number, a: number, b: number) {
  return clamp((t - a) / (b - a))
}

export function window01(t: number, a: number, b: number, fade = 0.6) {
  if (t < a || t > b) return 0
  if (t < a + fade) return (t - a) / fade
  if (t > b - fade) return (b - t) / fade
  return 1
}

export function chapterIndex(t: number) {
  for (let i = CHAPTERS.length - 1; i >= 0; i--) {
    if (t >= CHAPTERS[i].start) return i
  }
  return 0
}

export function chapterAt(t: number): Chapter {
  return CHAPTERS[chapterIndex(t)]
}

interface RawConsoleLine {
  t: number
  kind: 'human' | 'agent' | 'cmd' | 'out' | 'alert' | 'gate' | 'good' | 'bad'
  text: string
}

const CONSOLE_SCRIPT: RawConsoleLine[] = [
  { t: 0.8, kind: 'human', text: '把我院 HIS/EMR/LIS 和出院规章接进来，构建患者出院协同与床位周转系统' },
  { t: 2.2, kind: 'cmd', text: 'llm-ontology ingest ./sources/hospital-discharge --profile-db his,emr,lis' },
  { t: 4.0, kind: 'out', text: '提取 4 份原始文档 (38 Fragments)，采样 3 个异构库 12 张核心表' },
  { t: 6.2, kind: 'alert', text: '发现冲突主张：Claim-04 (双签放行) vs Claim-09 (日间手术单签) vs Claim-12 (夜班无签字记录)' },
  { t: 8.4, kind: 'gate', text: '01-discovery 验证门 PASS：19 条 Claim 100% 绑定原文 Hash 与模态' },
  { t: 11.2, kind: 'agent', text: '对齐跨库身份：HIS.visit_no ↔ EMR.inp_id ↔ FHIR.Encounter (ID: hospital.encounter)' },
  { t: 13.8, kind: 'out', text: '五维消解：Claim-04(Inpatient) 与 Claim-09(DaySurgery) 按 Scope 拆分；Claim-12 标为违规观察事实' },
  { t: 16.5, kind: 'gate', text: '审批点 ①：业务方在三视图 Preview 确认「日间手术单签例外」与出院状态机' },
  { t: 21.0, kind: 'cmd', text: 'llm-ontology check --candidate ./02-reconcile/candidate-ontology.json' },
  { t: 23.8, kind: 'good', text: 'Policy AST 静态类型检查 PASS：ConfirmMedicallyFit 强制要求 Role >= AttendingPhysician' },
  { t: 26.8, kind: 'gate', text: '审批点 ②：批准 ChangeSet #042，正式发布 Canonical Ontology v1.2.0' },
  { t: 31.0, kind: 'cmd', text: 'llm-ontology compile --canonical v1.2.0 --targets zod,guards,ui,mcp,tests' },
  { t: 34.2, kind: 'out', text: '生成 5 类受控产物，写入 build-manifest.json (含节点级依赖图)' },
  { t: 37.5, kind: 'good', text: '契约测试 16/16 PASS；负例 N1(越权签字) & N2(未出危急值放行) 均按预期拦截' },
  { t: 41.2, kind: 'agent', text: '事件触发：Encounter-2026-089 待出院，Context Resolver 装载 4 个关联实体与 3 个可用 Action' },
  { t: 44.5, kind: 'bad', text: '拦截越权调用：ReleaseBed(bed-302) 被 Policy Guard 拒绝 (原因: medically_fit == false)' },
  { t: 47.6, kind: 'good', text: '主治医师执行 ConfirmMedicallyFit → 触发 ScheduleBedCleaning，写入 PROV-O 审计链' },
  { t: 51.5, kind: 'cmd', text: 'llm-ontology wiki-consolidate --events ./05-runtime/domain-events.jsonl' },
  { t: 54.4, kind: 'out', text: '更新 LLM Wiki [[出院带药药房核对延迟复盘]]，双向锚定 hospital.discharge_pathway' },
  { t: 57.5, kind: 'gate', text: '增量重编译 PASS：SOP 局部更新仅重算 4 个受影响节点，耗时 1.4s' },
]

export function consoleAt(t: number, limit = 6) {
  const visible = CONSOLE_SCRIPT.filter((l) => l.t <= t).slice(-limit)
  return visible.map((l) => {
    const age = t - l.t
    const chars = Math.min(l.text.length, Math.floor(age * 38))
    return {
      ...l,
      age,
      shown: l.text.slice(0, chars),
      typing: chars < l.text.length,
    }
  })
}

export interface TreeRow {
  dir: string
  state: 'todo' | 'active' | 'fail' | 'pass'
  files: { f: string; fresh: boolean }[]
}

const TREE_DEF: { dir: string; start: number; end: number; files: [number, string][] }[] = [
  {
    dir: '01-discovery',
    start: 0,
    end: 9.5,
    files: [
      [1.5, 'sources/sop-discharge-2026.pdf.json'],
      [3.2, 'sources/his-emr-lis-profile.json'],
      [5.5, 'claims/evidence-graph.json'],
      [8.0, 'gates/discovery.pass.json'],
    ],
  },
  {
    dir: '02-reconcile',
    start: 9.5,
    end: 19.5,
    files: [
      [11.0, 'concept-registry.json'],
      [13.5, 'reconcile-report.json'],
      [15.2, 'preview/three-views.html'],
      [18.0, 'candidate-ontology.json'],
    ],
  },
  {
    dir: '03-canonical',
    start: 19.5,
    end: 29.5,
    files: [
      [21.2, 'changeset-042.json'],
      [23.5, 'ast/policy-ast.checked.json'],
      [26.5, 'canonical-ontology.v1.2.json'],
      [28.2, 'prov/w3c-prov-o.ttl'],
    ],
  },
  {
    dir: '04-compile',
    start: 29.5,
    end: 39.5,
    files: [
      [31.2, 'generated/schema.zod.ts'],
      [33.0, 'generated/policy-guards.ts'],
      [35.0, 'generated/mcp-tools.json'],
      [37.2, 'build-manifest.json'],
    ],
  },
  {
    dir: '05-runtime',
    start: 39.5,
    end: 49.5,
    files: [
      [41.0, 'context/encounter-089.pkg.json'],
      [44.2, 'audit/blocked-release-bed.json'],
      [47.0, 'events/domain-events.jsonl'],
      [48.8, 'traces/agent-trace-089.json'],
    ],
  },
  {
    dir: '06-learning',
    start: 49.5,
    end: 59.5,
    files: [
      [51.5, 'wiki/discharge-bottlenecks.md'],
      [54.2, 'proposals/changeset-043.json'],
      [56.5, 'impact/affected-nodes.json'],
      [58.2, 'gates/incremental.pass.json'],
    ],
  },
]

export function treeAt(t: number): TreeRow[] {
  return TREE_DEF.map((d) => {
    let state: TreeRow['state'] = 'todo'
    if (t >= d.end) state = 'pass'
    else if (t >= d.start) state = d.dir === '05-runtime' && t >= 44.0 && t <= 46.2 ? 'fail' : 'active'
    const files = d.files
      .filter(([ft]) => t >= ft)
      .map(([ft, f]) => ({ f, fresh: t - ft < 2.2 }))
    return { dir: d.dir, state, files }
  })
}

export function toastAt(t: number) {
  if (t >= 15.8 && t <= 19.2) {
    return {
      kind: 'approve' as const,
      n: 1,
      pressed: t >= 17.6,
      o: window01(t, 15.8, 19.2, 0.4),
      title: '确认候选本体与三视图 Preview',
      meta: '已消解日间手术单签例外；已对齐 HIS/EMR/LIS 12 张表映射。',
    }
  }
  if (t >= 26.0 && t <= 29.2) {
    return {
      kind: 'approve' as const,
      n: 2,
      pressed: t >= 27.6,
      o: window01(t, 26.0, 29.2, 0.4),
      title: '批准 Model ChangeSet #042 发布 v1.2.0',
      meta: 'Policy AST 静态类型检查 PASS，状态机不变量已冻结。',
    }
  }
  if (t >= 44.0 && t <= 46.8) {
    return {
      kind: 'fail' as const,
      n: 0,
      pressed: false,
      o: window01(t, 44.0, 46.8, 0.35),
      title: 'Action Executor 拦截：ReleaseBed(bed-302)',
      meta: '违反 Policy [policy.discharge.medically_fit]：主治医师尚未签发 MedicallyFit。',
    }
  }
  if (t >= 56.8 && t <= 59.8) {
    return {
      kind: 'pass' as const,
      n: 0,
      pressed: false,
      o: window01(t, 56.8, 59.8, 0.4),
      title: 'Incremental Compiler：局部增量发布完成',
      meta: '仅重编译 4 / 28 个下游构件，历史 Encounter 事件 100% 兼容。',
    }
  }
  return null
}

export function hudAt(t: number) {
  const stage = Math.min(6, Math.floor(t / 10) + 1)
  const claims = Math.min(19, Math.floor(clamp((t - 1) / 8) * 19))
  const nodes = t < 10 ? 0 : Math.min(28, Math.floor(clamp((t - 10) / 18) * 28))
  const guards = t < 30 ? 0 : Math.min(16, Math.floor(clamp((t - 30) / 8) * 16))
  const approvals = t >= 27.6 ? 2 : t >= 17.6 ? 1 : 0
  return { stage, claims, nodes, guards, approvals }
}
