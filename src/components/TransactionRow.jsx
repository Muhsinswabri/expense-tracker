import { DoodleTile } from './Doodle.jsx'
import { dayLabel, money, shortDate } from '../lib/format.js'

export default function TransactionRow({ tx, highlight, onOpen, onReceive }) {
  const pending = tx.type === 'to_receive'
  const sub = [pending && `Expected ${shortDate(tx.expectedDate)}`, tx.note].filter(Boolean).join(' · ')

  return (
    <div className={`flex items-center gap-2 ${highlight ? 'animate-row-in' : ''}`}>
      <button type="button" onClick={() => onOpen(tx)} className="flex min-w-0 flex-1 items-center gap-3.5 py-2.5 text-left active:opacity-50">
        <DoodleTile name={tx.category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium">{tx.category}</span>
          {sub && <span className="block truncate text-[12px] text-muted">{sub}</span>}
        </span>
        {!pending && (
          <span className="shrink-0 text-[16px] font-medium tabular-nums">
            {money(tx.amount, { sign: tx.type === 'expense' ? '-' : '+' })}
          </span>
        )}
      </button>
      {pending && (
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[16px] font-medium tabular-nums text-muted">{money(tx.amount, { sign: '+' })}</span>
          <button type="button" onClick={() => onReceive(tx)} className="pill press h-6 border-ink px-2.5 text-[11px]">
            Mark Received
          </button>
        </div>
      )}
    </div>
  )
}

/** "today ........ -₹308.89" header with a hairline, then the day's rows. */
export function DayGroup({ day, items, lastAddedId, onOpen, onReceive }) {
  const net = items.reduce((s, t) => s + (t.type === 'expense' ? -1 : t.type === 'income' ? 1 : 0) * Math.round(t.amount * 100), 0) / 100
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-line pb-1.5 text-[12px] text-muted">
        <span>{dayLabel(day)}</span>
        {net !== 0 && <span className="tabular-nums">{money(net, { sign: net < 0 ? '-' : '+' })}</span>}
      </div>
      <div className="pt-1">
        {items.map((t) => (
          <TransactionRow key={t.id} tx={t} highlight={t.id === lastAddedId} onOpen={onOpen} onReceive={onReceive} />
        ))}
      </div>
    </section>
  )
}

/** Group a sorted list into days. */
export function byDay(list, dateOf) {
  const groups = []
  for (const t of list) {
    const day = dateOf(t)
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] })
    groups.at(-1).items.push(t)
  }
  return groups
}
