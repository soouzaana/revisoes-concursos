<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { X } from 'lucide-vue-next'
const props = defineProps({ open: Boolean, title: String, wide: Boolean })
const emit = defineEmits(['close'])
const onKey = (e) => { if (e.key === 'Escape' && props.open) emit('close') }
onMounted(() => addEventListener('keydown', onKey))
onUnmounted(() => { removeEventListener('keydown', onKey); document.body.style.overflow = '' })
watch(() => props.open, (v) => { document.body.style.overflow = v ? 'hidden' : '' })
</script>
<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" :aria-label="title">
      <div class="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" @click="emit('close')" />
      <div class="relative flex max-h-[92dvh] w-full flex-col animate-rise rounded-t-3xl border border-line bg-surface shadow-2xl sm:animate-pop sm:rounded-3xl" :class="wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'">
        <header class="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 class="font-display text-lg font-bold">{{ title }}</h2>
          <button class="btn-ghost btn-sm !p-2" aria-label="Fechar" @click="emit('close')"><X :size="18" /></button>
        </header>
        <div class="overflow-y-auto px-5 py-5"><slot /></div>
        <footer v-if="$slots.footer" class="safe-bottom flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4"><slot name="footer" /></footer>
      </div>
    </div>
  </Teleport>
</template>
