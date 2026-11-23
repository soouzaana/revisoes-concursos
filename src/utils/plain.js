/** Cópia simples (sem proxies reativos do Vue) — o IndexedDB não aceita proxies. */
export const plain = (o) => JSON.parse(JSON.stringify(o))
