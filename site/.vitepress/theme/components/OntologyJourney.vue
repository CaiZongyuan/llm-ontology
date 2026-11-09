<script setup lang="ts">
/* OntologyJourney — from a desk of messy sources to one canonical ontology.
   Ported from the single-file preview (public/preview/ontology-journey.html) into
   a first-class VitePress Vue component: site design tokens, scoped styles, and
   VitePress' own dark/light switch instead of a private theme toggle. */
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'

const RAIL = [
  { n: '00', label: '原始资料', file: 'sources/*.json' },
  { n: '01', label: '资料片段', file: 'fragments/*.json' },
  { n: '02', label: '事实主张', file: 'claims.json' },
  { n: '03', label: '概念对齐', file: 'concept-registry.json' },
  { n: '04', label: '冲突消解', file: 'candidate-ontology.json' },
  { n: '05', label: '类型编译', file: 'canonical-ontology.json' },
  { n: '06', label: '权威本体', file: 'v1.2 · signed' },
]

const STEPS = [
  { kicker: 'STEP 00 · INGEST', title: '一桌子的「需求」与「文件」',
    lede: '先承认现实：起点不是模型，是互相矛盾、格式各异的原始资料。',
    what: '把 7 份异构材料（规章、通知、访谈、三套数据库、一句需求）原样登记，记录来源与 Hash。原文不做任何改写或总结。',
    why: '一旦让 LLM 先「帮忙整理成文档」，原始措辞、适用范围和矛盾点就被抹平了。后面发现结论有问题时，将再也找不到它从哪来。',
    tip: '试着点开《交班访谈》，里面那句「夜班有时候没签字就先放床」就是后面最大的陷阱。',
    tasks: ['把 7 份材料送进编译器'], output: 'sources/*.json（含原始 Hash）' },
  { kicker: 'STEP 01 · FRAGMENT', title: '把资料切成可引用的最小单元',
    lede: '资料片段（Fragment）：能精确定位到某一段、某一行、某个时间戳的原文。',
    what: '扫描原文，切出 12 个片段；只有真正含业务断言的片段才值得进入下一环节。页眉、附件说明、日志时间戳都是噪声。',
    why: '如果证据的粒度是「一整份 PDF」，那么每次引用都无法验证，也没法知道一条规则究竟出自第几条第几款。',
    tip: '点选 3 条含业务断言的片段；点错了会抖动并告诉你为什么。',
    tasks: ['扫描并切分资料', '标记 3 条有效片段'], output: 'fragments/*.json（12 个片段，3 条被引用）' },
  { kicker: 'STEP 02 · CLAIM', title: '从片段里读出「事实主张」',
    lede: 'Claim 带两件关键行李：模态（normative / descriptive / observational / hypothetical）和适用范围。',
    what: '把片段转成结构化断言，并标注模态。消解前允许重复、允许冲突，全部先留在证据图里。',
    why: '纯 RAG 分不清「规范要求」和「历史上有人违规这么干」。把 observational 误标成 normative，等于让夜班违规习惯变成合法规则。',
    tip: '最容易错的是第 3 条：它描述发生过的事，不代表被允许。',
    tasks: ['给 4 条主张标注正确模态'], output: 'claims.json + 证据图雏形' },
  { kicker: 'STEP 03 · CONCEPT REGISTRY', title: '给业务概念一个稳定身份',
    lede: 'HIS 的 visit_no、EMR 的 inp_id、LIS 的 encounter_id，其实是同一个业务概念。',
    what: '建立概念注册表：稳定 ID + 正式名称 + 别名。严格区分「同义词关联 LINK_ALIAS」与「概念合并 MERGE_CONCEPT」。',
    why: '「95% 的记录里数值相同」只是数据巧合，不是概念相同。错误合并会污染所有下游生成物，而且很难回滚。',
    tip: '先把 3 个字段对齐，再回答那道陷阱题。',
    tasks: ['对齐 3 个跨源字段', '避开「95% 相同就合并」的陷阱'], output: 'concept-registry.json（C-017 Encounter）' },
  { kicker: 'STEP 04 · RECONCILE', title: '消解冲突，而不是删掉矛盾',
    lede: '两条规则打架时，先找它们在哪一维不同：Identity / Scope / Time / Authority / Semantics。',
    what: '按适用范围把一条口径拆成两个指标，两条主张都保留；违规观察被标记 BLOCKED，留在证据图供审计。',
    why: '直接用「新文件覆盖旧文件」会让全院口径被日间手术的特例带偏；把冲突物理删除，则审计链断裂。',
    tip: '注意两份文件的适用范围（scope）写在哪里。',
    tasks: ['用正确的维度消解冲突'], output: 'candidate-ontology.json（候选，未授权）' },
  { kicker: 'STEP 05 · TYPE CHECK', title: '确定性编译器把关，LLM 不能拍板',
    lede: '语义发现引擎负责提议，语义编译引擎 100% 确定性地裁决。',
    what: '校验 EntityType / Relation / StateMachine / Policy AST。自然语言字符串不能充当执行规则，必须替换为类型化 AST 并绑定受控动作。',
    why: '「仅主治医师可确认出院」写进提示词，上下文一长就可能被 LLM 忽略；写成 AST 则由后端守卫强制执行，无法通过话术绕过。',
    tip: '点一下「交给 LLM 自由判断」，看看会发生什么。',
    tasks: ['把自然语言规则组装成策略 AST'], output: 'canonical-ontology.json · v1.2 · signed' },
  { kicker: 'STEP 06 · CANONICAL ONTOLOGY', title: '1 份权威本体，服务所有角色',
    lede: '模型是唯一事实源；看板、代码、Agent 工具都只是它的投影（Projection）。',
    what: '探索领域图与溯源链，切换业务 / 工程 / Agent 三视图，最后用本体回答开头那个问题。',
    why: '如果每个角色各维护一套模型，系统必然漂移。投影式编辑保证「改一处、处处一致」，而运行时的每个动作都受策略约束。',
    tip: '点击节点能看到它从哪份文件一路走来 —— 这就是从 0 到 1 的全部证据。',
    tasks: ['点开一个节点查看溯源', '切换一次投影视图', '运行答案对比'], output: 'Ontology Context Package + 受控 Action' },
]

const SOURCES = [
  { id: 's1', ico: 'PDF', cls: 'doc', name: '出院管理 SOP v3', meta: '医务处 · 2024-03 · 12 页', badge: '规范性规章',
    excerpt: '第 2.3 条  患者出院须由主治医师签署《医疗适合出院确认》，护理完成出院宣教后方可释放床位。\n第 4.1 条  出院准备时长自医嘱下达起计算至患者离院。',
    note: '看起来最权威，但它只覆盖普通住院。' },
  { id: 's2', ico: 'DOC', cls: 'doc', name: '日间手术绿色通道通知', meta: '门诊办公室 · 2025-06 · 3 页', badge: '规范性规章',
    excerpt: '§1.2  日间手术患者由主治医师单签即可放行；出院准备时长自护理评估完成起算。\n§2.1  本规范仅适用于日间手术中心。',
    note: '「单签」与 SOP 的「双签」看着矛盾，其实适用范围不同。' },
  { id: 's3', ico: 'TXT', cls: 'talk', name: '住院总交班访谈转写', meta: '录音 08:41 · 护理交班', badge: '观察性资料',
    excerpt: '「夜班忙的时候，有时候没等签字就先把床位放掉了，第二天再补。」\n「检验报告晚出来，床就一直卡着。」',
    note: '这是发生过的事实（observational），不是被允许的规则。' },
  { id: 's4', ico: 'SQL', cls: 'db', name: 'HIS 表结构快照', meta: 'his.inpatient_visit', badge: '结构化数据',
    excerpt: 'visit_no        varchar(32)  NOT NULL\npatient_id      varchar(32)\nbed_id          varchar(16)\ndischarge_dt    timestamp',
    note: '「一次住院就诊」在这套系统里叫 visit_no。' },
  { id: 's5', ico: 'CSV', cls: 'db', name: 'EMR 字段字典', meta: 'emr.inp_record', badge: '结构化数据',
    excerpt: 'inp_id,patient_id,medically_fit,attending_sign\nINP-2026-089,P-7712,false,NULL',
    note: '同样是「住院就诊」，EMR 叫 inp_id。' },
  { id: 's6', ico: 'JSON', cls: 'db', name: 'LIS 接口日志', meta: 'lis.lab_result · 30 天', badge: '运行日志',
    excerpt: '{"encounter_id":"INP-2026-089","panel":"CBC","status":"pending"}\n{"encounter_id":"INP-2026-091","panel":"CHEM","status":"pending"}',
    note: '第三套方言：encounter_id。检验卡点就藏在这里。' },
  { id: 's7', ico: 'REQ', cls: 'mail', name: '业务需求便签', meta: '运营 · 一句话需求', badge: '需求 / 假设',
    excerpt: '「能不能帮我做个看板，把所有被检验报告卡住、没法出院的床位列出来？顺便通知后勤做终末消毒。」\n「以后要是上了电子签，是不是就不用双签了？」',
    note: '真正要解决的问题，以及一个尚未发生的假设。' },
]

const DOC_LINES = [
  '出院管理 SOP v3        第 3 页 / 共 12 页',
  '第 2.3 条  患者出院须由主治医师签署《医疗适合出院确认》后方可释放床位。',
  '第 4.1 条  出院准备时长自医嘱下达起计算至患者离院。',
  '附件一：床位周转统计表（略）',
  '日间手术绿色通道 §1.2  主治单签即可放行，时长自护理评估完成起算。',
  '[INFO] 02:14  encounter_id=INP-2026-089 payload received',
  '交班访谈 08:41  「夜班忙的时候，有时候没等签字就先把床位放掉了。」',
  '（本页无正文）',
]

const FRAGS = [
  { id: 'f1', src: 'SOP v3 · §2.3', hash: 'a3f9c1', text: '患者出院须由主治医师签署《医疗适合出院确认》后方可释放床位。', good: true,
    why: '一条明确的规范性断言，能精确引用到条款。' },
  { id: 'f2', src: 'SOP v3 · 页眉', hash: 'b71e02', text: '— 第 3 页 / 共 12 页 —', good: false, why: '只是排版信息，不是业务断言。' },
  { id: 'f3', src: '绿色通道 · §1.2', hash: 'c02d8e', text: '日间手术患者主治单签即可放行，出院准备时长自护理评估完成起算。', good: true,
    why: '另一条规范，但适用范围更小；先留着，后面消解。' },
  { id: 'f4', src: 'LIS 日志 · 02:14', hash: 'd4aa90', text: '[INFO] encounter_id=INP-2026-089 payload received', good: false, why: '运行日志，不是可引用的业务规则。' },
  { id: 'f5', src: '交班访谈 · 08:41', hash: 'e91b77', text: '「夜班忙的时候，有时候没等签字就先把床位放掉了。」', good: true,
    why: '是观察事实，也是重要证据 —— 但绝不能当规范用。' },
  { id: 'f6', src: 'SOP v3 · 附件', hash: 'f60013', text: '附件一：床位周转统计表（略）', good: false, why: '附件占位说明，没有可断言的内容。' },
]
const GOOD_FRAGS = FRAGS.filter(f => f.good)

