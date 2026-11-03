<script setup>
defineProps({ title: String, subtitle: String })
</script>
<template>
  <header class="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 class="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-mute">{{ subtitle }}</p>
    </div>
    <div class="flex flex-wrap gap-2"><slot /></div>
  </header>
</template>
