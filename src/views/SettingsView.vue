<script setup>
import { computed, ref } from 'vue'
import { Sun, Moon, Monitor, Download, Upload, Smartphone } from 'lucide-vue-next'
import { useSettingsStore } from '../stores/settings'
import { useAppStore } from '../stores/app'
import { downloadBackup, restoreBackup } from '../services/backupService'
import { useInstallPrompt } from '../composables/useInstallPrompt'
import { useToast } from '../composables/useToast'
import { useConfirm } from '../composables/useConfirm'
import { formatDate } from '../utils/date'
import { FREQUENCY_PRESETS, MAX_FREQUENCY, isValidFrequency } from '../services/mockEngine'
import PageHeader from '../components/ui/PageHeader.vue'
import SubjectsManager from '../components/forms/SubjectsManager.vue'

const settings = useSettingsStore(), app = useAppStore(), toast = useToast(), confirm = useConfirm()
const { canInstall, standalone, install } = useInstallPrompt()
const file = ref(null)
const busy = ref(false)
const themes = [{ id: 'system', label: 'Sistema', icon: Monitor }, { id: 'light', label: 'Claro', icon: Sun }, { id: 'dark', label: 'Escuro', icon: Moon }]

async function exportBackup() {
  try { await downloadBackup(); await settings.markBackup(); toast.ok('Backup exportado') } catch (e) { toast.error('Não foi possível exportar: ' + e.message) }
}
async function onFile(e) {
  const f = e.target.files?.[0]
  e.target.value = ''
  if (!f) return
  busy.value = true
  try {
    const obj = JSON.parse(await f.text())
    if (!(await confirm({ title: 'Restaurar backup', message: 'Isto substitui TODOS os dados atuais pelos do arquivo. Deseja continuar?\n\nDica: exporte um backup antes.', confirmLabel: 'Restaurar', danger: true }))) return
    const counts = await restoreBackup(obj)
    await app.loadAll()
    toast.ok(`Backup restaurado: ${counts.studies} estudos, ${counts.questions} questões, ${counts.flashcards} cartões`)
  } catch (err) {
    toast.error(err instanceof SyntaxError ? 'Arquivo inválido: não é um JSON.' : err.message)
  } finally { busy.value = false }
}
const custom = ref(false), customDays = ref('')
const isPreset = computed(() => FREQUENCY_PRESETS.includes(settings.mockFrequencyDays))
const showCustom = computed(() => custom.value || !isPreset.value)
async function setFreq(n) {
  try { await settings.setMockFrequency(n); toast.ok(`Frequência sugerida: ${n} dias`) } catch (e) { toast.error(e.message) }
}
function pickPreset(n) { custom.value = false; setFreq(n) }
async function saveCustom() {
  const n = Number(customDays.value)
  if (!isValidFrequency(n)) { toast.error(`Informe um número inteiro de 1 a ${MAX_FREQUENCY} dias.`); return }
  await setFreq(n)
}
async function doInstall() { (await install()) && toast.ok('App instalado') }
</script>

<template>
  <PageHeader title="Ajustes" />
  <div class="space-y-6">
    <section class="panel p-5">
      <h2 class="mb-3 font-display text-lg font-bold">Aparência</h2>
      <div class="grid grid-cols-3 gap-2">
        <button v-for="t in themes" :key="t.id" class="flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm font-semibold transition" :class="settings.theme === t.id ? 'border-accent bg-accent-soft text-accent' : 'border-line text-mute hover:bg-sunken'" :aria-pressed="settings.theme === t.id" @click="settings.setTheme(t.id)">
          <component :is="t.icon" :size="20" />{{ t.label }}
        </button>
      </div>
    </section>

    <section class="panel p-5">
      <h2 class="mb-1 font-display text-lg font-bold">Frequência dos simulados</h2>
      <p class="mb-3 text-sm text-mute">Intervalo sugerido entre simulados. É só um lembrete: você pode cadastrar simulados quando quiser.</p>
      <div class="flex flex-wrap gap-2">
        <button v-for="n in FREQUENCY_PRESETS" :key="n" class="pill !px-3.5 !py-1.5 text-sm transition" :class="!showCustom && settings.mockFrequencyDays === n ? 'bg-accent text-accent-fg' : 'bg-sunken text-ink'" :aria-pressed="!showCustom && settings.mockFrequencyDays === n" @click="pickPreset(n)">{{ n }} dias</button>
        <button class="pill !px-3.5 !py-1.5 text-sm transition" :class="showCustom ? 'bg-accent text-accent-fg' : 'bg-sunken text-ink'" :aria-pressed="showCustom" @click="custom = true; customDays = String(settings.mockFrequencyDays)">Personalizado</button>
      </div>
      <form v-if="showCustom" class="mt-3 flex items-end gap-2" @submit.prevent="saveCustom">
        <div><label class="label" for="freq-custom">Dias entre simulados</label><input id="freq-custom" v-model="customDays" type="number" min="1" :max="MAX_FREQUENCY" step="1" class="field !w-32" :placeholder="String(settings.mockFrequencyDays)" /></div>
        <button class="btn-line" type="submit">Salvar</button>
      </form>
      <p class="mt-3 text-xs text-mute">Atual: <b>{{ settings.mockFrequencyDays }} dias</b></p>
    </section>

    <section class="panel p-5">
      <h2 class="mb-1 font-display text-lg font-bold">Matérias</h2>
      <p class="mb-4 text-sm text-mute">Adicione, renomeie ou exclua. Matérias com registros ligados não podem ser excluídas.</p>
      <SubjectsManager />
    </section>

    <section class="panel p-5">
      <h2 class="mb-1 font-display text-lg font-bold">Backup dos dados</h2>
      <p class="mb-4 text-sm text-mute">Seus dados ficam só neste aparelho. Exporte um arquivo para guardar ou trocar de celular.
        <span v-if="settings.lastBackupAt"> Último backup: {{ formatDate(settings.lastBackupAt.slice(0, 10)) }}.</span></p>
      <div class="flex flex-wrap gap-2">
        <button class="btn-primary" @click="exportBackup"><Download :size="16" /> Exportar backup (JSON)</button>
        <button class="btn-line" :disabled="busy" @click="file.click()"><Upload :size="16" /> Restaurar backup</button>
        <input ref="file" type="file" accept="application/json,.json" class="hidden" data-testid="backup-input" @change="onFile" />
      </div>
    </section>

    <section class="panel p-5">
      <h2 class="mb-1 font-display text-lg font-bold">Instalar no celular</h2>
      <p v-if="standalone" class="text-sm text-ok">O app já está instalado e funciona offline.</p>
      <template v-else>
        <p class="mb-3 text-sm text-mute">Instalado, o app abre em tela cheia e funciona sem internet.</p>
        <button v-if="canInstall" class="btn-primary" @click="doInstall"><Smartphone :size="16" /> Instalar app</button>
        <p v-else class="text-sm text-mute">No Chrome (Android): menu ⋮ → <b>Instalar app</b>. No Safari (iPhone): Compartilhar → <b>Adicionar à Tela de Início</b>.</p>
      </template>
    </section>
  </div>
</template>
