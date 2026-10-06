// Regra de negócio de "concluir tarefa": registra no histórico e, se
// recorrente, volta pra "a fazer" com o próximo prazo (senão, some de vez).
// Compartilhado entre TarefasClient.tsx (quadro) e TarefaDetalhe.tsx (página
// de detalhe) — antes duplicado quase-verbatim nos dois arquivos.

import { addDays, addWeeks, addMonths, format } from 'date-fns'
import { update, remove, currentUserId } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import type { Tarefa } from '@/lib/types'
import { hoje } from './checklistUtils'

// Próxima data de uma recorrência, a partir de hoje (formato yyyy-MM-dd).
export function proximaData(rec: Tarefa['recorrencia']): string {
  const base = hoje()
  const d = rec === 'diaria' ? addDays(base, 1) : rec === 'semanal' ? addWeeks(base, 1) : rec === 'mensal' ? addMonths(base, 1) : base
  return format(d, 'yyyy-MM-dd')
}

// Registra a conclusão no histórico (alimenta o painel de análise). É
// "best-effort": se falhar (tabela ausente, RLS, etc.) apenas avisa no console
// e NÃO impede a conclusão da tarefa.
export async function registrarConclusao(t: Tarefa): Promise<void> {
  try {
    const uid = await currentUserId()
    const { error } = await supabase.from('tarefas_concluidas').insert({
      user_id: uid, tarefa_id: t.id, titulo: t.titulo,
      responsavel_nome: t.responsavel_nome, responsavel_email: t.responsavel_email,
      prioridade: t.prioridade, recorrencia: t.recorrencia,
      cliente_nome: t.cliente_nome ?? '',
      criada_em: t.criado_em ?? null,
      prazo: t.prazo ?? null,
    })
    if (error) console.warn('Conclusão não registrada no histórico:', error.message)
  } catch (err) {
    console.warn('Conclusão não registrada no histórico:', err)
  }
}

// Concluir: tarefa some do quadro. Se for recorrente, reaparece no próximo
// período. Não captura erros — quem chama decide o que fazer no catch (os
// dois pontos de chamada têm comportamento diferente após o sucesso).
export async function concluirTarefa(t: Tarefa): Promise<void> {
  await registrarConclusao(t) // best-effort, nunca lança
  if (t.recorrencia === 'nenhuma') {
    // Não-recorrente: some de vez (fica só no histórico de conclusões).
    await remove('tarefas', t.id)
  } else {
    // Recorrente: volta para "a fazer" com o próximo prazo (futuro) -> some
    // do quadro agora e reaparece quando o período chega.
    await update<Tarefa>('tarefas', t.id, { status: 'a_fazer', prazo: proximaData(t.recorrencia) })
  }
}
