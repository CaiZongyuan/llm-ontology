<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { withBase } from 'vitepress'
import { STAGES } from '../data/stages'

const props = withDefaults(defineProps<{ initial?: number }>(), { initial: 0 })
const sel = ref(props.initial)
const playing = ref(false)
let timer: ReturnType<typeof setInterval> | null = null
const s = computed(() => STAGES[sel.value])

function pick(i: number) {
  sel.value = i
  stop()
}
function stop() {
  playing.value = false
  if (timer) clearInterval(timer)
  timer = null
}
function play() {
  if (playing.value) return stop()
  playing.value = true
  timer = setInterval(() => {
    sel.value = (sel.value + 1) % STAGES.length
  }, 2800)
}
onBeforeUnmount(stop)
</script>

<template>
  <div class="sf vp-raw">
    <ol class="row" aria-label="六个核心阶段">
      <li v-for="(st, i) in STAGES" :key="st.id" :class="{ on: i === sel, past: i < sel }">
        <button type="button" :aria-pressed="i === sel" @click="pick(i)">
          <span class="n mono">{{ st.n }} · {{ st.loop }}</span>
          <b>{{ st.name }}</b>
          <span class="out mono">→ {{ st.handoff }}</span>
          <span v-if="st.approval" class="ap"><i>人</i>审批点{{ st.approval === 1 ? '①' : '②' }}</span>
        </button>
      </li>
    </ol>
    <div class="bar">
      <button type="button" class="wb-btn" @click="play">{{ playing ? '❚❚ 暂停轮播' : '▶ 依次播放六阶段' }}</button>
      <span class="hint">
        当前处于 <strong>{{ s.loop }}</strong> · 产物 <code>{{ s.handoff }}</code> 经确定性验证门后移交下一阶段。
      </span>
    </div>
    <Transition name="sf-swap" mode="out-in">
      <div :key="s.id" class="detail wb-panel">
        <div class="q">
          <span class="wb-eyebrow">阶段 {{ s.n }} ({{ s.dir }}) · 负责回答的核心问题</span>
          <h3>{{ s.question }}</h3>
        </div>
        <div class="cols">
          <dl>
            <div>
              <dt>输入材料</dt>
              <dd>
                <ul><li v-for="x in s.input" :key="x">{{ x }}</li></ul>
              </dd>
            </div>
            <div>
              <dt>受控产物</dt>
              <dd>
                <ul><li v-for="x in s.output" :key="x" class="mono">{{ x }}</li></ul>
              </dd>
            </div>
            <div>
              <dt>核心组件</dt>
              <dd>
                <ul><li v-for="x in s.tools" :key="x">{{ x }}</li></ul>
              </dd>
            </div>
          </dl>
          <dl>
            <div>
              <dt>验证门检查</dt>
              <dd>
                <ul class="gate"><li v-for="x in s.gate" :key="x">{{ x }}</li></ul>
              </dd>
            </div>
            <div>
              <dt>最典型误区</dt>
              <dd class="pit">{{ s.pitfall }}</dd>
            </div>
            <div v-if="s.approval">
              <dt>人工决策点</dt>
              <dd class="you">
                {{
                  s.approval === 1
                    ? '审批点①：在三视图 Preview 中确认消解后的业务规则与跨源概念映射。'
                    : '审批点②：审核通过类型检查的 Model ChangeSet，授权发布 Canonical Ontology 新版本。'
                }}
              </dd>
            </div>
          </dl>
        </div>
        <div class="foot">
          <a :href="withBase(s.link)">深入阅读本阶段设计 →</a>
          <span class="mono">{{ s.lesson }}</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.sf { margin: 28px 0; container-type: inline-size; }
.mono { font-family: var(--font-mono); }
.row { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
.row li { position: relative; margin: 0; }
.row li + li::before { content: ''; position: absolute; left: -10px; top: 34px; width: 10px; height: 1px; background: var(--line-2); }
.row button { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 12px; text-align: left; border-radius: 12px; border: 1px solid var(--line); background: color-mix(in srgb, var(--surface) 80%, transparent); box-shadow: var(--shadow-1); cursor: pointer; transition: border-color .25s var(--ease), background .25s var(--ease), transform .25s var(--ease); font-family: var(--font-ui); }
.row button:hover { border-color: var(--line-2); transform: translateY(-1px); }
.row li.on button { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
.row li.past button { border-color: color-mix(in srgb, var(--accent) 30%, var(--line)); }
.n { font-size: 10px; color: var(--faint); letter-spacing: .02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.row b { font-family: var(--font-display); font-size: 16px; font-weight: 600; color: var(--ink); line-height: 1.3; }
.out { font-size: 10.5px; color: var(--muted); line-height: 1.4; overflow-wrap: anywhere; }
.ap { margin-top: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--accent-ink); }
.ap i { font-style: normal; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 5px; background: var(--accent); color: var(--on-accent); font-size: 10.5px; }
.bar { margin-top: 14px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.hint { font-size: 13px; color: var(--muted); }
.hint code { font-size: 12px; }
.detail { margin-top: 14px; padding: 22px 24px; }
.q h3 { margin: 8px 0 0; font-family: var(--font-display); font-size: 22px; font-weight: 600; color: var(--ink); line-height: 1.35; border: 0; padding: 0; }
.cols { margin-top: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
dl { margin: 0; display: flex; flex-direction: column; }
dl > div { display: grid; grid-template-columns: 88px 1fr; gap: 14px; padding: 10px 0; border-top: 1px solid var(--line); }
dt { font-size: 12.5px; color: var(--faint); padding-top: 2px; }
dd { margin: 0; font-size: 14px; line-height: 1.7; color: var(--ink-2); }
dd ul { margin: 0; padding: 0; list-style: none; }
dd li { margin: 0; line-height: 1.7; }
dd li.mono { font-size: 12.5px; }
.gate li::before { content: '✓ '; color: var(--ok); }
.pit { color: var(--bad); }
.you { color: var(--accent-ink); }
.foot { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-size: 13.5px; }
.foot a { color: var(--accent-ink); font-weight: 500; text-decoration: none; }
.foot .mono { font-size: 12px; color: var(--faint); }
.sf-swap-enter-active, .sf-swap-leave-active { transition: opacity .25s var(--ease), transform .25s var(--ease); }
.sf-swap-enter-from { opacity: 0; transform: translateY(6px); }
.sf-swap-leave-to { opacity: 0; transform: translateY(-4px); }
@container (max-width: 960px) {
  .row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .row li + li::before { display: none; }
}
@container (max-width: 620px) {
  .row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cols { grid-template-columns: 1fr; gap: 0; }
  .detail { padding: 18px 16px; }
  dl > div { grid-template-columns: 76px 1fr; }
}
</style>
