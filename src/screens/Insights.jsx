import { CategoryBars } from '../components/Breakdown.jsx'
import PeriodPill from '../components/PeriodPill.jsx'
import { AnimatedMoney, Empty } from '../components/ui.jsx'

export default function Insights({ stats, breakdown, period, setPeriod }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-semibold tracking-tight">Insights</h1>
        <PeriodPill period={period} setPeriod={setPeriod} align="right" />
      </div>
      {breakdown.length ? (
        <>
          <section className="text-center">
            <p className="text-[13px] font-medium text-muted">Total Spent</p>
            <AnimatedMoney value={stats.expenses} className="mt-1 block text-[44px] leading-none font-medium tracking-[-0.04em]" />
          </section>
          <div className="border-t border-line pt-5">
            <CategoryBars rows={breakdown} />
          </div>
        </>
      ) : (
        <Empty title="No Spending Yet" text="Expenses you add will be broken down by category here." />
      )}
    </div>
  )
}
