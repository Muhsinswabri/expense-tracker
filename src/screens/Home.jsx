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
      <span className="text-[12px] text-muted">{label}</span>
      <AnimatedMoney value={value} className="mt-0.5 text-[15px] font-medium" />
    </Tag>
  )
}

export default function Home({ txs, list, stats, breakdown, period, setPeriod, lastAddedId, onOpen, onReceive, goTo }) {
  const recent = list.slice(0, RECENT)
  return (
    <div className="space-y-7 pt-4">
      <section className="flex flex-col items-center">
        <PeriodPill period={period} setPeriod={setPeriod} />
        <AnimatedMoney value={stats.balance} className="mt-4 text-[52px] leading-none font-medium tracking-[-0.04em]" />
        <p className="mt-2 text-[13px] text-muted">available balance</p>
        <div className="mt-5 grid w-full grid-cols-3">
          <Stat label="income" value={stats.income} />
          <Stat label="expenses" value={stats.expenses} />
          <Stat label={stats.pendingCount ? `to receive · ${stats.pendingCount}` : 'to receive'} value={stats.toReceive} onClick={() => goTo('transactions', 'to_receive')} />
        </div>
      </section>

      <WaveChart txs={txs} period={period} setPeriod={setPeriod} />

      {breakdown.length > 0 && <CategoryPills rows={breakdown} onClick={() => goTo('insights')} />}

      <section className="space-y-5">
        {recent.length ? (
          byDay(recent, dateOf).map((g) => (
            <DayGroup key={g.day} {...g} lastAddedId={lastAddedId} onOpen={onOpen} onReceive={onReceive} />
          ))
        ) : (
          <Empty emoji="🌱" title="Nothing here yet" text="Start by adding your first income or expense." />
        )}
        {list.length > RECENT && (
          <button type="button" onClick={() => goTo('transactions')} className="pill press mx-auto flex">
            see all {list.length}
          </button>
        )}
      </section>
    </div>
  )
}
