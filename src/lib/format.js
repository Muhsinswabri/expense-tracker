const pad = (n) => String(n).padStart(2, '0')

export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayKey = () => toKey(new Date())
export const fromKey = (k) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function money(n, { sign } = {}) {
  const abs = Math.abs(n)
  const text = abs.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(abs) ? 0 : 2,
    maximumFractionDigits: 2,
  })
  const prefix = sign === '+' ? '+' : sign === '-' ? '−' : n < 0 ? '−' : ''
  return `${prefix}₹${text}`
}

export function dayLabel(key) {
  const today = todayKey()
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (key === today) return 'Today'
  if (key === toKey(y)) return 'Yesterday'
  const d = fromKey(key)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export const shortDate = (key) =>
  fromKey(key).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function greeting(h = new Date().getHours()) {
  if (h < 5) return 'Good night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
