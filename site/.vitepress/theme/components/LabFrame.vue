<script setup lang="ts">
withDefaults(
  defineProps<{
    labId: string
    title: string
    note?: string
    contract?: string
  }>(),
  {
    note: '',
    contract: '先预测 → 再运行 → 看解释',
  },
)
const emit = defineEmits<{ (e: 'reset'): void }>()
</script>

<template>
  <section class="lf wb-panel vp-raw" :aria-label="`${labId} ${title}`">
    <div class="wb-panel-head lf-head">
      <span class="lf-title">{{ labId }} · {{ title }}</span>
      <div class="lf-meta">
        <span class="wb-tag PASS">BROWSER_EXECUTABLE</span>
        <span class="wb-tag NOT_RUN">SIMULATED · 不连接真实 HIS</span>
        <button type="button" class="lf-reset" @click="emit('reset')">↺ 重置实验</button>
      </div>
    </div>
    <div class="wb-panel-body">
      <p class="lf-note">{{ note }} <strong>契约：{{ contract }}</strong></p>
      <slot />
    </div>
  </section>
</template>

<style scoped>
.lf { margin: 24px 0; }
.lf-head { flex-wrap: wrap; row-gap: 8px; }
.lf-title { color: var(--faint); }
.lf-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.lf-reset {
  height: 24px; padding: 0 9px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--line-2); background: var(--surface-2);
  color: var(--ink-2); font-family: var(--font-ui); font-size: 12px;
}
.lf-reset:hover { border-color: var(--accent); color: var(--accent-ink); }
.lf-note { margin: 0 0 14px; font-size: 13px; line-height: 1.75; color: var(--muted); }
.lf-note strong { color: var(--accent-ink); font-weight: 600; }
</style>
