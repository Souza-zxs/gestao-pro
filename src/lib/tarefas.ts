// Lógica de tarefas padrão (gerais). Uma tarefa padrão é um MODELO (padrao=true,
// sem cliente); cada cliente que já vende ganha sua PRÓPRIA CÓPIA (padrao=false,
// template_id = modelo, cliente_id = o cliente) — um card de kanban
// independente por cliente, com status/prazo/responsável próprios.
// Ver migration 021 (padrao/template_id) e 030 (volta a 1 linha por cliente).

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

// Responsável de uma cópia = o colaborador do próprio cliente (campo
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

// Campos do modelo necessários para gerar uma cópia (o registro recém-inserido
// não tem todos os campos de Tarefa, ex.: user_id, por isso um Pick).
export type ModeloTarefa = Pick<
  Tarefa,
  'id' | 'titulo' | 'descricao' | 'responsavel_nome' | 'responsavel_email' | 'prioridade' | 'recorrencia' | 'prazo'
>

// Payload de uma cópia individual (1 linha = 1 modelo aplicado a 1 cliente).
function copiaClientePayload(tpl: ModeloTarefa, cliente: Cliente, resp: { responsavel_nome: string; responsavel_email: string }) {
  return {
    titulo: tpl.titulo,
    descricao: tpl.descricao,
    responsavel_nome: resp.responsavel_nome,
    responsavel_email: resp.responsavel_email,
    prioridade: tpl.prioridade,
    status: 'a_fazer' as const,
    recorrencia: tpl.recorrencia,
    // Tarefa recorrente sempre aparece assim que criada (nunca herda um
    // prazo futuro do modelo) — o prazo vira 100% automático, avançando 1
    // dia/semana/mês só depois de concluída (ver proximaData no quadro).
    prazo: tpl.recorrencia === 'nenhuma' ? (tpl.prazo ?? null) : null,
    padrao: false,
    template_id: tpl.id,
    clientes: [tarefaClienteDe(cliente)],
    cliente_id: cliente.id,
    cliente_nome: cliente.nome,
  }
}

/**
 * Ao criar um cliente (ou ao marcá-lo como "já vende"): cria um card
 * independente para ele em cada tarefa padrão. Só clientes que JÁ VENDEM
 * recebem tarefas padrão. Idempotente — pula modelos que já têm uma cópia
 * deste cliente. Best-effort: nunca lança (não deve impedir o cadastro do
 * cliente). Retorna quantas tarefas padrão (modelos) receberam o cliente.
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
    const jaTemPorTemplate = new Set(
      tarefas.filter(t => t.template_id && t.cliente_id === cliente.id).map(t => t.template_id as string),
    )
    let n = 0
    for (const tpl of modelos) {
      if (jaTemPorTemplate.has(tpl.id)) continue
      const resp = responsavelDoCliente(cliente, membros, {
        responsavel_nome: tpl.responsavel_nome, responsavel_email: tpl.responsavel_email,
      })
      await insert('tarefas', copiaClientePayload(tpl, cliente, resp))
      n++
    }
    return n
  } catch (err) {
    console.warn('Não foi possível aplicar as tarefas padrão ao cliente:', err)
    return 0
  }
}

/**
 * Ao criar/reaplicar uma tarefa padrão: cria um card independente para cada
 * cliente que JÁ VENDE e ainda não tem cópia deste modelo (clientes que não
 * vendem são ignorados). Idempotente. Retorna quantos clientes receberam
 * uma cópia nova.
 */
export async function aplicarPadraoATodos(template: ModeloTarefa, clientes: Cliente[], membros: Membro[] = []): Promise<number> {
  const existentes = await getAll<Tarefa>('tarefas', { order: null, match: { template_id: template.id } })
    .catch(() => [] as Tarefa[])
  const jaTem = new Set(existentes.map(t => t.cliente_id).filter(Boolean))
  let n = 0
  for (const c of clientes) {
    if (!c.ja_vende || jaTem.has(c.id)) continue
    const resp = responsavelDoCliente(c, membros, {
      responsavel_nome: template.responsavel_nome, responsavel_email: template.responsavel_email,
    })
    await insert('tarefas', copiaClientePayload(template, c, resp))
    n++
  }
  return n
}

/**
 * Remove a(s) cópia(s) de tarefa padrão de um cliente (usado quando ele
 * deixa de vender). Não mexe nos modelos. Best-effort.
 * Retorna de quantas tarefas padrão o cliente foi removido.
 */
export async function removerPadroesDoCliente(clienteId: string): Promise<number> {
  try {
    const tarefas = await getAll<Tarefa>('tarefas', { order: null })
    const alvo = tarefas.filter(t => t.template_id && t.cliente_id === clienteId)
    for (const t of alvo) await remove('tarefas', t.id)
    return alvo.length
  } catch (err) {
    console.warn('Não foi possível remover as tarefas padrão do cliente:', err)
    return 0
  }
}

/**
 * Reconciliação: remove as cópias de tarefa padrão de clientes que NÃO
 * vendem. Só considera clientes conhecidos (presentes na lista) — evita
 * apagar cópias de clientes que o usuário não carregou. Retorna quantas
 * cópias foram removidas.
 */
export async function limparPadroesDeNaoVendem(tarefas: Tarefa[], clientes: Cliente[]): Promise<number> {
  const vende = new Map(clientes.map(c => [c.id, c.ja_vende]))
  const alvo = tarefas.filter(t => t.template_id && t.cliente_id && vende.get(t.cliente_id) === false)
  let n = 0
  for (const t of alvo) {
    try { await remove('tarefas', t.id); n++ }
    catch (err) { console.warn('Não foi possível remover tarefa padrão de cliente que não vende:', err) }
  }
  return n
}

/**
 * Sincroniza o responsável das tarefas com o colaborador definido na aba
 * Clientes (tarefas comuns e cópias de tarefa padrão são tratadas igual, já
 * que ambas têm 1 cliente e 1 responsável por linha). Não mexe em modelos
 * padrão. Retorna quantas tarefas foram atualizadas.
 */
export async function sincronizarResponsaveis(tarefas: Tarefa[], clientes: Cliente[], membros: Membro[]): Promise<number> {
  const byId = new Map(clientes.map(c => [c.id, c]))
  let n = 0
  for (const t of tarefas) {
    if (t.padrao || !t.cliente_id) continue
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
