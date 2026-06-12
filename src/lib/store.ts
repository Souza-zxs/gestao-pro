// localStorage CRUD simples que substitui Supabase enquanto não há banco configurado

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function getAll<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

export function insert<T extends object>(key: string, item: T): T & { id: string; criado_em: string } {
  const all = getAll<T & { id: string; criado_em: string }>(key)
  const novo = { ...item, id: genId(), criado_em: new Date().toISOString() }
  localStorage.setItem(key, JSON.stringify([...all, novo]))
  return novo
}

export function update<T extends { id: string }>(key: string, id: string, changes: Partial<T>): void {
  const all = getAll<T>(key)
  localStorage.setItem(key, JSON.stringify(all.map(x => x.id === id ? { ...x, ...changes } : x)))
}

export function remove(key: string, id: string): void {
  const all = getAll<{ id: string }>(key)
  localStorage.setItem(key, JSON.stringify(all.filter(x => x.id !== id)))
}

export function upsertBy<T extends object>(key: string, matchField: keyof T, matchValue: unknown, item: T): void {
  const all = getAll<T & { id: string }>(key)
  const idx = all.findIndex(x => x[matchField] === matchValue)
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...item }
  } else {
    all.push({ ...item, id: genId() } as T & { id: string })
  }
  localStorage.setItem(key, JSON.stringify(all))
}
