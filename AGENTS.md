# LLM Ontology

证据驱动的领域模型编译器（Evidence-Grounded Domain Model Compiler）与交互式架构教程。核心领域术语见 `GLOSSARY.md`，关键架构决策见 `docs/adr/`。

- 正文与教学说明用中文；代码、文件名、类型与标识符用英文。
- 交互式教程站点位于 `site/`（基于 VitePress + Vue 3，推送主分支后通过 `.github/workflows/site.yml` 自动构建并发布到 GitHub Pages）。
- 站点字体子集化：修改站点中文字符后运行 `pnpm --dir site font` 重新生成 `site/public/fonts/noto-serif-sc-600.woff2` 与 `.vitepress/display-font-chars.txt`，再运行 `pnpm --dir site build` 验证构建。
- 贯穿案例采用「智慧医院数据治理与患者出院协同（NHS FDP 范式）」，并在 `NVIDIA/auto-ontology` 章节保留官方 `Wide World Importers` 源码对照。
