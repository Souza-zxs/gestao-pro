
// Camada de dados sobre o Supabase (substitui o antigo CRUD em localStorage).
// Todas as funções são assíncronas. As policies de RLS no banco garantem que
// cada usuário só enxergue/mexa nas próprias linhas, então o filtro por user_id
// acontece no servidor — aqui só precisamos injetá-lo nos INSERTs.

import { supabase } from './supabase'

// Tabelas cuja coluna user_id deve ser preenchida automaticamente com o usuário
// logado nos INSERTs/UPSERTs. As demais (faltas_horas, ingressos e as do portal
// de cursos) são escopadas por uma chave estrangeira/e-mail e não têm user_id.
const TABLES_WITH_USER_ID = new Set<string>([
  'colaboradores', 'pagamentos_config', 'agendamentos', 'horarios_disponiveis',
  'bloqueios', 'turmas', 'alunos', 'leads', 'eventos', 'news', 'apresentacoes',
  'financeiro', 'clientes', 'tarefas', 'membros', 'tarefas_concluidas',
])

/** ID do usuário autenticado (lança erro se a sessão tiver expirado). */
export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user?.id
  if (!uid) throw new Error('Sessão expirada. Faça login novamente.')
  return uid
}

export interface QueryOpts {
  /** Filtros de igualdade (coluna => valor). */
  match?: Record<string, unknown>
  /** Ordenação. `null` desativa (use em tabelas sem a coluna criado_em). */
  order?: { column: string; ascending?: boolean } | null
  /** Colunas a selecionar (padrão '*'). Útil para joins, ex: '*, turmas(*)'. */
  select?: string
}

/** Lê linhas da tabela (RLS já restringe ao usuário logado quando aplicável). */
export async function getAll<T>(table: string, opts: QueryOpts = {}): Promise<T[]> {
  let query = supabase.from(table).select(opts.select ?? '*')

  if (opts.match) {
    for (const [coluna, valor] of Object.entries(opts.match)) {
      query = query.eq(coluna, valor as never)
    }
  }

  const order = opts.order === undefined ? { column: 'criado_em', ascending: true } : opts.order
  if (order) query = query.order(order.column, { ascending: order.ascending ?? true })

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as T[]
}

/** Insere uma linha e retorna o registro criado (com id/criado_em do banco). */
export async function insert<T extends object>(table: string, item: T): Promise<T & { id: string; criado_em: string }> {
  const payload: Record<string, unknown> = { ...(item as Record<string, unknown>) }
  delete payload.id // o id é gerado pelo banco
  // Injeta o usuário logado quando a tabela é escopada por user_id e o chamador
  // não forneceu um (a página pública de agendamento passa o user_id explícito).
  if (TABLES_WITH_USER_ID.has(table) && payload.user_id == null) {
    payload.user_id = await currentUserId()
  }

  const { data, error } = await supabase.from(table).insert(payload).select().single()
  if (error) throw error
  return data as T & { id: string; criado_em: string }
}

/** Atualiza parcialmente a linha de id informado. */
export async function update<T>(table: string, id: string, changes: Partial<T>): Promise<void> {
  const patch: Record<string, unknown> = { ...changes }
  delete patch.id
  const { error } = await supabase.from(table).update(patch).eq('id', id)
  if (error) throw error
}

/** Remove a linha de id informado. */
export async function remove(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

/**
 * Insere ou atualiza uma linha resolvendo conflito por `onConflict`
 * (nome de coluna única ou lista separada por vírgula, ex: 'user_id,dia_semana').
 */
export async function upsert<T extends object>(table: string, item: T, onConflict: string): Promise<T & { id: string }> {
  const payload: Record<string, unknown> = { ...(item as Record<string, unknown>) }
  if (TABLES_WITH_USER_ID.has(table)) payload.user_id = await currentUserId()

  const { data, error } = await supabase.from(table).upsert(payload, { onConflict }).select().single()
  if (error) throw error
  return data as T & { id: string }
}

/** Apaga todos os dados do usuário logado (usado na "Zona de perigo"). */
export async function deleteAllUserData(): Promise<void> {
  const uid = await currentUserId()
  // Filhos (faltas_horas, ingressos) somem por ON DELETE CASCADE dos pais.
  const tabelas = [
    'agendamentos', 'horarios_disponiveis', 'bloqueios', 'alunos', 'turmas',
    'leads', 'eventos', 'news', 'apresentacoes', 'financeiro', 'clientes', 'tarefas', 'membros',
    'colaboradores', 'pagamentos_config',
  ]
  for (const t of tabelas) {
    const { error } = await supabase.from(t).delete().eq('user_id', uid)
    if (error) throw error
  }
}
