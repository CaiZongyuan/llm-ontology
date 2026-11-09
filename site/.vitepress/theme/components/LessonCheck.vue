<script setup lang="ts">
import { computed, ref } from 'vue'

interface Q {
  q: string
  opts: string[]
  answer: number
  why: string
  transfer?: boolean
}

const BANK: Record<string, Q[]> = {
  L01: [
    {
      q: '把 DischargePathway 的中文显示名从「出院准备路径」改成「离院协同路径」，正确的影响范围是？',
      opts: [
        '全部 28 个产物重编译，历史出院事件也要跟着改',
        '只更新 UI 投影字典；稳定节点 ID 未变，后端守卫与历史事件零改动',
        '必须重建数据库表结构并迁移 HIS 历史数据',
        '自动触发一次全院策略重新审批',
      ],
      answer: 1,
      why: '稳定节点 ID（hospital.discharge_pathway）与显示名解耦，是增量编译的前提；名称变化不改变业务语义。',
    },
    {
      q: '【迁移题】如果改的不是名称，而是把 ConfirmMedicallyFit 的前置条件由 2 项改为 3 项，会怎样？',
      opts: [
        '和改名一样，只更新显示名，无需审批',
        '策略 AST 语义变化：守卫、看板、契约测试与 Agent 工具契约都要重算，且必须走审批发布',
        '只影响前端，后端守卫靠运行时解释旧规则即可',
        '历史出院事件需要按新条件重新判定一遍',
      ],
      answer: 1,
      why: '把「名称变化」换成「语义变化」，判定依据就变了：依赖图沿策略节点扩散，发布门禁要求 Review + 授权；历史事件仍保留旧 modelRevision 快照，绝不回溯重判。',
      transfer: true,
    },
    {
      q: '直接热改 discharge-policy.yaml 最危险的地方是什么？',
      opts: [
        '只是没走流程，补一张工单就能追平',
        '编译速度比 ChangeSet 慢一点',
        '历史出院事件被新规则追溯重判、看板与守卫口径分叉，且无审批记录、无可考版本可回滚',
        'YAML 缩进容易写错',
      ],
      answer: 2,
      why: '问题不在流程形式，而在缺少依赖图、版本快照与审计链，导致同一事实在不同层出现不可恢复的分叉。',
    },
  ],
  L02: [
    {
      q: 'Agent 从 Ontology Context Package 里看到 ReleaseBed 可用，是否意味着它已获授权？',
      opts: [
        '是，上下文里出现的 Action 就是可执行清单',
        '否。上下文裁剪只是能力发现，后端确定性守卫必须独立再验一次',
        '只要模型置信度高于 0.95 就算授权',
        '只要前端隐藏了按钮就等于后端已授权',
      ],
      answer: 1,
      why: '上下文解析解决「给 LLM 看什么」，授权解决「允许做什么」，两者分属不同层，不能互相替代。',
    },
    {
      q: '【迁移题】调用者是科主任（Chief），但患者仍有 2 项检验危急值未清零，结果如何？',
      opts: [
        '科主任权限最高，直接放行',
        '进入人工审批队列后自动放行',
        '仍被 inv.zero_critical_labs 拦下；不变量对所有角色一视同仁',
        '先放行再补记录',
      ],
      answer: 2,
      why: '把角色换成更高权限并不会豁免业务不变量。角色判定与不变量判定是策略 AST 里两类不同的条件，迁移时要分别检查。',
      transfer: true,
    },
    {
      q: '重试时把 Date.now() 拼进 idempotencyKey，最可能出什么问题？',
      opts: [
        '键变长，只是稍微多占一点存储',
        '每次重试键都不同，去重失效，可能重复释放床位或重复发单',
        '会让 traceId 变短',
        '没有任何影响，幂等由数据库自增主键保证',
      ],
      answer: 1,
      why: '幂等键必须在重试中保持稳定，由 actionId + 业务实例 ID + modelRevision 组成，不能包含每次重新生成的时间戳。',
    },
  ],
  L03: [
    {
      q: '为什么不能让生成器自己生成测试，并拿它当黄金预期？',
      opts: [
        '因为生成器写测试太慢',
        '因为实现与测试可能共享同一个错误，断言全绿但业务值是错的',
        '因为测试文件不能放进版本库',
        '因为 Vitest 不支持领域规则',
      ],
      answer: 1,
      why: '黄金预期必须来自独立业务基线并经人工复核；否则测试只是在复述实现的输出，失去检错能力。',
    },
    {
      q: '【迁移题】明细 JOIN 让「完成出院协同医嘱数」从 3 膨胀到 5，独立基线仍是 3，应该怎么做？',
      opts: [
        '把期望值改成 5，让 CI 变绿',
        '删掉这条断言，改用截图人工目检',
        '判定 FAIL，修聚合口径（按医嘱去重后再计数），期望值保持 3',
        '降低断言容差到 ±2 即可通过',
      ],
      answer: 2,
      why: '数值断言不接受「改期望值」这种修法；口径错误要修实现。把容差放宽到能容纳错误，等于取消断言。',
      transfer: true,
    },
    {
      q: '本分组的 5 个实验台可以标记 VERIFIED_EXPERIMENT 吗？',
      opts: [
        '可以，浏览器里确实运行了代码',
        '可以，只要页面上有绿色的 PASS',
        '不可以。没有真实后端、命令、退出码与日志，只能标 COURSE_DESIGN + SIMULATED + BROWSER_EXECUTABLE',
        '可以，因为构建通过了',
      ],
      answer: 2,
      why: '构建通过只证明站点能编译，不证明业务规则在真实运行时被验证。把模拟结果写成实测属于发布阻断项。',
    },
  ],
}

