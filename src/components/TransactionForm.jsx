import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, Delete, Trash2, X } from 'lucide-react'
import { parseAmount } from '../../shared/transaction.js'
import { fromKey, money, todayKey } from '../lib/format.js'
import { categoryOptions, lastCategory } from '../lib/ledger.js'
import { useStore } from '../store.jsx'
import Doodle from './Doodle.jsx'
import { Confirm, Prompt, useToast } from './ui.jsx'

const NAME = { expense: 'Expense', income: 'Income', to_receive: 'To Receive' }
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back']

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

const dateText = (k) =>
  k === todayKey() ? 'Today' : fromKey(k).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/** Grouped-list row with a native date picker laid over it. */
function DateRow({ label, value, onChange }) {
  return (
    <label className="relative flex h-12 items-center justify-between px-4">
      <span className="text-[16px]">{label}</span>
      <span className="flex items-center gap-1 text-[16px] text-muted">
        {dateText(value)}
        <ChevronRight size={16} />
      </span>
      <input
        type="date"
        aria-label={label}
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 opacity-0"
      />
    </label>
  )
}

/**
 * Add (initialType) or edit (tx) a transaction. Remount with a new key for a fresh form.
 * Reports unsaved changes through onDirty so closing can ask first.
 */
export default function TransactionForm({ tx, initialType = 'expense', onDone, onClose, onDirty }) {
  const { txs, categories, add, update, remove, markReceived, addCategory } = useStore()
  const toast = useToast()
  const editing = Boolean(tx)
  const type = tx?.type ?? initialType
  const pending = type === 'to_receive'

  const [initial] = useState(() => {
    const options = categoryOptions(categories, type)
    const last = lastCategory(txs, type)
    return {
      amount: tx ? String(tx.amount) : '',
      category: tx?.category ?? (options.includes(last) ? last : options[0]),
      date: (pending ? tx?.expectedDate : tx?.date) ?? todayKey(),
      note: tx?.note ?? '',
    }
  })
  const [amount, setAmount] = useState(initial.amount)
  const [category, setCategory] = useState(initial.category)
  const [date, setDate] = useState(initial.date)
  const [note, setNote] = useState(initial.note)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [adding, setAdding] = useState(false)
  const busy = useRef(false)

  // An older transaction may use a category that isn't offered any more (e.g. Other): keep it visible.
  const options = categoryOptions(categories, type)
  const chips = options.includes(category) ? options : [...options, category]

  const value = parseAmount(amount)
  const dirty = amount !== initial.amount || category !== initial.category || date !== initial.date || note !== initial.note
  useEffect(() => {
    onDirty?.(dirty)
  }, [dirty, onDirty])

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
      toast('Saved')
    } else {
      await add(fields)
      toast(`${category}  ${money(value, { sign: type === 'expense' ? '-' : '+' })}`)
    }
    onDone()
  })

  const receive = guard(async () => {
    await markReceived(tx.id)
    toast(`Received ${money(tx.amount)}`)
    onDone()
  })

  const destroy = guard(async () => {
    await remove(tx.id)
    toast('Deleted')
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
    <form onSubmit={save} className="flex flex-col">
      <header className="flex items-center justify-between">
        <button type="button" aria-label="Close" onClick={onClose} className="press grid size-9 place-items-center rounded-full bg-fill">
          <X size={18} />
        </button>
        <h2 className="text-[17px] font-semibold">{editing ? `Edit ${NAME[type]}` : `Add ${NAME[type]}`}</h2>
        {editing ? (
          <button
            type="button"
            aria-label="Delete"
            onClick={() => setConfirmDelete(true)}
            className="press grid size-9 place-items-center rounded-full bg-fill text-danger"
          >
            <Trash2 size={17} />
          </button>
        ) : (
          <span className="size-9" />
        )}
      </header>

      <div className="relative mt-5 flex items-center justify-center">
        <output aria-label="Amount" className={`flex items-center font-semibold tracking-tight tabular-nums ${shown.length > 9 ? 'text-[38px]' : 'text-[48px]'}`}>
          <span className={amount ? '' : 'text-muted'}>₹{shown}</span>
          <span className="ml-0.5 h-[0.9em] w-[2.5px] rounded-full bg-ink animate-caret" aria-hidden="true" />
        </output>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Category">
        {chips.map((c) => {
          const on = c === category
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setCategory(c)}
              className={`pill press h-10 max-w-full px-3.5 text-[15px] transition-colors duration-200 ${on ? 'border-ink bg-ink font-medium text-bg' : ''}`}
            >
              {on ? <Check size={17} strokeWidth={2.4} /> : <Doodle name={c} size={18} />}
              <span className="truncate">{c}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="pill press h-10 border-dashed border-muted px-3.5 text-[15px] text-muted"
        >
          <Doodle name="_add" size={17} />
          Add Category
        </button>
      </div>

      <Prompt
        open={adding}
        title="Add Category"
        label="Category Name"
        placeholder="e.g. Gym"
        confirmLabel="Add"
        onCancel={() => setAdding(false)}
        onConfirm={async (name) => {
          const saved = await addCategory(type, name)
          setCategory(saved)
          setAdding(false)
          toast(`${saved} Added`)
        }}
      />

      <div className="mt-5 overflow-hidden rounded-[16px] bg-fill">
        <DateRow label={pending ? 'Expected Date' : 'Date'} value={date} onChange={setDate} />
        <div className="mx-4 h-px bg-line" />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 200))}
          placeholder="Add a Note"
          aria-label="Note"
          enterKeyHint="done"
          className="h-12 w-full bg-transparent px-4 outline-none placeholder:text-muted"
        />
      </div>

      {editing && tx.type === 'to_receive' && (
        <button type="button" onClick={receive} className="press mt-3 h-11 rounded-full border border-ink text-[15px] font-medium">
          Mark as Received
        </button>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            aria-label={k === 'back' ? 'Delete last digit' : k}
            onClick={() => press(k)}
            className="press grid h-12 place-items-center rounded-[14px] bg-fill text-[24px] active:bg-fill-strong"
          >
            {k === 'back' ? <Delete size={22} strokeWidth={1.75} /> : k}
          </button>
        ))}
      </div>

      <button
        type="submit"
        disabled={value == null}
        className="press mt-3 flex h-[52px] items-center justify-center gap-2 rounded-full bg-ink text-[17px] font-semibold text-bg transition-opacity disabled:opacity-25"
      >
        <Check size={20} strokeWidth={2.5} />
        {editing ? 'Save Changes' : `Save ${NAME[type]}`}
      </button>

      <Confirm
        open={confirmDelete}
        title="Delete Transaction?"
        message="This can't be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          destroy()
        }}
      />
    </form>
  )
}
