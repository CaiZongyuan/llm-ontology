<script setup lang="ts">
import { withBase } from 'vitepress'
import LoopStageFlow from '../components/LoopStageFlow.vue'

const STATUSES = [
  { s: 'PASS', d: '结构、类型检查、策略 AST 与正负例契约测试全部通过', act: '签署 Model ChangeSet，发布新版本 Canonical Ontology' },
  { s: 'FAIL', d: '存在未消解的规范冲突、悬空引用或策略类型错误', act: '退回 Evidence Graph 补充证据或修正 AST，严禁带病上线' },
  { s: 'BLOCKED', d: '涉及医疗安全、角色越权或不可逆字段变更，等待人工审批', act: '进入 Decision Inbox 阻塞高危动作，低风险模块继续推进' },
  { s: 'IDEALIZED', d: '因缺乏实时接口暂用 Mock 视图或默认假设', act: '显式标注假设来源与生效边界，永不伪装为已验证事实' },
]

const MODULES = [
  {
    href: '/ontology/',
    kicker: '模块 01 · 认知基石与医疗数据治理标杆',
    title: '什么是 Ontology？从八层解剖到 Agentic Hospital',
    body: '突破“本体 = RDF 学术名词”的误区，用医院患者出院协同拆解八层认知模型，并整合 NHS FDP、国内互联互通/DCMM 2025 与 FHIR/openEHR/OMOP 参考框架。',
    stats: [['8 层', '本体认知解剖'], ['3 类', '医院核心资产'], ['5 大', '行业参考标准']],
  },
  {
    href: '/opensource/auto-ontology',
    kicker: '模块 02 · 开源实现深度拆解',
    title: 'NVIDIA Auto-Ontology 与 Semantica',
    body: '剖析 Auto-Ontology 如何从关系库采样编译 Term 与 SQL Attribute 并计算 Answerability；剖析 Semantica 如何构建 W3C PROV-O 可审计 Context Graph。',
    stats: [['4 元', '语义层结构'], ['5 阶', '本体生成管线'], ['PROV-O', '合规决策溯源']],
  },
  {
    href: '/wiki/karpathy-pattern',
    kicker: '模块 03 · 知识沉淀范式演进',
    title: 'Karpathy LLM Wiki 与 nashsu/llm_wiki',
    body: '为什么每次从零切块检索的传统 RAG 无法积累知识？解析 raw → wiki → Schema 持续编译机制，以及为什么 Wiki 管经验解释而绝不能替代本体执行契约。',
    stats: [['3 层', '知识目录结构'], ['Ingest/Lint', '持续维护闭环'], ['双向 ID', '本体语义锚定']],
  },
  {
    href: '/mps/projectional-editing',
    kicker: '模块 04 & 05 · MPS 投影编辑与 llm-ontology 编译器',
    title: '从 JetBrains MPS 到证据驱动的领域模型编译器',
    body: '吸收 MPS 投影式编辑思想，构建包含双图架构（Evidence Graph + Domain Graph）、类型化 Policy AST 与增量依赖重编译的完整 llm-ontology 系统。',
    stats: [['3 视图', '同源模型投影'], ['2 引擎', '发现 + 编译'], ['3 闭环', '需求 · 运行 · 学习']],
  },
]

const PATHS = [
  { href: '/ontology/', k: '01 从零建立认知', t: '一页看懂 Agent 时代的 Ontology', d: '理解认知世界、业务世界与行动世界，记住「问→定→映→跑→记→改」六字主线。' },
  { href: '/opensource/auto-ontology', k: '02 对比开源方案', t: 'Auto-Ontology · Semantica · LLM Wiki', d: '搞清语义层、可审计 Context Graph 与持续编译 Markdown Wiki 各自的边界与复用点。' },
  { href: '/architecture/overview', k: '03 深入本项目架构', t: 'llm-ontology 内部架构与交互沙盒', d: '亲手操作证据图冲突消解、MPS 三视图联动、Policy AST 校验与增量编译依赖图。' },
]
</script>

