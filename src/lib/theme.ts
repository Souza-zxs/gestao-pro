// Tema claro/escuro. O escuro é aplicado pela classe `dark` no <html>, que liga
// as variáveis de cor sobrescritas no globals.css. A escolha é persistida.

export type Theme = 'light' | 'dark'
const KEY = 'gp-theme'

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    if (t === 'light' || t === 'dark') return t
  } catch { /* ignore */ }
  return 'light'
}

export function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
}

export function setTheme(t: Theme) {
  try { localStorage.setItem(KEY, t) } catch { /* ignore */ }
  applyTheme(t)
}

