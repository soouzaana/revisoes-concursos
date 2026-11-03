import { getDB } from './db'

export const getAll = async (store) => (await getDB()).getAll(store)
export const getOne = async (store, id) => (await getDB()).get(store, id)
export const putOne = async (store, obj) => { await (await getDB()).put(store, obj); return obj }
export const removeOne = async (store, id) => (await getDB()).delete(store, id)
export const countBy = async (store, index, key) => (await getDB()).countFromIndex(store, index, key)
export const getAllBy = async (store, index, key) => (await getDB()).getAllFromIndex(store, index, key)
