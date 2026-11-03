<script setup>
import { confirmState as s } from '../../composables/useConfirm'
import BaseModal from './BaseModal.vue'
const done = (v) => { s.open = false; s.resolve?.(v) }
</script>
<template>
  <BaseModal :open="s.open" :title="s.title" @close="done(false)">
    <p class="whitespace-pre-line text-sm text-mute">{{ s.message }}</p>
    <template #footer>
      <button class="btn-line" @click="done(false)">Cancelar</button>
      <button :class="s.danger ? 'btn-danger' : 'btn-primary'" @click="done(true)">{{ s.confirmLabel }}</button>
    </template>
  </BaseModal>
</template>
