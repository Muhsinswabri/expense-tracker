// Appearance: 'light' (default) | 'dark' | 'system'. index.html applies it before first paint.
const KEY = 'chelaveee.theme'
const COLORS = { light: '#FFFFFF', dark: '#000000' }

export function getTheme() {
  try {
    return localStorage.getItem(KEY) || 'light'
  } catch {
    return 'light'
  }
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* not remembered, still applied for this session */
  }
  document.documentElement.dataset.theme = theme
  // Status bar / browser chrome colour follows the chosen theme.
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light'
    meta.content = COLORS[theme === 'system' ? scheme : theme]
  }
}