const props = defineProps<{ lesson: string }>()
const qs = computed(() => BANK[props.lesson] ?? [])
const ans = ref<(number | null)[]>(qs.value.map(() => null))
const done = computed(() => ans.value.filter((a) => a !== null).length)
const right = computed(() => ans.value.filter((a, i) => a === qs.value[i].answer).length)

function pick(i: number, j: number) {
  if (ans.value[i] === null) ans.value[i] = j
}
function reset() {
  ans.value = qs.value.map(() => null)
}
</script>

<template>
  <div class="lc vp-raw">
    <div class="top">
      <p class="score">
        {{ done ? `已作答 ${done} / ${qs.length} 题 · 答对 ${right} 题（含迁移题，答错也会给解析）` : `本课 ${qs.length} 道自测题：点击选项立即判定并查看为什么。` }}
      </p>
      <button v-if="done" type="button" class="wb-btn" @click="reset">重新作答</button>
    </div>
    <div v-for="(q, i) in qs" :key="i" class="q wb-panel">
      <p class="t">
        <span v-if="q.transfer" class="wb-tag BLOCKED">迁移题</span>
        {{ i + 1 }}. {{ q.q }}
      </p>
      <div class="opts">
        <button
          v-for="(o, j) in q.opts"
          :key="j"
          type="button"
          :class="{ right: ans[i] !== null && j === q.answer, wrong: ans[i] === j && j !== q.answer }"
          :disabled="ans[i] !== null"
          @click="pick(i, j)"
        >{{ o }}</button>
      </div>
      <p v-if="ans[i] !== null" class="why">{{ ans[i] === q.answer ? '✓ 解析：' : '✗ 解析：' }}{{ q.why }}</p>
    </div>
  </div>
</template>

<style scoped>
.lc { margin: 22px 0; display: flex; flex-direction: column; gap: 10px; }
.top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.score { margin: 0; font-size: 13.5px; color: var(--muted); }
.q { padding: 14px 16px; }
.t { margin: 0 0 10px; font-size: 14px; color: var(--ink); font-weight: 500; line-height: 1.6; }
.t .wb-tag { margin-right: 8px; vertical-align: middle; }
.opts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.opts button { text-align: left; padding: 9px 12px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink-2); font-size: 13px; cursor: pointer; font-family: var(--font-ui); line-height: 1.55; transition: border-color .2s var(--ease); }
.opts button:hover:not(:disabled) { border-color: var(--accent); }
.opts button:disabled { cursor: default; }
.opts button.right { border-color: var(--ok); background: color-mix(in srgb, var(--ok) 12%, transparent); color: var(--ok); }
.opts button.wrong { border-color: var(--bad); background: color-mix(in srgb, var(--bad) 10%, transparent); color: var(--bad); }
.why { margin: 10px 0 0; padding-top: 8px; border-top: 1px solid var(--line); font-size: 13px; line-height: 1.75; color: var(--ink-2); }
@media (max-width: 680px) { .opts { grid-template-columns: 1fr; } }
</style>
