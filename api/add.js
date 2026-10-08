// Called by Apple Shortcuts ("Get Contents of URL").
//   GET /api/add?key=…&type=expense&amount=250&category=Food&note=Lunch
// POST with a JSON body works too. Responds with one plain-text line so the
// Shortcut can show it as a notification.
import { normalizeTransaction } from '../shared/transaction.js'
import { redis, checkKey, newId, hash, SetupError, INBOX_KEY, INBOX_LIMIT } from './_lib.js'

const DUPLICATE_WINDOW_SECONDS = 30

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  const send = (status, text) => res.status(status).send(text)

  if (req.method !== 'GET' && req.method !== 'POST') return send(405, 'Use GET or POST.')
  const denied = checkKey(req)
  if (denied) return send(...denied)

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const { key: _key, ...input } = { ...req.query, ...body }
  const result = normalizeTransaction(input, { makeId: newId })
  if (!result.ok) return send(400, `Not added: ${result.error}`)
  const tx = result.tx

  // Same id, or same content within 30 s, is treated as a double submission.
  const { id: _id, createdAt: _c, ...content } = tx
  const dupKey = `dup:${typeof input.id === 'string' ? `id:${tx.id}` : hash(content)}`
  try {
    const fresh = await redis('SET', dupKey, '1', 'NX', 'EX', DUPLICATE_WINDOW_SECONDS)
    if (fresh !== 'OK') return send(409, 'Already added a moment ago. Ignored the duplicate.')

    if ((await redis('HLEN', INBOX_KEY)) >= INBOX_LIMIT) {
      await redis('DEL', dupKey)
      return send(507, 'Inbox is full. Open the app once to sync, then try again.')
    }
    await redis('HSET', INBOX_KEY, tx.id, JSON.stringify(tx))
  } catch (err) {
    // Let an immediate retry through after a failed save.
    await redis('DEL', dupKey).catch(() => {})
    if (err instanceof SetupError) return send(500, err.message)
    console.error(err)
    return send(502, 'Could not save right now. Try again in a moment.')
  }

  const label = { expense: 'expense', income: 'income', to_receive: 'to receive' }[tx.type]
  return send(200, `Added ${label}: ₹${tx.amount.toLocaleString('en-IN')} · ${tx.category}`)
}
