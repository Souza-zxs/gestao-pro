// Painel retrátil "A vencer / Feitas", embutido no quadro Kanban de Tarefas.
// "A vencer": tarefas ativas com prazo, mais próximas primeiro (vermelho se
// atrasada). "Feitas": histórico de tarefas_concluidas, detalhado, com selo
// de "no prazo"/"atrasada" quando dá pra comparar com o prazo original.

import { useMemo } from 'react'
import { format, parseISO, isValid, isBefore, isAfter, startOfDay } from 'date-fns'
import type { Tarefa, TarefaConcluida } from '@/lib/types'
import { Card, Badge } from '@/components/ui'
import { IconCalendar, IconCheck } from '@/components/icons'

const PRIO_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' } as const
const PRIO_COR = { alta: 'red', media: 'amber', baixa: 'gray' } as const

const hoje = () => startOfDay(new Date())
const fmtCurta = (d?: string | null) => (d && isValid(parseISO(d)) ? format(parseISO(d), 'dd/MM') : '')
const fmtLonga = (d: string) => (isValid(parseISO(d)) ? format(parseISO(d), 'dd/MM/yyyy HH:mm') : '—')
const atrasada = (t: Tarefa) => !!t.prazo && isValid(parseISO(t.prazo)) && isBefore(parseISO(t.prazo), hoje())

function clienteDe(t: Tarefa | TarefaConcluida): string {
  if ('clientes' in t && t.clientes?.length) return t.clientes.map(c => c.nome).filter(Boolean).join(', ')
  return t.cliente_nome || ''
}

// Comparação "no prazo" vs "atrasada" para uma conclusão: o dia da conclusão
// é depois do dia do prazo original.
function statusConclusao(r: TarefaConcluida): 'no_prazo' | 'atrasada' | null {
  if (!r.prazo || !isValid(parseISO(r.prazo))) return null
  const concl = parseISO(r.concluida_em)
  if (!isValid(concl)) return null
  return isAfter(startOfDay(concl), parseISO(r.prazo)) ? 'atrasada' : 'no_prazo'
}

export default function PainelPrazos({
  tarefas, concluidas, onEditar,
}: { tarefas: Tarefa[]; concluidas: TarefaConcluida[]; onEditar: (t: Tarefa) => void }) {
  const aVencer = useMemo(
    () => tarefas.filter(t => t.prazo).sort((a, b) => (a.prazo || '').localeCompare(b.prazo || '')),
    [tarefas],
  )
  const semPrazo = tarefas.length - aVencer.length

  const feitas = useMemo(
    () => [...concluidas].sort((a, b) => b.concluida_em.localeCompare(a.concluida_em)),
    [concluidas],
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <IconCalendar className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">A vencer</h3>
          <span className="text-xs text-gray-400 tabular-nums">{aVencer.length}</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/60">
          {aVencer.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhuma tarefa com prazo definido.</p>
          ) : aVencer.map(t => (
            <button
              key={t.id}
              onClick={() => onEditar(t)}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 leading-snug truncate">{t.titulo}</p>
                <span className={`shrink-0 text-[11px] font-medium ${atrasada(t) ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
                  {fmtCurta(t.prazo)}
                </span>
              </div>
              <p className="text-[11.5px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                {[clienteDe(t), t.responsavel_nome].filter(Boolean).join(' · ') || '—'}
              </p>
            </button>
          ))}
        </div>
        {semPrazo > 0 && (
          <p className="text-[11px] text-gray-400 dark:text-gray-600 text-center py-2 border-t border-gray-50 dark:border-gray-800/60">
            {semPrazo} tarefa(s) sem prazo definido (não listadas aqui)
          </p>
        )}
      </Card>

      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <IconCheck className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Feitas</h3>
          <span className="text-xs text-gray-400 tabular-nums">{feitas.length}</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/60">
          {feitas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhuma tarefa concluída ainda.</p>
          ) : feitas.map(r => {
            const st = statusConclusao(r)
            return (
              <div key={r.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 leading-snug truncate">{r.titulo}</p>
                  {st && <Badge color={st === 'atrasada' ? 'red' : 'green'}>{st === 'atrasada' ? 'Atrasada' : 'No prazo'}</Badge>}
                </div>
                <p className="text-[11.5px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                  {[clienteDe(r), r.responsavel_nome].filter(Boolean).join(' · ') || '—'}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-gray-400 dark:text-gray-600">
                  <Badge color={PRIO_COR[r.prioridade]}>{PRIO_LABEL[r.prioridade]}</Badge>
                  <span>Concluída em {fmtLonga(r.concluida_em)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
