<script setup>
import { useSubjectsStore } from '../../stores/subjects'
defineProps({ id: String, bare: Boolean })
const subjects = useSubjectsStore()
</script>
<template>
  <span class="inline-flex min-w-0 items-center gap-1.5" :class="bare ? '' : 'rounded-full bg-sunken px-2.5 py-0.5 text-xs font-semibold'">
    <span class="h-2 w-2 shrink-0 rounded-full" :style="{ background: subjects.colorOf(id) }" />
    <span class="truncate">{{ subjects.nameOf(id) }}</span>
  </span>
</template>
