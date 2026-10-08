import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { monthLabel } from '../lib/format.js'
import { currentMonth } from '../lib/ledger.js'

const MODES = [
  { mode: 'today', label: 'today' },
  { mode: 'week', label: 'this week' },
  { mode: 'month', label: 'this month' },
  { mode: 'all', label: 'all time' },
]

export function periodLabel({ mode, month }) {
  if (mode === 'month' && month !== currentMonth()) return monthLabel(month).toLowerCase()
  return MODES.find((m) => m.mode === mode).label
}

/** "this month ⌄" pill with a small menu: today / week / month / all, or any month. */
export default function PeriodPill({ period, setPeriod, align = 'center' }) {
  const [open, setOpen] = useState(false)
  const pick = (next) => {
    setPeriod(next)
    setOpen(false)
  }
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="pill press" aria-haspopup="menu" aria-expanded={open}>
        {periodLabel(period)}
        <ChevronDown size={14} strokeWidth={2} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className={`absolute top-10 z-40 w-48 overflow-hidden ${align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'} rounded-[18px] border border-line bg-bg py-1 shadow-[0_12px_40px_rgba(0,0,0,0.12)] animate-pop-in`}
          >
            {MODES.map((m) => {
              const on = period.mode === m.mode && (m.mode !== 'month' || period.month === currentMonth())
              return (
                <button
                  key={m.mode}
                  type="button"
                  role="menuitem"
                  onClick={() => pick({ mode: m.mode, month: currentMonth() })}
                  className="flex h-11 w-full items-center justify-between px-4 text-[15px] active:bg-fill"
                >
                  {m.label}
                  {on && <Check size={16} />}
                </button>
              )
            })}
            <label className="relative flex h-11 w-full items-center justify-between border-t border-line px-4 text-[15px] text-muted active:bg-fill">
              pick a month…
              <input
                type="month"
                aria-label="Pick a month"
                value={period.month}
                onChange={(e) => e.target.value && pick({ mode: 'month', month: e.target.value })}
                className="absolute inset-0 opacity-0"
              />
            </label>
          </div>
        </>
      )}
    </div>
  )
}
