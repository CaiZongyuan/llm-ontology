<script setup lang="ts">
import { computed, ref } from 'vue'

const mode = ref<'hospital' | 'wwi'>('hospital')
const step = ref(0)

const STEPS = [
  { n: '01', name: '数据采样与画像 (Profiling)' },
  { n: '02', name: '提取 Term 与 SQL Attribute' },
  { n: '03', name: '外键与语义关系补全' },
  { n: '04', name: 'Answerability 与 NL2SQL' },
]

// Interactive Answerability Coverage Controls
const queryPreset = ref(0)
const QUERIES = computed(() =>
  mode.value === 'hospital'
    ? [
        {
          q: '上个月心内科出院患者的平均出院准备时长是多少？哪些患者因待出检验报告延迟？',
          entities: [
            { name: 'Department (心内科)', matched: true, source: 'HIS.inpatient_visits.dept_name' },
            { name: 'AvgDischargePrepHours (平均出院准备时长)', matched: true, source: 'SQL Attribute: AVG(EXTRACT(EPOCH FROM discharge_at - fit_at)/3600)' },
            { name: 'PendingLabDelay (检验延迟)', matched: true, source: 'HIS.discharge_tasks.delay_reason = "LAB_PENDING"' },
          ],
          crossDb: false,
          sql: `SELECT
  v.dept_name,
  AVG(EXTRACT(EPOCH FROM (v.actual_discharge_at - v.medically_fit_at)) / 3600.0) AS avg_prep_hours,
  COUNT(*) FILTER (WHERE t.delay_reason = 'LAB_PENDING') AS lab_delayed_cases
FROM inpatient_visits v
JOIN discharge_tasks t ON t.visit_no = v.visit_no
WHERE v.dept_name = '心内科'
  AND v.actual_discharge_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
GROUP BY v.dept_name;`,
          note: '全部实体均在同一数据仓库命中语义映射，Coverage = 1.0，生成的 SQL 使用经过人工认证的 SQL Attribute 计算口径。',
        },
        {
          q: '心内科出院延迟患者的院外社区护理随访满意度与医保 DRG 拒付率是多少？',
          entities: [
            { name: 'Department (心内科)', matched: true, source: 'HIS.inpatient_visits.dept_name' },
            { name: 'DischargeDelay (出院延迟)', matched: true, source: 'SQL Attribute: prep_hours > 24' },
            { name: 'CommunityFollowupScore (社区随访满意度)', matched: false, source: '缺失：未接入区域社区慢病随访库' },
            { name: 'DRGRejectionRate (医保拒付率)', matched: false, source: '缺失：未导入省医保局月度结算反馈表' },
          ],
          crossDb: false,
          sql: `-- CoverageGradeAgent 判定 Coverage = 0.50 (2/4 实体缺失)
-- 拒绝盲目编造字段，直接向调用方返回缺失概念清单：
-- Missing: [CommunityFollowupScore, DRGRejectionRate]`,
          note: 'Answerability 机制在执行昂贵查询前识别出缺失概念（Coverage = 0.50），避免大模型凭空捏造 `drg_rejection_rate` 字段！',
        },
        {
          q: '将 HIS 库的住院出院记录与独立 PACS 影像库的设备故障日志直接单条 SQL 关联查询',
          entities: [
            { name: 'InpatientVisit (住院记录)', matched: true, source: 'DataSource A: HIS_PostgreSQL' },
            { name: 'PacsDeviceLog (影像设备日志)', matched: true, source: 'DataSource B: PACS_ClickHouse' },
          ],
          crossDb: true,
          sql: `-- connector_routing.py 拦截报错：
-- Error: Candidate tables belong to multiple database connectors (HIS_PostgreSQL, PACS_ClickHouse).
-- Single-query federated JOIN across distinct connectors is not supported.`,
          note: '源码级局限展示：尽管 Coverage = 1.0（两个概念都找到了），但 `connector_routing.py` 拒绝跨多个独立数据库连接器生成单条联邦 JOIN SQL。',
        },
      ]
    : [
        {
          q: '2015 年 6 月，宾夕法尼亚州销售的 Sushi Roll USB 产品产生了多少收入？（官方 README 示例）',
          entities: [
            { name: 'Revenue (收入)', matched: true, source: 'InvoiceLines.ExtendedPrice (SUM)' },
            { name: 'Product (Sushi Roll USB)', matched: true, source: 'StockItems.StockItemName' },
            { name: 'State (Pennsylvania)', matched: true, source: 'StateProvinces.StateProvinceName' },
            { name: 'Date (June 2015)', matched: true, source: 'Invoices.InvoiceDate' },
          ],
          crossDb: false,
          sql: `SELECT SUM(il.extendedprice) AS total_revenue, COUNT(*) AS line_count
FROM sales.invoicelines il
JOIN sales.invoices i ON il.invoiceid = i.invoiceid
JOIN sales.customers c ON i.customerid = c.customerid
JOIN application.cities ct ON c.deliverycityid = ct.cityid
JOIN application.stateprovinces sp ON ct.stateprovinceid = sp.stateprovinceid
JOIN warehouse.stockitems si ON il.stockitemid = si.stockitemid
WHERE sp.stateprovincename = 'Pennsylvania'
  AND si.stockitemname ILIKE '%Sushi Roll%'
  AND i.invoicedate >= '2015-06-01' AND i.invoicedate < '2015-07-01';
-- 官方执行结果：$588.80 (共 3 条发票明细)`,
          note: 'Auto-Ontology 自动沿着 InvoiceLine → Invoice → Customer → City → StateProvince 与 StockItem 补全 5 表 JOIN 路径。',
        },
      ],
)

