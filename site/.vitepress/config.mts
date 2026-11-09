import { defineConfig, type HeadConfig } from 'vitepress'
import { fileURLToPath } from 'node:url'
import { assertDisplayFontCovers } from './display-font'

const base = '/llm-ontology/'
const origin = 'https://caizongyuan.github.io'
const repo = 'https://github.com/CaiZongyuan/llm-ontology'

export default defineConfig({
  base,
  lang: 'zh-CN',
  title: 'LLM Ontology',
  description: '从杂乱业务资料到可验证、可执行、可持续演化的业务本体：Ontology、Auto-Ontology、Semantica、LLM Wiki、MPS 与 llm-ontology 交互式教程。',
  appearance: true,
  cleanUrls: true,
  lastUpdated: false,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}mark.svg` }],
    ['link', { rel: 'preload', href: `${base}fonts/noto-serif-sc-600.woff2`, as: 'font', type: 'font/woff2', crossorigin: '' }],
    ['meta', { name: 'theme-color', content: '#121211' }],
    ['meta', { property: 'og:site_name', content: 'LLM Ontology' }],
  ],
  transformHead({ pageData, title, description }): HeadConfig[] {
    const path = pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
    return [
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: `${origin}${base}${path}` }],
    ]
  },
  buildEnd: (site) => assertDisplayFontCovers(site.srcDir),
  vite: {
    build: { chunkSizeWarningLimit: 700 },
    server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  },
  themeConfig: {
    logo: '/mark.svg',
    siteTitle: 'LLM Ontology',
    nav: [
      { text: '00 从 0 到 1', link: '/journey/', activeMatch: '/journey/' },
      { text: '01 什么是 Ontology', link: '/ontology/', activeMatch: '/ontology/' },
      { text: '02 开源实现', link: '/opensource/auto-ontology', activeMatch: '/opensource/' },
      { text: '03 LLM Wiki', link: '/wiki/karpathy-pattern', activeMatch: '/wiki/' },
      { text: '04 MPS 建模', link: '/mps/projectional-editing', activeMatch: '/mps/' },
      { text: '05 本项目架构', link: '/architecture/overview', activeMatch: '/architecture/' },
      { text: '06 受控落地', link: '/practice/change-set', activeMatch: '/practice/' },
    ],
    sidebar: [
      {
        text: '00 动手入门：从 0 到 1',
        items: [
          { text: '把一桌资料编译成 Ontology', link: '/journey/' },
        ],
      },
      {
        text: '01 认知基石：什么是 Ontology',
        items: [
          { text: '一页看懂 Agent 时代的 Ontology', link: '/ontology/' },
          { text: 'Ontology 的八层解剖', link: '/ontology/anatomy' },
          { text: '医院数据治理与 Agentic Hospital', link: '/ontology/hospital-governance' },
        ],
      },
      {
        text: '02 开源实现：从语义层到可审计图谱',
        items: [
          { text: 'NVIDIA Auto-Ontology 深度剖析', link: '/opensource/auto-ontology' },
          { text: 'Semantica：可审计 Context Graph', link: '/opensource/semantica' },
        ],
      },
      {
        text: '03 知识沉淀范式：什么是 LLM Wiki',
        items: [
          { text: 'Karpathy LLM Wiki：从 RAG 到持续编译', link: '/wiki/karpathy-pattern' },
          { text: 'nashsu/llm_wiki 与本体双向锚定', link: '/wiki/nashsu-implementation' },
        ],
      },
      {
        text: '04 结构化建模哲学：JetBrains MPS',
        items: [
          { text: '投影式编辑：模型才是唯一事实源', link: '/mps/projectional-editing' },
          { text: '三层抽象阶梯：元模型、领域模型与实例', link: '/mps/meta-modeling' },
        ],
      },
      {
        text: '05 终极架构：本项目 llm-ontology',
        items: [
          { text: '三个闭环与两大引擎总览', link: '/architecture/overview' },
          { text: '双图架构：Evidence Graph 与 Domain Graph', link: '/architecture/dual-graphs' },
          { text: 'Meta-model 原语与类型化策略 AST', link: '/architecture/meta-model' },
          { text: '增量语义编译与运行时上下文解析', link: '/architecture/compiler-and-runtime' },
          { text: '最小验证实验（MVP）与综合自测', link: '/architecture/mvp-and-quiz' },
        ],
      },
      {
        text: '06 受控落地：把架构跑一遍',
        items: [
          { text: '一条规则改下去，到底会动到什么？', link: '/practice/change-set' },
          { text: 'Agent 提议释放床位，谁能让它真的执行？', link: '/practice/action-guard' },
          { text: '怎么证明它不是一段演示动画？', link: '/practice/golden-cases' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: repo }],
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一课', next: '下一课' },
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色',
    darkModeSwitchTitle: '切换到深色',
    sidebarMenuLabel: '课程目录',
    returnToTopLabel: '回到顶部',
    externalLinkIcon: false,
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索课程', buttonAriaLabel: '搜索课程' },
          modal: {
            noResultsText: '没有找到相关内容',
            resetButtonTitle: '清除',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },
  },
})
