import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChartColumn, House, Plus, ReceiptText, Settings as SettingsIcon } from 'lucide-react'
import Settings from './components/Settings.jsx'
import Sheet from './components/Sheet.jsx'
import TransactionForm from './components/TransactionForm.jsx'
import { useToast } from './components/ui.jsx'
import { money } from './lib/format.js'
import { currentMonth, expenseBreakdown, inPeriod, totals } from './lib/ledger.js'
import Home from './screens/Home.jsx'
import Insights from './screens/Insights.jsx'
import Transactions from './screens/Transactions.jsx'
import { useStore } from './store.jsx'

const TABS = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'transactions', label: 'Transactions', icon: ReceiptText },
  { id: 'add' },
  { id: 'insights', label: 'Insights', icon: ChartColumn },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

export default function App() {
  const { txs, ready, lastAddedId, markReceived, syncInbox } = useStore()
  const toast = useToast()
  const [tab, setTab] = useState('home')
  const [kind, setKind] = useState('all')
  const [period, setPeriod] = useState(() => ({ mode: 'month', month: currentMonth() }))
  // The sheet's content stays mounted while it animates closed.
  const [sheet, setSheet] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const list = useMemo(() => inPeriod(txs, period), [txs, period])
  const stats = useMemo(() => totals(list), [list])
  const breakdown = useMemo(() => expenseBreakdown(list), [list])

  const openSheet = (s) => {
    setSheet({ ...s, key: Date.now() })
    setSheetOpen(true)
  }
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  const onAdd = (type = 'expense') => openSheet({ kind: 'add', type })
  const onOpen = (tx) => openSheet({ kind: 'edit', tx })
  const onReceive = async (tx) => {
    try {
      await markReceived(tx.id)
      toast(`received ${money(tx.amount)}`)
    } catch {
      toast("Couldn't update. Please try again.", 'error')
    }
  }
  const goTo = (t, k = 'all') => {
    setKind(k)
    setTab(t)
  }

  // Pick up Shortcut-added transactions whenever the app comes to the foreground.
  useEffect(() => {
    if (!ready) return
    const sync = () =>
      syncInbox()
        .then((n) => n && toast(`added ${n} from shortcuts`))
        .catch(() => {})
    const onVisible = () => document.visibilityState === 'visible' && sync()
    sync()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', sync)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', sync)
    }
  }, [ready, syncInbox, toast])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  if (!ready) return null

  const shared = { list, period, setPeriod, lastAddedId, onOpen, onReceive }
  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pt-safe pb-[calc(env(safe-area-inset-bottom)+96px)]">
      <main key={tab} className="animate-screen-in">
        {tab === 'home' && <Home {...shared} txs={txs} stats={stats} breakdown={breakdown} goTo={goTo} />}
        {tab === 'transactions' && <Transactions {...shared} kind={kind} setKind={setKind} />}
        {tab === 'insights' && <Insights stats={stats} breakdown={breakdown} period={period} setPeriod={setPeriod} />}
      </main>

      <nav className="blur-bar fixed inset-x-0 bottom-0 z-40 pb-safe">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-3">
          {TABS.map((t) =>
            t.id === 'add' ? (
              <div key="add" className="grid place-items-center">
                <button
                  type="button"
                  aria-label="Add transaction"
                  onClick={() => onAdd()}
                  className="press grid size-12 place-items-center rounded-full bg-ink text-bg"
                >
                  <Plus size={24} strokeWidth={2} />
                </button>
              </div>
            ) : (
              <button
                key={t.id}
                type="button"
                aria-label={t.label}
                onClick={() => (t.id === 'settings' ? openSheet({ kind: 'settings' }) : goTo(t.id, t.id === tab ? kind : 'all'))}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`press grid h-full place-items-center transition-colors ${tab === t.id ? 'text-ink' : 'text-muted'}`}
              >
                <t.icon size={22} strokeWidth={tab === t.id ? 2 : 1.6} />
              </button>
            ),
          )}
        </div>
      </nav>

      <Sheet open={sheetOpen} onClose={closeSheet} title={sheet?.kind === 'settings' ? 'settings' : undefined}>
        {sheet?.kind === 'settings' && <Settings />}
        {sheet?.kind === 'add' && <TransactionForm key={sheet.key} initialType={sheet.type} onDone={closeSheet} />}
        {sheet?.kind === 'edit' && <TransactionForm key={sheet.key} tx={sheet.tx} onDone={closeSheet} />}
      </Sheet>
    </div>
  )
}