const CLAIMS = [
  { id: 'c1', text: '出院必须由主治医师签署《医疗适合出院确认》', frag: 'SOP §2.3 · a3f9c1', mod: 'normative',
    why: '写了「必须」，规定业务应当如何运行 → normative。它才有资格进入权威本体。' },
  { id: 'c2', text: 'HIS 的 visit_no 唯一标识一次住院就诊', frag: 'HIS 快照 · 8d12bb', mod: 'descriptive',
    why: '描述系统现状，不规定对错 → descriptive。用于概念对齐，不是规则。' },
  { id: 'c3', text: '夜班偶尔未签字就先放行了床位', frag: '交班访谈 · e91b77', mod: 'observational',
    why: '发生过的事 ≠ 被允许的事。标成 normative 就等于把违规习惯写进本体。' },
  { id: 'c4', text: '若上线电子签名，未来可取消双签', frag: '需求便签 · 9c21ab', mod: 'hypothetical',
    why: '尚未发生的假设 → hypothetical。挂起等待决策，不能直接编译。' },
]
const MODS = [
  { k: 'normative', cn: '规范' }, { k: 'descriptive', cn: '描述' },
  { k: 'observational', cn: '观察' }, { k: 'hypothetical', cn: '假设' },
]
const FIELDS = [
  { id: 'visit_no', sys: 'HIS · his.inpatient_visit', desc: '住院号' },
  { id: 'inp_id', sys: 'EMR · emr.inp_record', desc: '住院记录主键' },
  { id: 'encounter_id', sys: 'LIS · lab_result', desc: '就诊关联键' },
]
const DIMS = [
  { k: 'Identity', cn: '概念身份', fb: '两条讲的是同一个指标，只是起点定义不同 —— 不是身份问题，再想想。' },
  { k: 'Scope', cn: '适用范围', fb: '', good: true },
  { k: 'Time', cn: '时间版本', fb: '按时间覆盖会让 2025 年的日间手术特例，把全院普通住院的口径一起改掉。' },
  { k: 'Authority', cn: '发布权威', fb: '按权威选一份丢一份：证据图里会留下「我们曾经知道另一条规则，但把它删了」的断链。' },
  { k: 'Semantics', cn: '语义定义', fb: '语义确实不同，但根源是两份文件各自只对自己的适用范围有效。' },
]
const AST_OPTS: Record<string, { k: string; t: string; ok?: boolean }[]> = {
  role: [{ k: 'attending', t: 'role == Attending', ok: true }, { k: 'nurse', t: 'role == Nurse' }, { k: 'agent', t: 'role == Agent' }],
  state: [{ k: 'anystate', t: 'any state' }, { k: 'fit', t: 'medically_fit == true', ok: true }, { k: 'lab', t: 'pending_lab == false' }],
  action: [{ k: 'clean', t: 'ScheduleBedCleaning' }, { k: 'release', t: 'ReleaseBed' }, { k: 'confirm', t: 'ConfirmMedicallyFit', ok: true }],
}
const AST_KEYS = ['role', 'state', 'action']

const NODES = [
  { id: 'patient', x: 98, y: 62, cn: '患者', en: 'Patient', type: 'EntityType', prov: ['业务需求便签 · s7', 'Fragment §需求-01 · 9c21ab', 'Claim C-014 患者是独立概念'] },
  { id: 'encounter', x: 320, y: 62, cn: '住院就诊', en: 'Encounter', type: 'EntityType', prov: ['HIS / EMR / LIS 三套快照', '3 个跨源字段片段', 'Concept Registry C-017'] },
  { id: 'bed', x: 548, y: 52, cn: '床位', en: 'Bed', type: 'EntityType', prov: ['HIS 快照 · his.inpatient_visit', 'Fragment bed_id · 8d12bb', 'Claim C-021 床位占据关系'] },
  { id: 'lab', x: 548, y: 162, cn: '检验结果', en: 'LabResult', type: 'EntityType', prov: ['LIS 接口日志 · 30 天', 'Fragment encounter_id · d4aa90', 'Claim C-022 检验卡点'] },
  { id: 'pathway', x: 320, y: 196, cn: '出院准备路径', en: 'DischargePathway', type: 'StateMachine', prov: ['SOP v3 §4.1 + 绿色通道 §1.2', 'Fragment a3f9c1 / c02d8e', 'Scope 消解后的两个 Metric'] },
  { id: 'metric', x: 98, y: 196, cn: '出院准备时长', en: 'Metric', type: 'Metric', prov: ['两份互相冲突的规章', 'Fragment §4.1 / §1.2', 'Claim C-001 / C-002（scope 拆分）'] },
  { id: 'action', x: 548, y: 288, cn: '出院确认动作', en: 'Action', type: 'Action', prov: ['SOP v3 §2.3', 'Fragment a3f9c1', 'Claim C-001 · normative'] },
  { id: 'policy', x: 320, y: 322, cn: '策略约束', en: 'Policy', type: 'Policy (AST)', prov: ['SOP v3 §2.3 自然语言规则', 'AST 组装台 · typed', 'canonical-v1.2 signed'] },
]
const EDGES = [
  { a: 'patient', b: 'encounter', label: 'has' }, { a: 'encounter', b: 'bed', label: 'occupies' },
  { a: 'encounter', b: 'lab', label: 'awaits' }, { a: 'encounter', b: 'pathway', label: 'follows' },
  { a: 'pathway', b: 'metric', label: 'measured_by' }, { a: 'lab', b: 'action', label: 'blocks' },
  { a: 'action', b: 'policy', label: 'guards', guard: true }, { a: 'policy', b: 'encounter', label: 'applies', guard: true },
]
const EDGE_PATHS = EDGES.map(e => {
  const a = NODES.find(n => n.id === e.a)!, b = NODES.find(n => n.id === e.b)!
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
  const cx = mx + (b.y - a.y) * 0.08, cy = my - Math.abs(b.x - a.x) * 0.04
  return { ...e, d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`, lx: mx, ly: my - 6 }
})
const FUNNEL = [
  { l: '资料', v: 7 }, { l: '片段', v: 12 }, { l: '主张', v: 9 }, { l: '概念', v: 6 },
  { l: '关系', v: 8 }, { l: '策略', v: 3 }, { l: '权威本体', v: 1 },
]
const TERM_LINES = [
  '<span style="color:var(--term-dim)">$</span> llm-ontology compile --in candidate-ontology.json',
  '<span style="color:var(--term-dim)">[ingest]</span> 3 EntityType · 8 Relation · 2 Metric · 3 Policy',
  '<span style="color:var(--term-ok)">[ PASS ]</span> EntityType / stable ID ..................... OK',
  '<span style="color:var(--term-ok)">[ PASS ]</span> Relation cardinality ..................... OK',
  '<span style="color:var(--term-ok)">[ PASS ]</span> StateMachine invariants ................... OK',
  '<span style="color:var(--term-bad)">[ FAIL ]</span> Policy AST typed ........... RAW STRING FOUND',
  '<span style="color:var(--term-warn)">  └</span> found "仅主治医师可确认出院"  <span style="color:var(--term-dim)">(natural language)</span>',
  '<span style="color:var(--term-dim)">  → 自然语言不能充当执行规则，请提交类型化 Policy AST。</span>',
]
const PROJ_VIEWS = [['biz', '业务视图'], ['dev', '工程视图'], ['agent', 'Agent 视图']] as const
const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37.7) % 100, color: ['var(--accent)', 'var(--c2)', 'var(--c3)', 'var(--ok)'][i % 4], delay: ((i * 13) % 50) / 100,
}))

/* ------------------------------------------------------------- state */
const rootEl = ref<HTMLElement | null>(null)
const hopperEl = ref<HTMLElement | null>(null)
const coreEl = ref<HTMLElement | null>(null)

const step = ref(0)
const unlocked = ref<Set<number>>(new Set())
const tasks = ref<Set<string>>(new Set())
const auto = ref(false)
let autoToken = 0
const fullscreen = ref(false)
const toastMsg = ref('')
const toastKind = ref('')
let toastTimer = 0

const ingested = ref(false)
const ingestCount = ref(0)
const openSource = ref('')
const mouthPulse = ref(false)
const offsets = reactive<Record<string, { x: number; y: number }>>({})
let drag: { id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null

const scanning = ref(false)
const scanned = ref(false)
const fragsVisible = ref(false)
const docHits = ref<Set<number>>(new Set())
const picks = ref<Set<string>>(new Set())
const wrongFrag = ref('')
const claimAnswers = reactive<Record<string, string>>({})
const wrongClaim = ref('')
const aligned = ref<Set<string>>(new Set())
const trapAnswer = ref('')
const trapWrong = ref(false)
const dimAnswer = ref('')
const dimWrong = ref('')
const astSel = reactive<Record<string, string>>({})
const astPassed = ref(false)
const astFeedback = ref('')
const termLines = ref<string[]>([])
const termRunning = ref(false)
const termDone = ref(false)
const projView = ref('biz')
const selectedNode = ref('')
const nodeDetailLit = ref(0)
const answered = ref(false)
const graphDrawn = ref(false)
const funnelShown = ref<number[]>([0, 0, 0, 0, 0, 0, 0])
const finalDone = ref(false)

const alignedList = computed(() => Array.from(aligned.value))
const curStep = computed(() => STEPS[step.value])
const selNode = computed(() => NODES.find(n => n.id === selectedNode.value) || null)
const isLast = computed(() => step.value === STEPS.length - 1)
const nextDisabled = computed(() => !isLast.value && !unlocked.value.has(step.value))
const canSkip = computed(() => !isLast.value && !unlocked.value.has(step.value))
const ingestStatus = computed(() => ingested.value
  ? '✓ 7 份资料原样登记完成。原文不改写 —— 这是后面所有追溯的锚点。'
  : ingestCount.value ? `已登记 ${ingestCount.value} / 7 份资料（含原始 Hash）…` : '尚未登记任何资料。')
const fragStatus = computed(() => {
  if (!scanned.value) return '等待扫描。'
  if (picks.value.size === 3) return '✓ 3 条片段被引用，其余 9 个片段留在库里但不会进入证据图。'
  if (picks.value.size) return `已标记 ${picks.value.size} / 3 条有效片段。`
  return '切出 12 个片段；请点选 3 条真正含业务断言的。'
})
const claimStatus = computed(() => Object.keys(claimAnswers).length === 4
  ? '✓ 4 条主张全部带模态；observational 与 hypothetical 被挡在权威本体之外。'
  : `${Object.keys(claimAnswers).length} / 4 条主张已标注。`)
const alignStatus = computed(() => aligned.value.size === 3
  ? '✓ 三个别名挂到同一个稳定 ID；注意这只是 LINK_ALIAS，不是概念合并。'
  : `${aligned.value.size} / 3 个字段已对齐到 C-017。`)
const finalStatus = computed(() => answered.value
  ? '✓ 同一个问题，两种答案：差别不在模型能力，而在有没有一份受约束的本体。'
  : '点一个节点、切换一次视图、再运行对比，就算走完全程。')

/* ------------------------------------------------------------- helpers */
function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }
function offsetStyle(id: string) {
  const o = offsets[id]
  return o ? `translate(${o.x}px,${o.y}px)` : ''
}
function nodeTransform(n: typeof NODES[number]) { return `translate(${n.x - 68},${n.y - 24})` }
function q(sel: string) { return rootEl.value?.querySelector(sel) as HTMLElement | null ?? null }
function qs(sel: string) { return Array.from(rootEl.value?.querySelectorAll(sel) ?? []) as HTMLElement[] }
function toast(msg: string, kind = '') {
  toastMsg.value = msg; toastKind.value = kind
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toastMsg.value = '' }, 2600)
}
function shake(el: HTMLElement | null) {
  if (!el) return
  el.classList.remove('oj-shake'); void el.offsetWidth
  el.classList.add('oj-shake')
  window.setTimeout(() => el.classList.remove('oj-shake'), 450)
}
async function flyTo(el: HTMLElement, target: HTMLElement | null, delay = 0) {
  if (!el || !target) return
  const a = el.getBoundingClientRect(), b = target.getBoundingClientRect()
  const clone = el.cloneNode(true) as HTMLElement
  clone.style.cssText = `position:fixed;z-index:9999;margin:0;pointer-events:none;left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;`
  document.body.appendChild(clone)
  const dx = (b.left + b.width / 2) - (a.left + a.width / 2)
  const dy = (b.top + b.height / 2) - (a.top + a.height / 2)
  let anim: Animation | null = null
  try {
    anim = clone.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) scale(.14) rotate(14deg)`, opacity: 0.1 },
    ], { duration: 680, delay, easing: 'cubic-bezier(.4,0,.7,.4)', fill: 'forwards' })
  } catch { clone.remove(); return }
  const cleanup = () => clone.remove()
  if (!anim.finished) { await sleep(800 + delay); cleanup(); return }
  await Promise.race([
    anim.finished.then(cleanup).catch(cleanup),
    sleep(1200 + delay).then(cleanup),
  ])
}
function stopAuto() {
  if (!auto.value) return
  auto.value = false; autoToken++
}
function markTask(s: number, i: number) {
  tasks.value.add(`${s}:${i}`)
  tasks.value = new Set(tasks.value)
  if (STEPS[s].tasks.every((_, j) => tasks.value.has(`${s}:${j}`))) unlock(s)
}
function unlock(s: number) {
  if (unlocked.value.has(s)) return
  unlocked.value.add(s); unlocked.value = new Set(unlocked.value)
  toast(`✓ 第 ${s} 步完成，可以继续了`, 'oj-ok')
}
function animateFunnel() {
  const s = step.value
  const arr = FUNNEL.map((f, i) => i < s ? f.v : 0)
  funnelShown.value = arr
  const to = FUNNEL[s].v
  let n = 0
  const inc = Math.max(1, Math.ceil(to / 6))
  const id = window.setInterval(() => {
    n += inc
    const next = [...funnelShown.value]
    next[s] = Math.min(n, to)
    funnelShown.value = next
    if (n >= to) window.clearInterval(id)
  }, 45)
}
function goto(i: number) {
  step.value = Math.max(0, Math.min(STEPS.length - 1, i))
  animateFunnel()
  if (step.value === 5 && !termDone.value) runTerminal()
  if (step.value === 6 && !graphDrawn.value) graphDrawn.value = true
  if (!fullscreen.value && rootEl.value) {
    const y = rootEl.value.getBoundingClientRect().top + window.scrollY - 76
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
  }
}