const curQuery = computed(() => QUERIES.value[Math.min(queryPreset.value, QUERIES.value.length - 1)])
const coverage = computed(() => {
  const list = curQuery.value.entities
  const hit = list.filter((e) => e.matched).length
  return (hit / list.length).toFixed(2)
})
</script>

<template>
  <div class="aow wb-panel vp-raw">
    <div class="wb-panel-head">
      <span>NVIDIA Auto-Ontology 编译与问答交互推演台</span>
      <div class="wb-seg">
        <button type="button" :aria-pressed="mode === 'hospital'" @click="mode = 'hospital'; queryPreset = 0">医院出院数据治理案例</button>
        <button type="button" :aria-pressed="mode === 'wwi'" @click="mode = 'wwi'; queryPreset = 0">官方 Wide World Importers 案例</button>
      </div>
    </div>

    <div class="wb-panel-body">
      <div class="steps">
        <button
          v-for="(s, i) in STEPS"
          :key="s.n"
          type="button"
          class="step-btn"
          :class="{ on: step === i }"
          @click="step = i"
        >
          <span class="wb-mono">{{ s.n }}</span>
          <b>{{ s.name }}</b>
        </button>
      </div>

      <!-- Step 0: Profiling -->
      <div v-if="step === 0" class="pane">
        <p class="desc">
          源码入口 <code>semantic/visit_enter.py</code>：不仅读取 <code>CREATE TABLE</code>，还对每张表采样最多 <strong>1,000 行</strong>，对低基数枚举列（如状态、科室）探测高频取值，供 LLM 理解真实业务语义。
        </p>
        <div class="wb-grid2">
          <div class="wb-term">
            <div class="dim"># 1. 原始物理表结构 ({{ mode === 'hospital' ? 'HIS.inpatient_visits' : 'sales.invoicelines' }})</div>
            <pre v-if="mode === 'hospital'">CREATE TABLE inpatient_visits (
  visit_no             VARCHAR(32) PRIMARY KEY,
  pat_empi             VARCHAR(32),
  dept_name            VARCHAR(64),
  status_flag          CHAR(2),     -- 含义不明的缩写编码
  medically_fit_at     TIMESTAMP,
  actual_discharge_at  TIMESTAMP
);</pre>
            <pre v-else>CREATE TABLE sales.invoicelines (
  invoicelineid  INTEGER PRIMARY KEY,
  invoiceid      INTEGER,
  stockitemid    INTEGER,
  quantity       INTEGER,
  unitprice       NUMERIC(18,2),
  extendedprice  NUMERIC(18,2)
);</pre>
          </div>
          <div class="wb-term">
            <div class="dim"># 2. 数据采样画像结果 (1,000 rows sample)</div>
            <pre v-if="mode === 'hospital'">Column Profile [status_flag]:
  distinct_count: 4 (low-cardinality enum)
  top_values:
    "01" (62.4%) -> 推断为 在院治疗 (InTreatment)
    "02" (14.1%) -> 推断为 临床准予出院 (MedicallyFit)
    "03" (19.8%) -> 推断为 已结算离院 (Discharged)
    "99" ( 3.7%) -> 推断为 取消入院 (Cancelled)</pre>
            <pre v-else>Column Profile [extendedprice]:
  null_ratio: 0.0%
  min: 1.20, max: 28800.00
  sample_values: [38.40, 192.00, 588.80]
  semantic_hint: "Line item total including tax"</pre>
          </div>
        </div>
      </div>

      <!-- Step 1: Term & SQL Attribute -->
      <div v-else-if="step === 1" class="pane">
        <p class="desc">
          源码入口 <code>semantic/term_extractor.py</code> 与 <code>sql_attribute_suggester.py</code>：将物理表映射为业务概念（<strong>Term</strong>）、字段映射（<strong>Column Attribute</strong>）与可复用的指标计算表达式（<strong>SQL Attribute</strong>）。
        </p>
        <div class="cards3">
          <div class="c">
            <span class="wb-eyebrow">1. Term (业务概念)</span>
            <h5>{{ mode === 'hospital' ? 'InpatientEncounter (住院就诊)' : 'InvoiceLine (发票明细)' }}</h5>
            <p>{{ mode === 'hospital' ? '患者一次完整的住院诊疗与出院周转过程，REPRESENTS -> inpatient_visits 表。' : '客户订单开具的单条商品收费明细，REPRESENTS -> sales.invoicelines 表。' }}</p>
          </div>
          <div class="c">
            <span class="wb-eyebrow">2. Column Attribute (字段映射)</span>
            <h5>{{ mode === 'hospital' ? 'Discharge Status / Fit Timestamp' : 'Extended Price / Quantity' }}</h5>
            <p class="wb-mono">{{ mode === 'hospital' ? 'status_flag -> 就诊状态码\nmedically_fit_at -> 临床准出时间' : 'extendedprice -> 明细含税金额\nstockitemid -> 关联库存商品ID' }}</p>
          </div>
          <div class="c hi">
            <span class="wb-eyebrow">3. SQL Attribute (复用指标口径)</span>
            <h5>{{ mode === 'hospital' ? 'AvgDischargePrepHours (平均出院准备时长)' : 'TotalLineRevenue (有效明细收入)' }}</h5>
            <p>{{ mode === 'hospital' ? '固化“排除取消入院(99)记录，计算临床准出到实际离院的小时均值”，防止各科室各写一套 SQL。' : '固化 SUM(extendedprice) 口径，供所有涉及商品销售收入的自然语言提问直接检索复用。' }}</p>
          </div>
        </div>
      </div>

      <!-- Step 2: Semantic FK -->
      <div v-else-if="step === 2" class="pane">
        <p class="desc">
          源码入口 <code>semantic/semantic_fk.py</code>：很多医院 HIS 老库没有显式声明数据库 <code>FOREIGN KEY</code>。Auto-Ontology 结合列名向量相似度、LLM 选择与<strong>实际采样值重合率</strong>自动补全关联路径与 Bridge Table。
        </p>
        <div class="wb-term">
          <div class="dim"># semantic_fk.py 隐式关联推断日志</div>
          <div class="ok">✓ 显式外键：discharge_tasks.visit_no → inpatient_visits.visit_no</div>
          <div class="acc">◆ 候选隐式关联：inpatient_visits.bed_code ↔ bed_management.beds.bed_no</div>
          <div>  - 列名 Embedding 余弦相似度: 0.89</div>
          <div>  - 采样值集合重叠率 (Jaccard Overlap): 98.4% ("302-A", "305-B" ...)</div>
          <div class="ok">✓ LLM + 数据证据确认 Relationship：InpatientEncounter.bed_code → Bed.bed_no</div>
        </div>
      </div>

      <!-- Step 3: Answerability & NL2SQL -->
      <div v-else class="pane">
        <div class="q-picker">
          <span class="wb-eyebrow">选择测试问题（观察 CoverageGradeAgent 与路由检查）</span>
          <div class="q-btns">
            <button
              v-for="(q, idx) in QUERIES"
              :key="idx"
              type="button"
              class="wb-btn"
              :class="{ 'wb-btn--primary': queryPreset === idx }"
              @click="queryPreset = idx"
            >
              案例 {{ idx + 1 }}：{{ q.q.slice(0, 18) }}…
            </button>
          </div>
        </div>

        <div class="ans-grid">
          <div class="cov-box">
            <div class="cov-head">
              <span>Answerability Coverage</span>
              <b class="wb-mono" :class="Number(coverage) === 1 && !curQuery.crossDb ? 'ok' : 'bad'">{{ coverage }}</b>
            </div>
            <ul class="ent-list">
              <li v-for="e in curQuery.entities" :key="e.name">
                <span class="wb-tag" :class="e.matched ? 'PASS' : 'FAIL'">{{ e.matched ? 'HIT' : 'MISS' }}</span>
                <div>
                  <b>{{ e.name }}</b>
                  <small class="wb-mono">{{ e.source }}</small>
                </div>
              </li>
            </ul>
            <p class="cov-note">{{ curQuery.note }}</p>
          </div>

          <div class="wb-term">
            <div class="dim"># LangGraph text_to_sql_graph.py 输出</div>
            <pre>{{ curQuery.sql }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.aow { margin: 22px 0; }
.steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
.step-btn { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); cursor: pointer; text-align: left; font-family: var(--font-ui); transition: all .2s var(--ease); }
.step-btn span { font-size: 11px; color: var(--accent-ink); }
.step-btn b { font-size: 13.5px; color: var(--ink); }
.step-btn.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, var(--surface)); box-shadow: var(--shadow-1); }
.desc { margin: 0 0 14px; font-size: 14px; line-height: 1.75; color: var(--ink-2); }
.cards3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.c { padding: 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); }
.c.hi { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, var(--surface)); }
.c h5 { margin: 6px 0 8px; font-family: var(--font-display); font-size: 17px; color: var(--ink); }
.c p { margin: 0; font-size: 13px; line-height: 1.65; color: var(--ink-2); white-space: pre-line; }
.q-picker { margin-bottom: 14px; }
.q-btns { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.ans-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 14px; align-items: start; }
.cov-box { padding: 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); }
.cov-head { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
.cov-head span { font-family: var(--font-mono); font-size: 12px; color: var(--faint); }
.cov-head b { font-size: 26px; }
.cov-head b.ok { color: var(--ok); }
.cov-head b.bad { color: var(--bad); }
.ent-list { list-style: none; margin: 10px 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ent-list li { display: grid; grid-template-columns: 48px 1fr; gap: 10px; align-items: start; font-size: 13px; }
.ent-list b { display: block; color: var(--ink); }
.ent-list small { display: block; color: var(--muted); font-size: 11.5px; }
.cov-note { margin: 10px 0 0; padding-top: 10px; border-top: 1px solid var(--line); font-size: 12.5px; line-height: 1.65; color: var(--ink-2); }
.wb-term pre { margin: 6px 0 0; font-family: var(--font-mono); font-size: 12px; line-height: 1.65; white-space: pre-wrap; }
@media (max-width: 860px) {
  .steps { grid-template-columns: 1fr 1fr; }
  .cards3, .ans-grid { grid-template-columns: 1fr; }
}
</style>
