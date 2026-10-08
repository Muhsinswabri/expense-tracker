import { todayKey } from './format.js'
import { sortTransactions } from './ledger.js'

const COLUMNS = ['id', 'type', 'status', 'amount', 'category', 'date', 'expectedDate', 'note', 'createdAt']

export function toJSON(list) {
  return JSON.stringify({ app: 'ledger', version: 1, exportedAt: new Date().toISOString(), transactions: sortTransactions(list) }, null, 2)
}

function csvCell(v) {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@]/.test(s) && typeof v === 'string') s = `'${s}` // spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(list) {
  const rows = sortTransactions(list).map((t) => COLUMNS.map((c) => csvCell(t[c])).join(','))
  return [COLUMNS.join(','), ...rows].join('\r\n')
}

// Share sheet on iPhone (Save to Files), plain download elsewhere.
export async function saveFile(text, ext, mime) {
  const name = `ledger-${todayKey()}.${ext}`
  const file = new File([text], name, { type: mime })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      if (err?.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Accepts this app's export or a bare array of transactions.
export function readBackup(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("This file isn't a valid backup.")
  }
  const list = Array.isArray(data) ? data : data?.transactions
  if (!Array.isArray(list)) throw new Error("This file isn't a valid backup.")
  return list
}
