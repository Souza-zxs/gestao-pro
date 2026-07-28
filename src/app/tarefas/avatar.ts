// Helpers de apresentação reaproveitados no quadro Kanban e no checklist por
// colaborador: avatar de iniciais (cor determinística a partir do nome) e o
// número da carteira extraído do início do nome da loja.

// Número da carteira = dígitos no início da loja (ex: "12 - LLModas" -> "12").
export const numeroDaLoja = (loja: string) => {
  const m = (loja || '').match(/^\s*(\d+)/)
  return m ? m[1].padStart(2, '0') : ''
}

// Avatar de iniciais: cor determinística a partir do nome (mesma pessoa = mesma cor).
const AVATAR_CORES = [
  'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300',
  'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300',
  'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
  'bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300',
  'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
]
export function corAvatar(nome: string): string {
  const s = nome || '?'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_CORES[h % AVATAR_CORES.length]
}
export function iniciais(nome: string): string {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase()
}
