// Shared by the app (src/) and the Shortcut API (api/). One definition of
// categories and of what a valid transaction is.

export const INCOME_CATEGORIES = ['Freelance', 'Salary', 'Business', 'Other']
export const EXPENSE_CATEGORIES = [
  'Food', 'Travel', 'Education', 'Shopping', 'Bills', 'Health', 'Personal', 'Other',
]
export const TYPES = ['expense', 'income', 'to_receive']

export function categoriesFor(type) {
  return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
}

const MAX_AMOUNT = 1e9
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export function parseType(v) {
  const s = String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (s === 'expense') return 'expense'
  if (s === 'income') return 'income'
  if (s === 'to_receive' || s === 'toreceive' || s === 'pending') return 'to_receive'
  return null
}

// "₹1,250.50" -> 1250.5. Returns null when unusable.
export function parseAmount(v) {
  if (typeof v === 'number') return finiteAmount(v)
  const cleaned = String(v ?? '').replace(/[^\d.]/g, '')
  if (!cleaned || (cleaned.match(/\./g) || []).length > 1) return null
  return finiteAmount(Number(cleaned))
}

function finiteAmount(n) {
  if (!Number.isFinite(n)) return null
  const r = Math.round(n * 100) / 100
  return r > 0 && r <= MAX_AMOUNT ? r : null
}

const pad = (n) => String(n).padStart(2, '0')

// Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY and "15 Oct 2026". Returns YYYY-MM-DD or null.
export function parseDate(v) {
  const s = String(v ?? '').trim()
  if (!s) return null
  let y, m, d
  let t
  if ((t = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|[T\s])/.exec(s))) [y, m, d] = [t[1], t[2], t[3]]
  else if ((t = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s))) [d, m, y] = [t[1], t[2], t[3]]
  else if ((t = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/.exec(s))) {
    const mi = MONTHS.indexOf(t[2].slice(0, 3).toLowerCase())
    if (mi < 0) return null
    ;[d, m, y] = [t[1], mi + 1, t[3]]
  } else return null
  y = Number(y); m = Number(m); d = Number(d)
  const check = new Date(Date.UTC(y, m - 1, d))
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

function matchCategory(type, v) {
  const s = String(v ?? '').trim().toLowerCase()
  return categoriesFor(type).find((c) => c.toLowerCase() === s) ?? 'Other'
}

/**
 * Validate untrusted input (Shortcut query, JSON backup, inbox item) into a
 * transaction. `defaultDate` fills a missing date (YYYY-MM-DD) — the server
 * passes none and the app fills it from createdAt in local time.
 */
export function normalizeTransaction(raw, { defaultDate = null, makeId, now = new Date() } = {}) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Nothing to add.' }
  const type = parseType(raw.type)
  if (!type) return { ok: false, error: 'Type must be expense, income or to_receive.' }
  const amount = parseAmount(raw.amount)
  if (amount == null) return { ok: false, error: 'Amount must be a number above 0.' }

  const given = raw.date ? parseDate(raw.date) : null
  if (raw.date && !given) return { ok: false, error: 'Date not understood. Use YYYY-MM-DD.' }
  const givenExpected = raw.expectedDate ? parseDate(raw.expectedDate) : null
  if (raw.expectedDate && !givenExpected) return { ok: false, error: 'Expected date not understood. Use YYYY-MM-DD.' }

  const pending = type === 'to_receive'
  const created = raw.createdAt && !Number.isNaN(Date.parse(raw.createdAt)) ? new Date(raw.createdAt) : now
  const id = typeof raw.id === 'string' && /^[\w-]{6,64}$/.test(raw.id) ? raw.id : makeId ? makeId() : null
  if (!id) return { ok: false, error: 'Missing id.' }

  return {
    ok: true,
    tx: {
      id,
      type,
      amount,
      category: matchCategory(type, raw.category),
      date: pending ? null : given ?? defaultDate,
      expectedDate: pending ? givenExpected ?? given ?? defaultDate : null,
      note: String(raw.note ?? '').trim().slice(0, 200),
      status: pending ? 'pending' : 'received',
      createdAt: created.toISOString(),
    },
  }
}