/* ------------------------------------------------------------- step 0 */
function onSrcClick(id: string) {
  if (drag?.moved) { drag = null; return }
  openSource.value = openSource.value === id ? '' : id
}
function onDown(e: PointerEvent, id: string) {
  if (e.button !== 0 || ingested.value) return
  const o = offsets[id] || { x: 0, y: 0 }
  drag = { id, sx: e.clientX, sy: e.clientY, ox: o.x, oy: o.y, moved: false }
  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* noop */ }
}
function onMove(e: PointerEvent) {
  if (!drag) return
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy
  if (Math.abs(dx) + Math.abs(dy) > 4) {
    drag.moved = true
    offsets[drag.id] = { x: drag.ox + dx, y: drag.oy + dy }
  }
}
function onUp() { if (drag && !drag.moved) drag = null }
async function ingestAll() {
  if (ingested.value) return
  ingested.value = true
  openSource.value = ''
  const cards = qs('.oj-src')
  await Promise.all(cards.map((c, i) => flyTo(c, hopperEl.value, i * 110).then(() => {
    ingestCount.value = i + 1
    mouthPulse.value = false
    window.setTimeout(() => { mouthPulse.value = true }, 0)
  })))
  ingestCount.value = 7
  markTask(0, 0)
}
function onIngest() { stopAuto(); ingestAll() }

/* ------------------------------------------------------------- step 1 */
async function scanAll() {
  if (scanned.value) return
  scanned.value = true; scanning.value = true
  DOC_LINES.forEach((_, i) => window.setTimeout(() => {
    docHits.value.add(i); docHits.value = new Set(docHits.value)
  }, 120 + i * 90))
  await sleep(900)
  scanning.value = false; fragsVisible.value = true
  markTask(1, 0)
}
function pickFrag(f: typeof FRAGS[number]) {
  if (picks.value.has(f.id)) return
  if (!f.good) {
    wrongFrag.value = f.id
    toast('这不是业务断言：' + f.why, 'oj-bad')
    window.setTimeout(() => { wrongFrag.value = '' }, 500)
    return
  }
  picks.value.add(f.id); picks.value = new Set(picks.value)
  toast(`已引用 ${f.src} · #${f.hash}`, 'oj-ok')
  if (picks.value.size === 3) markTask(1, 1)
}
function onFragClick(f: typeof FRAGS[number]) { stopAuto(); pickFrag(f) }
function onFragScan() { stopAuto(); scanAll() }
function onAutoFind() { stopAuto(); autoFind() }
async function autoFind() {
  if (!scanned.value) await scanAll()
  for (const f of GOOD_FRAGS) {
    if (!picks.value.has(f.id)) pickFrag(f)
    await sleep(220)
  }
}

/* ------------------------------------------------------------- step 2 */
function setClaim(c: typeof CLAIMS[number], mod: string) {
  if (claimAnswers[c.id]) return
  if (mod !== c.mod) {
    wrongClaim.value = `${c.id}:${mod}`
    toast('再想想：这条是「' + (c.mod === 'normative' ? '规定必须怎样' : c.mod === 'observational' ? '实际发生过' : c.mod === 'hypothetical' ? '还没发生的假设' : '描述系统现状') + '」。', 'oj-bad')
    window.setTimeout(() => { wrongClaim.value = '' }, 500)
    return
  }
  claimAnswers[c.id] = mod
  toast('✓ 正确：' + mod, 'oj-ok')
  if (Object.keys(claimAnswers).length === 4) markTask(2, 0)
}
function onClaimClick(c: typeof CLAIMS[number], mod: string) { stopAuto(); setClaim(c, mod) }
async function solveClaims() {
  for (const c of CLAIMS) {
    if (!claimAnswers[c.id]) setClaim(c, c.mod)
    await sleep(260)
  }
}

/* ------------------------------------------------------------- step 3 */
async function alignField(id: string) {
  if (aligned.value.has(id)) return
  aligned.value.add(id); aligned.value = new Set(aligned.value)
  const el = q(`.oj-field[data-id="${id}"]`)
  await flyTo(el || (rootEl.value as HTMLElement), coreEl.value, 0)
  if (aligned.value.size === 3) markTask(3, 0)
}
function onFieldClick(id: string) { stopAuto(); alignField(id) }
function setTrap(k: string) {
  if (trapAnswer.value) return
  if (k === 'KEEP_SEPARATE') {
    trapAnswer.value = k; trapWrong.value = false
    toast('✓ 避免了不可逆的错误合并', 'oj-ok')
    markTask(3, 1)
  } else {
    trapWrong.value = true
    toast('这个选择会污染下游所有生成物', 'oj-bad')
    shake(q('.oj-trap') as HTMLElement)
  }
}
function onTrapClick(k: string) { stopAuto(); setTrap(k) }
async function solveAlign() {
  for (const f of FIELDS) {
    if (!aligned.value.has(f.id)) alignField(f.id)
    await sleep(300)
  }
  await sleep(400)
  if (!trapAnswer.value) setTrap('KEEP_SEPARATE')
}

/* ------------------------------------------------------------- step 4 */
function setDim(k: string) {
  if (dimAnswer.value) return
  const d = DIMS.find(x => x.k === k)!
  if (d.good) {
    dimAnswer.value = k
    toast('✓ 消解完成：候选本体已生成（尚未授权）', 'oj-ok')
    markTask(4, 0)
  } else {
    dimWrong.value = k
    toast(d.fb, 'oj-bad')
    window.setTimeout(() => { dimWrong.value = '' }, 500)
  }
}
function onDimClick(k: string) { stopAuto(); setDim(k) }

/* ------------------------------------------------------------- step 5 */
async function runTerminal() {
  if (termDone.value) return
  termDone.value = true; termRunning.value = true
  for (const line of TERM_LINES) {
    termLines.value.push(line)
    await sleep(190 + Math.random() * 130)
  }
  termLines.value.push('<span style="color:var(--term-acc)">&gt; 等待类型化 Policy AST …</span>')
  termRunning.value = false
}
function termLog(html: string) { termLines.value.push(html) }
function setAst(k: string, v: string) { astSel[k] = v }
function onAstClick(k: string, v: string) { stopAuto(); setAst(k, v) }
function submitAst() {
  if (astPassed.value) return
  if (termRunning.value) { toast('编译器正在逐项检查，稍等一下…'); return }
  const ok = AST_KEYS.every(k => AST_OPTS[k].find(o => o.k === astSel[k])?.ok)
  if (!ok) {
    astFeedback.value = 'oj-bad'
    toast('Policy AST 不合法，编译器拒绝放行', 'oj-bad')
    shake(q('.oj-ast') as HTMLElement)
    termLog('<span style="color:var(--term-bad)">[ FAIL ]</span> AST 仍不合法：缺少 typed guard。')
    return
  }
  astPassed.value = true; astFeedback.value = 'oj-good'
  termLog('<span style="color:var(--term-acc)">$</span> submit policy/only-attending.ast')
  termLog('<span style="color:var(--term-ok)">[ PASS ]</span> Policy AST typed ........................ OK')
  termLog('<span style="color:var(--term-ok)">[ PASS ]</span> 16 contract tests (incl. 4 negative) ... OK')
  termLog('<span style="color:var(--term-ok)">[ SIGN ]</span> canonical-ontology.json  <span style="color:var(--term-acc)">v1.2</span>  ·  approved  ✓')
  toast('✓ 权威本体已发布 v1.2', 'oj-ok')
  markTask(5, 0)
}
function onAstSubmit() { stopAuto(); submitAst() }
function llmFree() {
  stopAuto()
  if (termRunning.value) { toast('编译器正在逐项检查，稍等一下…'); return }
  termLog('<span style="color:var(--term-dim)">$</span> agent.run("直接放行床位", trust_llm=true)')
  termLog('<span style="color:var(--term-bad)">[ DRIFT ]</span> LLM 忽略了「仅主治医师」约束，判定 Nurse 工号可操作')
  termLog('<span style="color:var(--term-bad)">[ BLOCKED? ]</span> 无 AST 守卫 → ReleaseBed 已执行，审计链缺少 modelVersion')
  toast('看：提示词约束在长上下文里被绕过了', 'oj-bad')
}
async function solveAst() {
  while (termRunning.value) await sleep(200)
  for (const k of AST_KEYS) {
    const o = AST_OPTS[k].find(x => x.ok)!
    setAst(k, o.k)
    await sleep(220)
  }
  await sleep(250)
  if (!astPassed.value) submitAst()
}

/* ------------------------------------------------------------- step 6 */
function selectNode(id: string) {
  selectedNode.value = id
  nodeDetailLit.value = 0
  ;[1, 2, 3].forEach((n, i) => window.setTimeout(() => { nodeDetailLit.value = n }, 160 + i * 220))
  markTask(6, 0)
  checkFinal()
}
function onNodeClick(id: string) { stopAuto(); selectNode(id) }
function setProj(v: string) {
  projView.value = v
  markTask(6, 1)
  checkFinal()
}
function onProj(v: string) { stopAuto(); setProj(v) }
function runAnswer() {
  if (answered.value) return
  answered.value = true
  markTask(6, 2)
  checkFinal()
}
function onAnswer() { stopAuto(); runAnswer() }
function checkFinal() {
  if (finalDone.value) return
  if (STEPS[6].tasks.every((_, i) => tasks.value.has(`6:${i}`))) {
    finalDone.value = true
    unlock(6)
    toast('🎉 0 → 1 完成：每一处都能走回原始文件', 'oj-ok')
  }
}

