// Regras de visibilidade de tarefa + agrupamento em "checklist": quando um
// colaborador tem a MESMA tarefa recorrente (diária/semanal/mensal) em 2+
// clientes — seja por "tarefa padrão" (mesmo template_id) ou por uma tarefa
// manual criada com vários clientes de uma vez (mesmo título) — as linhas
// viram um único card de checklist (ver ChecklistTarefas.tsx) em vez de N
// cards soltos no quadro.

import { isAfter, isSameDay, isValid, parseISO, startOfDay } from 'date-fns'
import type { Tarefa, TarefaCliente, TarefaConcluida } from '@/lib/types'

export const hoje = () => startOfDay(new Date())

// Normaliza o array de clientes vindo do banco (JSONB) — tolera linhas antigas.
export function clientesDe(t: Tarefa): TarefaCliente[] {
  if (Array.isArray(t.clientes) && t.clientes.length) return t.clientes
  if (t.cliente_nome) return [{ id: t.cliente_id, nome: t.cliente_nome, numero: '', loja: '', telefone: '' }]
  return []
}

// Subconjunto de clientesDe(t) com o cliente ainda ativo (não arquivado). Um
// cliente arquivado sai do quadro a partir desse momento — o histórico
// (tarefas_concluidas) já registrado antes não é mexido, só a exibição atual.
export function clientesAtivosDe(t: Tarefa, arquivadosIds: Set<string>): TarefaCliente[] {
  return clientesDe(t).filter(c => !c.id || !arquivadosIds.has(c.id))
}

// Tarefa visível no quadro: ao clicar em "Concluir" ela some.
//  • não-recorrente -> vira 'concluida' e não volta;
//  • recorrente     -> volta para 'a_fazer' com o PRÓXIMO prazo (futuro), então
//    some agora e só reaparece quando esse prazo chega (ver concluir()).
// Tarefas sem prazo (ou prazo já vencido) ficam sempre visíveis.
export function ativa(t: Tarefa): boolean {
  if (t.status === 'concluida') return false
  if (t.recorrencia === 'nenhuma') return true
  if (!t.prazo || !isValid(parseISO(t.prazo))) return true
  return !isAfter(parseISO(t.prazo), hoje())
}

// Identidade do responsável para agrupar/exibir: usa e-mail quando existe;
// cai para o nome quando o cliente tem responsável mas ele não bate com
// nenhum membro da equipe (responsavel_email fica ''). Evita misturar duas
// pessoas diferentes com e-mail vazio num único grupo/seção.
export const identidadeResp = (t: Pick<Tarefa, 'responsavel_email' | 'responsavel_nome'>) =>
  t.responsavel_email || t.responsavel_nome || '—'

const normalizaTitulo = (s: string) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ')

// Chave de agrupamento: mesmo modelo (template_id) OU mesmo título normalizado
// (tarefa manual com vários clientes), + mesmo responsável + mesma recorrência.
export const chaveGrupo = (t: Tarefa): string =>
  `${t.template_id ?? normalizaTitulo(t.titulo)}|${identidadeResp(t)}|${t.recorrencia}`

export interface ChecklistLinha {
  tarefa: Tarefa
  cliente?: TarefaCliente
  pendente: boolean
}

export interface ChecklistGrupo {
  key: string
  titulo: string
  responsavel_nome: string
  responsavel_email: string
  recorrencia: Exclude<Tarefa['recorrencia'], 'nenhuma'>
  templateId: string | null
  linhas: ChecklistLinha[]
}

/**
 * Agrupa tarefas recorrentes (não-padrão) que se repetem para 2+ clientes do
 * mesmo responsável em cards de checklist. Regra de "pendente" por linha:
 *  • diária: reseta todo dia — pendente = não foi concluída HOJE (olha
 *    tarefas_concluidas, não o prazo, então o checklist do colaborador não
 *    acumula "atrasado" visualmente; o histórico completo continua disponível
 *    para o admin no dashboard de análise);
 *  • semanal/mensal: usa ativa() como já é hoje — fica pendente/atrasada até
 *    ser concluída manualmente, sem reset automático.
 * Retorna também o Set de ids de tarefa que entraram em algum grupo, para o
 * quadro normal excluir essas linhas de `visiveis` (não duplicar o card).
 */
export function agruparChecklists(
  tarefas: Tarefa[],
  concluidas: TarefaConcluida[],
  clientesArquivadosIds: Set<string>,
): { grupos: ChecklistGrupo[]; idsAgrupados: Set<string> } {
  // Candidatas: NÃO filtrar por ativa() aqui — o checklist precisa de todas as
  // linhas (algumas já concluídas neste ciclo, outras não) para montar os itens.
  const candidatas = tarefas.filter(t =>
    !t.padrao && t.recorrencia !== 'nenhuma' && clientesAtivosDe(t, clientesArquivadosIds).length > 0)

  const porChave = new Map<string, Tarefa[]>()
  for (const t of candidatas) {
    const k = chaveGrupo(t)
    const arr = porChave.get(k)
    if (arr) arr.push(t)
    else porChave.set(k, [t])
  }

  const concluidasHoje = new Set(
    concluidas
      .filter(r => r.tarefa_id && isValid(parseISO(r.concluida_em)) && isSameDay(parseISO(r.concluida_em), new Date()))
      .map(r => r.tarefa_id as string),
  )

  const grupos: ChecklistGrupo[] = []
  const idsAgrupados = new Set<string>()

  for (const [key, linhasTarefas] of porChave) {
    const idsClientesDistintos = new Set(
      linhasTarefas.map(t => clientesAtivosDe(t, clientesArquivadosIds)[0]?.id).filter(Boolean),
    )
    // Menos de 2 clientes ativos: não forma checklist — volta a ser card individual.
    if (idsClientesDistintos.size < 2) continue

    const linhas: ChecklistLinha[] = linhasTarefas
      .map(t => {
        const cliente = clientesAtivosDe(t, clientesArquivadosIds)[0]
        const pendente = t.recorrencia === 'diaria' ? !concluidasHoje.has(t.id) : ativa(t)
        return { tarefa: t, cliente, pendente }
      })
      .sort((a, b) => (a.cliente?.nome || '').localeCompare(b.cliente?.nome || ''))

    linhasTarefas.forEach(t => idsAgrupados.add(t.id))
    const primeira = linhasTarefas[0]
    grupos.push({
      key,
      titulo: primeira.titulo,
      responsavel_nome: primeira.responsavel_nome,
      responsavel_email: primeira.responsavel_email,
      recorrencia: primeira.recorrencia as Exclude<Tarefa['recorrencia'], 'nenhuma'>,
      templateId: primeira.template_id ?? null,
      linhas,
    })
  }

  return { grupos, idsAgrupados }
}
