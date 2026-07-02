// Lógica de tarefas padrão (gerais). Uma tarefa padrão é um MODELO (padrao=true,
// sem cliente); cada cliente recebe uma CÓPIA (padrao=false, template_id = modelo,
// um único cliente) que vira card no quadro. Ver migration 021.

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
// (o responsável escolhido no formulário).
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

// Payload de uma cópia (card por cliente) a partir de um modelo padrão.
// O responsável é o colaborador do próprio cliente (ver responsavelDoCliente).
function copiaPayload(tpl: ModeloTarefa, c: Cliente, resp: { responsavel_nome: string; responsavel_email: string }) {
  return {
    titulo: tpl.titulo,
    descricao: tpl.descricao,
    responsavel_nome: resp.responsavel_nome,
    responsavel_email: resp.responsavel_email,
    prioridade: tpl.prioridade,
    status: 'a_fazer' as const,
    recorrencia: tpl.recorrencia,
    prazo: tpl.prazo ?? null,
    padrao: false,
    template_id: tpl.id,
    clientes: [tarefaClienteDe(c)],
    cliente_id: c.id,
    cliente_nome: c.nome,
  }
}

/**
 * Ao criar um cliente (ou ao marcá-lo como "já vende"): gera uma cópia de cada
 * tarefa padrão para ele. Só clientes que JÁ VENDEM recebem tarefas padrão.
 * Idempotente — pula modelos que já têm cópia para este cliente.
 * Best-effort: nunca lança (não deve impedir o cadastro do cliente).
 * Retorna quantas cópias foram criadas.
 */
export async function aplicarPadroesAoCliente(cliente: Cliente): Promise<number> {
  // Tarefas padrão são exclusivas de clientes que já vendem.
  if (!cliente.ja_vende) return 0
  try {
    const [tarefas, membros] = await Promise.all([
      getAll<Tarefa>('tarefas', { order: null }),
      getAll<Membro>('membros', { order: null }).catch(() => [] as Membro[]),
    ])
    const modelos = tarefas.filter(t => t.padrao)
    if (modelos.length === 0) return 0
    // Modelos que já têm cópia para este cliente (evita duplicar).
    const jaTem = new Set(
      tarefas.filter(t => t.template_id && t.cliente_id === cliente.id).map(t => t.template_id),
    )
    let n = 0
    for (const tpl of modelos) {
      if (jaTem.has(tpl.id)) continue
      const resp = responsavelDoCliente(cliente, membros, {
        responsavel_nome: tpl.responsavel_nome, responsavel_email: tpl.responsavel_email,
      })
      await insert('tarefas', copiaPayload(tpl, cliente, resp))
      n++
    }
    return n
  } catch (err) {
    console.warn('Não foi possível aplicar as tarefas padrão ao cliente:', err)
    return 0
  }
}

/**
 * Ao criar/marcar uma tarefa padrão: gera uma cópia dela para cada cliente
 * que JÁ VENDE (clientes que ainda não vendem são ignorados).
 * Idempotente — pula clientes que já têm cópia deste modelo.
 * Retorna quantas cópias foram criadas.
 */
export async function aplicarPadraoATodos(template: ModeloTarefa, clientes: Cliente[], membros: Membro[] = []): Promise<number> {
  const existentes = await getAll<Tarefa>('tarefas', { order: null, match: { template_id: template.id } })
    .catch(() => [] as Tarefa[])
  const jaTem = new Set(existentes.map(t => t.cliente_id))
  let n = 0
  for (const c of clientes) {
    if (!c.ja_vende || jaTem.has(c.id)) continue
    const resp = responsavelDoCliente(c, membros, {
      responsavel_nome: template.responsavel_nome, responsavel_email: template.responsavel_email,
    })
    await insert('tarefas', copiaPayload(template, c, resp))
    n++
  }
  return n
}

/**
 * Remove todas as cópias de tarefa padrão de um cliente (usado quando ele deixa
 * de vender). Não mexe nos modelos nem em tarefas comuns. Best-effort.
 * Retorna quantas cópias foram removidas.
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
 * Reconciliação: remove cópias de tarefa padrão de clientes que NÃO vendem.
 * Só considera clientes conhecidos (presentes na lista) — evita apagar cópias
 * de clientes que o usuário não carregou. Retorna quantas cópias removeu.
 */
export async function limparPadroesDeNaoVendem(tarefas: Tarefa[], clientes: Cliente[]): Promise<number> {
  const vende = new Map(clientes.map(c => [c.id, c.ja_vende]))
  const alvo = tarefas.filter(t => t.template_id && t.cliente_id && vende.get(t.cliente_id) === false)
  let n = 0
  for (const t of alvo) {
    try { await remove('tarefas', t.id); n++ }
    catch (err) { console.warn('Não foi possível remover cópia de tarefa padrão:', err) }
  }
  return n
}

/**
 * Sincroniza o responsável das tarefas (cards por cliente) com o colaborador
 * definido na aba Clientes. Para cada tarefa vinculada a um cliente conhecido
 * que tenha responsável, ajusta `responsavel_nome`/`responsavel_email` para o
 * do cliente (resolvido pela Equipe). Não mexe em modelos padrão nem em
 * tarefas de clientes sem responsável (nada a sincronizar). Retorna quantas
 * tarefas foram atualizadas.
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
 * Atualiza o responsável de todas as tarefas de UM cliente para o colaborador
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
