// Lógica de tarefas padrão (gerais). Uma tarefa padrão é um MODELO (padrao=true,
// sem cliente); ela tem NO MÁXIMO UMA CÓPIA (padrao=false, template_id = modelo)
// que vira o card único no quadro — os clientes vinculados vivem dentro do
// array `clientes` dessa cópia, um item por cliente, cada um funcionando como
// uma subtarefa (checklist) com seu próprio responsável e estado de conclusão.
// Ver migration 021 (padrao/template_id) e 026 (subtarefas + RLS).

import { getAll, insert, remove, update } from './store'
import type { Tarefa, TarefaCliente, Cliente, Membro } from './types'

// Número da carteira = dígitos no início da loja (ex: "12 - LLModas" -> "12").
export const numeroDaLoja = (loja: string) => {
  const m = (loja || '').match(/^\s*(\d+)/)
  return m ? m[1].padStart(2, '0') : ''
}

// Objeto denormalizado do cliente guardado no array `clientes` da tarefa.
export function tarefaClienteDe(c: Cliente): TarefaCliente {
  return { id: c.id, nome: c.nome, numero: numeroDaLoja(c.loja), loja: c.loja || '', telefone: c.telefone || '' }
}

const normaliza = (s: string) => (s || '').trim().toLowerCase()

// Responsável de uma subtarefa = o colaborador do próprio cliente (campo
// `responsavel` da tabela de clientes). Se esse nome/e-mail casa com um membro
// da equipe, usa nome + e-mail dele (para a tarefa aparecer para o colaborador
// e nos filtros). Se o cliente tem responsável, mas ele não está na equipe,
// mantém o nome sem e-mail. Se o cliente não tem responsável, cai no `fallback`
// (o responsável escolhido no formulário do modelo).
export function responsavelDoCliente(
  c: Cliente,
  membros: Membro[],
  fallback: { responsavel_nome: string; responsavel_email: string },
): { responsavel_nome: string; responsavel_email: string } {
  const alvo = normaliza(c.responsavel)
  if (!alvo) return fallback
  const m = membros.find(x => normaliza(x.nome) === alvo || normaliza(x.email) === alvo)
  if (m) return { responsavel_nome: m.nome, responsavel_email: m.email }
  return { responsavel_nome: c.responsavel, responsavel_email: '' }
}

// Campos do modelo necessários para gerar/alimentar a cópia (o registro
// recém-inserido não tem todos os campos de Tarefa, ex.: user_id, por isso
// um Pick).
export type ModeloTarefa = Pick<
  Tarefa,
  'id' | 'titulo' | 'descricao' | 'responsavel_nome' | 'responsavel_email' | 'prioridade' | 'recorrencia' | 'prazo'
>

// Item de subtarefa (cliente) dentro do array `clientes` de uma cópia padrão.
function subtarefaDe(c: Cliente, resp: { responsavel_nome: string; responsavel_email: string }): TarefaCliente {
  return { ...tarefaClienteDe(c), responsavel_nome: resp.responsavel_nome, responsavel_email: resp.responsavel_email, concluido: false, concluido_em: null }
}

// Payload de uma nova linha-cópia (1 por modelo) a partir do template e das
// subtarefas iniciais.
function copiaPayload(tpl: ModeloTarefa, subtarefas: TarefaCliente[]) {
  return {
    titulo: tpl.titulo,
    descricao: tpl.descricao,
    responsavel_nome: '',
    responsavel_email: '',
    prioridade: tpl.prioridade,
    status: 'a_fazer' as const,
    recorrencia: tpl.recorrencia,
    // Tarefa recorrente sempre aparece assim que criada (nunca herda um
    // prazo futuro do modelo) — o prazo vira 100% automático, avançando 1
    // dia/semana/mês só depois de concluída (ver proximaData no quadro).
    prazo: tpl.recorrencia === 'nenhuma' ? (tpl.prazo ?? null) : null,
    padrao: false,
    template_id: tpl.id,
    clientes: subtarefas,
    cliente_id: null,
    cliente_nome: '',
  }
}

/**
 * Ao criar um cliente (ou ao marcá-lo como "já vende"): adiciona esse cliente
 * como subtarefa em cada tarefa padrão (criando a linha-cópia do modelo se
 * ainda não existir). Só clientes que JÁ VENDEM recebem tarefas padrão.
 * Idempotente — pula modelos cuja cópia já tem este cliente.
 * Best-effort: nunca lança (não deve impedir o cadastro do cliente).
 * Retorna quantas tarefas padrão (modelos) receberam o cliente.
 */
