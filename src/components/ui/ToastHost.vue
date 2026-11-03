<script setup>
import { toasts } from '../../composables/useToast'
import { CheckCircle2, AlertCircle, Info } from 'lucide-vue-next'
</script>
<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
    <TransitionGroup enter-active-class="animate-rise" leave-active-class="transition duration-200" leave-to-class="opacity-0">
      <div v-for="t in toasts" :key="t.id" class="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
        :class="t.type === 'error' ? 'bg-danger text-white' : 'bg-ink text-bg'">
        <AlertCircle v-if="t.type === 'error'" :size="18" /><CheckCircle2 v-else-if="t.type === 'ok'" :size="18" /><Info v-else :size="18" />
        {{ t.message }}
      </div>
    </TransitionGroup>
  </div>
</template>
