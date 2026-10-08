import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { TYPES, cleanCategoryName, normalizeTransaction } from '../shared/transaction.js'
import * as db from './lib/db.js'
import { toKey, todayKey } from './lib/format.js'
import { categoryOptions, sortTransactions } from './lib/ledger.js'
import { ackInbox, fetchInbox, getKey } from './lib/sync.js'

const Store = createContext(null)
export const useStore = () => useContext(Store)

const makeId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

function validate(raw, defaultDate = todayKey()) {
  const r = normalizeTransaction(raw, { makeId, defaultDate })
  if (!r.ok) throw new Error(r.error)
  return r.tx
}

export function StoreProvider({ children }) {
  const [txs, setTxs] = useState([])
  const [ready, setReady] = useState(false)
  const [lastAddedId, setLastAddedId] = useState(null)
  const txsRef = useRef(txs)

  // Keep the ref in step immediately so back-to-back writes see each other.
  const commit = (next) => {
    txsRef.current = sortTransactions(next)
    setTxs(txsRef.current)
  }

  // Custom categories: { id: "type:name", type, name, createdAt }.
  const [categories, setCategories] = useState([])
  const catsRef = useRef(categories)
  const commitCats = (next) => {
    catsRef.current = [...next].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    setCategories(catsRef.current)
  }

  useEffect(() => {
    Promise.all([db.getAll().then(commit), db.getCategories().then(commitCats)])
      .catch(() => {})
      .finally(() => setReady(true))
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  // Returns the saved name ("gym" -> "Gym"); throws a friendly Error when empty or a duplicate.
  const addCategory = useCallback(async (type, raw) => {
    const name = cleanCategoryName(raw)
    if (!name) throw new Error('Enter a category name.')
    if (categoryOptions(catsRef.current, type).some((c) => c.toLowerCase() === name.toLowerCase())) {
      throw new Error(`${name} already exists.`)
    }
    const rec = { id: `${type}:${name.toLowerCase()}`, type, name, createdAt: new Date().toISOString() }
    await db.putCategories([rec])
    commitCats([...catsRef.current, rec])
    return name
  }, [])

  const add = useCallback(async (input) => {
    const tx = validate(input)
    await db.put(tx)
    commit([...txsRef.current, tx])
    setLastAddedId(tx.id)
    return tx
  }, [])

  const update = useCallback(async (id, patch) => {
    const old = txsRef.current.find((t) => t.id === id)
    if (!old) throw new Error('This transaction no longer exists.')
    const tx = validate({ ...old, ...patch, id, createdAt: old.createdAt })
    await db.put(tx)
    commit(txsRef.current.map((t) => (t.id === id ? tx : t)))
    return tx
  }, [])

  const remove = useCallback(async (id) => {
    await db.remove(id)
    commit(txsRef.current.filter((t) => t.id !== id))
  }, [])

  // Pending money arrived: it becomes income dated today.
  const markReceived = useCallback(
    (id) => update(id, { type: 'income', date: todayKey(), expectedDate: null }),
    [update],
  )

  // Merges by id; existing transactions and categories are kept as they are.
  const importMany = useCallback(async (rawList, rawCategories = []) => {
    const haveCats = new Set(catsRef.current.map((c) => c.id))
    const freshCats = []
    for (const c of Array.isArray(rawCategories) ? rawCategories : []) {
      const name = cleanCategoryName(c?.name)
      const id = `${c?.type}:${name.toLowerCase()}`
      if (!name || !TYPES.includes(c?.type) || haveCats.has(id)) continue
      haveCats.add(id)
      freshCats.push({ id, type: c.type, name, createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString() })
    }
    if (freshCats.length) {
      await db.putCategories(freshCats)
      commitCats([...catsRef.current, ...freshCats])
    }

    const have = new Set(txsRef.current.map((t) => t.id))
    const fresh = []
    let skipped = 0
    for (const raw of rawList) {
      const r = normalizeTransaction(raw, { makeId, defaultDate: todayKey() })
      if (!r.ok || have.has(r.tx.id)) skipped++
      else {
        have.add(r.tx.id)
        fresh.push(r.tx)
      }
    }
    if (fresh.length) {
      await db.putMany(fresh)
      commit([...txsRef.current, ...fresh])
    }
    return { added: fresh.length, skipped }
  }, [])

  const clearAll = useCallback(async () => {
    await Promise.all([db.clear(), db.clearCategories()])
    commit([])
    commitCats([])
  }, [])

  // Returns the number of new transactions, or throws { unauthorized }.
  const syncing = useRef(false)
  const syncInbox = useCallback(async () => {
    const key = getKey()
    if (!key || syncing.current || !navigator.onLine) return 0
    syncing.current = true
    try {
      const items = await fetchInbox(key)
      if (!items.length) return 0
      const have = new Set(txsRef.current.map((t) => t.id))
      const fresh = []
      for (const raw of items) {
        // Date comes from when the Shortcut ran, in this device's time zone.
        const created = Date.parse(raw?.createdAt)
        const r = normalizeTransaction(raw, { defaultDate: toKey(Number.isNaN(created) ? new Date() : new Date(created)) })
        if (r.ok && !have.has(r.tx.id)) {
          have.add(r.tx.id)
          fresh.push(r.tx)
        }
      }
      if (fresh.length) {
        await db.putMany(fresh)
        commit([...txsRef.current, ...fresh])
        setLastAddedId(fresh.at(-1).id)
      }
      // Only acknowledge after the local write succeeded, so nothing is lost.
      await ackInbox(key, items.map((i) => i?.id).filter((id) => typeof id === 'string')).catch(() => {})
      return fresh.length
    } finally {
      syncing.current = false
    }
  }, [])

  const value = useMemo(
    () => ({ txs, categories, ready, lastAddedId, add, update, remove, markReceived, addCategory, importMany, clearAll, syncInbox }),
    [txs, categories, ready, lastAddedId, add, update, remove, markReceived, addCategory, importMany, clearAll, syncInbox],
  )
  return <Store.Provider value={value}>{children}</Store.Provider>
}
