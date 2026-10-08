import Doodle, { DoodleTile } from './Doodle.jsx'
import { money } from '../lib/format.js'

export function CategoryBars({ rows }) {
  const max = rows[0]?.amount || 1
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.category} className="flex items-center gap-3.5">
          <DoodleTile name={r.category} />
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-baseline justify-between text-[15px]">
              <span className="font-medium">{r.category}</span>
              <span className="tabular-nums">
                {money(r.amount)}
                <span className="ml-2 inline-block w-9 text-right text-[12px] text-muted">{Math.round(r.share * 100)}%</span>
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-fill">
              <div
                className="h-full rounded-full bg-ink transition-[width] duration-700 ease-ios"
                style={{ width: `${Math.max(2, (r.amount / max) * 100)}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Horizontal row of "Food ₹4,500" pills. */
export function CategoryPills({ rows, onClick }) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
      {rows.map((r) => (
        <button key={r.category} type="button" onClick={onClick} className="pill press h-9 shrink-0 border-line">
          <Doodle name={r.category} size={17} />
          <span>{r.category}</span>
          <span className="tabular-nums text-muted">{money(r.amount)}</span>
        </button>
      ))}
    </div>
  )
}
