import { useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Check, EllipsisVertical, Share, SquarePlus } from 'lucide-react'
import { installState, promptInstall, subscribe } from '../lib/install.js'
import { useToast } from './ui.jsx'

const STEPS = {
  ios: [
    { icon: Share, text: 'Tap Share in Safari.' },
    { icon: SquarePlus, text: 'Tap “Add to Home Screen”.' },
    { icon: Check, text: 'Tap “Add”.' },
  ],
  manual: [
    { icon: EllipsisVertical, text: 'Open your browser menu.' },
    { icon: SquarePlus, text: 'Choose “Install app” or “Add to Home Screen”.' },
  ],
}

function Guide({ steps, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center px-8" role="dialog" aria-modal="true" aria-label="Add Chelaveee to Home Screen">
      <div className="absolute inset-0 bg-[var(--scrim)] animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-[320px] rounded-[24px] bg-bg p-5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.2)] animate-pop-in">
        <img src="/logo.png" alt="" className="mx-auto size-14 rounded-[14px]" />
        <h3 className="mt-3 text-[17px] font-semibold">Add Chelaveee to Home Screen</h3>
        <ol className="mt-4 space-y-2.5 text-left">
          {steps.map(({ icon: Icon, text }, i) => (
            <li key={text} className="flex items-center gap-3 rounded-[14px] bg-fill px-3 py-2.5 text-[15px]">
              <span className="w-4 shrink-0 text-center text-[13px] font-semibold text-muted">{i + 1}</span>
              <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-bg">
                <Icon size={18} strokeWidth={1.9} />
              </span>
              {text}
            </li>
          ))}
        </ol>
        <button type="button" onClick={onClose} className="press mt-5 h-11 w-full rounded-full bg-ink text-[15px] font-semibold text-bg">
          Got It
        </button>
      </div>
    </div>,
    document.body,
  )
}

/** Settings row: install the PWA, or show it's already on the Home Screen. */
export default function InstallApp() {
  const state = useSyncExternalStore(subscribe, installState)
  const toast = useToast()
  const [guide, setGuide] = useState(false)
  const installed = state === 'installed'

  const onTap = async () => {
    if (installed) return toast('Chelaveee is already installed.')
    if (state === 'prompt') {
      if (await promptInstall()) toast('Chelaveee added to Home Screen')
      return
    }
    setGuide(true)
  }

  return (
    <>
      <button type="button" onClick={onTap} className="flex h-12 w-full items-center gap-3 px-4 text-left text-[16px] active:bg-fill-strong">
        {installed ? <Check size={19} strokeWidth={2.2} /> : <SquarePlus size={19} strokeWidth={1.9} className="text-muted" />}
        <span className="flex-1">{installed ? 'Added to Home Screen' : 'Add Chelaveee to Home Screen'}</span>
      </button>
      {guide && <Guide steps={STEPS[state] ?? STEPS.manual} onClose={() => setGuide(false)} />}
    </>
  )
}
