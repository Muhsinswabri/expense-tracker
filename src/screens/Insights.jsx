import { CategoryBars } from '../components/Breakdown.jsx'
import PeriodPill from '../components/PeriodPill.jsx'
import { AnimatedMoney, Empty } from '../components/ui.jsx'

function Card({ label, value, emptyText }) {
  return (
    <div className="min-w-0 rounded-[20px] bg-fill p-4">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      {value > 0 ? (
        <AnimatedMoney value={value} className="mt-1 block truncate text-[20px] font-semibold tracking-tight" />
      ) : (
        <p className="mt-1 text-[15px] font-medium text-muted">{emptyText}</p>
      )}
    </div>
  )
}

// Two bars on one scale: the larger amount is full width, the other is proportional.
function Compare({ income, expenses }) {
  const max = Math.max(income, expenses)
  const rows = [
    { label: 'Income', value: income, bar: 'bg-ink', empty: 'No Income Yet' },
    { label: 'Expenses', value: expenses, bar: 'bg-muted', empty: 'No Expenses Yet' },
  ]
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between text-[15px]">
            <span className="font-medium">{r.label}</span>
            {r.value > 0 ? <AnimatedMoney value={r.value} className="font-medium" /> : <span className="text-muted">{r.empty}</span>}
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-fill">
            {r.value > 0 && (
              <div
                className={`h-full rounded-full ${r.bar} transition-[width] duration-700 ease-ios`}
                style={{ width: `${Math.max(1, (r.value / max) * 100)}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="mb-4 text-[20px] font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

/** Everything here comes from the same period-filtered transactions as Home and Transactions. */
export default function Insights({ stats, breakdown, period, setPeriod }) {
  const { income, expenses, balance } = stats
  const hasData = income > 0 || expenses > 0

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold tracking-tight">Insights</h1>
        <PeriodPill period={period} setPeriod={setPeriod} align="right" />
      </div>

      {hasData ? (
        <div className="space-y-8 animate-screen-in">
          <section className="space-y-3">
            <div className="text-center">
              <p className="text-[13px] font-medium text-muted">Net</p>
              <AnimatedMoney value={balance} className="mt-1 block text-[44px] leading-none font-semibold tracking-[-0.04em]" />
              <p className="mt-2 text-[13px] text-muted">Income − Expenses</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3">
              <Card label="Income" value={income} emptyText="No Income Yet" />
              <Card label="Expenses" value={expenses} emptyText="No Expenses Yet" />
            </div>
          </section>

          <Section title="Income vs Expenses">
            <Compare income={income} expenses={expenses} />
          </Section>

          <Section title="Expense Breakdown">
            {breakdown.length ? (
              <CategoryBars rows={breakdown} />
            ) : (
              <p className="rounded-[20px] bg-fill py-6 text-center text-[15px] text-muted">No Expenses Yet</p>
            )}
          </Section>
        </div>
      ) : (
        <Empty title="No Data For This Period" text="Income and expenses in the selected period will appear here." />
      )}
    </div>
  )
}
