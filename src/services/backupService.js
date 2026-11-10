import { STORE_NAMES, withTx } from '../database/db'
import { syncReviews } from './reviewService'

export const BACKUP_APP = 'revisoes-concursos'
export const BACKUP_VERSION = 2 // v2 inclui simulados; backups v1 continuam válidos

export async function buildBackup() {
  const data = await withTx(STORE_NAMES, 'readonly', async (s) => {
    const out = {}
    for (const n of STORE_NAMES) out[n] = await s[n].getAll()
    return out
  })
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data }
}

export async function downloadBackup() {
  const backup = await buildBackup()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `backup-revisoes-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return backup
}

/** Valida estrutura do backup; lança Error com mensagem em português se inválido. */
export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Arquivo inválido: não é um backup deste aplicativo.')
  if (obj.app !== BACKUP_APP) throw new Error('Arquivo inválido: este backup não pertence ao aplicativo.')
  if (typeof obj.version !== 'number' || obj.version > BACKUP_VERSION) throw new Error('Versão de backup não suportada.')
  if (!obj.data || typeof obj.data !== 'object') throw new Error('Backup sem dados.')
  const clean = {}
  for (const n of STORE_NAMES) {
    const arr = obj.data[n] ?? []
    if (!Array.isArray(arr)) throw new Error(`Backup corrompido: "${n}" deveria ser uma lista.`)
    const keyName = n === 'settings' ? 'key' : 'id'
    for (const rec of arr) {
      if (!rec || typeof rec !== 'object' || rec[keyName] === undefined || rec[keyName] === null) throw new Error(`Backup corrompido: registro sem identificação em "${n}".`)
    }
    clean[n] = arr
  }
  const subjectIds = new Set(clean.subjects.map((s) => s.id))
  for (const st of clean.studies) if (!subjectIds.has(st.subjectId)) throw new Error('Backup corrompido: estudo ligado a matéria inexistente.')
  return clean
}

/** Restaura substituindo TODOS os dados atuais, em uma única transação (tudo ou nada). */
export async function restoreBackup(obj) {
  const clean = validateBackup(obj)
  await withTx(STORE_NAMES, 'readwrite', async (s) => {
    for (const n of STORE_NAMES) {
      await s[n].clear()
      for (const rec of clean[n]) await s[n].put(rec)
    }
  })
  await syncReviews()
  return Object.fromEntries(STORE_NAMES.map((n) => [n, clean[n].length]))
}
