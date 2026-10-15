// "Add to Home Screen" support. Imported from main.jsx so Chrome's beforeinstallprompt,
// which fires soon after load, is caught before Settings is ever opened.
let deferred = null
let justInstalled = false
const listeners = new Set()
const emit = () => listeners.forEach((f) => f())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // we offer our own button instead of the browser's mini-infobar
  deferred = e
  emit()
})
window.addEventListener('appinstalled', () => {
  deferred = null
  justInstalled = true
  emit()
})

// Running as the installed app (Home Screen / standalone window).
export const isInstalled = () =>
  justInstalled || navigator.standalone === true || matchMedia('(display-mode: standalone)').matches

// iPhone / iPad (iPadOS reports itself as a Mac with touch).
export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const canPrompt = () => deferred !== null

// Shows the browser's install dialog. Resolves true when the user accepts.
export async function promptInstall() {
  const e = deferred
  if (!e) return false
  deferred = null
  emit()
  await e.prompt()
  const { outcome } = await e.userChoice
  return outcome === 'accepted'
}

export function subscribe(f) {
  listeners.add(f)
  return () => listeners.delete(f)
}

// Snapshot for useSyncExternalStore: 'installed' | 'prompt' | 'ios' | 'manual'.
export const installState = () => (isInstalled() ? 'installed' : canPrompt() ? 'prompt' : isIOS() ? 'ios' : 'manual')

// Installed app only: no pinch or double-tap zoom. The website in a normal browser tab keeps zoom.
if (isInstalled()) {
  // Panning stays; pinch and double-tap are not handled by the browser (Chrome/Android, Edge, Firefox).
  document.documentElement.style.touchAction = 'pan-x pan-y'
  // Same intent for engines that read the viewport.
  document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
  // iOS ignores user-scalable and touch-action for pinch; its gesture events can be cancelled instead.
  document.addEventListener('gesturestart', (e) => e.preventDefault())
}
