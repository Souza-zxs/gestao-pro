// Automação de Resultados a partir do cadastro de Clientes.

import { getAll, insert } from './store'
import { responsavelDoCliente } from './tarefas'
import type { Cliente, Membro, Resultado } from './types'

const mesAtual = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Ao marcar um cliente como "já vende": cria automaticamente 1 registro de
 * Resultado vazio no mês atual, atribuído ao responsável do cliente — pronto
 * pra ser preenchido, sem precisar criar manualmente (mesma ideia de
 * `aplicarPadroesAoCliente` para Tarefas). Só cria se o responsável do
 * cliente corresponder a um membro da equipe com e-mail: sem e-mail
 * resolvido, a RLS de `resultados` não deixaria nenhum colaborador enxergar
 * o registro, então pulamos. Idempotente — não duplica se já existe um
 * resultado deste cliente no mês. Best-effort: nunca lança.
 * Retorna true se criou o registro.
 */
export async function criarResultadoInicialDoCliente(cliente: Cliente, membros: Membro[]): Promise<boolean> {
  if (!cliente.ja_vende) return false
  try {
    const resp = responsavelDoCliente(cliente, membros, { responsavel_nome: '', responsavel_email: '' })
    if (!resp.responsavel_email) return false
    const mes = mesAtual()
    const existentes = await getAll<Resultado>('resultados', { order: null, match: { cliente_id: cliente.id, mes } })
    if (existentes.length > 0) return false
    await insert('resultados', {
      colaborador_nome: resp.responsavel_nome, colaborador_email: resp.responsavel_email,
      cliente_id: cliente.id, cliente_nome: cliente.nome, mes,
      faturamento_anterior: 0, meta_mes: 0,
      semana_1: 0, semana_2: 0, semana_3: 0, semana_4: 0, semana_5: 0,
      pedidos_1: 0, pedidos_2: 0, pedidos_3: 0, pedidos_4: 0, pedidos_5: 0,
      cancelados_1: 0, cancelados_2: 0, cancelados_3: 0, cancelados_4: 0, cancelados_5: 0,
      pedidos_cancelados: 0, projecao: 0, status: 'Linear',
    })
    return true
  } catch (err) {
    console.warn('Não foi possível criar o resultado inicial do cliente:', err)
    return false
  }
}
