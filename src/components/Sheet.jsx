import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// Distance from the bottom of the layout viewport to the top of the iOS keyboard.
function useKeyboardInset() {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
    }
  }, [])
  return inset
}

/** iOS-style bottom sheet. Drag the handle down, tap outside or press Esc to close. */
export default function Sheet({ open, onClose, title, children }) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  const [drag, setDrag] = useState(0)
  const start = useRef(null)
  const keyboard = useKeyboardInset()

  if (open && !mounted) setMounted(true)
  if (open && closing) setClosing(false) // reopened mid-close
  if (!open && mounted && !closing) setClosing(true)

  useEffect(() => {
    if (!closing) return
    const t = setTimeout(() => {
      setMounted(false)
      setClosing(false)
      setDrag(0)
    }, 240)
    return () => clearTimeout(t)
  }, [closing])

  useEffect(() => {
    if (!mounted) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [mounted, onClose])

  if (!mounted) return null

  const onPointerDown = (e) => {
    start.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => start.current != null && setDrag(Math.max(0, e.clientY - start.current))
  const onPointerUp = () => {
    if (start.current == null) return
    start.current = null
    if (drag > 90) onClose() // may be refused (unsaved changes), so snap back either way
    setDrag(0)
  }

  const shown = !closing
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-[var(--scrim)] transition-opacity duration-200 animate-fade-in"
        style={{ opacity: shown ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 mx-auto max-w-md animate-sheet-in"
        style={{
          bottom: keyboard,
          transform: `translateY(${shown ? drag : '100%'}${shown ? 'px' : ''})`,
          transition: start.current != null ? 'none' : 'transform 260ms var(--ease-ios)',
        }}
      >
        <div
          className="flex flex-col rounded-t-[28px] border-t border-line bg-bg shadow-[0_-8px_40px_rgba(0,0,0,0.12)]"
          style={{ maxHeight: `calc(${keyboard ? `${window.visualViewport?.height ?? 600}px` : '100dvh'} - 12px - env(safe-area-inset-top))` }}
        >
          <div
            className="shrink-0 cursor-grab touch-none px-5 pt-2.5 pb-1"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="mx-auto h-[5px] w-9 rounded-full bg-fill-strong" />
            {title && (
              <div className="mt-2 flex items-center justify-between">
                <span className="size-9" />
                <h2 className="text-[17px] font-semibold">{title}</h2>
                <button
                  type="button"
                  aria-label="Close"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={onClose}
                  className="press grid size-9 place-items-center rounded-full bg-fill"
                >
                  <X size={18} />
                </button>
              </div>
            )}
          </div>
          <div className="overflow-y-auto overscroll-contain px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
