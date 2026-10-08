import PeriodPill from '../components/PeriodPill.jsx'
import { DayGroup, byDay } from '../components/TransactionRow.jsx'
import { Empty, Pills } from '../components/ui.jsx'
import { dateOf } from '../lib/ledger.js'

const KINDS = [
  { value: 'all', label: 'all' },
  { value: 'income', label: 'income' },
  { value: 'expense', label: 'expenses' },
  { value: 'to_receive', label: 'to receive' },
]

export default function Transactions({ list, period, setPeriod, kind, setKind, lastAddedId, onOpen, onReceive }) {
  const shown = kind === 'all' ? list : list.filter((t) => t.type === kind)
  return (
    <div className="space-y-5 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold tracking-tight">transactions</h1>
        <PeriodPill period={period} setPeriod={setPeriod} align="right" />
      </div>
      <Pills options={KINDS} value={kind} onChange={setKind} className="no-scrollbar -mx-4 overflow-x-auto px-4" />

      {shown.length ? (
        <div className="space-y-5">
          {byDay(shown, dateOf).map((g) => (
            <DayGroup key={g.day} {...g} lastAddedId={lastAddedId} onOpen={onOpen} onReceive={onReceive} />
          ))}
        </div>
      ) : (
        <Empty
          emoji="🗂️"
          title="Nothing here yet"
          text={list.length ? 'No transactions match this filter.' : 'Start by adding your first income or expense.'}
        />
      )}
    </div>
  )
}