export async function aplicarPadroesAoCliente(cliente: Cliente): Promise<number> {
  if (!cliente.ja_vende) return 0
  try {
    const [tarefas, membros] = await Promise.all([
      getAll<Tarefa>('tarefas', { order: null }),
      getAll<Membro>('membros', { order: null }).catch(() => [] as Membro[]),
    ])
    const modelos = tarefas.filter(t => t.padrao)
    if (modelos.length === 0) return 0
    const copiaPorTemplate = new Map(tarefas.filter(t => t.template_id).map(t => [t.template_id as string, t]))
    let n = 0
    for (const tpl of modelos) {
      const copia = copiaPorTemplate.get(tpl.id)
      if (copia?.clientes.some(c => c.id === cliente.id)) continue
      const resp = responsavelDoCliente(cliente, membros, {
        responsavel_nome: tpl.responsavel_nome, responsavel_email: tpl.responsavel_email,
      })
      const subtarefa = subtarefaDe(cliente, resp)
      if (copia) await update<Tarefa>('tarefas', copia.id, { clientes: [...copia.clientes, subtarefa] })
      else await insert('tarefas', copiaPayload(tpl, [subtarefa]))
      n++
    }
    return n
  } catch (err) {
    console.warn('Não foi possível aplicar as tarefas padrão ao cliente:', err)
    return 0
  }
}

/**
 * Ao criar/reaplicar uma tarefa padrão: adiciona como subtarefa cada cliente
 * que JÁ VENDE e ainda não está na cópia (clientes que não vendem são
 * ignorados). Cria a linha-cópia se ainda não existir. Idempotente.
 * Retorna quantos clientes foram adicionados.
 */
export async function aplicarPadraoATodos(template: ModeloTarefa, clientes: Cliente[], membros: Membro[] = []): Promise<number> {
  const existentes = await getAll<Tarefa>('tarefas', { order: null, match: { template_id: template.id } })
    .catch(() => [] as Tarefa[])
  const copia = existentes[0] ?? null
  const jaTem = new Set((copia?.clientes ?? []).map(c => c.id))
  const novos: TarefaCliente[] = []
  for (const c of clientes) {
    if (!c.ja_vende || jaTem.has(c.id)) continue
    const resp = responsavelDoCliente(c, membros, {
      responsavel_nome: template.responsavel_nome, responsavel_email: template.responsavel_email,
    })
    novos.push(subtarefaDe(c, resp))
  }
  if (novos.length === 0) return 0
  if (copia) await update<Tarefa>('tarefas', copia.id, { clientes: [...copia.clientes, ...novos] })
  else await insert('tarefas', copiaPayload(template, novos))
  return novos.length
}

/**
 * Remove um cliente das subtarefas de toda tarefa padrão (usado quando ele
 * deixa de vender). Se uma cópia ficar sem nenhum cliente, a linha é apagada
 * (evita card vazio no quadro). Não mexe nos modelos. Best-effort.
 * Retorna de quantas tarefas padrão o cliente foi removido.
 */
export async function removerPadroesDoCliente(clienteId: string): Promise<number> {
  try {
    const tarefas = await getAll<Tarefa>('tarefas', { order: null })
    const copias = tarefas.filter(t => t.template_id && t.clientes.some(c => c.id === clienteId))
    let n = 0
    for (const t of copias) {
      const restantes = t.clientes.filter(c => c.id !== clienteId)
      if (restantes.length === 0) await remove('tarefas', t.id)
      else await update<Tarefa>('tarefas', t.id, { clientes: restantes })
      n++
    }
    return n
  } catch (err) {
    console.warn('Não foi possível remover as tarefas padrão do cliente:', err)
    return 0
  }
}

/**
 * Reconciliação: remove das cópias de tarefa padrão os clientes que NÃO
 * vendem. Só considera clientes conhecidos (presentes na lista) — evita
 * apagar subtarefas de clientes que o usuário não carregou. Apaga a linha se
 * ficar sem nenhum cliente. Retorna quantas cópias foram alteradas/removidas.
 */