<template>
  <section id="stages" class="pl-section" tabindex="-1">
    <p class="pl-eyebrow pl-rule"><span>三个闭环 · 六个阶段</span></p>
    <div class="pl-section-head">
      <h2><span class="nb">证据驱动建模，模型驱动软件，</span><span class="nb">运行沉淀知识</span></h2>
      <p class="pl-section-lede">
        <code>llm-ontology</code> 不是另一个向量 RAG 或自由发挥的编码 Agent，而是位于原始业务证据与可运行 SaaS 之间的<strong>领域模型编译器</strong>。点击下方任意阶段，查看它的输入、受控产物、验证门与常见陷阱。
      </p>
    </div>
    <LoopStageFlow :initial="0" />
  </section>

  <section class="pl-section">
    <p class="pl-eyebrow pl-rule"><span>三大权威事实源</span></p>
    <div class="pl-section-head">
      <h2><span class="nb">不把文档、模型和数据库</span><span class="nb">混成一锅粥</span></h2>
      <p class="pl-section-lede">
        在医院数据治理与企业级 SaaS 中，最致命的错误是让大模型把未验证的访谈经验或历史脏数据直接当成系统规则执行。我们严格分离三种事实源，再通过稳定对象 ID 与版本引用将它们串联。
      </p>
    </div>
    <ol class="moments">
      <li>
        <span class="n mono">事实源 ① · 证据与知识层</span>
        <h3>Evidence Graph &amp; LLM Wiki</h3>
        <p>保存原始 SOP、录音、日志片段（<code>Fragment</code>）与提取出的事实主张（<code>Claim</code>），以及运行期沉淀的经验 Wiki。允许存在冲突与待验证假设，提供完整溯源。</p>
      </li>
      <li>
        <span class="n mono">事实源 ② · 业务契约层</span>
        <h3>Canonical Ontology</h3>
        <p>经过五维冲突消解、AST 静态类型检查与人工授权批准的版本化领域模型。它是实体、关系、状态机、指标口径与动作权限的唯一规范性权威。</p>
      </li>
      <li>
        <span class="n mono">事实源 ③ · 运行记录层</span>
        <h3>System of Record &amp; Events</h3>
        <p>HIS/EMR/SaaS 数据库中的真实业务状态与绑定模型版本号的领域事件（<code>Domain Event</code>）。只接受通过 <code>Action Executor</code> 确定性守卫的合法变更。</p>
      </li>
    </ol>
  </section>

  <section class="pl-section">
    <p class="pl-eyebrow pl-rule"><span>编译器验证门</span></p>
    <div class="pl-section-head">
      <h2><span class="nb">LLM 负责发现与提议，</span><span class="nb">确定性程序负责校验与放行</span></h2>
      <p class="pl-section-lede">
        无论是将候选主张合并进正式本体，还是在运行时由 Agent 调用医院出院协同动作，都必须经过确定性验证门（Validation Gate）。
      </p>
    </div>
    <div class="gates">
      <div class="term wb-term" aria-label="llm-ontology validate 的输出示例">
        <div><span class="dim">$</span> pnpm llm-ontology check nhs-discharge --changeset 042</div>
        <div><span class="ok">✅ check: PASS (Canonical Ontology v1.2.0)</span></div>
        <div>  <span class="ok">✓</span> Structural: 12 EntityTypes &amp; 18 Relations 引用完整</div>
        <div>  <span class="ok">✓</span> Provenance: 19 Claims 100% 绑定 Source Fragment Hash</div>
        <div>  <span class="ok">✓</span> Policy AST: ConfirmMedicallyFit 权限与枚举类型匹配</div>
        <div>  <span class="ok">✓</span> Negative N1: 住院医越权调用 ConfirmMedicallyFit 按预期判 BLOCKED</div>
        <div>  <span class="ok">✓</span> Negative N2: 存在未出危急值时调用 ReleaseBed 按预期判 BLOCKED</div>
      </div>
      <ul class="statuses">
        <li v-for="x in STATUSES" :key="x.s">
          <span class="wb-tag" :class="x.s">{{ x.s }}</span>
          <div>
            <b>{{ x.d }}</b>
            <p>{{ x.act }}</p>
          </div>
        </li>
      </ul>
    </div>
  </section>

  <section class="pl-section">
    <p class="pl-eyebrow pl-rule"><span>五大课程模块</span></p>
    <div class="pl-section-head">
      <h2><span class="nb">从基础概念、开源标杆，</span><span class="nb">一直到可落地的编译器架构</span></h2>
      <p class="pl-section-lede">
        全站共 18 节深度交互课程，包含多个可亲手操作的沙盒实验台与自测题。以「智慧医院数据治理与患者出院协同」为主线贯穿始终。
      </p>
    </div>
    <div class="cases">
      <a v-for="c in MODULES" :key="c.href" class="case" :href="withBase(c.href)">
        <div class="cb">
          <p class="k mono">{{ c.kicker }}</p>
          <h3>{{ c.title }}</h3>
          <p class="d">{{ c.body }}</p>
          <dl>
            <div v-for="[v, l] in c.stats" :key="l">
              <dt class="mono">{{ v }}</dt>
              <dd>{{ l }}</dd>
            </div>
          </dl>
        </div>
      </a>
    </div>
  </section>

  <section class="pl-section last">
    <p class="pl-eyebrow pl-rule"><span>开始学习</span></p>
    <div class="pl-section-head">
      <h2>选择你的切入路径</h2>
    </div>
    <a class="journey-cta" :href="withBase('/journey/')">
      <span class="jc-k mono">NEW · 动手入门</span>
      <span class="jc-t">从 0 到 1：把一桌资料编译成 Ontology</span>
      <span class="jc-d">7 幕交互与动画，亲手把 7 份互相冲突的医院资料，编译成一份可追溯、可执行的权威本体。</span>
      <span class="jc-go">开始动手 →</span>
    </a>
    <div class="paths">
      <a v-for="p in PATHS" :key="p.href" :href="withBase(p.href)">
        <span class="k mono">{{ p.k }}</span>
        <h3>{{ p.t }}</h3>
        <p>{{ p.d }}</p>
        <span class="go">→</span>
      </a>
    </div>
  </section>