/* ------------------------------------------------------------- auto + chrome */
const SOLVERS: (() => Promise<void>)[] = [
  async () => { await ingestAll() },
  async () => { await scanAll(); await autoFind() },
  async () => { await solveClaims() },
  async () => { await solveAlign() },
  async () => { if (!dimAnswer.value) setDim('Scope'); await sleep(500) },
  async () => { await solveAst() },
  async () => { selectNode('encounter'); await sleep(400); setProj('dev'); await sleep(400); runAnswer() },
]
async function autoPlay() {
  if (auto.value) { stopAuto(); return }
  auto.value = true
  const token = ++autoToken
  if (step.value !== 0) { goto(0); await sleep(400) }
  for (let i = 0; i < STEPS.length; i++) {
    if (!auto.value || token !== autoToken) return
    goto(i)
    await sleep(650)
    if (!auto.value || token !== autoToken) return
    await SOLVERS[i]()
    await sleep(1000)
  }
  if (auto.value) auto.value = false
}
function onAuto() {
  if (auto.value) { stopAuto(); return }
  autoPlay()
}
function onRail(i: number) { stopAuto(); goto(i) }
function onPrev() { stopAuto(); goto(step.value - 1) }
function onNext() {
  stopAuto()
  if (isLast.value) { resetAll(); return }
  goto(step.value + 1)
}
function onSkip() { stopAuto(); unlock(step.value); goto(step.value + 1) }
function resetAll() {
  stopAuto()
  step.value = 0
  unlocked.value = new Set(); tasks.value = new Set()
  ingested.value = false; ingestCount.value = 0; openSource.value = ''; mouthPulse.value = false
  for (const k of Object.keys(offsets)) delete offsets[k]
  scanning.value = false; scanned.value = false; fragsVisible.value = false; docHits.value = new Set()
  picks.value = new Set(); wrongFrag.value = ''
  for (const k of Object.keys(claimAnswers)) delete claimAnswers[k]
  wrongClaim.value = ''
  aligned.value = new Set(); trapAnswer.value = ''; trapWrong.value = false
  dimAnswer.value = ''; dimWrong.value = ''
  for (const k of Object.keys(astSel)) delete astSel[k]
  astPassed.value = false; astFeedback.value = ''
  termLines.value = []; termRunning.value = false; termDone.value = false
  projView.value = 'biz'; selectedNode.value = ''; nodeDetailLit.value = 0
  answered.value = false; graphDrawn.value = false; finalDone.value = false
  animateFunnel()
  toast('已重置，从第 00 步重新开始')
}
function toggleFullscreen() {
  fullscreen.value = !fullscreen.value
  document.body.style.overflow = fullscreen.value ? 'hidden' : ''
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && fullscreen.value) toggleFullscreen()
  if (e.key === 'Escape' && auto.value) stopAuto()
}
onMounted(() => {
  animateFunnel()
  window.addEventListener('keydown', onKey)
  if (/[?&]autorun=1/.test(window.location.search)) window.setTimeout(() => { if (!auto.value) autoPlay() }, 500)
})
onBeforeUnmount(() => {
  stopAuto()
  window.clearTimeout(toastTimer)
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
<div ref="rootEl" class="oj oj-root vp-raw" :class="{ 'oj-full': fullscreen }">
  <header class="oj-top">
    <div class="oj-brand">
      <div class="oj-mark">O</div>
      <div>
        <h1>从 0 到 1：一份 Ontology 的诞生</h1>
        <div class="oj-sub">INTERACTIVE LESSON · EVIDENCE → CANONICAL ONTOLOGY</div>
      </div>
    </div>
    <div class="oj-top-actions">
      <button class="oj-btn oj-btn--sm" :class="{ 'oj-on': auto }" @click="onAuto">{{ auto ? '⏸ 停止演示' : '▶ 自动演示' }}</button>
      <button class="oj-btn oj-btn--sm" @click="toggleFullscreen">{{ fullscreen ? '⛶ 退出全屏' : '⛶ 全屏沉浸' }}</button>
      <button class="oj-btn oj-btn--sm oj-btn--ghost" @click="resetAll">↺ 重置</button>
    </div>
  </header>

  <div class="oj-mission" :class="{ 'oj-answered': answered }">
    <span class="oj-tag">贯穿任务</span>
    <div class="oj-q">读者带着一个真实需求走进来：<b>「帮我列出被检验报告卡住、没法出院的床位，并通知后勤安排终末消毒」</b></div>
    <span class="oj-state">{{ answered ? '已由 v1.2 守卫回答 ✓' : '等待本体回答…' }}</span>
  </div>

  <nav class="oj-rail" aria-label="编译流水线步骤">
    <button v-for="(r, i) in RAIL" :key="r.n" class="oj-rail-item"
      :class="{ 'oj-active': i === step, 'oj-done': unlocked.has(i) }" @click="onRail(i)">
      <span class="oj-rn"><span>{{ r.n }}</span><span class="oj-tick">{{ unlocked.has(i) ? '✓' : '' }}</span></span>
      <span class="oj-rl">{{ r.label }}</span>
      <span class="oj-rf">{{ r.file }}</span>
    </button>
  </nav>

  <div class="oj-split">
    <main class="oj-panel">
      <div class="oj-stage-head">
        <div class="oj-kicker">{{ curStep.kicker }}</div>
        <h2>{{ curStep.title }}</h2>
        <p>{{ curStep.lede }}</p>
      </div>
      <div class="oj-acts">

        <!-- 00 ------------------------------------------------------------ -->
        <section v-if="step === 0" class="oj-act">
          <p class="oj-act-lead">桌上这 7 份东西，就是项目的全部起点：<em>规章、通知、访谈、三套异构数据库、还有一句随口的需求</em>。点开看看里面写了什么，也可以拖一拖它们 —— 此刻没有任何「模型」，只有互相矛盾、格式各异的原始资料。</p>
          <p class="oj-mini-title">SOURCE / 原始资料 · 点卡片展开原文，可拖动</p>
          <div class="oj-desk">
            <div v-for="(s, i) in SOURCES" :key="s.id" class="oj-src" :data-id="s.id"
              :class="{ 'oj-open': openSource === s.id, 'oj-ingested': ingested }"
              :style="{ animationDelay: (i * 65) + 'ms', transform: offsetStyle(s.id) }"
              @click="onSrcClick(s.id)" @pointerdown="onDown($event, s.id)" @pointermove="onMove($event)" @pointerup="onUp">
              <div class="oj-srow"><div class="oj-ico" :class="s.cls">{{ s.ico }}</div><div class="oj-name">{{ s.name }}</div></div>
              <div class="oj-meta">{{ s.meta }}</div>
              <div class="oj-badge">{{ s.badge }}</div>
              <div class="oj-excerpt">{{ s.excerpt }}<span class="oj-note">💡 {{ s.note }}</span></div>
            </div>
          </div>
          <div class="oj-hopper">
            <div ref="hopperEl" class="oj-mouth" :class="{ 'oj-pulse': mouthPulse }">IN</div>
            <div class="oj-htxt"><b>编译器入口 · Source Ingestor</b>先登记原文与 Hash，之后每一步都必须能回溯到这里。</div>
            <button class="oj-btn oj-btn--primary" :disabled="ingested" @click="onIngest">把这 7 份材料送进编译器 →</button>
          </div>
          <div class="oj-bar"><span class="oj-status" :class="{ 'oj-ok': ingested }">{{ ingestStatus }}</span><span class="oj-hint">提示：违规观察、规范、字段定义混在一起，是这个阶段最大的坑。</span></div>
        </section>

        <!-- 01 ------------------------------------------------------------ -->
        <section v-else-if="step === 1" class="oj-act">
          <p class="oj-act-lead">编译器不改写原文，只把它切成<em>可精确定位、可引用的最小单元：资料片段（Fragment）</em>。但并不是每一行都算证据 —— 页眉、日志时间戳、附件说明都只是噪声。请亲手挑出 3 条真正含业务断言的片段。</p>
          <div class="oj-scanbox">
            <div class="oj-docview" :class="{ 'oj-scanning': scanning }">
              <div class="oj-dv-head">SOURCE READER / SOP v3 · 绿色通道 · 交班访谈</div>
              <div v-for="(l, i) in DOC_LINES" :key="i" class="oj-docline" :class="{ 'oj-hit': docHits.has(i) }">{{ l }}</div>
              <div class="oj-scanline" />
            </div>
            <div>
              <p class="oj-mini-title">FRAGMENTS / 点击标记可引用的片段</p>
              <div class="oj-frag-grid">
                <div v-for="(f, i) in FRAGS" v-show="fragsVisible" :key="f.id" class="oj-frag"
                  :class="{ 'oj-visible': fragsVisible, 'oj-good-pick': picks.has(f.id), 'oj-picked': picks.has(f.id), 'oj-wrong-pick': wrongFrag === f.id }"
                  :style="{ animationDelay: (i * 80) + 'ms' }" @click="onFragClick(f)">
                  <div class="oj-fh"><span>{{ f.src }}</span><span>#{{ f.hash }}</span></div>
                  <div class="oj-ft">{{ f.text }}</div>
                </div>
                <div v-if="!fragsVisible" class="oj-hint">点击「扫描并切分资料」，编译器会逐行定位可引用的最小单元。</div>
              </div>
            </div>
          </div>
          <div class="oj-bar">
            <button class="oj-btn oj-btn--primary" :disabled="scanned" @click="onFragScan">① 扫描并切分资料</button>
            <button class="oj-btn oj-btn--ghost oj-btn--sm" @click="onAutoFind">自动定位（看答案）</button>
            <span class="oj-status" :class="{ 'oj-ok': picks.size === 3 }">{{ fragStatus }}</span>
          </div>
        </section>

        <!-- 02 ------------------------------------------------------------ -->
        <section v-else-if="step === 2" class="oj-act">
          <p class="oj-act-lead">从片段里读出<em>事实主张（Claim）</em>，并给每条标注模态。这一步决定它有没有资格进入本体：<em>「发生过」不等于「被允许」</em>。请给 4 条主张各选一个正确的模态。</p>
          <div class="oj-claim-list">
            <div v-for="(c, i) in CLAIMS" :key="c.id" class="oj-claim"
              :class="{ 'oj-solved': !!claimAnswers[c.id] }" :style="{ animationDelay: (i * 90) + 'ms' }">
              <div class="oj-ct">{{ c.text }}</div>
              <div class="oj-cf">{{ c.frag }} · {{ claimAnswers[c.id] || '待标注模态' }}</div>
              <div v-if="!claimAnswers[c.id]" class="oj-mods">
                <button v-for="m in MODS" :key="m.k" class="oj-mod-btn" :data-mod="m.k"
                  :class="{ 'oj-wrongpick': wrongClaim === c.id + ':' + m.k }" @click="onClaimClick(c, m.k)">
                  <b>{{ m.k }}</b>{{ m.cn }}
                </button>
              </div>
              <div v-else class="oj-why-line">✓ {{ c.why }}</div>
            </div>
          </div>
          <div v-if="Object.keys(claimAnswers).length === 4" class="oj-prov oj-show">
            <p class="oj-mini-title">EVIDENCE GRAPH / 每条主张都连得回原文</p>
            <div class="oj-chain"><span>Source：出院管理 SOP v3</span><i>→</i><span>Fragment：§2.3 · a3f9c1</span><i>→</i><span>Claim C-001 · normative</span></div>
            <p>证据图保留矛盾与不确定性；它回答的是「我们为什么相信这件事」，不是知识图谱，也不是 RAG 索引。</p>
          </div>
          <div class="oj-bar"><span class="oj-status" :class="{ 'oj-ok': Object.keys(claimAnswers).length === 4 }">{{ claimStatus }}</span><span class="oj-hint">normative 规范 · descriptive 描述 · observational 观察 · hypothetical 假设</span></div>
        </section>

        <!-- 03 ------------------------------------------------------------ -->
        <section v-else-if="step === 3" class="oj-act">
          <p class="oj-act-lead">同一个「住院就诊」，三套系统有三个名字。概念注册表要给业务概念一个<em>稳定身份</em>，把跨源字段挂成别名。点击左侧 3 个字段，把它们对齐到中间的 Encounter。</p>
          <div class="oj-align">
            <div class="oj-field-pool">
              <div v-for="f in FIELDS" :key="f.id" class="oj-field" :data-id="f.id"
                :class="{ 'oj-merged': aligned.has(f.id) }" @click="onFieldClick(f.id)">
                <div class="oj-fk">{{ f.id }}</div><div class="oj-fs">{{ f.sys }} · {{ f.desc }}</div>
              </div>
            </div>
            <div ref="coreEl" class="oj-concept-core">
              <div class="oj-ct">Encounter</div>
              <div class="oj-cs">住院就诊 · 稳定 ID <span class="oj-mono">C-017</span></div>
              <div class="oj-aliases">
                <span v-for="id in alignedList" :key="id" class="oj-alias">{{ id }}</span>
              </div>
              <div v-if="!aligned.size" class="oj-alias-empty">尚无别名</div>
            </div>
            <div class="oj-align-note">
              <p class="oj-mini-title">WHY / 为什么需要稳定 ID</p>
              如果每次查询都靠字段名猜，Agent 就得同时记住三套系统的方言。<br><br>
              有了稳定 ID，<code>visit_no / inp_id / encounter_id</code> 只是同一个概念的三个别名 <code>LINK_ALIAS</code>，模型层只有一份定义。
            </div>
          </div>
          <div class="oj-trap" :class="{ 'oj-solved': trapAnswer === 'KEEP_SEPARATE' }">
            <h4>⚠ 陷阱题：患者 ID 与医保付款人 ID 在 95% 的记录里数值相同，要怎么处理？</h4>
            <p>直觉会说「合并吧」。但概念一旦合并，Payer 的动作就会错误地绑到 Patient 上，而且下游所有生成物都跟着错。</p>
            <div class="oj-opts">
              <button class="oj-btn oj-btn--sm" @click="onTrapClick('LINK_ALIAS')">LINK_ALIAS 同义关联</button>
              <button class="oj-btn oj-btn--sm" @click="onTrapClick('MERGE_CONCEPT')">MERGE_CONCEPT 概念合并</button>
              <button class="oj-btn oj-btn--sm" @click="onTrapClick('KEEP_SEPARATE')">保持两个独立概念</button>
            </div>
            <div v-if="trapAnswer" class="oj-fb oj-show oj-good">✓ 正确。Patient 与 Payer 是两个业务概念，数值相同只是数据巧合。注册表保持两个稳定 ID，只记录一次「曾被发现高度重合」的审计备注。</div>
            <div v-else-if="trapWrong" class="oj-fb oj-show oj-bad">✕ 这两个 ID 不是同一个概念的两种叫法，而是碰巧取值相近的不同概念；合并还会让 Payer 的结算动作误绑到 Patient，污染 Schema、守卫、UI 与 Agent 工具。再试一次。</div>
          </div>
          <div class="oj-bar"><span class="oj-status" :class="{ 'oj-ok': aligned.size === 3 }">{{ alignStatus }}</span></div>
        </section>

        <!-- 04 ------------------------------------------------------------ -->
        <section v-else-if="step === 4" class="oj-act">
          <p class="oj-act-lead">两条主张看起来互相打架。<em>消解不等于删掉一条</em> —— 先判断它们到底在哪一维上不同。选一个维度试试，选错会展示真实后果，可以反复试。</p>
          <div class="oj-conflicts">
            <div class="oj-conf-card">
              <div class="oj-ch">CLAIM C-001 · SOP v3 §4.1 · a3f9c1 · 2024-03</div>
              <div class="oj-cq">「出院准备时长，自<b>医嘱下达</b>起计算至患者离院。」</div>
              <div class="oj-cm">适用范围 scope：全院普通住院 · 规范性 normative · 医务处发布</div>
            </div>
            <div class="oj-vs">VS</div>
            <div class="oj-conf-card">
              <div class="oj-ch">CLAIM C-002 · 日间手术绿色通道 §1.2 · c02d8e · 2025-06</div>
              <div class="oj-cq">「出院准备时长，自<b>护理评估完成</b>起算；主治单签即可放行。」</div>
              <div class="oj-cm">适用范围 scope：仅日间手术 · 规范性 normative · 门诊办公室发布</div>
            </div>
          </div>
          <p class="oj-mini-title" style="margin-top:16px">RECONCILE / 按哪个维度消解？</p>
          <div class="oj-dims">
            <button v-for="d in DIMS" :key="d.k" class="oj-dim"
              :class="{ 'oj-goodpick': dimAnswer === d.k, 'oj-badpick': dimWrong === d.k }" @click="onDimClick(d.k)">
              <b>{{ d.k }}</b>{{ d.cn }}
            </button>
          </div>
          <div v-if="dimAnswer" class="oj-resolve oj-show">
            <div class="oj-rn"><b>✓ 正确：差异在 Scope（适用范围），不是谁对谁错。</b>两条都保留，拆成两个带 scope 的指标；证据图里仍记录它们曾经冲突，以及这次裁决的依据。</div>
            <div class="oj-rr">
              <div class="oj-metric"><div class="oj-mn">Metric: discharge_prep_hours</div><div class="oj-ms">起点 = 医嘱下达 · scope = 全院普通住院 · 源自 C-001</div></div>
              <div class="oj-metric"><div class="oj-mn">Metric: day_surgery_prep_hours</div><div class="oj-ms">起点 = 护理评估完成 · scope = 日间手术 · 源自 C-002</div></div>
            </div>
            <div class="oj-rn" style="margin-top:10px">另外，「夜班未签字先放行」是 observational 违规观察 → 被标记为 <b>BLOCKED</b>，留在证据图里供审计，绝不写进权威本体。此刻产出的是<b>候选本体</b>，还没有生产执行授权。</div>
          </div>
          <div class="oj-bar"><span class="oj-status" :class="{ 'oj-ok': !!dimAnswer }">{{ dimAnswer ? '✓ 按 Scope 拆成两个指标，两条主张都保留；证据图记录冲突与裁决依据。' : '等待裁决。' }}</span></div>
        </section>

        <!-- 05 ------------------------------------------------------------ -->
        <section v-else-if="step === 5" class="oj-act">
          <p class="oj-act-lead">候选本体要过<em>确定性编译器</em>这一关：类型、稳定 ID、状态机、策略 AST 全部静态校验。注意终端里那条 FAIL —— 自然语言写成的「仅主治医师可确认出院」不能当执行规则，请把它组装成类型化 AST。</p>
          <div class="oj-compile-grid">
            <div class="oj-term">
              <div v-for="(l, i) in termLines" :key="i" class="oj-ln" v-html="l" />
              <div v-if="termRunning" class="oj-caret" />
            </div>
            <div class="oj-ast">
              <h4>Policy AST 组装台</h4>
              <div class="oj-ast-desc">把自然语言规则拆成「主体 + 前置条件 + 动作」三段。只有全部选对，编译器才会放行。</div>
              <div v-for="k in AST_KEYS" :key="k" class="oj-ast-row">
                <div class="oj-rk">{{ { role: 'WHO / 主体', state: 'WHEN / 前置条件', action: 'DO / 受控动作' }[k] }}</div>
                <div class="oj-ast-opts">
                  <button v-for="o in AST_OPTS[k]" :key="o.k" class="oj-ast-opt"
                    :class="{ 'oj-sel': astSel[k] === o.k }" @click="onAstClick(k, o.k)">{{ o.t }}</button>
                </div>
              </div>
              <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:11px">
                <button class="oj-btn oj-btn--primary oj-btn--sm" @click="onAstSubmit">提交 AST 并重新编译</button>
                <button class="oj-btn oj-btn--ghost oj-btn--sm" @click="llmFree">交给 LLM 自由判断</button>
              </div>
              <div v-if="astFeedback === 'oj-good'" class="oj-fb oj-show oj-good">✓ AST 通过：role == Attending ∧ medically_fit == true → ConfirmMedicallyFit，由确定性执行层强制校验。</div>
              <div v-else-if="astFeedback === 'oj-bad'" class="oj-fb oj-show oj-bad">✕ 类型检查未通过：主体必须是 Attending，前置条件必须校验 medically_fit，动作必须绑定 ConfirmMedicallyFit。任意一处放宽，都会让未获授权的人提前释放床位。</div>
            </div>
          </div>
          <div class="oj-bar"><span class="oj-status" :class="{ 'oj-ok': astPassed }">{{ astPassed ? '✓ v1.2 已签署。从现在起，模型是唯一规范性事实源。' : '等待类型化策略通过。' }}</span><span class="oj-hint">生产语义永远不由 LLM 拍板：LLM 负责提议，编译器负责裁决。</span></div>
        </section>

        <!-- 06 ------------------------------------------------------------ -->
        <section v-else class="oj-act">
          <p class="oj-act-lead">现在它不再是文档，而是一份<em>类型安全、带完整证据链、已签署的权威本体（Canonical Ontology v1.2）</em>。点任意节点查看它从哪份资料一路走来；切换投影视图，看同一份模型如何服务不同角色。</p>
          <div class="oj-final">
            <div class="oj-graph" :class="{ 'oj-drawn': graphDrawn }">
              <svg viewBox="0 0 660 400" role="img" aria-label="权威本体领域图">
                <path v-for="(e, i) in EDGE_PATHS" :key="'e' + i" class="oj-edge"
                  :class="{ 'oj-guard': e.guard, 'oj-hi': !!selectedNode && (e.a === selectedNode || e.b === selectedNode) }"
                  :d="e.d" :style="{ animationDelay: (i * 100) + 'ms' }" />
                <text v-for="(e, i) in EDGE_PATHS" :key="'l' + i" class="oj-elabel" :x="e.lx" :y="e.ly" text-anchor="middle">{{ e.label }}</text>
                <g v-for="(n, i) in NODES" :key="n.id" class="oj-node" :class="{ 'oj-sel': selectedNode === n.id }"
                  :transform="nodeTransform(n)" :style="{ animationDelay: (i * 75) + 'ms' }" @click="onNodeClick(n.id)">
                  <rect width="136" height="48" rx="9" />
                  <text class="oj-ncn" x="12" y="21">{{ n.cn }}</text>
                  <text class="oj-nen" x="12" y="37">{{ n.en }}</text>
                </g>
              </svg>
            </div>
            <div class="oj-detail">
              <div class="oj-dh">PROVENANCE / 溯源链</div>
              <template v-if="selNode">
                <div class="oj-dt">{{ selNode.cn }}</div>
                <div class="oj-dtype">{{ selNode.en }} · {{ selNode.type }}</div>
                <div v-for="(p, i) in selNode.prov" :key="i" class="oj-prov-step" :class="{ 'oj-lit': nodeDetailLit > i }">
                  <div class="oj-pl">{{ ['SOURCE', 'FRAGMENT', 'CLAIM / NODE'][i] }}</div>
                  <div class="oj-pv">{{ p }}</div>
                </div>
                <div class="oj-hint" style="margin-top:10px">← 一路走回第 00 步那张桌子。模型里没有一句凭空出现的话。</div>
              </template>
              <div v-else class="oj-hint">点击左侧任一节点，查看它是由哪份原始资料、哪个片段、哪条主张编译而来。<br><br>这就是「可追溯」的具体含义：模型里没有一句凭空出现的话。</div>
            </div>
          </div>
          <div class="oj-projection">
            <div class="oj-ph">
              <div><p class="oj-mini-title" style="margin:0">PROJECTION / 同一份本体的三种投影</p></div>
              <div class="oj-seg">
                <button v-for="v in PROJ_VIEWS" :key="v[0]" :aria-pressed="projView === v[0]" @click="onProj(v[0])">{{ v[1] }}</button>
              </div>
            </div>
            <div class="oj-out">
              <div v-if="projView === 'biz'" class="oj-kpi">
                <div class="oj-k"><div class="oj-kn">12</div><div class="oj-kl">今日待出院床位</div></div>
                <div class="oj-k"><div class="oj-kn">3</div><div class="oj-kl">被检验报告卡住</div></div>
                <div class="oj-k"><div class="oj-kn">5</div><div class="oj-kl">终末消毒排程</div></div>
                <div class="oj-hint" style="grid-column:1/-1;margin-top:2px">业务方看到的只是看板；「出院准备时长」按 scope 自动选用对应指标，无需知道底层有几套表。</div>
              </div>
              <div v-else-if="projView === 'dev'" class="oj-code"><span style="color:var(--term-dim)">// generated from canonical-ontology.json v1.2</span>
type Encounter = {
  id: <span style="color:var(--term-acc)">EncounterId</span>; patientId: <span style="color:var(--term-acc)">PatientId</span>;
  bedId?: <span style="color:var(--term-acc)">BedId</span>; medically_fit: boolean;
};

<span style="color:var(--term-ok)">guard</span> ConfirmMedicallyFit: policy/only-attending.ast
<span style="color:var(--term-ok)">emit</span> DomainEvent&lt;BedReadyForCleaning&gt;</div>
              <div v-else class="oj-tools">
                <div class="oj-tool"><span class="oj-tn">ExpeditePendingLab</span><span class="oj-tt oj-warn">需医师授权</span></div>
                <div class="oj-tool"><span class="oj-tn">ConfirmMedicallyFit</span><span class="oj-tt oj-warn">Attending only</span></div>
                <div class="oj-tool"><span class="oj-tn">ScheduleBedCleaning</span><span class="oj-tt oj-ok">状态满足后可调用</span></div>
                <div class="oj-hint" style="margin-top:2px">上下文包只装载当前 Encounter 相关的最小规则与动作集合，而不是把整个本体塞进提示词。</div>
              </div>
            </div>
          </div>
          <div class="oj-answer">
            <button class="oj-btn oj-btn--accent" @click="onAnswer">{{ answered ? '✓ 已用本体回答' : '▶ 用这份本体回答最初的那个问题' }}</button>
            <div class="oj-answer-grid" :class="{ 'oj-show': answered }">
              <div class="oj-acol oj-bad">
                <div class="oj-ah">✕ 直接把一堆文档丢给 LLM / 纯 RAG</div>
                <div class="oj-ab">「大概有 2～3 张床位被检验结果影响，建议让 Agent 直接释放床位并通知保洁。」<br><br>❌ 字段名靠猜（<code>visit_no / inp_id</code> 混用）<br>❌ 把夜班违规习惯当成了合法规则<br>❌ 绕过了主治医师确认与权限校验</div>
              </div>
              <div class="oj-acol oj-good">
                <div class="oj-ah">✓ 经权威本体守卫的 Agent</div>
                <div class="oj-ab">命中 <code>Bed B-12-03 / B-12-07</code>：状态 <code>awaiting_lab</code> 且 <code>Encounter.medically_fit = false</code>。<br><br>✅ <code>ExpeditePendingLab</code> 已提交，待主治医师授权<br>✅ <code>ScheduleBedCleaning</code> 仅在 <code>ConfirmMedicallyFit</code> 之后排队<br>✅ 每个动作留有 modelVersion + 证据链 ID 的审计事件</div>
              </div>
            </div>
          </div>
          <div class="oj-journey-done" :class="{ 'oj-show': finalDone }">
            <h3>0 → 1 完成</h3>
            <p>7 份杂乱资料 → 12 个片段 → 9 条主张 → 6 个概念 → 8 条关系 → 3 条策略 → 1 份权威本体。<br>而且每一个节点，都能走回最初那份文件。</p>
            <i v-for="(c, i) in CONFETTI" :key="i" class="oj-confetti"
              :style="{ left: c.left + '%', background: c.color, animationDelay: c.delay + 's' }" />
          </div>
          <div class="oj-bar"><span class="oj-status" :class="{ 'oj-ok': answered }">{{ finalStatus }}</span></div>
        </section>
      </div>
    </main>

    <aside class="oj-panel oj-coach">
      <div class="oj-step-no">{{ curStep.kicker }}</div>
      <h3>{{ curStep.title }}</h3>
      <div class="oj-cblock"><div class="oj-lab"><i />这一步在做什么</div><p>{{ curStep.what }}</p></div>
      <div class="oj-cblock oj-why"><div class="oj-lab"><i />为什么不能直接建图</div><p>{{ curStep.why }}</p></div>
      <div class="oj-tasks">
        <div class="oj-lab">本步任务 · 动手才算学会</div>
        <ul>
          <li v-for="(t, i) in curStep.tasks" :key="i" :class="{ 'oj-done': tasks.has(step + ':' + i) }">
            <span class="oj-box">✓</span><span>{{ t }}</span>
          </li>
        </ul>
      </div>
      <div class="oj-coach-out"><div class="oj-lab">交给下一步的产物</div><code>{{ curStep.output }}</code></div>
      <div class="oj-coach-foot">💡 {{ curStep.tip }}</div>
    </aside>
  </div>

  <footer class="oj-bottom">
    <div class="oj-funnel">
      <div v-for="(f, i) in FUNNEL" :key="f.l" class="oj-fstat" :class="{ 'oj-lit': i <= step }">
        <span class="oj-n">{{ funnelShown[i] }}</span><span class="oj-l">{{ f.l }}</span>
        <span v-if="i < FUNNEL.length - 1" class="oj-arw">→</span>
      </div>
    </div>
    <div class="oj-controls">
      <button class="oj-btn" :disabled="step === 0" @click="onPrev">← 上一步</button>
      <span class="oj-pos">STEP {{ String(step).padStart(2, '0') }} / 06 · {{ unlocked.has(step) || isLast ? '本步已完成' : '完成小任务后解锁下一步' }}</span>
      <span v-if="canSkip" class="oj-skip" @click="onSkip">跳过本步任务 →</span>
      <button class="oj-btn oj-btn--primary" :disabled="nextDisabled" @click="onNext">{{ isLast ? '↺ 再走一遍' : '下一步 →' }}</button>
    </div>
  </footer>
  <div class="oj-foot-note">INTERACTIVE LESSON · 术语与案例对齐 GLOSSARY.md / 智慧医院出院协同 · 可全屏沉浸，Esc 退出</div>

  <div v-if="toastMsg" class="oj-toast" :class="toastKind">{{ toastMsg }}</div>
</div>
</template>

<style scoped>
/* Design tokens come from site/.vitepress/theme/style.css (light + .dark).
   Only the few names the preview invented are aliased here. */
.oj{
  --ground2:var(--ground-2);
  --surface2:var(--surface-2);
  --line2:var(--line-2);
  --ink2:var(--ink-2);
  --term:var(--term-bg);
  --shadow:var(--shadow-1);
  --shadow2:var(--shadow-2);
  --accent-soft:color-mix(in srgb,var(--accent) 13%,transparent);
  --ok-soft:color-mix(in srgb,var(--ok) 12%,transparent);
  --warn-soft:color-mix(in srgb,var(--warn) 12%,transparent);
  --bad-soft:color-mix(in srgb,var(--bad) 12%,transparent);
  --c4:#8a6bb1;
  --ease:cubic-bezier(.2,.7,.2,1);
  position:relative;z-index:1;max-width:1420px;margin:0 auto;padding:0 0 24px;
  font-family:var(--font-ui);color:var(--ink);line-height:1.6;
}
html.dark .oj{ --c4:#ab8ed0; }
.oj.oj-full{position:fixed;inset:0;z-index:9999;overflow:auto;max-width:none;padding:18px 22px 28px;background:var(--ground);box-shadow:none}
.oj button{font-family:inherit;cursor:pointer}
/* VitePress .vp-doc styles must not bleed into the lesson widget. */
.oj h1,.oj h2,.oj h3,.oj h4,.oj p,.oj ul,.oj li,.oj code{
  margin:0;padding:0;border:0;border-radius:0;background:none;
  font-family:inherit;font-size:inherit;font-weight:inherit;color:inherit;line-height:inherit;
}
.oj-mono{font-family:var(--font-mono)}
.oj-align-note{font-size:12.5px;color:var(--muted);line-height:1.8}
.oj-align-note code{font-family:var(--font-mono);font-size:11px;color:var(--accent-ink)}
.oj-detail .oj-hint,.oj-out .oj-hint{font-size:11.5px;color:var(--muted);line-height:1.7}
/* Rail items use spans; keep the three rows stacked (the preview used divs). */
.oj-rail-item .oj-rn{display:flex}
.oj-rail-item .oj-rl,.oj-rail-item .oj-rf{display:block}
.oj .oj-coach-out code{word-break:normal;overflow-wrap:anywhere}

/* ===========================================================================
   Interactive preview — self-contained, no build step, no external assets.
   Visual language follows site/.oj-vitepress/theme/style.oj-css (warm paper + indigo).
   Later this can be split into a VitePress Vue component under theme/landing/.
   =========================================================================== */
*{box-sizing:border-box}

button{font-family:inherit;cursor:pointer}
.oj-app{position:relative;z-index:1;max-width:1420px;margin:0 auto;padding:0 22px 30px}

/* ---------- header ---------- */
.oj-top{display:flex;align-items:center;justify-content:space-between;gap:16px;height:66px;border-bottom:1px solid var(--line)}
.oj-brand{display:flex;align-items:center;gap:12px;min-width:0}
.oj-mark{width:28px;height:28px;border-radius:8px;background:var(--accent);color:var(--surface);
  display:grid;place-items:center;font-family:var(--font-mono);font-size:13px;font-weight:700;flex:none}
.oj-brand h1{font-family:var(--font-display);font-size:17px;font-weight:600;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oj-brand .oj-sub{font-family:var(--font-mono);font-size:10px;letter-spacing:.1em;color:var(--faint);white-space:nowrap}
.oj-top-actions{display:flex;align-items:center;gap:8px;flex:none}
.oj-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:34px;padding:0 13px;
  border-radius:8px;border:1px solid var(--line2);background:var(--surface);color:var(--ink);
  font-size:13px;font-weight:500;transition:.2s var(--ease);white-space:nowrap}
.oj-btn:hover:not(:disabled){border-color:var(--faint);background:var(--surface2);transform:translateY(-1px)}
.oj-btn:disabled{opacity:.45;cursor:default}
.oj-btn--primary{background:var(--ink);border-color:var(--ink);color:var(--ground)}
.oj-btn--primary:hover:not(:disabled){background:var(--ink2);border-color:var(--ink2);color:var(--ground)}
.oj-btn--accent{background:var(--accent);border-color:var(--accent);color:#fff}
html.dark .oj-btn--accent{color:#14152c}
.oj-btn--ghost{background:transparent;border-style:dashed;color:var(--muted)}
.oj-btn--sm{height:29px;padding:0 10px;font-size:12px}
.oj-btn.oj-on{background:var(--accent-soft);border-color:var(--accent);color:var(--accent-ink)}

/* ---------- mission strip ---------- */
.oj-mission{display:flex;align-items:center;gap:12px;margin:16px 0 6px;padding:11px 15px;border-radius:11px;
  border:1px solid var(--line);background:var(--surface);box-shadow:var(--shadow);font-size:13.5px}
.oj-mission .oj-tag{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;color:var(--accent-ink);
  border:1px solid var(--accent);border-radius:999px;padding:2px 9px;white-space:nowrap}
.oj-mission .oj-q{color:var(--ink2);flex:1}
.oj-mission .oj-q b{color:var(--ink)}
.oj-mission .oj-state{font-family:var(--font-mono);font-size:11px;color:var(--faint);white-space:nowrap}
.oj-mission.oj-answered{border-color:var(--ok);background:var(--ok-soft)}
.oj-mission.oj-answered .oj-state{color:var(--ok)}

/* ---------- pipeline rail ---------- */
.oj-rail{display:flex;gap:6px;overflow-x:auto;padding:14px 2px 16px;scrollbar-width:thin}
.oj-rail-item{position:relative;flex:1;min-width:118px;text-align:left;padding:9px 10px 10px;border-radius:10px;
  border:1px solid var(--line);background:var(--surface);color:var(--muted);transition:.25s var(--ease)}
.oj-rail-item:hover{border-color:var(--line2);background:var(--surface2)}
.oj-rail-item .oj-rn{font-family:var(--font-mono);font-size:10px;letter-spacing:.06em;color:var(--faint);display:flex;justify-content:space-between}
.oj-rail-item .oj-rl{font-size:12.5px;font-weight:600;color:var(--ink2);margin-top:4px;white-space:nowrap}
.oj-rail-item .oj-rf{font-family:var(--font-mono);font-size:9.5px;color:var(--faint);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.oj-rail-item.oj-done{border-color:var(--ok);background:var(--ok-soft)}
.oj-rail-item.oj-done .oj-rn{color:var(--ok)}
.oj-rail-item.oj-active{border-color:var(--accent);background:var(--accent-soft);box-shadow:0 0 0 3px var(--accent-soft)}
.oj-rail-item.oj-active .oj-rl{color:var(--accent-ink)}
.oj-rail-item.oj-active::after{content:'';position:absolute;left:12px;right:12px;bottom:-1px;height:2px;background:var(--accent);border-radius:2px}
.oj-rail-item .oj-tick{color:var(--ok);font-weight:700}

/* ---------- layout ---------- */
.oj-split{display:grid;grid-template-columns:minmax(0,1fr) 322px;gap:16px;align-items:start}
.oj-panel{border:1px solid var(--line);border-radius:14px;background:var(--surface);box-shadow:var(--shadow);overflow:hidden}
.oj-stage-head{padding:17px 20px 14px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--surface2),transparent)}
.oj-stage-head .oj-kicker{font-family:var(--font-mono);font-size:10.5px;letter-spacing:.1em;color:var(--faint);text-transform:uppercase}
.oj-stage-head h2{font-family:var(--font-display);font-size:24px;font-weight:600;margin:6px 0 5px;line-height:1.3}
.oj-stage-head p{margin:0;font-size:13.5px;color:var(--muted);line-height:1.7}
.oj-acts{padding:20px;min-height:600px}
.oj-act{display:block;animation:actIn .42s var(--ease) both}
@keyframes actIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.oj-act-lead{font-size:13.5px;color:var(--muted);margin:0 0 16px;line-height:1.75}
.oj-act-lead em{font-style:normal;color:var(--accent-ink);font-weight:600}
.oj-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)}
.oj-bar .oj-status{font-size:12.5px;color:var(--muted);flex:1;min-width:180px}
.oj-bar .oj-status.oj-ok{color:var(--ok);font-weight:600}
.oj-hint{font-size:12px;color:var(--faint)}
.oj-mini-title{font-family:var(--font-mono);font-size:10.5px;letter-spacing:.08em;color:var(--faint);text-transform:uppercase;margin:0 0 10px}

/* ---------- coach panel ---------- */
.oj-coach{position:sticky;top:14px;padding:18px}
.oj-coach .oj-step-no{font-family:var(--font-mono);font-size:10.5px;letter-spacing:.1em;color:var(--accent-ink)}
.oj-coach h3{font-family:var(--font-display);font-size:19px;font-weight:600;margin:6px 0 14px;line-height:1.4}
.oj-cblock{margin-bottom:14px}
.oj-cblock .oj-lab{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;letter-spacing:.04em;color:var(--faint);margin-bottom:5px}
.oj-cblock .oj-lab i{width:5px;height:5px;border-radius:50%;background:var(--accent);display:inline-block}
.oj-cblock p{margin:0;font-size:13px;color:var(--ink2);line-height:1.75}
.oj-cblock.oj-why{background:var(--warn-soft);border-left:2px solid var(--warn);padding:9px 11px;border-radius:0 8px 8px 0}
.oj-cblock.oj-why .oj-lab i{background:var(--warn)}
.oj-tasks{border-top:1px dashed var(--line);padding-top:13px;margin-top:4px}
.oj-tasks .oj-lab{font-size:11px;font-weight:600;color:var(--faint);margin-bottom:8px}
.oj-tasks ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.oj-tasks li{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;color:var(--muted);line-height:1.5}
.oj-tasks li .oj-box{width:15px;height:15px;border:1px solid var(--line2);border-radius:4px;flex:none;margin-top:2px;display:grid;place-items:center;font-size:10px;color:transparent}
.oj-tasks li.oj-done{color:var(--ink2)}
.oj-tasks li.oj-done .oj-box{background:var(--ok);border-color:var(--ok);color:#fff}
.oj-coach-out{margin-top:14px;padding:10px 11px;border:1px dashed var(--line2);border-radius:9px;background:var(--surface2)}
.oj-coach-out .oj-lab{font-size:10px;letter-spacing:.08em;color:var(--faint);font-family:var(--font-mono);text-transform:uppercase}
.oj-coach-out code{font-family:var(--font-mono);font-size:12px;color:var(--accent-ink);display:block;margin-top:4px;word-break:break-all}
.oj-coach-foot{margin-top:14px;font-size:11.5px;color:var(--faint);line-height:1.6}

/* ---------- bottom bar ---------- */
.oj-bottom{margin-top:16px;border:1px solid var(--line);border-radius:14px;background:var(--surface);box-shadow:var(--shadow);padding:13px 16px}
.oj-funnel{display:flex;gap:0;flex-wrap:wrap;align-items:center;justify-content:space-between}
.oj-fstat{display:flex;align-items:baseline;gap:7px;min-width:96px;padding:5px 9px;border-radius:8px;opacity:.35;transition:.4s var(--ease)}
.oj-fstat.oj-lit{opacity:1;background:var(--accent-soft)}
.oj-fstat .oj-n{font-family:var(--font-mono);font-size:20px;font-weight:600;color:var(--accent-ink);font-variant-numeric:tabular-nums}
.oj-fstat .oj-l{font-size:11.5px;color:var(--muted)}
.oj-fstat .oj-arw{color:var(--line2);font-size:13px}
.oj-controls{display:flex;align-items:center;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
.oj-controls .oj-pos{font-family:var(--font-mono);font-size:12px;color:var(--faint);flex:1}
.oj-controls .oj-skip{font-size:12px;color:var(--faint);text-decoration:underline;text-underline-offset:3px;cursor:pointer;background:none;border:0;padding:4px}
.oj-foot-note{margin-top:12px;font-family:var(--font-mono);font-size:10.5px;color:var(--faint);text-align:center}

/* ---------- ACT 0 : source desk ---------- */
.oj-desk{position:relative;display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:12px;min-height:290px}
.oj-src{position:relative;border:1px solid var(--line);border-radius:11px;background:var(--surface);padding:12px 13px;
  box-shadow:var(--shadow);cursor:grab;transition:transform .22s var(--ease),box-shadow .22s var(--ease),opacity .35s;
  animation:floatIn .55s var(--ease) both;user-select:none}
@keyframes floatIn{from{opacity:0;transform:translateY(16px) rotate(-1.2deg)}to{opacity:1;transform:none}}
.oj-src:hover{transform:translateY(-3px) rotate(-.4deg);box-shadow:var(--shadow2);z-index:3}
.oj-src.oj-dragging{cursor:grabbing;z-index:9;box-shadow:var(--shadow2);transition:none}
.oj-src.oj-ingested{opacity:.28;transform:scale(.94);pointer-events:none}
.oj-src .oj-srow{display:flex;align-items:center;gap:8px}
.oj-src .oj-ico{width:28px;height:30px;border-radius:5px;display:grid;place-items:center;font-family:var(--font-mono);font-size:9px;font-weight:700;color:#fff;flex:none}
.oj-src .oj-ico.oj-doc{background:var(--c2)} .oj-src .oj-ico.oj-db{background:var(--c1)} .oj-src .oj-ico.oj-talk{background:var(--c3)} .oj-src .oj-ico.oj-mail{background:var(--c4)}
.oj-src .oj-name{font-size:13px;font-weight:600;line-height:1.35}
.oj-src .oj-meta{font-family:var(--font-mono);font-size:10px;color:var(--faint);margin-top:7px}
.oj-src .oj-badge{display:inline-block;margin-top:8px;font-size:10.5px;padding:2px 7px;border-radius:999px;background:var(--surface2);border:1px solid var(--line);color:var(--muted)}
.oj-src .oj-excerpt{margin-top:10px;padding-top:9px;border-top:1px dashed var(--line);font-size:12px;color:var(--ink2);line-height:1.7;white-space:pre-line;display:none}
.oj-src .oj-excerpt .oj-note{display:block;margin-top:8px;font-size:11px;color:var(--warn)}
.oj-src.oj-open .oj-excerpt{display:block;animation:actIn .3s var(--ease)}
.oj-src.oj-open{cursor:default;grid-column:span 2;z-index:4}
.oj-hopper{margin-top:16px;display:flex;align-items:center;gap:14px;padding:13px 15px;border:1px dashed var(--line2);border-radius:11px;background:var(--surface2)}
.oj-hopper .oj-mouth{width:54px;height:44px;flex:none;border-radius:9px;border:2px solid var(--accent);background:var(--accent-soft);
  display:grid;place-items:center;font-family:var(--font-mono);font-size:10px;color:var(--accent-ink);transition:.25s}
.oj-hopper .oj-mouth.oj-pulse{animation:pulse .6s var(--ease)}
@keyframes pulse{0%{transform:scale(1)}45%{transform:scale(1.18);box-shadow:0 0 0 8px var(--accent-soft)}100%{transform:scale(1)}}
.oj-hopper .oj-htxt{font-size:12.5px;color:var(--muted);flex:1}
.oj-hopper .oj-htxt b{color:var(--ink);display:block;font-size:13.5px}

/* ---------- ACT 1 : scanner + fragments ---------- */
.oj-scanbox{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:14px}
@media(max-width:900px){.oj-scanbox{grid-template-columns:1fr}}
.oj-docview{position:relative;border:1px solid var(--line);border-radius:11px;background:var(--surface2);padding:14px;overflow:hidden;min-height:250px}
.oj-docview .oj-dv-head{font-family:var(--font-mono);font-size:10px;color:var(--faint);letter-spacing:.08em;margin-bottom:10px}
.oj-docline{font-size:12.5px;color:var(--ink2);line-height:1.95;padding:2px 6px;border-radius:5px;white-space:pre-wrap}
.oj-docline.oj-hit{background:var(--accent-soft);color:var(--accent-ink)}
.oj-docview .oj-scanline{position:absolute;left:0;right:0;top:0;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent);
  box-shadow:0 0 14px 2px var(--accent);opacity:0;pointer-events:none}
.oj-docview.oj-scanning .oj-scanline{opacity:1;animation:scan 1.5s linear}
@keyframes scan{from{top:6%}to{top:94%}}
.oj-frag-grid{display:grid;gap:9px}
.oj-frag{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:10px 12px;cursor:pointer;
  transition:.2s var(--ease);animation:none}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.oj-frag:hover{border-color:var(--accent);transform:translateX(2px)}
.oj-frag .oj-fh{display:flex;justify-content:space-between;gap:8px;font-family:var(--font-mono);font-size:10px;color:var(--faint)}
.oj-frag .oj-ft{font-size:12.5px;color:var(--ink2);margin-top:5px;line-height:1.6}
.oj-frag.oj-good-pick{border-color:var(--ok);background:var(--ok-soft)}
.oj-frag.oj-good-pick .oj-fh{color:var(--ok)}
.oj-frag.oj-wrong-pick{animation:shake .4s}
.oj-frag.oj-picked .oj-fh::after{content:'✓ 已引用';color:var(--ok);font-weight:700}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}50%{transform:translateX(6px)}75%{transform:translateX(-3px)}}
.oj-shake{animation:shake .4s var(--ease)!important}

/* ---------- ACT 2 : claims ---------- */
.oj-claim-list{display:grid;gap:11px}
.oj-claim{border:1px solid var(--line);border-radius:11px;background:var(--surface);padding:12px 14px;animation:rise .45s var(--ease) both}
.oj-claim .oj-ct{font-size:13.5px;color:var(--ink);line-height:1.6}
.oj-claim .oj-cf{font-family:var(--font-mono);font-size:10px;color:var(--faint);margin-top:5px}
.oj-claim .oj-cf::before{content:'↳ ';color:var(--accent)}
.oj-mods{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.oj-mod-btn{border:1px solid var(--line2);background:var(--surface2);border-radius:7px;padding:5px 9px;font-size:11.5px;color:var(--muted);transition:.2s}
.oj-mod-btn:hover{border-color:var(--accent);color:var(--ink)}
.oj-mod-btn b{font-family:var(--font-mono);font-weight:500;margin-right:5px}
.oj-mod-btn[data-mod="normative"] b{color:var(--c1)}
.oj-mod-btn[data-mod="descriptive"] b{color:var(--c3)}
.oj-mod-btn[data-mod="observational"] b{color:var(--c2)}
.oj-mod-btn[data-mod="hypothetical"] b{color:var(--c4)}
.oj-mod-btn.oj-correct{background:var(--ok-soft);border-color:var(--ok);color:var(--ok)}
.oj-mod-btn.oj-wrongpick{animation:shake .4s;border-color:var(--bad);color:var(--bad)}
.oj-claim.oj-solved{border-color:var(--ok);background:var(--ok-soft)}
.oj-claim .oj-why-line{display:none;margin-top:9px;font-size:12px;color:var(--ink2);line-height:1.65}
.oj-claim.oj-solved .oj-why-line{display:block;animation:actIn .3s}
.oj-claim.oj-solved .oj-mods{display:none}
.oj-prov{margin-top:14px;border:1px dashed var(--line2);border-radius:10px;padding:11px 13px;background:var(--surface2);display:none}
.oj-prov.oj-show{display:block;animation:actIn .4s}
.oj-prov .oj-chain{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-family:var(--font-mono);font-size:11px;color:var(--muted)}
.oj-prov .oj-chain span{border:1px solid var(--line2);border-radius:6px;padding:4px 8px;background:var(--surface)}
.oj-prov .oj-chain i{color:var(--accent);font-style:normal}
.oj-prov p{margin:9px 0 0;font-size:12px;color:var(--muted)}

/* ---------- ACT 3 : concept alignment ---------- */
.oj-align{display:grid;grid-template-columns:1fr 260px 1fr;gap:14px;align-items:center}
@media(max-width:900px){.oj-align{grid-template-columns:1fr}}
.oj-field-pool{display:grid;gap:9px}
.oj-field{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:10px 12px;cursor:pointer;transition:.2s var(--ease)}
.oj-field:hover{border-color:var(--accent);transform:translateX(3px)}
.oj-field .oj-fk{font-family:var(--font-mono);font-size:12.5px;color:var(--accent-ink);font-weight:600}
.oj-field .oj-fs{font-size:11.5px;color:var(--muted);margin-top:3px}
.oj-field.oj-merged{opacity:.3;pointer-events:none;text-decoration:line-through}
.oj-concept-core{border:2px solid var(--accent);border-radius:14px;background:var(--accent-soft);padding:16px 13px;text-align:center;min-height:150px;transition:.25s}
.oj-concept-core.oj-bump{animation:pulse .6s var(--ease)}
.oj-concept-core .oj-ct{font-family:var(--font-display);font-size:20px;font-weight:600;color:var(--accent-ink)}
.oj-concept-core .oj-cs{font-size:11.5px;color:var(--muted);margin-top:3px}
.oj-aliases{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-top:12px}
.oj-alias{font-family:var(--font-mono);font-size:10px;padding:3px 7px;border-radius:6px;background:var(--surface);border:1px solid var(--line2);color:var(--ink2);animation:pop .4s var(--ease)}
@keyframes pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
.oj-alias-empty{font-size:11px;color:var(--faint);margin-top:12px}
.oj-trap{margin-top:16px;border:1px solid var(--line);border-left:3px solid var(--warn);border-radius:0 11px 11px 0;padding:13px 15px;background:var(--warn-soft)}
.oj-trap h4{margin:0 0 5px;font-size:13.5px;font-weight:600}
.oj-trap p{margin:0;font-size:12.5px;color:var(--ink2);line-height:1.7}
.oj-trap .oj-opts{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}
.oj-trap .oj-fb{margin-top:10px;font-size:12.5px;line-height:1.65;display:none}
.oj-trap .oj-fb.oj-show{display:block;animation:actIn .3s}
.oj-trap .oj-fb.oj-bad{color:var(--bad)} .oj-trap .oj-fb.oj-good{color:var(--ok)}
.oj-trap.oj-solved{border-left-color:var(--ok);background:var(--ok-soft)}

/* ---------- ACT 4 : conflicts ---------- */
.oj-conflicts{display:grid;grid-template-columns:1fr 46px 1fr;gap:10px;align-items:stretch}
@media(max-width:760px){.oj-conflicts{grid-template-columns:1fr}.oj-conflicts .oj-vs{align-self:center;text-align:center}}
.oj-conf-card{border:1px solid var(--line);border-radius:11px;background:var(--surface);padding:13px}
.oj-conf-card .oj-ch{font-family:var(--font-mono);font-size:10px;color:var(--faint);margin-bottom:7px}
.oj-conf-card .oj-cq{font-size:13.5px;line-height:1.7}
.oj-conf-card .oj-cm{margin-top:9px;font-size:11.5px;color:var(--muted)}
.oj-vs{display:grid;place-items:center;font-family:var(--font-mono);font-size:12px;color:var(--bad);font-weight:700}
.oj-dims{display:flex;gap:7px;flex-wrap:wrap;margin-top:15px}
.oj-dim{border:1px solid var(--line2);border-radius:8px;background:var(--surface2);padding:8px 11px;font-size:12.5px;color:var(--ink2);transition:.2s}
.oj-dim:hover{border-color:var(--accent);transform:translateY(-2px)}
.oj-dim b{font-family:var(--font-mono);font-size:10.5px;color:var(--faint);display:block}
.oj-dim.oj-badpick{animation:shake .4s;border-color:var(--bad);color:var(--bad)}
.oj-dim.oj-goodpick{background:var(--ok-soft);border-color:var(--ok);color:var(--ok)}
.oj-resolve{margin-top:15px;border:1px solid var(--ok);border-radius:11px;background:var(--ok-soft);padding:13px;display:none}
.oj-resolve.oj-show{display:block;animation:actIn .45s}
.oj-resolve .oj-rr{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
@media(max-width:700px){.oj-resolve .oj-rr{grid-template-columns:1fr}}
.oj-metric{border:1px solid var(--line2);border-radius:9px;background:var(--surface);padding:10px 12px}
.oj-metric .oj-mn{font-family:var(--font-mono);font-size:12px;color:var(--accent-ink)}
.oj-metric .oj-ms{font-size:11.5px;color:var(--muted);margin-top:4px}
.oj-resolve .oj-rn{font-size:12px;color:var(--ink2);line-height:1.7}

/* ---------- ACT 5 : terminal + AST ---------- */
.oj-compile-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:14px}
@media(max-width:950px){.oj-compile-grid{grid-template-columns:1fr}}
.oj-term{background:var(--term);color:var(--term-ink);border:1px solid var(--term-line);border-radius:11px;
  padding:13px 14px;font-family:var(--font-mono);font-size:11.5px;line-height:1.85;min-height:296px;max-height:340px;overflow:auto}
.oj-term .oj-ln{white-space:pre-wrap;word-break:break-word}
.oj-term .oj-dim{color:var(--term-dim)} .oj-term .oj-ok{color:var(--term-ok)} .oj-term .oj-bad{color:var(--term-bad)}
.oj-term .oj-warn{color:var(--term-warn)} .oj-term .oj-acc{color:var(--term-acc)}
.oj-term .oj-caret{display:inline-block;width:7px;height:13px;background:var(--term-acc);vertical-align:-2px;animation:blink 1s steps(1) infinite}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}
.oj-ast{border:1px solid var(--line);border-radius:11px;padding:13px 14px;background:var(--surface)}
.oj-ast h4{margin:0 0 4px;font-size:13.5px}
.oj-ast .oj-ast-desc{font-size:11.5px;color:var(--muted);line-height:1.6;margin-bottom:10px}
.oj-ast-row{margin-bottom:9px}
.oj-ast-row .oj-rk{font-family:var(--font-mono);font-size:10px;color:var(--faint);letter-spacing:.06em;margin-bottom:5px}
.oj-ast-opts{display:flex;gap:5px;flex-wrap:wrap}
.oj-ast-opt{border:1px solid var(--line2);border-radius:6px;background:var(--surface2);padding:4px 8px;
  font-family:var(--font-mono);font-size:10.5px;color:var(--muted);transition:.2s}
.oj-ast-opt:hover{border-color:var(--accent);color:var(--ink)}
.oj-ast-opt.oj-sel{background:var(--accent-soft);border-color:var(--accent);color:var(--accent-ink)}
.oj-ast .oj-fb{margin-top:9px;font-size:12px;line-height:1.6;display:none}
.oj-ast .oj-fb.oj-show{display:block}
.oj-ast .oj-fb.oj-bad{color:var(--bad)} .oj-ast .oj-fb.oj-good{color:var(--ok)}

/* ---------- ACT 6 : final graph ---------- */
.oj-final{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:14px}
@media(max-width:1050px){.oj-final{grid-template-columns:1fr}}
.oj-graph{border:1px solid var(--line);border-radius:11px;background:
  radial-gradient(600px 300px at 50% 20%,var(--accent-soft),transparent 70%),var(--surface2);overflow:hidden}
.oj-graph svg{display:block;width:100%;height:auto}
.oj-edge{fill:none;stroke:var(--line2);stroke-width:1.6;stroke-dasharray:400;stroke-dashoffset:400}
.oj-graph.oj-drawn .oj-edge{animation:draw 1.1s var(--ease) forwards}
@keyframes draw{to{stroke-dashoffset:0}}
.oj-edge.oj-guard{stroke-dasharray:5 5}
.oj-graph.oj-drawn .oj-edge.oj-guard{animation:draw 1.1s var(--ease) forwards}
.oj-edge.oj-hi{stroke:var(--accent);stroke-width:2.4}
.oj-elabel{font-family:var(--font-mono);font-size:9px;fill:var(--faint)}
.oj-node{cursor:pointer}
.oj-node rect{fill:var(--surface);stroke:var(--line2);stroke-width:1.4;rx:9;transition:.2s}
.oj-node .oj-ncn{font-family:var(--font-ui);font-size:13px;font-weight:600;fill:var(--ink)}
.oj-node .oj-nen{font-family:var(--font-mono);font-size:9.5px;fill:var(--faint)}
.oj-node:hover rect,.oj-node.oj-sel rect{stroke:var(--accent);stroke-width:2.2;fill:var(--accent-soft)}
.oj-node.oj-sel .oj-ncn{fill:var(--accent-ink)}
/* SVG <g> keeps its transform="translate(...)" presentation attribute only if
   CSS never sets transform on it — so the entrance animation is opacity-only. */
@keyframes nodeIn{from{opacity:0}to{opacity:1}}
.oj-node{animation:nodeIn .5s var(--ease) both}
.oj-detail{border:1px solid var(--line);border-radius:11px;padding:13px;background:var(--surface);min-height:260px}
.oj-detail .oj-dh{font-family:var(--font-mono);font-size:10px;letter-spacing:.07em;color:var(--faint);margin-bottom:9px}
.oj-detail .oj-dt{font-family:var(--font-display);font-size:17px;font-weight:600;margin-bottom:3px}
.oj-detail .oj-dtype{font-family:var(--font-mono);font-size:10px;color:var(--accent-ink);margin-bottom:10px}
.oj-prov-step{border-left:2px solid var(--line2);padding:6px 0 6px 11px;margin-bottom:7px;opacity:.25;transition:.45s var(--ease)}
.oj-prov-step.oj-lit{opacity:1;border-left-color:var(--accent)}
.oj-prov-step .oj-pl{font-family:var(--font-mono);font-size:9.5px;color:var(--faint)}
.oj-prov-step .oj-pv{font-size:12px;color:var(--ink2);line-height:1.5;margin-top:2px}
.oj-projection{margin-top:14px;border:1px solid var(--line);border-radius:11px;padding:12px;background:var(--surface)}
.oj-projection .oj-ph{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.oj-projection .oj-seg{display:inline-flex;border:1px solid var(--line2);border-radius:8px;overflow:hidden}
.oj-projection .oj-seg button{border:0;border-right:1px solid var(--line);background:transparent;padding:5px 10px;font-size:11.5px;color:var(--muted)}
.oj-projection .oj-seg button:last-child{border-right:0}
.oj-projection .oj-seg button[aria-pressed="true"]{background:var(--ink);color:var(--ground)}
.oj-projection .oj-out{margin-top:10px;min-height:92px}
.oj-kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.oj-kpi .oj-k{border:1px solid var(--line);border-radius:8px;padding:9px;background:var(--surface2)}
.oj-kpi .oj-kn{font-family:var(--font-mono);font-size:19px;color:var(--accent-ink)}
.oj-kpi .oj-kl{font-size:11px;color:var(--muted)}
.oj-code{background:var(--term);color:var(--term-ink);border-radius:8px;padding:10px 12px;font-family:var(--font-mono);font-size:10.5px;line-height:1.75;white-space:pre-wrap}
.oj-code .oj-acc{color:var(--term-acc)} .oj-code .oj-ok{color:var(--term-ok)} .oj-code .oj-dim{color:var(--term-dim)}
.oj-tools{display:grid;gap:7px}
.oj-tool{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--line);border-radius:8px;padding:7px 10px;background:var(--surface2)}
.oj-tool .oj-tn{font-family:var(--font-mono);font-size:11px;color:var(--ink2)}
.oj-tool .oj-tt{font-size:10px;padding:2px 7px;border-radius:999px;border:1px solid var(--line2);color:var(--muted)}
.oj-tool .oj-tt.oj-ok{color:var(--ok);border-color:var(--ok)} .oj-tool .oj-tt.oj-warn{color:var(--warn);border-color:var(--warn)}
.oj-answer{margin-top:14px;border:1px solid var(--line);border-radius:11px;padding:13px;background:var(--surface)}
.oj-answer-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:11px;display:none}
.oj-answer-grid.oj-show{display:grid;animation:actIn .5s}
@media(max-width:760px){.oj-answer-grid.oj-show{grid-template-columns:1fr}}
.oj-acol{border:1px solid var(--line);border-radius:9px;padding:11px;background:var(--surface2)}
.oj-acol.oj-bad{border-color:var(--bad);background:var(--bad-soft)}
.oj-acol.oj-good{border-color:var(--ok);background:var(--ok-soft)}
.oj-acol .oj-ah{font-size:11px;font-weight:600;color:var(--muted);margin-bottom:7px}
.oj-acol .oj-ab{font-size:12.5px;line-height:1.75;color:var(--ink2)}
.oj-acol .oj-ab code{font-family:var(--font-mono);font-size:11px;color:var(--accent-ink)}
/* Do not use a bare .oj-done class here: rail items and task list items also use
   `done` as a state class, and a global .oj-done { display:none } would hide them. */
.oj-journey-done{margin-top:14px;border:1px solid var(--ok);border-radius:12px;padding:15px;background:var(--ok-soft);text-align:center;display:none;position:relative;overflow:hidden}
.oj-journey-done.oj-show{display:block;animation:actIn .5s}
.oj-journey-done h3{font-family:var(--font-display);font-size:22px;margin:0 0 5px;color:var(--ok)}
.oj-journey-done p{margin:0;font-size:12.5px;color:var(--ink2)}
.oj-confetti{position:absolute;width:7px;height:11px;top:-14px;animation:fall 1.8s linear forwards}
@keyframes fall{to{transform:translateY(180px) rotate(540deg);opacity:0}}

/* ---------- toast ---------- */
.oj-toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,20px);z-index:99;
  padding:10px 16px;border-radius:10px;background:var(--ink);color:var(--ground);font-size:13px;
  box-shadow:0 12px 34px -12px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:.28s var(--ease);max-width:min(90vw,460px);text-align:center}
.oj-toast.oj-show{opacity:1;transform:translate(-50%,0)}
.oj-toast.oj-bad{background:var(--bad);color:#fff}
.oj-toast.oj-ok{background:var(--ok);color:#fff}

@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01s!important;transition-duration:.01s!important}}

.oj-frag.oj-visible{animation:rise .45s var(--ease) both}
</style>
