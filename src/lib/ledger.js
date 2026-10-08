import { categoriesFor } from '../../shared/transaction.js'
import { toKey, todayKey } from './format.js'

// The date a transaction belongs to: when money moved, or when it's expected.
export const dateOf = (t) => (t.type === 'to_receive' ? t.expectedDate : t.date)

export function sortTransactions(list) {
  return [...list].sort(
    (a, b) => dateOf(b).localeCompare(dateOf(a)) || b.createdAt.localeCompare(a.createdAt),
  )
}

export const currentMonth = () => todayKey().slice(0, 7)

export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return toKey(d).slice(0, 7)
}

// Inclusive [start, end] date keys, or null for "All".
export function periodRange({ mode, month }) {
  const now = new Date()
  if (mode === 'today') return [todayKey(), todayKey()]
  if (mode === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7)) // Monday
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return [toKey(start), toKey(end)]
  }
  if (mode === 'month') {
    const [y, m] = month.split('-').map(Number)
    return [`${month}-01`, toKey(new Date(y, m, 0))]
  }
  return null
}

export function inPeriod(list, period) {
  const range = periodRange(period)
  if (!range) return list
  return list.filter((t) => {
    const k = dateOf(t)
    return k >= range[0] && k <= range[1]
  })
}

// Sum in paise to avoid floating-point drift.
const sum = (list) => list.reduce((s, t) => s + Math.round(t.amount * 100), 0) / 100

// Income is received money only; pending To Receive is kept separate and never counted in the balance.
export function totals(list) {
  const income = sum(list.filter((t) => t.type === 'income' && t.status === 'received'))
  const expenses = sum(list.filter((t) => t.type === 'expense'))
  const pending = list.filter((t) => t.type === 'to_receive')
  return { income, expenses, balance: Math.round((income - expenses) * 100) / 100, toReceive: sum(pending), pendingCount: pending.length }
}

export const expenseBreakdown = (list) => categoryBreakdown(list, 'expense')

// Every category (built-in or custom) of one type, largest first. Amounts sum exactly to that type's
// total in totals(). For income only received money counts; pending To Receive never does.
// pct is each category's own share rounded to a whole number, so the sum can be 99–101.
export function categoryBreakdown(list, type) {
  const by = new Map()
  for (const t of list) {
    if (t.type !== type || (type === 'income' && t.status !== 'received')) continue
    by.set(t.category, (by.get(t.category) ?? 0) + Math.round(t.amount * 100))
  }
  const rows = [...by].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const total = rows.reduce((s, [, paise]) => s + paise, 0)
  return rows.map(([category, paise]) => {
    const share = total ? paise / total : 0
    return { category, amount: paise / 100, share, pct: Math.round(share * 100) }
  })
}

// The last category used for a type, to preselect in the add sheet.
export function lastCategory(list, type) {
  let best
  for (const t of list) if (t.type === type && (!best || t.createdAt > best.createdAt)) best = t
  return best?.category
}

// Chips offered for a type: built-ins (except Other, replaced by "+ Add Category"), then custom ones.
export function categoryOptions(custom, type) {
  return [
    ...categoriesFor(type).filter((c) => c !== 'Other'),
    ...custom.filter((c) => c.type === type).map((c) => c.name),
  ]
}
