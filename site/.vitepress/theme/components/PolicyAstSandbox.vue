<script setup lang="ts">
import { computed, ref } from 'vue'

const actorRole = ref<'Resident' | 'Attending' | 'Chief'>('Attending')
const encounterType = ref<'Inpatient' | 'DaySurgery'>('DaySurgery')
const pendingCriticalLabs = ref<number>(0)
const injectTypeBug = ref(false)

const typeCheckResult = computed(() => {
  if (injectTypeBug.value) {
    return {
      pass: false,
      msg: 'CompileError [E_TYPE_MISMATCH]: 属性 `encounter.pending_critical_labs` 类型为 Integer，不能与字符串字面量 `"none"` 进行 `eq` 比较。模型发布被拒绝！',
    }
  }
  return {
    pass: true,
    msg: 'Static Type Check PASS：所有属性路径、Enum 字面量与角色权限标识符均在 Meta-model 中验证合法。',
  }
})

const runtimeResult = computed(() => {
  if (!typeCheckResult.value.pass) {
    return { allow: false, reason: '模型未通过编译期静态类型检查，禁止加载至 Action Executor。' }
  }
  if (pendingCriticalLabs.value > 0) {
    return {
      allow: false,
      reason: `违反不变量 [inv.zero_critical_labs]：当前患者存在 ${pendingCriticalLabs.value} 项未处理检验危急值，严禁放行出院。`,
    }
  }
  if (encounterType.value === 'Inpatient' && actorRole.value !== 'Chief') {
    return {
      allow: false,
      reason: `违反策略 [policy.discharge.signoff]：常规住院患者出院须由科主任 (Chief) 终审签发，当前调用者为 ${actorRole.value}。`,
    }
  }
  if (encounterType.value === 'DaySurgery' && actorRole.value === 'Resident') {
    return {
      allow: false,
      reason: `违反策略 [policy.discharge.signoff]：日间手术绿色通道至少要求主治医师 (Attending) 权限，住院医 (Resident) 调用被拒绝。`,
    }
  }
  return {
    allow: true,
    reason: `Action Executor 放行 PASS：(${encounterType.value}, Role=${actorRole.value}, CriticalLabs=0) 满足全部前置条件，已原子更新状态并写入 PROV-O 事件。`,
  }
})
</script>

<template>
  <div class="pas wb-panel vp-raw">
    <div class="wb-panel-head">
      <span>类型化策略 AST 编译器与运行时 Action 守卫沙盒</span>
      <span class="wb-tag" :class="runtimeResult.allow ? 'PASS' : 'FAIL'">
        {{ runtimeResult.allow ? 'ACTION ALLOWED' : 'ACTION BLOCKED' }}
      </span>
    </div>

    <div class="wb-panel-body">
      <div class="controls">
        <label>
          <span>调用者角色 (Actor Role)</span>
          <select v-model="actorRole" class="inp">
            <option value="Resident">Resident (住院医师)</option>
            <option value="Attending">Attending (主治医师)</option>
            <option value="Chief">Chief (科主任)</option>
          </select>
        </label>
        <label>
          <span>就诊类型 (Encounter Type)</span>
          <select v-model="encounterType" class="inp">
            <option value="DaySurgery">DaySurgery (日间手术)</option>
            <option value="Inpatient">Inpatient (常规住院)</option>
          </select>
        </label>
        <label>
          <span>未处理危急值数 (pending_critical_labs)</span>
          <select v-model.number="pendingCriticalLabs" class="inp">
            <option :value="0">0 项</option>
            <option :value="2">2 项（危急值未解除）</option>
          </select>
        </label>
        <label class="bug-toggle">
          <input v-model="injectTypeBug" type="checkbox" />
          <span>注入 AST 类型错误（测试编译期拦截）</span>
        </label>
      </div>

      <div class="grid">
        <div class="wb-term">
          <div class="dim"># Policy AST 结构化定义 (拒绝自然语言字符串规则)</div>
          <pre>{
  "id": "hospital.policy.confirm_medically_fit",
  "kind": "Policy",
  "actionRef": "hospital.action.confirm_medically_fit",
  "condition": {
    "op": "and",
    "args": [
      {
        "op": "eq",
        "left": { "path": "encounter.pending_critical_labs" },
        "right": { "literal": {{ injectTypeBug ? '"none"  // <-- 类型错误！应为 Integer' : '0' }} }
      },
      {
        "op": "or",
        "args": [
          { "op": "and", "args": [
            { "op": "eq", "left": { "path": "encounter.type" }, "right": { "literal": "DaySurgery" } },
            { "op": "roleAtLeast", "role": "Attending" }
          ]},
          { "op": "eq", "left": { "path": "actor.role" }, "right": { "literal": "Chief" } }
        ]
      }
    ]
  }
}</pre>
        </div>

        <div class="verdicts">
          <div class="v-card" :class="typeCheckResult.pass ? 'ok' : 'bad'">
            <span class="wb-eyebrow">阶段 1 · 编译期静态类型检查 (Semantic Type Checker)</span>
            <p>{{ typeCheckResult.msg }}</p>
          </div>
          <div class="v-card" :class="runtimeResult.allow ? 'ok' : 'bad'">
            <span class="wb-eyebrow">阶段 2 · 运行时确定性守卫 (Deterministic Action Executor)</span>
            <p>{{ runtimeResult.reason }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pas { margin: 22px 0; }
.controls { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); margin-bottom: 14px; }
.controls label { display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--muted); }
.controls .bug-toggle { flex-direction: row; align-items: center; gap: 8px; color: var(--bad); font-weight: 500; padding-top: 16px; }
.inp { padding: 6px 8px; border-radius: 6px; border: 1px solid var(--line-2); background: var(--surface); color: var(--ink); font-size: 13px; }
.grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 14px; align-items: start; }
.wb-term pre { margin: 4px 0 0; font-family: var(--font-mono); font-size: 11.5px; line-height: 1.55; white-space: pre-wrap; }
.verdicts { display: flex; flex-direction: column; gap: 12px; }
.v-card { padding: 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); }
.v-card.ok { border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); background: color-mix(in srgb, var(--ok) 6%, var(--surface)); }
.v-card.bad { border-color: color-mix(in srgb, var(--bad) 45%, var(--line)); background: color-mix(in srgb, var(--bad) 6%, var(--surface)); }
.v-card p { margin: 6px 0 0; font-size: 13.5px; line-height: 1.65; color: var(--ink); }
@media (max-width: 860px) {
  .controls { grid-template-columns: 1fr 1fr; }
  .grid { grid-template-columns: 1fr; }
}
</style>
