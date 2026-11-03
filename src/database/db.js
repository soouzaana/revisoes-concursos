import { openDB, deleteDB } from 'idb'

export const DB_NAME = 'revisoes-concursos'
export const DB_VERSION = 1
export const STORE_NAMES = ['subjects', 'studies', 'questions', 'flashcards', 'reviews', 'reviewLog', 'cycles', 'settings']

let dbPromise = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('subjects', { keyPath: 'id' })
        const studies = db.createObjectStore('studies', { keyPath: 'id' })
        studies.createIndex('date', 'date')
        studies.createIndex('subjectId', 'subjectId')
        const questions = db.createObjectStore('questions', { keyPath: 'id' })
        questions.createIndex('date', 'date')
        questions.createIndex('subjectId', 'subjectId')
        questions.createIndex('status', 'status')
        const cards = db.createObjectStore('flashcards', { keyPath: 'id' })
        cards.createIndex('subjectId', 'subjectId')
        cards.createIndex('dueDate', 'dueDate')
        const reviews = db.createObjectStore('reviews', { keyPath: 'id' })
        reviews.createIndex('type', 'type')
        reviews.createIndex('refDate', 'refDate')
        const log = db.createObjectStore('reviewLog', { keyPath: 'id' })
        log.createIndex('itemId', 'itemId')
        log.createIndex('reviewId', 'reviewId')
        log.createIndex('kind', 'kind')
        log.createIndex('date', 'date')
        db.createObjectStore('cycles', { keyPath: 'id' })
        db.createObjectStore('settings', { keyPath: 'key' })
      },
      blocking() {
        dbPromise?.then((db) => db.close())
        dbPromise = null
      }
    })
  }
  return dbPromise
}

/** Executa `fn(stores, tx)` em uma transação atômica sobre os stores informados. */
export async function withTx(storeNames, mode, fn) {
  const db = await getDB()
  const tx = db.transaction(storeNames, mode)
  const stores = Object.fromEntries(storeNames.map((n) => [n, tx.objectStore(n)]))
  try {
    const result = await fn(stores, tx)
    await tx.done
    return result
  } catch (err) {
    tx.done.catch(() => {})
    try { tx.abort() } catch { /* já finalizada */ }
    throw err
  }
}

export async function deleteDatabase() {
  if (dbPromise) {
    try { (await dbPromise).close() } catch { /* ignore */ }
    dbPromise = null
  }
  await deleteDB(DB_NAME)
}
