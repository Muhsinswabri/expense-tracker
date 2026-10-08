import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { money } from '../lib/format.js'

/* ---------- Toast ---------- */

const ToastContext = createContext(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timer = useRef()
  const show = useCallback((text, kind = 'success') => {
    clearTimeout(timer.current)
    setToast({ text, kind, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), 2400)
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center pt-safe" role="status" aria-live="polite">
            <div
              key={toast.key}
              className={`mt-2 rounded-full px-4 py-2 text-[14px] font-medium shadow-[0_8px_30px_rgba(0,0,0,0.16)] animate-toast-in ${
                toast.kind === 'error' ? 'border border-danger bg-bg text-danger' : 'bg-ink text-bg'
              }`}
            >
              {toast.kind === 'error' ? toast.text : `✓  ${toast.text}`}
            </div>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}

/* ---------- Pill filter: selected option is filled ---------- */

export function Pills({ options, value, onChange, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={`pill press h-9 shrink-0 transition-colors duration-200 ${o.value === value ? 'border-ink bg-ink text-bg' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- iOS segmented control ---------- */

export function Segmented({ options, value, onChange, label }) {
  const i = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div className="relative grid rounded-[12px] bg-fill-strong p-0.5" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }} role="radiogroup" aria-label={label}>
      <div
        className="absolute inset-y-0.5 left-0.5 rounded-[10px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-ios"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${i * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`relative z-10 h-9 text-[14px] font-medium transition-colors ${o.value === value ? 'text-ink' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Animated money ---------- */

export function AnimatedMoney({ value, className = '', ...opts }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    if (start === value || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = value
      setShown(value)
      return
    }
    const t0 = performance.now()
    let raf
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 550)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = p < 1 ? Math.round(start + (value - start) * eased) : value
      from.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // rAF pauses in background tabs; make sure the final value always lands.
    const done = setTimeout(() => {
      cancelAnimationFrame(raf)
      from.current = value
      setShown(value)
    }, 650)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(done)
    }
  }, [value])
  return <span className={`tabular-nums ${className}`}>{money(shown, opts)}</span>
}

/* ---------- Confirm dialog ---------- */

export function Confirm({ open, title, message, confirmLabel, onConfirm, onCancel }) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center px-10" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[var(--scrim)] animate-fade-in" onClick={onCancel} />
      <div className="relative w-full max-w-[290px] rounded-[24px] bg-bg p-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.2)] animate-pop-in">
        <h3 className="text-[17px] font-semibold">{title}</h3>
        {message && <p className="mt-1 text-[14px] leading-snug text-muted">{message}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="press h-11 rounded-full border border-ink text-[15px]">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="press h-11 rounded-full bg-danger text-[15px] font-semibold text-white">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ---------- Empty state ---------- */

export function Empty({ emoji, title, text }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center animate-fade-in">
      {emoji && <div className="mb-3 text-[40px] leading-none">{emoji}</div>}
      <p className="text-[17px] font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-[260px] text-[14px] leading-snug text-muted">{text}</p>}
    </div>
  )
}
