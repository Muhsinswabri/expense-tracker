// Minimal IndexedDB wrapper. Transactions keyed by id; custom categories keyed by "type:name".
const DB_NAME = 'ledger'
const TX = 'transactions'
const CATS = 'categories'

let dbPromise
function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2)
    req.onupgradeneeded = (e) => {
      const db = req.result
      if (e.oldVersion < 1) db.createObjectStore(TX, { keyPath: 'id' })
      if (e.oldVersion < 2) db.createObjectStore(CATS, { keyPath: 'id' })
    }
    req.onsuccess = () => {
      // Let a newer version (another tab after an update) upgrade instead of blocking.
      req.result.onversionchange = () => req.result.close()
      resolve(req.result)
    }
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function run(store, mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const result = fn(tx.objectStore(store))
    tx.oncomplete = () => resolve(result?.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export const getAll = () => run(TX, 'readonly', (s) => s.getAll())
export const put = (t) => run(TX, 'readwrite', (s) => void s.put(t))
export const putMany = (list) => run(TX, 'readwrite', (s) => void list.forEach((t) => s.put(t)))
export const remove = (id) => run(TX, 'readwrite', (s) => void s.delete(id))
export const clear = () => run(TX, 'readwrite', (s) => void s.clear())

export const getCategories = () => run(CATS, 'readonly', (s) => s.getAll())
export const putCategories = (list) => run(CATS, 'readwrite', (s) => void list.forEach((c) => s.put(c)))
export const clearCategories = () => run(CATS, 'readwrite', (s) => void s.clear())
