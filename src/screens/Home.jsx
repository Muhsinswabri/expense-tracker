import { CategoryPills } from '../components/Breakdown.jsx'
import PeriodPill from '../components/PeriodPill.jsx'
import { DayGroup, byDay } from '../components/TransactionRow.jsx'
import { AnimatedMoney, Empty } from '../components/ui.jsx'
import WaveChart from '../components/WaveChart.jsx'
import { dateOf } from '../lib/ledger.js'

const RECENT = 8

function Stat({ label, value, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`flex flex-col items-center ${onClick ? 'press' : ''}`}>
      <span className="text-[12px] font-medium text-muted">{label}</span>
      <AnimatedMoney value={value} className="mt-0.5 text-[16px] font-semibold" />
    </Tag>
  )
}

function Heading({ children, action, onAction }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[20px] font-semibold tracking-tight">{children}</h2>
      {action && (
        <button type="button" onClick={onAction} className="press text-[15px] text-muted">
          {action}
        </button>
      )}
    </div>
  )
}

export default function Home({ txs, list, stats, breakdown, period, setPeriod, lastAddedId, onOpen, onReceive, goTo }) {
  const recent = list.slice(0, RECENT)
  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="size-8 rounded-[9px]" onError={(e) => (e.currentTarget.style.display = 'none')} />
          <span className="text-[20px] font-semibold tracking-tight">Chelaveee</span>
        </div>
        <PeriodPill period={period} setPeriod={setPeriod} align="right" />
      </header>

      <section className="flex flex-col items-center">
        <p className="text-[13px] font-medium text-muted">Available Balance</p>
        <AnimatedMoney value={stats.balance} className="mt-2 text-[48px] leading-none font-semibold tracking-[-0.04em]" />
        <div className="mt-6 grid w-full grid-cols-3 divide-x divide-line">
          <Stat label="Total Income" value={stats.income} />
          <Stat label="Total Expenses" value={stats.expenses} />
          <Stat label={stats.pendingCount ? `To Receive · ${stats.pendingCount}` : 'To Receive'} value={stats.toReceive} onClick={() => goTo('transactions', 'to_receive')} />
        </div>
      </section>

      <WaveChart txs={txs} period={period} setPeriod={setPeriod} />

      {breakdown.length > 0 && (
        <section>
          <Heading action="See All" onAction={() => goTo('insights')}>
            Expenses by Category
          </Heading>
          <CategoryPills rows={breakdown} onClick={() => goTo('insights')} />
        </section>
      )}

      <section>
        <Heading action={list.length > RECENT ? 'See All' : null} onAction={() => goTo('transactions')}>
          Recent Transactions
        </Heading>
        {recent.length ? (
          <div className="space-y-5">
            {byDay(recent, dateOf).map((g) => (
              <DayGroup key={g.day} {...g} lastAddedId={lastAddedId} onOpen={onOpen} onReceive={onReceive} />
            ))}
          </div>
        ) : (
          <Empty emoji="🌱" title="Nothing Here Yet" text="Start by adding your first income or expense." />
        )}
      </section>
    </div>
  )
}
