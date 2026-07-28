// Aba "Checklist": tarefas recorrentes iguais para 2+ clientes do mesmo
// colaborador (mesma tarefa padrão ou mesmo título criado manualmente para
// vários clientes) viram um único card com uma checklist de clientes, em vez
// de N cards soltos no quadro (ver checklistUtils.ts para a regra de
// agrupamento/pendência). Um "board" (seção) por colaborador — como páginas
// separadas de um Notion — nunca mistura pessoas diferentes num mesmo card.

import { useMemo } from 'react'
import type { Tarefa } from '@/lib/types'
import type { ChecklistGrupo } from './checklistUtils'
import { identidadeResp } from './checklistUtils'
import { corAvatar, iniciais } from './avatar'
import { Card, Badge, EmptyState } from '@/components/ui'
import { IconCheck, IconClipboard, IconEdit, IconTrash } from '@/components/icons'

const REC_LABEL = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' } as const

export default function ChecklistTarefas({
  grupos, tarefas, filtroRec, onConcluirLinha, onEditar, onExcluirLinha,
}: {
  grupos: ChecklistGrupo[]
  tarefas: Tarefa[]
  filtroRec: 'todas' | 'diaria' | 'semanal' | 'mensal'
  onConcluirLinha: (t: Tarefa) => void
  onEditar: (t: Tarefa) => void
  onExcluirLinha: (t: Tarefa) => void
}) {
  // Só mostra grupos com pelo menos 1 cliente ainda pendente (o resto some,
  // exatamente como um card normal some ao ser concluído).
  const visiveis = useMemo(
    () => grupos.filter(g => g.linhas.some(l => l.pendente) && (filtroRec === 'todas' || g.recorrencia === filtroRec)),
    [grupos, filtroRec],
  )

  // 1 seção por colaborador — nunca junta pessoas diferentes num mesmo bloco,
  // mesmo que tenham uma tarefa de título igual.
  const porColaborador = useMemo(() => {
    const mapa = new Map<string, { nome: string; grupos: ChecklistGrupo[] }>()
    for (const g of visiveis) {
      const chave = identidadeResp({ responsavel_email: g.responsavel_email, responsavel_nome: g.responsavel_nome })
      const cur = mapa.get(chave) ?? { nome: g.responsavel_nome || g.responsavel_email || '—', grupos: [] }
      cur.grupos.push(g)
      mapa.set(chave, cur)
    }
    return [...mapa.entries()].map(([chave, v]) => ({ chave, ...v })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [visiveis])

  if (porColaborador.length === 0) {
    return (
      <EmptyState
        icon={<IconClipboard className="w-6 h-6" />}
        title="Nenhum checklist pendente"
        description="Quando um colaborador tiver a mesma tarefa recorrente em 2 ou mais clientes, ela aparece aqui agrupada."
      />
    )
  }

  return (
    <div className="space-y-8">
      {porColaborador.map(secao => (
        <div key={secao.chave}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${corAvatar(secao.nome)}`}>
              {iniciais(secao.nome)}
            </span>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{secao.nome}</h2>
            <span className="text-xs text-gray-400 tabular-nums">{secao.grupos.length}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {secao.grupos.map(g => {
              const template = g.templateId ? tarefas.find(t => t.id === g.templateId) : undefined
              const feitas = g.linhas.filter(l => !l.pendente).length
              return (
                <Card key={g.key} className="!p-0 overflow-hidden">
                  <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2.5 border-b border-gray-100 dark:border-gray-800">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-gray-900 dark:text-gray-100 leading-snug truncate">{g.titulo}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <Badge color="blue">{REC_LABEL[g.recorrencia]}</Badge>
                        {g.templateId && <Badge color="gray">Padrão</Badge>}
                        <span className="text-[11px] text-gray-400 tabular-nums">{feitas}/{g.linhas.length} feitas</span>
                      </div>
                    </div>
                    {template && (
                      <button
                        onClick={() => onEditar(template)}
                        title="Editar tarefa padrão (aplica a todos os clientes)"
                        className="shrink-0 p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <IconEdit className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
                    {g.linhas.map(l => (
                      <div key={l.tarefa.id} className="flex items-center gap-2.5 px-4 py-2.5 group">
                        <input
                          type="checkbox"
                          checked={!l.pendente}
                          disabled={!l.pendente}
                          onChange={() => onConcluirLinha(l.tarefa)}
                          className="w-4 h-4 accent-blue-600 shrink-0 disabled:cursor-not-allowed"
                          title={l.pendente ? 'Marcar como concluída' : 'Já concluída'}
                        />
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${corAvatar(l.cliente?.nome || '')}`}>
                          {iniciais(l.cliente?.nome || '')}
                        </span>
                        <span className={`text-[12.5px] truncate flex-1 min-w-0 ${l.pendente ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600 line-through'}`}>
                          {l.cliente?.nome || '—'}
                        </span>
                        {!l.pendente && <IconCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                        {!g.templateId && (
                          <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => onEditar(l.tarefa)} title="Editar" className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                              <IconEdit className="w-3 h-3" />
                            </button>
                            <button onClick={() => onExcluirLinha(l.tarefa)} title="Excluir" className="p-1 rounded text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                              <IconTrash className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
