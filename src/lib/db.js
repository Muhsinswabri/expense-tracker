// Minimal IndexedDB wrapper. One store, keyed by transaction id.
const DB_NAME = 'ledger'
const STORE = 'transactions'

let dbPromise
function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function run(mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const result = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(result?.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const getAll = () => run('readonly', (s) => s.getAll())
export const put = (t) => run('readwrite', (s) => void s.put(t))
export const putMany = (list) => run('readwrite', (s) => void list.forEach((t) => s.put(t)))
export const remove = (id) => run('readwrite', (s) => void s.delete(id))
export const clear = () => run('readwrite', (s) => void s.clear())