export async function limparPadroesDeNaoVendem(tarefas: Tarefa[], clientes: Cliente[]): Promise<number> {
  const vende = new Map(clientes.map(c => [c.id, c.ja_vende]))
  const alvo = tarefas.filter(t => t.template_id && t.clientes.some(c => c.id && vende.get(c.id) === false))
  let n = 0
  for (const t of alvo) {
    try {
      const restantes = t.clientes.filter(c => !(c.id && vende.get(c.id) === false))
      if (restantes.length === 0) await remove('tarefas', t.id)
      else await update<Tarefa>('tarefas', t.id, { clientes: restantes })
      n++
    } catch (err) { console.warn('Não foi possível remover cliente de tarefa padrão:', err) }
  }
  return n
}

/**
 * Sincroniza o responsável das tarefas com o colaborador definido na aba
 * Clientes. Em tarefas comuns ajusta a linha inteira (responsavel_nome/email);
 * em cópias de tarefa padrão ajusta o responsável de cada subtarefa (item do
 * array `clientes`) individualmente. Não mexe em modelos padrão. Retorna
 * quantas tarefas foram atualizadas.
 */
export async function sincronizarResponsaveis(tarefas: Tarefa[], clientes: Cliente[], membros: Membro[]): Promise<number> {
  const byId = new Map(clientes.map(c => [c.id, c]))
  let n = 0
  for (const t of tarefas) {
    if (t.padrao) continue
    if (t.template_id) {
      let mudou = false
      const atualizados = t.clientes.map(item => {
        const c = item.id ? byId.get(item.id) : undefined
        if (!c || !(c.responsavel || '').trim()) return item
        const resp = responsavelDoCliente(c, membros, { responsavel_nome: c.responsavel, responsavel_email: '' })
        if (item.responsavel_nome === resp.responsavel_nome && item.responsavel_email === resp.responsavel_email) return item
        mudou = true
        return { ...item, responsavel_nome: resp.responsavel_nome, responsavel_email: resp.responsavel_email }
      })
      if (!mudou) continue
      try { await update<Tarefa>('tarefas', t.id, { clientes: atualizados }); n++ }
      catch (err) { console.warn('Não foi possível sincronizar o responsável da subtarefa:', err) }
      continue
    }
    if (!t.cliente_id) continue
    const c = byId.get(t.cliente_id)
    if (!c || !(c.responsavel || '').trim()) continue
    const resp = responsavelDoCliente(c, membros, { responsavel_nome: c.responsavel, responsavel_email: '' })
    if (t.responsavel_nome === resp.responsavel_nome && t.responsavel_email === resp.responsavel_email) continue
    try { await update('tarefas', t.id, resp); n++ }
    catch (err) { console.warn('Não foi possível sincronizar o responsável da tarefa:', err) }
  }
  return n
}

/**
 * Atualiza o responsável das tarefas de UM cliente para o colaborador
 * definido na aba Clientes (usado ao trocar o responsável do cliente).
 * Best-effort. Retorna quantas tarefas foram atualizadas.
 */
export async function atualizarResponsavelDoCliente(cliente: Cliente, membros: Membro[]): Promise<number> {
  try {
    const tarefas = await getAll<Tarefa>('tarefas', { order: null })
    return await sincronizarResponsaveis(tarefas, [cliente], membros)
  } catch (err) {
    console.warn('Não foi possível atualizar o responsável das tarefas do cliente:', err)
    return 0
  }
}

/* ---------- Checklist de subtarefas (cópia de tarefa padrão) ---------- */

// Alterna o estado de conclusão de UM cliente dentro do array `clientes`.
export function alternarConcluido(itens: TarefaCliente[], clienteId: string | null): TarefaCliente[] {
  return itens.map(c => {
    if (c.id !== clienteId) return c
    const concluido = !c.concluido
    return { ...c, concluido, concluido_em: concluido ? new Date().toISOString() : null }
  })
}

// Todas as subtarefas concluídas? (array vazio não conta como "tudo feito").
export function todasConcluidas(itens: TarefaCliente[]): boolean {
  return itens.length > 0 && itens.every(c => c.concluido)
}

// Reseta o checklist (usado ao completar o ciclo de uma tarefa recorrente).
export function resetarConclusao(itens: TarefaCliente[]): TarefaCliente[] {
  return itens.map(c => ({ ...c, concluido: false, concluido_em: null }))
}
