// Automação de Resultados a partir do cadastro de Clientes.

import { getAll, insert } from './store'
import { responsavelDoCliente } from './tarefas'
import type { Cliente, Membro, Resultado } from './types'

const anoAtual = () => String(new Date().getFullYear())

/**
 * Ao marcar um cliente como "já vende": cria automaticamente 1 registro de
 * Resultado vazio no ano atual, atribuído ao responsável do cliente — pronto
 * pra ser preenchido mês a mês, sem precisar criar manualmente (mesma ideia
 * de `aplicarPadroesAoCliente` para Tarefas). Só cria se o responsável do
 * cliente corresponder a um membro da equipe com e-mail: sem e-mail
 * resolvido, a RLS de `resultados` não deixaria nenhum colaborador enxergar
 * o registro, então pulamos. Idempotente — não duplica se já existe um
 * resultado deste cliente no ano. Best-effort: nunca lança.
 * Retorna true se criou o registro.
 */
export async function criarResultadoInicialDoCliente(cliente: Cliente, membros: Membro[]): Promise<boolean> {
  if (!cliente.ja_vende) return false
  try {
    const resp = responsavelDoCliente(cliente, membros, { responsavel_nome: '', responsavel_email: '' })
    if (!resp.responsavel_email) return false
    const ano = anoAtual()
    const existentes = await getAll<Resultado>('resultados', { order: null, match: { cliente_id: cliente.id, ano } })
    if (existentes.length > 0) return false
    await insert('resultados', {
      colaborador_nome: resp.responsavel_nome, colaborador_email: resp.responsavel_email,
      cliente_id: cliente.id, cliente_nome: cliente.nome, ano,
      fat_1: 0, fat_2: 0, fat_3: 0, fat_4: 0, fat_5: 0, fat_6: 0, fat_7: 0, fat_8: 0, fat_9: 0, fat_10: 0, fat_11: 0, fat_12: 0,
      meta_1: 0, meta_2: 0, meta_3: 0, meta_4: 0, meta_5: 0, meta_6: 0, meta_7: 0, meta_8: 0, meta_9: 0, meta_10: 0, meta_11: 0, meta_12: 0,
      fat_anterior_1: 0, fat_anterior_2: 0, fat_anterior_3: 0, fat_anterior_4: 0, fat_anterior_5: 0, fat_anterior_6: 0,
      fat_anterior_7: 0, fat_anterior_8: 0, fat_anterior_9: 0, fat_anterior_10: 0, fat_anterior_11: 0, fat_anterior_12: 0,
      pedidos_1: 0, pedidos_2: 0, pedidos_3: 0, pedidos_4: 0, pedidos_5: 0, pedidos_6: 0,
      pedidos_7: 0, pedidos_8: 0, pedidos_9: 0, pedidos_10: 0, pedidos_11: 0, pedidos_12: 0,
      cancelados_1: 0, cancelados_2: 0, cancelados_3: 0, cancelados_4: 0, cancelados_5: 0, cancelados_6: 0,
      cancelados_7: 0, cancelados_8: 0, cancelados_9: 0, cancelados_10: 0, cancelados_11: 0, cancelados_12: 0,
      projecao: 0, status: 'Linear',
    })
    return true
  } catch (err) {
    console.warn('Não foi possível criar o resultado inicial do cliente:', err)
    return false
  }
}
