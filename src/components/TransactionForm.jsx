import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Delete, Trash2 } from 'lucide-react'
import { categoriesFor, parseAmount } from '../../shared/transaction.js'
import { emojiFor } from '../lib/categories.js'
import { fromKey, money, toKey, todayKey } from '../lib/format.js'
import { lastCategory } from '../lib/ledger.js'
import { useStore } from '../store.jsx'
import { Confirm, Pills, useToast } from './ui.jsx'

const TYPES = [
  { value: 'expense', label: 'expense' },
  { value: 'income', label: 'income' },
  { value: 'to_receive', label: 'to receive' },
]
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0']

// Digits with at most one dot and two decimals.
function cleanAmount(s) {
  let [int = '', ...rest] = s.replace(/[^\d.]/g, '').split('.')
  int = int.replace(/^0+(?=\d)/, '').slice(0, 10)
  return rest.length ? `${int || '0'}.${rest.join('').slice(0, 2)}` : int
}

function displayAmount(a) {
  if (!a) return '0'
  const [i, d] = a.split('.')
  return Number(i || 0).toLocaleString('en-IN') + (a.includes('.') ? `.${d}` : '')
}

const addDays = (key, n) => {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

/** Horizontally scrolling day picker; the selected day sits in the middle. */
function DateStrip({ value, onChange, future }) {
  const today = todayKey()
  const days = useMemo(() => {
    let start = addDays(today, -60)
    let end = addDays(today, future ? 180 : 7)
    if (value < start) start = addDays(value, -3)
    if (value > end) end = addDays(value, 3)
    const out = []
    for (let k = start; k <= end; k = addDays(k, 1)) out.push(k)
    return out
  }, [today, future, value])
  const strip = useRef(null)

  useLayoutEffect(() => {
    const el = strip.current?.querySelector('[aria-pressed="true"]')
    if (!el) return
    const c = strip.current
    c.scrollTo({ left: el.offsetLeft - (c.clientWidth - el.offsetWidth) / 2, behavior: c.dataset.ready ? 'smooth' : 'instant' })
    c.dataset.ready = '1'
  }, [value])

  const sel = fromKey(value)
  return (
    <div>
      <label className="relative mx-auto flex w-fit items-center gap-1 text-[13px] text-muted">
        {sel.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }).toLowerCase()}
        <ChevronDown size={13} />
        <input
          type="date"
          aria-label="Pick a date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 opacity-0"
        />
      </label>
      <div ref={strip} className="no-scrollbar -mx-5 mt-2 flex snap-x overflow-x-auto px-5">
        {days.map((k) => {
          const d = fromKey(k)
          const on = k === value
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              aria-label={d.toDateString()}
              onClick={() => onChange(k)}
              className="flex w-1/5 shrink-0 snap-center justify-center"
            >
              <span
                className={`flex h-14 w-12 flex-col items-center justify-center rounded-[14px] transition-colors duration-200 ${
                  on ? 'bg-ink text-bg' : k === today ? 'text-ink' : 'text-muted'
                }`}
              >
                <span className="text-[17px] leading-tight font-medium tabular-nums">{d.getDate()}</span>
                <span className="text-[10px] lowercase">{k === today ? 'today' : d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Add (initialType) or edit (tx) a transaction. Remount with a new key for a fresh form. */
export default function TransactionForm({ tx, initialType = 'expense', onDone }) {
  const { txs, add, update, remove, markReceived } = useStore()
  const toast = useToast()
  const editing = Boolean(tx)
  const pick = (t) => lastCategory(txs, t) ?? categoriesFor(t)[0]

  const [type, setType] = useState(tx?.type ?? initialType)
  const [amount, setAmount] = useState(tx ? String(tx.amount) : '')
  const [category, setCategory] = useState(tx?.category ?? pick(initialType))
  const [date, setDate] = useState((tx?.type === 'to_receive' ? tx.expectedDate : tx?.date) ?? todayKey())
  const [note, setNote] = useState(tx?.note ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const busy = useRef(false)

  const value = parseAmount(amount)
  const pending = type === 'to_receive'

  const changeType = (t) => {
    setType(t)
    if (!categoriesFor(t).includes(category)) setCategory(pick(t))
  }
  const press = (k) => setAmount((a) => (k === 'back' ? a.slice(0, -1) : cleanAmount(a + k)))

  // One write at a time; ignores double taps.
  const guard = (fn) => async (e) => {
    e?.preventDefault()
    if (busy.current) return
    busy.current = true
    try {
      await fn()
    } catch (err) {
      // Our validation errors are plain Errors with friendly text; hide anything technical.
      toast(err?.name === 'Error' && err.message ? err.message : "Couldn't save. Please try again.", 'error')
    } finally {
      busy.current = false
    }
  }

  const save = guard(async () => {
    if (value == null) return
    const fields = { type, amount: value, category, note, ...(pending ? { expectedDate: date, date: null } : { date }) }
    if (editing) {
      await update(tx.id, fields)
      toast('saved')
    } else {
      await add(fields)
      toast(`${category.toLowerCase()}  ${money(value, { sign: type === 'expense' ? '-' : '+' })}`)
    }
    onDone()
  })

  const receive = guard(async () => {
    await markReceived(tx.id)
    toast(`received ${money(tx.amount)}`)
    onDone()
  })

  const destroy = guard(async () => {
    await remove(tx.id)
    toast('deleted')
    onDone()
  })

  // Hardware keyboard: digits, dot, backspace, enter (ignored while typing a note).
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return
      if (/^[\d.]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('back')
      else if (e.key === 'Enter') saveRef.current()
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const shown = displayAmount(amount)
  return (
    <form onSubmit={save} className="flex flex-col pt-1">
      {editing ? (
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Delete"
            onClick={() => setConfirmDelete(true)}
            className="press grid size-9 place-items-center rounded-full border border-line text-danger"
          >
            <Trash2 size={16} />
          </button>
          <span className="pill">{TYPES.find((t) => t.value === type).label}</span>
          {tx.type === 'to_receive' ? (
            <button type="button" onClick={receive} className="pill press bg-ink text-bg">
              mark received
            </button>
          ) : (
            <span className="size-9" />
          )}
        </div>
      ) : (
        <Pills options={TYPES} value={type} onChange={changeType} className="justify-center" />
      )}

      <div className="mt-4">
        <DateStrip value={date} onChange={setDate} future={pending} />
      </div>

      <div className="relative mt-4 flex items-center justify-center">
        <output
          aria-label="Amount"
          className={`font-medium tracking-tight tabular-nums transition-colors ${shown.length > 9 ? 'text-[38px]' : 'text-[48px]'} ${
            amount ? '' : 'text-muted'
          }`}
        >
          ₹{shown}
        </output>
        {amount && (
          <button
            type="button"
            aria-label="Delete last digit"
            onClick={() => press('back')}
            className="press absolute right-0 grid size-10 place-items-center rounded-full text-muted"
          >
            <Delete size={22} strokeWidth={1.75} />
          </button>
        )}
      </div>
      {pending && <p className="-mt-1 text-center text-[12px] text-muted">expected on the date above</p>}

      <div className="no-scrollbar -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5" role="radiogroup" aria-label="Category">
        {categoriesFor(type).map((c) => {
          const on = c === category
          const tone = on ? 'bg-ink text-bg border-ink' : 'border-line'
          return (
            <button key={c} type="button" role="radio" aria-checked={on} onClick={() => setCategory(c)} className="press flex shrink-0 items-center gap-1">
              <span className={`grid size-8 place-items-center rounded-full border text-[15px] transition-colors duration-200 ${tone}`}>
                {emojiFor(type, c)}
              </span>
              <span className={`pill transition-colors duration-200 ${tone}`}>{c.toLowerCase()}</span>
            </button>
          )
        })}
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 200))}
        placeholder="add note"
        aria-label="Note"
        enterKeyHint="done"
        className="mx-auto mt-3 h-9 w-56 rounded-full border border-line bg-transparent px-4 text-center text-[16px] outline-none placeholder:text-muted focus:border-ink"
      />

      <div className="mx-auto mt-5 grid w-full max-w-[300px] grid-cols-3 gap-x-6 gap-y-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className="press mx-auto grid size-16 place-items-center rounded-full bg-fill text-[26px] font-normal active:bg-fill-strong"
          >
            {k}
          </button>
        ))}
        <button
          type="submit"
          aria-label={editing ? 'Save' : 'Add'}
          disabled={value == null}
          className="press mx-auto grid size-16 place-items-center rounded-full bg-ink text-bg transition-opacity disabled:opacity-25"
        >
          <Check size={26} strokeWidth={2} />
        </button>
      </div>

      <Confirm
        open={confirmDelete}
        title="Delete transaction?"
        message="This can't be undone."
        confirmLabel="delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          destroy()
        }}
      />
    </form>
  )
}
