import { useMemo } from 'react'
import { fromKey } from '../lib/format.js'
import { currentMonth, shiftMonth } from '../lib/ledger.js'

const W = 360
const H = 120
const PAD = 16
const MONTHS = 6

// Smooth curve through points (Catmull-Rom converted to cubic Béziers).
function smooth(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`
  }
  return d
}

/** Monthly spending as a wave; tap a month to view it. */
export default function WaveChart({ txs, period, setPeriod }) {
  const now = currentMonth()
  const selected = period.mode === 'month' ? period.month : null
  // Window of 6 months ending now, shifted so a selected month is always visible.
  let end = now
  if (selected && selected > now) end = selected
  if (selected && selected < shiftMonth(now, -(MONTHS - 1))) end = shiftMonth(selected, 2)
  const months = useMemo(() => Array.from({ length: MONTHS }, (_, i) => shiftMonth(end, i - (MONTHS - 1))), [end])

  const values = useMemo(() => {
    const by = Object.fromEntries(months.map((m) => [m, 0]))
    for (const t of txs) {
      if (t.type !== 'expense') continue
      const m = t.date.slice(0, 7)
      if (m in by) by[m] += t.amount
    }
    return months.map((m) => by[m])
  }, [txs, months])

  const max = Math.max(...values)
  const step = W / MONTHS
  const pts = values.map((v, i) => [step * (i + 0.5), max ? H - PAD - (v / max) * (H - 2 * PAD) : H / 2])
  // Run the line edge to edge.
  const path = smooth([[0, pts[0][1]], ...pts, [W, pts.at(-1)[1]]])
  const dot = selected ? months.indexOf(selected) : -1

  return (
    <div className="-mx-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" role="img" aria-label="Monthly spending">
        <path key={months[0]} d={path} pathLength="1" fill="none" stroke="var(--ink)" strokeWidth="2.25" strokeLinecap="round" className="animate-draw" />
        {dot >= 0 && (
          <circle cx={pts[dot][0]} cy={pts[dot][1]} r="7" fill="var(--bg)" stroke="var(--ink)" strokeWidth="2.25" className="transition-all duration-500 ease-ios" />
        )}
      </svg>
      <div className="mt-3 grid grid-cols-6 px-0">
        {months.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setPeriod({ mode: 'month', month: m })}
            className={`press h-8 text-[13px] lowercase transition-colors ${m === selected ? 'font-semibold text-ink' : 'text-muted'}`}
          >
            {fromKey(`${m}-01`).toLocaleDateString('en-IN', { month: 'short' }).toLowerCase()}
          </button>
        ))}
      </div>
    </div>
  )
}
