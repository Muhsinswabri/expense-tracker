// Helpers for the Shortcut API. Files starting with "_" are not routes on Vercel.
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto'

export const INBOX_KEY = 'inbox'
export const INBOX_LIMIT = 500

// Upstash Redis REST. Vercel's Upstash integration sets KV_REST_API_*;
// a direct Upstash database sets UPSTASH_REDIS_REST_*.
export async function redis(...command) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) throw new SetupError('Storage is not connected. Add an Upstash Redis store in Vercel.')
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) throw new Error(`redis ${command[0]} failed: ${data.error || res.status}`)
  return data.result
}

export class SetupError extends Error {}

// Returns null when authorised, otherwise [status, message].
export function checkKey(req) {
  const expected = process.env.SHORTCUT_TOKEN
  if (!expected) return [500, 'Server not set up: SHORTCUT_TOKEN is missing.']
  const header = req.headers.authorization || ''
  const given = header.startsWith('Bearer ') ? header.slice(7) : String(req.query?.key ?? req.body?.key ?? '')
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b) ? null : [401, 'Wrong key.']
}

export const newId = () => randomUUID()

export function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32)
}
