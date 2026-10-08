import { useMemo, useState } from 'react'
import { CategoryBars } from '../components/Breakdown.jsx'
import PeriodPill from '../components/PeriodPill.jsx'
import { AnimatedMoney, Empty, Segmented } from '../components/ui.jsx'
import { categoryBreakdown } from '../lib/ledger.js'

const VIEWS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
]
const COPY = {
  expense: { total: 'Total Expenses', breakdown: 'Expense Breakdown', empty: 'No Expenses Yet', hint: 'No expenses in this period.' },
  income: { total: 'Total Income', breakdown: 'Income Breakdown', empty: 'No Income Yet', hint: 'Pending To Receive counts once it is marked received.' },
}

/** One type at a time; everything comes from the same period-filtered transactions as Home. */
export default function Insights({ list, stats, period, setPeriod }) {
  const [view, setView] = useState('expense')
  const rows = useMemo(() => categoryBreakdown(list, view), [list, view])
  const total = view === 'expense' ? stats.expenses : stats.income
  const copy = COPY[view]
  const hasData = stats.income > 0 || stats.expenses > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold tracking-tight">Insights</h1>
        <PeriodPill period={period} setPeriod={setPeriod} align="right" />
      </div>

      <Segmented label="Insights type" options={VIEWS} value={view} onChange={setView} />

      {!hasData ? (
        <Empty title="No Data For This Period" text="Income and expenses in the selected period will appear here." />
      ) : total > 0 ? (
        <div key={view} className="space-y-8 animate-screen-in">
          <section className="text-center">
            <p className="text-[13px] font-medium text-muted">{copy.total}</p>
            <AnimatedMoney value={total} className="mt-1 block text-[44px] leading-none font-semibold tracking-[-0.04em]" />
          </section>
          <section>
            <h2 className="mb-4 text-[20px] font-semibold tracking-tight">{copy.breakdown}</h2>
            <CategoryBars rows={rows} />
          </section>
        </div>
      ) : (
        <Empty title={copy.empty} text={copy.hint} />
      )}
    </div>
  )
}
