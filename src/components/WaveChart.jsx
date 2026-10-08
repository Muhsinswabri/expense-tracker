import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fromKey } from '../lib/format.js'
import { currentMonth, shiftMonth } from '../lib/ledger.js'

const VISIBLE = 5 // months across the viewport; odd, so there is a true centre column
const HISTORY = 6 // at least this many months before the focus month
const AHEAD = 2 // months after the focus month
const MAX_MONTHS = 60

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

/**
 * Monthly spending as a wave; tap a month to view it.
 * The strip scrolls horizontally and keeps the focus month — the selected month,
 * otherwise the current month — in the centre of the viewport.
 */
export default function WaveChart({ txs, period, setPeriod }) {
  const now = currentMonth()
  const selected = period.mode === 'month' ? period.month : null
  const focus = selected ?? now

  // From the earliest expense (or HISTORY months back) to AHEAD months after the focus.
  const months = useMemo(() => {
    let first = shiftMonth(focus, -HISTORY)
    for (const t of txs) if (t.type === 'expense' && t.date.slice(0, 7) < first) first = t.date.slice(0, 7)
    const last = shiftMonth(focus, AHEAD)
    if (first < shiftMonth(last, -(MAX_MONTHS - 1))) first = shiftMonth(last, -(MAX_MONTHS - 1))
    const out = []
    for (let m = first; m <= last; m = shiftMonth(m, 1)) out.push(m)
    return out
  }, [txs, focus])

  const values = useMemo(() => {
    const by = Object.fromEntries(months.map((m) => [m, 0]))
    for (const t of txs) {
      if (t.type !== 'expense') continue
      const m = t.date.slice(0, 7)
      if (m in by) by[m] += t.amount
    }
    return months.map((m) => by[m])
  }, [txs, months])

  // Size everything in CSS pixels from the viewport width (same proportions as before: height = width / 3).
  const viewport = useRef(null)
  const [vw, setVw] = useState(() => Math.min(window.innerWidth, 512))
  useLayoutEffect(() => {
    const el = viewport.current
    const ro = new ResizeObserver(() => el.clientWidth && setVw(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const col = vw / VISIBLE
  const W = col * months.length
  const H = Math.round(vw / 3)
  const PAD = (vw / 360) * 16

  // Centre the focus month: instantly on first paint, smoothly after a change.
  const focusIndex = months.indexOf(focus)
  const placed = useRef(false)
  useLayoutEffect(() => {
    const el = viewport.current
    if (!el || focusIndex < 0) return
    // The browser clamps this when there aren't enough months on one side.
    el.scrollTo({ left: (focusIndex + 0.5) * col - el.clientWidth / 2, behavior: placed.current ? 'smooth' : 'instant' })
    placed.current = true
  }, [focusIndex, col])

  const max = Math.max(...values)
  const pts = values.map((v, i) => [col * (i + 0.5), max ? H - PAD - (v / max) * (H - 2 * PAD) : H / 2])
  // Run the line edge to edge.
  const path = smooth([[0, pts[0][1]], ...pts, [W, pts.at(-1)[1]]])
  const dot = selected ? months.indexOf(selected) : -1

  return (
    <div ref={viewport} className="no-scrollbar -mx-5 overflow-x-auto overscroll-x-contain sm:-mx-6">
      <div style={{ width: W }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block overflow-visible" role="img" aria-label="Monthly spending">
          <path key={months[0]} d={path} pathLength="1" fill="none" stroke="var(--ink)" strokeWidth="2.25" strokeLinecap="round" className="animate-draw" />
          {dot >= 0 && (
            <circle cx={pts[dot][0]} cy={pts[dot][1]} r="7" fill="var(--bg)" stroke="var(--ink)" strokeWidth="2.25" className="transition-all duration-500 ease-ios" />
          )}
        </svg>
        <div className="mt-3 grid" style={{ gridTemplateColumns: `repeat(${months.length}, ${col}px)` }}>
          {months.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPeriod({ mode: 'month', month: m })}
              className={`press h-8 text-[13px] transition-colors ${m === selected ? 'font-semibold text-ink' : 'text-muted'}`}
            >
              {fromKey(`${m}-01`).toLocaleDateString('en-IN', { month: 'short' })}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