</template>

<style scoped>
.pl-section code { font-family: var(--font-mono); font-size: .88em; padding: 1px 6px; border-radius: 5px; background: var(--surface-2); border: 1px solid var(--line); }
.moments { list-style: none; margin: 48px 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.moments li { position: relative; padding: 22px 20px; border: 1px solid var(--line); border-radius: 14px; background: color-mix(in srgb, var(--surface) 74%, transparent); box-shadow: var(--shadow-1); }
.moments li + li::before { content: ''; position: absolute; left: -15px; top: 40px; width: 16px; height: 1px; background: var(--line-2); }
.moments .n { font-size: 11px; color: var(--accent-ink); letter-spacing: .04em; }
.pl .moments h3 { margin-top: 10px; font-size: 22px; }
.moments p { margin-top: 10px; font-size: 14px; line-height: 1.8; color: var(--ink-2); }
.gates { margin-top: 44px; display: grid; grid-template-columns: 1.05fr 1fr; gap: 24px; align-items: start; }
.term div { white-space: pre; }
.statuses { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.statuses li { display: grid; grid-template-columns: 96px 1fr; gap: 14px; padding: 12px 0; border-top: 1px solid var(--line); align-items: start; }
.statuses .wb-tag { margin-top: 2px; justify-self: start; }
.statuses b { font-weight: 500; font-size: 14.5px; color: var(--ink); }
.statuses p { margin-top: 2px; font-size: 13.5px; color: var(--muted); line-height: 1.7; }
.cases { margin-top: 44px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.case { display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; background: var(--surface); box-shadow: var(--shadow-1); transition: transform .25s var(--ease), border-color .25s var(--ease); }
.case:hover { transform: translateY(-2px); border-color: var(--accent); }
.cb { padding: 24px 24px 26px; }
.k { font-size: 11px; color: var(--accent-ink); letter-spacing: .04em; }
.pl .case h3 { margin-top: 8px; font-size: 23px; }
.d { margin-top: 10px; font-size: 14.5px; line-height: 1.8; color: var(--ink-2); }
.case dl { margin: 18px 0 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding-top: 14px; border-top: 1px solid var(--line); }
.case dt { font-size: 18px; color: var(--ink); }
.case dd { margin: 2px 0 0; font-size: 12px; color: var(--muted); }
.paths { margin-top: 40px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.paths a { position: relative; padding: 22px 22px 46px; border: 1px solid var(--line); border-radius: 14px; background: color-mix(in srgb, var(--surface) 80%, transparent); box-shadow: var(--shadow-1); transition: border-color .25s var(--ease), transform .25s var(--ease); }
.paths a:hover { border-color: var(--accent); transform: translateY(-2px); }
.paths .k { color: var(--accent-ink); }
.pl .paths h3 { margin-top: 8px; font-size: 21px; }
.paths p { margin-top: 8px; font-size: 14px; line-height: 1.75; color: var(--ink-2); }
.go { position: absolute; left: 22px; bottom: 16px; color: var(--accent-ink); }
.last { padding-bottom: 140px; }
.journey-cta { position: relative; display: block; margin-top: 40px; padding: 26px 28px; border: 1px solid var(--accent); border-radius: 16px; background: linear-gradient(100deg, var(--accent-soft), transparent 72%), var(--surface); box-shadow: var(--shadow-1); transition: transform .25s var(--ease), border-color .25s var(--ease); }
.journey-cta:hover { transform: translateY(-2px); }
.jc-k { font-size: 11px; color: var(--accent-ink); letter-spacing: .06em; }
.jc-t { display: block; margin-top: 8px; font-family: var(--font-display); font-size: clamp(22px, 2.6vw, 30px); font-weight: 600; }
.jc-d { display: block; margin-top: 8px; max-width: 760px; font-size: 14px; line-height: 1.8; color: var(--ink-2); }
.jc-go { display: inline-block; margin-top: 14px; font-size: 13.5px; color: var(--accent-ink); }
@media (max-width: 1000px) {
  .moments, .paths { grid-template-columns: 1fr; }
  .moments li + li::before { display: none; }
  .gates, .cases { grid-template-columns: 1fr; }
}
</style>
