import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChartColumn, House, ReceiptText, Settings as SettingsIcon } from 'lucide-react'
import Settings from './components/Settings.jsx'
import Sheet from './components/Sheet.jsx'
import TransactionForm from './components/TransactionForm.jsx'
import { Confirm, useToast } from './components/ui.jsx'
import { money } from './lib/format.js'
import { currentMonth, expenseBreakdown, inPeriod, totals } from './lib/ledger.js'
import Home from './screens/Home.jsx'
import Insights from './screens/Insights.jsx'
import Transactions from './screens/Transactions.jsx'
import { useStore } from './store.jsx'

const TABS = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'transactions', label: 'Transactions', icon: ReceiptText },
  { id: 'insights', label: 'Insights', icon: ChartColumn },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]
const ACTIONS = [
  { type: 'expense', label: 'Expense', style: 'bg-ink text-bg' },
  { type: 'income', label: 'Income', style: 'border border-ink bg-bg' },
  { type: 'to_receive', label: 'Receive', style: 'border border-line bg-bg' },
]

/*
 * Navigation lives in browser history so the device/browser back button works:
 * each tab change and each opened sheet is one history entry. Closing a sheet
 * from the UI goes back one entry; back with unsaved changes asks first.
 */
export default function App() {
  const { txs, ready, lastAddedId, markReceived, syncInbox } = useStore()
  const toast = useToast()
  const [view, setView] = useState({ tab: 'home', kind: 'all' })
  const [period, setPeriod] = useState(() => ({ mode: 'month', month: currentMonth() }))
  // The sheet's content stays mounted while it animates closed.
  const [sheet, setSheet] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [askDiscard, setAskDiscard] = useState(false)
  const sheetOpenRef = useRef(false)
  const dirty = useRef(false)
  const restoreScroll = useRef(null)

  const list = useMemo(() => inPeriod(txs, period), [txs, period])
  const stats = useMemo(() => totals(list), [list])
  const breakdown = useMemo(() => expenseBreakdown(list), [list])

  useEffect(() => {
    history.scrollRestoration = 'manual'
    history.replaceState({ tab: 'home', kind: 'all', scroll: 0 }, '')
    const onPop = (e) => {
      const s = e.state ?? { tab: 'home', kind: 'all', scroll: 0 }
      if (sheetOpenRef.current) {
        if (dirty.current) {
          // Undo the back, keep the sheet, and ask.
          history.pushState({ ...s, sheet: true }, '')
          setAskDiscard(true)
          return
        }
        sheetOpenRef.current = false
        setSheetOpen(false)
        return
      }
      if (s.sheet) return history.back() // forward into a sheet that's already closed
      restoreScroll.current = s.scroll ?? 0
      setView({ tab: s.tab, kind: s.kind })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useLayoutEffect(() => {
    window.scrollTo(0, restoreScroll.current ?? 0)
    restoreScroll.current = null
  }, [view.tab])

  const goTo = (tab, kind = 'all') => {
    if (tab === view.tab && kind === view.kind) return
    history.replaceState({ ...history.state, scroll: window.scrollY }, '')
    history.pushState({ tab, kind, scroll: 0 }, '')
    setView({ tab, kind })
  }
  const setKind = (kind) => {
    history.replaceState({ ...history.state, kind }, '')
    setView((v) => ({ ...v, kind }))
  }

  const openSheet = (s) => {
    if (sheetOpenRef.current) return
    dirty.current = false
    sheetOpenRef.current = true
    history.pushState({ ...history.state, sheet: true }, '')
    setSheet({ ...s, key: Date.now() })
    setSheetOpen(true)
  }
  // From the UI (close button, swipe, scrim, Esc). `force` skips the unsaved-changes check.
  const closeSheet = useCallback((force) => {
    if (!sheetOpenRef.current) return
    if (dirty.current && force !== true) return setAskDiscard(true)
    dirty.current = false
    history.back()
  }, [])
  const done = useCallback(() => closeSheet(true), [closeSheet])
  const onDirty = useCallback((d) => {
    dirty.current = d
  }, [])

  const onAdd = (type) => openSheet({ kind: 'add', type })
  const onOpen = (tx) => openSheet({ kind: 'edit', tx })
  const onReceive = async (tx) => {
    try {
      await markReceived(tx.id)
      toast(`Received ${money(tx.amount)}`)
    } catch {
      toast("Couldn't update. Please try again.", 'error')
    }
  }

  // Pick up Shortcut-added transactions whenever the app comes to the foreground.
  useEffect(() => {
    if (!ready) return
    const sync = () =>
      syncInbox()
        .then((n) => n && toast(`Added ${n} from Shortcuts`))
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

  if (!ready) return null

  const { tab, kind } = view
  const shared = { list, period, setPeriod, lastAddedId, onOpen, onReceive }
  return (
    // Bottom padding clears the nav (58px) + floating actions (44px) + gaps, plus the home indicator.
    <div
      className={`mx-auto min-h-dvh max-w-lg px-5 pb-[calc(env(safe-area-inset-bottom)+140px)] sm:px-6 ${
        tab === 'home' ? '' : 'pt-[calc(env(safe-area-inset-top)+12px)]' // Home's sticky header handles the top itself
      }`}
    >
      <main key={tab} className="animate-screen-in">
        {tab === 'home' && <Home {...shared} txs={txs} stats={stats} breakdown={breakdown} goTo={goTo} />}
        {tab === 'transactions' && <Transactions {...shared} kind={kind} setKind={setKind} />}
        {tab === 'insights' && <Insights list={list} stats={stats} period={period} setPeriod={setPeriod} />}
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+70px)] z-40">
        <div className="pointer-events-auto mx-auto grid max-w-lg grid-cols-3 gap-2 px-5 sm:px-6">
          {ACTIONS.map((a) => (
            <button
              key={a.type}
              type="button"
              onClick={() => onAdd(a.type)}
              className={`press h-11 min-w-0 truncate rounded-full px-2 text-[14px] font-semibold whitespace-nowrap shadow-[0_6px_18px_rgba(0,0,0,0.12)] min-[380px]:text-[15px] ${a.style}`}
            >
              + {a.label}
            </button>
          ))}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
        <div className="mx-auto max-w-lg px-5 sm:px-6">
          <div className="grid h-[58px] grid-cols-4">
            {TABS.map((t) => {
              const on = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => (t.id === 'settings' ? openSheet({ kind: 'settings' }) : goTo(t.id, on ? kind : 'all'))}
                  aria-current={on ? 'page' : undefined}
                  className={`press flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${on ? 'text-ink' : 'text-muted'}`}
                >
                  <t.icon size={22} strokeWidth={on ? 2.1 : 1.7} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      <Sheet open={sheetOpen} onClose={closeSheet} title={sheet?.kind === 'settings' ? 'Settings' : undefined}>
        {sheet?.kind === 'settings' && <Settings />}
        {sheet?.kind === 'add' && (
          <TransactionForm key={sheet.key} initialType={sheet.type} onDone={done} onClose={closeSheet} onDirty={onDirty} />
        )}
        {sheet?.kind === 'edit' && <TransactionForm key={sheet.key} tx={sheet.tx} onDone={done} onClose={closeSheet} onDirty={onDirty} />}
      </Sheet>

      <Confirm
        open={askDiscard}
        title="Discard Changes?"
        message="You have unsaved changes."
        confirmLabel="Discard"
        onCancel={() => setAskDiscard(false)}
        onConfirm={() => {
          setAskDiscard(false)
          closeSheet(true)
        }}
      />
    </div>
  )
}
