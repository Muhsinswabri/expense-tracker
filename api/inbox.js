// The app drains Shortcut-added transactions from here into IndexedDB.
//   GET    -> { items: [...] }
//   DELETE { ids: [...] } -> removes items the app has stored
import { redis, checkKey, SetupError, INBOX_KEY } from './_lib.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const denied = checkKey(req)
  if (denied) return res.status(denied[0]).json({ error: denied[1] })

  try {
    if (req.method === 'GET') {
      const flat = (await redis('HGETALL', INBOX_KEY)) || []
      const items = []
      for (let i = 1; i < flat.length; i += 2) {
        try {
          items.push(JSON.parse(flat[i]))
        } catch {
          items.push({ id: flat[i - 1], corrupt: true })
        }
      }
      return res.status(200).json({ items })
    }
    if (req.method === 'DELETE') {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string') : []
      if (ids.length) await redis('HDEL', INBOX_KEY, ...ids)
      return res.status(200).json({ ok: true })
    }
    return res.status(405).json({ error: 'Method not allowed.' })
  } catch (err) {
    if (err instanceof SetupError) return res.status(500).json({ error: err.message })
    console.error(err)
    return res.status(502).json({ error: 'Storage unavailable.' })
  }
}
