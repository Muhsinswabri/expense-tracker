// Pulls transactions added by Apple Shortcuts from the server inbox.
// IndexedDB stays the source of truth; the inbox only holds items until the app picks them up.
const TOKEN_KEY = 'ledger.shortcutKey'

export function getKey() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setKey(value) {
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable: key just isn't remembered */
  }
}

export async function fetchInbox(key) {
  const res = await fetch('/api/inbox', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' })
  if (res.status === 401) throw Object.assign(new Error('unauthorized'), { unauthorized: true })
  if (!res.ok) throw new Error(`inbox ${res.status}`)
  const data = await res.json()
  return Array.isArray(data.items) ? data.items : []
}

export async function ackInbox(key, ids) {
  if (!ids.length) return
  await fetch('/api/inbox', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
}
