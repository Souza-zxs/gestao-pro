// Painel de análise de tarefas concluídas — só admin. Lê o histórico da tabela
// tarefas_concluidas (migration 015) e resume produtividade em métricas/gráficos.

import { useMemo, useState } from 'react'
import {
  format, parseISO, isValid, subDays, startOfDay, isAfter, differenceInCalendarDays,
} from 'date-fns'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import type { TarefaConcluida } from '@/lib/types'
import { Card, Metric, EmptyState, Select } from '@/components/ui'
import { IconClipboard, IconCheck } from '@/components/icons'

const PRIO_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' } as const
const PRIO_COR = { alta: '#dc2626', media: '#d97706', baixa: '#6b7280' } as const

const PERIODOS = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'todos', label: 'Todo o período' },
] as const

const dataDe = (r: TarefaConcluida) => (isValid(parseISO(r.concluida_em)) ? parseISO(r.concluida_em) : null)

export default function AnaliseTarefas({ registros }: { registros: TarefaConcluida[] }) {
  const [periodo, setPeriodo] = useState<string>('30')

  const filtrados = useMemo(() => {
    if (periodo === 'todos') return registros
    const limite = startOfDay(subDays(new Date(), Number(periodo) - 1))
    return registros.filter(r => { const d = dataDe(r); return d && !isAfter(limite, d) })
  }, [registros, periodo])

  const total = filtrados.length

  // Conclusões por dia (até 30 pontos para não poluir).
  const porDia = useMemo(() => {
    const dias = periodo === 'todos' ? 30 : Math.min(Number(periodo), 30)
    const base = startOfDay(new Date())
    const buckets = new Map<string, number>()
    for (let i = dias - 1; i >= 0; i--) buckets.set(format(subDays(base, i), 'yyyy-MM-dd'), 0)
    for (const r of filtrados) {
      const d = dataDe(r)
      if (!d) continue
      const k = format(d, 'yyyy-MM-dd')
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1)
    }
    return [...buckets.entries()].map(([data, qtd]) => ({ data, qtd }))
  }, [filtrados, periodo])

  // Ranking por responsável (top 8).
  const porResponsavel = useMemo(() => {
    const m = new Map<string, { nome: string; qtd: number }>()
    for (const r of filtrados) {
      const chave = r.responsavel_email || r.responsavel_nome || '—'
      const nome = r.responsavel_nome || r.responsavel_email || '—'
      const cur = m.get(chave) ?? { nome, qtd: 0 }
      cur.qtd++; m.set(chave, cur)
    }
    return [...m.values()].sort((a, b) => b.qtd - a.qtd).slice(0, 8)
  }, [filtrados])

  const porPrioridade = useMemo(() => {
    const c = { alta: 0, media: 0, baixa: 0 }
    for (const r of filtrados) c[r.prioridade]++
    return c
  }, [filtrados])

  const recorrentes = useMemo(() => filtrados.filter(r => r.recorrencia !== 'nenhuma').length, [filtrados])

  // Tempo médio de conclusão (dias entre criação e conclusão), quando há a data.
  const leadTimeMedio = useMemo(() => {
    const difs: number[] = []
    for (const r of filtrados) {
      const fim = dataDe(r)
      const ini = r.criada_em && isValid(parseISO(r.criada_em)) ? parseISO(r.criada_em) : null
      if (fim && ini) difs.push(Math.max(0, differenceInCalendarDays(fim, ini)))
    }
    if (!difs.length) return null
    return difs.reduce((a, b) => a + b, 0) / difs.length
  }, [filtrados])

  const recentes = useMemo(
    () => [...filtrados].sort((a, b) => (dataDe(b)?.getTime() ?? 0) - (dataDe(a)?.getTime() ?? 0)).slice(0, 10),
    [filtrados],
  )

  if (registros.length === 0) {
    return (
      <EmptyState
        icon={<IconCheck className="w-6 h-6" />}
        title="Nenhuma tarefa concluída ainda"
        description="Conclua tarefas no quadro para começar a acompanhar a produtividade da equipe aqui."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">Análise das tarefas concluídas pela equipe.</p>
        <Select value={periodo} onChange={e => setPeriodo(e.target.value)} className="!w-auto">
          {PERIODOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Concluídas no período" value={total.toString()} icon={<IconClipboard className="w-6 h-6" />} />
        <Metric label="Recorrentes concluídas" value={recorrentes.toString()} accent="text-violet-600" />
        <Metric label="Pessoas ativas" value={porResponsavel.length.toString()} accent="text-blue-600" />
        <Metric label="Tempo médio" value={leadTimeMedio == null ? '—' : `${leadTimeMedio.toFixed(1)}d`} accent="text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Conclusões por dia</h3>
          {total > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={porDia}>
                <defs>
                  <linearGradient id="gradTarefas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} tickFormatter={v => { try { return format(parseISO(v), 'dd/MM') } catch { return v } }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={v => [`${v}`, 'Concluídas']}
                  labelFormatter={v => { try { return format(parseISO(v as string), 'dd/MM/yyyy') } catch { return v as string } }}
                />
                <Area type="monotone" dataKey="qtd" stroke="#10b981" strokeWidth={2} fill="url(#gradTarefas)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-gray-400">Sem conclusões no período</div>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Por prioridade</h3>
          <div className="space-y-3 pt-2">
            {(['alta', 'media', 'baixa'] as const).map(p => {
              const qtd = porPrioridade[p]
              const pct = total ? Math.round((qtd / total) * 100) : 0
              return (
                <div key={p}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">{PRIO_LABEL[p]}</span>
                    <span className="font-medium text-gray-900">{qtd} <span className="text-gray-400 font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PRIO_COR[p] }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Concluídas por responsável</h3>
          {porResponsavel.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(160, porResponsavel.length * 38)}>
              <BarChart data={porResponsavel} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => [`${v}`, 'Concluídas']} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="qtd" radius={[0, 4, 4, 0]} fill="#2563eb">
                  {porResponsavel.map((_, i) => <Cell key={i} fill="#2563eb" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[160px] flex items-center justify-center text-sm text-gray-400">Sem dados no período</div>
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Conclusões recentes</h3>
          {recentes.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {recentes.map(r => {
                const d = dataDe(r)
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.titulo}</p>
                      <p className="text-xs text-gray-400 truncate">{r.responsavel_nome || r.responsavel_email || '—'}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{d ? format(d, 'dd/MM HH:mm') : '—'}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6">Sem conclusões no período</p>
          )}
        </Card>
      </div>
    </div>
  )
}
