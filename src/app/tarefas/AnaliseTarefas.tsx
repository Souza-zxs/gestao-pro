// Painel de análise de tarefas concluídas — só admin. Lê o histórico da tabela
// tarefas_concluidas (migration 015) e resume produtividade em métricas/gráficos.
// Duas abas: visão geral da equipe e um recorte por colaborador específico.
// O filtro de período (dia/semana/mês/ano + dia da semana) é o "calendário" do
// dashboard de acompanhamento — ver periodoUtils.ts.

import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, isValid, differenceInCalendarDays } from 'date-fns'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import type { Tarefa, TarefaConcluida } from '@/lib/types'
import { Card, Metric, EmptyState, Select, Tabs, Badge, Button } from '@/components/ui'
import { IconClipboard, IconCheck, IconChevronLeft, IconChevronRight } from '@/components/icons'
import PainelPrazos from './PainelPrazos'
import MiniCalendario from './MiniCalendario'
import {
  type Granularidade, type FiltroPeriodo,
  intervaloDe, navegar, dataDentroDoFiltro, calcPorPeriodo, labelDoFiltro, taxaConclusao,
} from './periodoUtils'

const chaveRespTarefa = (t: Tarefa) => t.responsavel_email || t.responsavel_nome || '—'
const clienteDeTarefa = (t: Tarefa) => (t.clientes?.length ? t.clientes.map(c => c.nome).filter(Boolean).join(', ') : t.cliente_nome || '')

const PRIO_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' } as const
const PRIO_COR = { alta: '#dc2626', media: '#d97706', baixa: '#6b7280' } as const
const UNIDADE_REC = { diaria: 'dias', semanal: 'semanas', mensal: 'meses' } as const
const NOMES_DIA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const GRANULARIDADES: { value: Granularidade; label: string }[] = [
  { value: 'dia', label: 'Dia' }, { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' }, { value: 'ano', label: 'Ano' },
]

const dataDe = (r: TarefaConcluida) => (isValid(parseISO(r.concluida_em)) ? parseISO(r.concluida_em) : null)
const chaveResp = (r: TarefaConcluida) => r.responsavel_email || r.responsavel_nome || '—'

/* ---------- Cálculos puros (reaproveitados na visão geral e por colaborador) ---------- */

function calcPorPrioridade(regs: TarefaConcluida[]) {
  const c = { alta: 0, media: 0, baixa: 0 }
  for (const r of regs) c[r.prioridade]++
  return c
}

function calcLeadTimeMedio(regs: TarefaConcluida[]): number | null {
  const difs: number[] = []
  for (const r of regs) {
    const fim = dataDe(r)
    const ini = r.criada_em && isValid(parseISO(r.criada_em)) ? parseISO(r.criada_em) : null
    if (fim && ini) difs.push(Math.max(0, differenceInCalendarDays(fim, ini)))
  }
  if (!difs.length) return null
  return difs.reduce((a, b) => a + b, 0) / difs.length
}

function calcRecentes(regs: TarefaConcluida[]) {
  return [...regs].sort((a, b) => (dataDe(b)?.getTime() ?? 0) - (dataDe(a)?.getTime() ?? 0)).slice(0, 10)
}

function calcPorResponsavel(regs: TarefaConcluida[]) {
  const m = new Map<string, { nome: string; qtd: number }>()
  for (const r of regs) {
    const chave = chaveResp(r)
    const cur = m.get(chave) ?? { nome: r.responsavel_nome || r.responsavel_email || '—', qtd: 0 }
    cur.qtd++; m.set(chave, cur)
  }
  return [...m.values()].sort((a, b) => b.qtd - a.qtd).slice(0, 8)
}

// Ranking de clientes atendidos (usado no recorte por colaborador) + total de
// clientes distintos (métrica de topo).
function calcPorCliente(regs: TarefaConcluida[]) {
  const m = new Map<string, number>()
  for (const r of regs) {
    if (!r.cliente_nome) continue
    m.set(r.cliente_nome, (m.get(r.cliente_nome) ?? 0) + 1)
  }
  const top = [...m.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 8)
  return { total: m.size, top }
}

// Recorrências relevantes para o período escolhido: uma tarefa só entra em
// "Feitas x Não feitas" se a granularidade combinar com a recorrência dela
// (diária em modo Dia/dia-da-semana, semanal em Semana, mensal em Mês; em Ano
// as três aparecem, já que todas cabem dentro de um ano).
function recorrenciasRelevantes(f: FiltroPeriodo): Tarefa['recorrencia'][] {
  if (f.tipo === 'diaSemana') return ['diaria']
  switch (f.granularidade) {
    case 'dia': return ['diaria']
    case 'semana': return ['semanal']
    case 'mes': return ['mensal']
    case 'ano': return ['diaria', 'semanal', 'mensal']
  }
}

/* ---------- Bloco de métricas + gráficos (compartilhado entre as abas) ---------- */

function ResumoBloco({ regs, filtro, metricExtra, ranking }: {
  regs: TarefaConcluida[]
  filtro: FiltroPeriodo
  metricExtra: { label: string; value: string; accent?: string }
  ranking: { titulo: string; dados: { nome: string; qtd: number }[] }
}) {
  const total = regs.length
  const porPeriodo = useMemo(() => calcPorPeriodo(regs, filtro), [regs, filtro])
  const porPrioridade = useMemo(() => calcPorPrioridade(regs), [regs])
  const recorrentes = useMemo(() => regs.filter(r => r.recorrencia !== 'nenhuma').length, [regs])
  const leadTimeMedio = useMemo(() => calcLeadTimeMedio(regs), [regs])
  const recentes = useMemo(() => calcRecentes(regs), [regs])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric label="Concluídas no período" value={total.toString()} icon={<IconClipboard className="w-6 h-6" />} />
        <Metric label="Recorrentes concluídas" value={recorrentes.toString()} accent="text-violet-600" />
        <Metric label={metricExtra.label} value={metricExtra.value} accent={metricExtra.accent ?? 'text-blue-600'} />
        <Metric label="Tempo médio" value={leadTimeMedio == null ? '—' : `${leadTimeMedio.toFixed(1)}d`} accent="text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Conclusões por período</h3>
          {total > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={porPeriodo}>
                <defs>
                  <linearGradient id="gradTarefas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => [`${v}`, 'Concluídas']} />
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
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{ranking.titulo}</h3>
          {ranking.dados.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(160, ranking.dados.length * 38)}>
              <BarChart data={ranking.dados} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => [`${v}`, 'Concluídas']} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="qtd" radius={[0, 4, 4, 0]} fill="#2563eb">
                  {ranking.dados.map((_, i) => <Cell key={i} fill="#2563eb" />)}
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
                      <p className="text-xs text-gray-400 truncate">{r.cliente_nome || r.responsavel_nome || r.responsavel_email || '—'}</p>
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

/* ---------- Feitas x Não feitas no período ---------- */

function FeitasNaoFeitas({ feitas, naoFeitas, historico, filtro }: {
  feitas: TarefaConcluida[]
  naoFeitas: Tarefa[]
  historico: TarefaConcluida[] // histórico completo (não só o período), p/ calcular taxaConclusao
  filtro: FiltroPeriodo
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <IconCheck className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Feitas no período</h3>
          <span className="text-xs text-gray-400 tabular-nums">{feitas.length}</span>
        </div>
        <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/60">
          {feitas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhuma conclusão no período.</p>
          ) : feitas.map(r => (
            <div key={r.id} className="px-4 py-2.5">
              <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 truncate">{r.titulo}</p>
              <p className="text-[11.5px] text-gray-400 truncate mt-0.5">
                {[r.cliente_nome, r.responsavel_nome].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <IconClipboard className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Não feitas no período</h3>
          <span className="text-xs text-gray-400 tabular-nums">{naoFeitas.length}</span>
        </div>
        <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/60">
          {naoFeitas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Tudo em dia no período.</p>
          ) : naoFeitas.map(t => {
            const taxa = t.recorrencia !== 'nenhuma' ? taxaConclusao(t, historico, filtro) : null
            return (
              <div key={t.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-gray-800 dark:text-gray-200 truncate">{t.titulo}</p>
                  <p className="text-[11.5px] text-gray-400 truncate mt-0.5">
                    {[clienteDeTarefa(t), t.responsavel_nome].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <Badge color={taxa && taxa.feitas > 0 ? 'amber' : 'red'}>
                  {taxa ? `${taxa.feitas}/${taxa.esperadas} ${UNIDADE_REC[t.recorrencia as 'diaria' | 'semanal' | 'mensal']}` : 'Não feita'}
                </Badge>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

/* ---------- Componente principal ---------- */

export default function AnaliseTarefas({ registros, tarefas, onEditar, mostrarPainel }: {
  registros: TarefaConcluida[]
  tarefas: Tarefa[]
  onEditar: (t: Tarefa) => void
  mostrarPainel: boolean
}) {
  const [aba, setAba] = useState<'geral' | 'colaborador'>('geral')
  const [colabSelecionado, setColabSelecionado] = useState('')

  // Filtro de período (o "calendário" do dashboard): granularidade dia/semana/
  // mês/ano, navegável, mais um recorte opcional por dia da semana (só no
  // modo Dia) — ver periodoUtils.ts.
  const [granularidade, setGranularidade] = useState<Granularidade>('mes')
  const [dataRef, setDataRef] = useState<Date>(() => new Date())
  const [diaSemanaSel, setDiaSemanaSel] = useState<number | null>(null)
  const [mesCalendario, setMesCalendario] = useState<Date>(() => new Date())
  useEffect(() => { if (granularidade === 'dia') setMesCalendario(dataRef) }, [granularidade, dataRef])

  const filtro: FiltroPeriodo = useMemo(() => {
    if (diaSemanaSel !== null) return { tipo: 'diaSemana', diaSemana: diaSemanaSel, mesRef: dataRef }
    const { inicio, fim } = intervaloDe(granularidade, dataRef)
    return { tipo: 'intervalo', granularidade, inicio, fim }
  }, [granularidade, dataRef, diaSemanaSel])

  function mudarGranularidade(g: Granularidade) { setGranularidade(g); setDiaSemanaSel(null) }
  function navegarPeriodo(direcao: 1 | -1) { setDataRef(d => navegar(granularidade, d, direcao)); setDiaSemanaSel(null) }
  function irParaHoje() { const agora = new Date(); setDataRef(agora); setDiaSemanaSel(null); setMesCalendario(agora) }
  function selecionarDiaCalendario(d: Date) { setDataRef(d); setDiaSemanaSel(null) }
  function alternarDiaSemana(dia: number) { setDiaSemanaSel(prev => prev === dia ? null : dia) }

  const filtrados = useMemo(
    () => registros.filter(r => { const d = dataDe(r); return d != null && dataDentroDoFiltro(d, filtro) }),
    [registros, filtro],
  )

  // Lista de colaboradores para o seletor: todo o histórico (não só o
  // período), pra não esvaziar o combo ao trocar o período.
  const colaboradoresDisponiveis = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of registros) if (!m.has(chaveResp(r))) m.set(chaveResp(r), r.responsavel_nome || r.responsavel_email || '—')
    return [...m.entries()].map(([chave, nome]) => ({ chave, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [registros])
  const colabAtivo = colaboradoresDisponiveis.some(c => c.chave === colabSelecionado)
    ? colabSelecionado
    : (colaboradoresDisponiveis[0]?.chave ?? '')
  const registrosColab = useMemo(() => filtrados.filter(r => chaveResp(r) === colabAtivo), [filtrados, colabAtivo])

  const porResponsavel = useMemo(() => calcPorResponsavel(filtrados), [filtrados])
  const porCliente = useMemo(() => calcPorCliente(registrosColab), [registrosColab])

  // Feitas x Não feitas: universo de tarefas recorrentes relevantes p/ a
  // granularidade escolhida, cruzado com o histórico do período selecionado.
  const recRelevantes = useMemo(() => recorrenciasRelevantes(filtro), [filtro])
  const tarefasEscopo = useMemo(
    () => tarefas.filter(t => aba === 'geral' || chaveRespTarefa(t) === colabAtivo),
    [tarefas, aba, colabAtivo],
  )
  const feitasBloco = aba === 'geral' ? filtrados : registrosColab
  const naoFeitas = useMemo(
    () => tarefasEscopo.filter(t => !t.padrao && recRelevantes.includes(t.recorrencia) && !feitasBloco.some(r => r.tarefa_id === t.id)),
    [tarefasEscopo, recRelevantes, feitasBloco],
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
    <div>
      <Tabs
        active={aba}
        onChange={setAba}
        tabs={[
          { value: 'geral', label: 'Visão geral' },
          { value: 'colaborador', label: 'Por colaborador' },
        ]}
        className="!mb-4"
      />

      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <p className="text-sm text-gray-500">
          {aba === 'geral' ? 'Análise das tarefas concluídas pela equipe.' : 'Análise das tarefas concluídas por um colaborador específico.'}
        </p>
        {aba === 'colaborador' && colaboradoresDisponiveis.length > 0 && (
          <Select value={colabAtivo} onChange={e => setColabSelecionado(e.target.value)} className="!w-auto">
            {colaboradoresDisponiveis.map(c => <option key={c.chave} value={c.chave}>{c.nome}</option>)}
          </Select>
        )}
      </div>

      {/* Filtro de período — o "calendário" do dashboard de acompanhamento. */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs active={granularidade} onChange={mudarGranularidade} tabs={GRANULARIDADES} />
          <div className="flex items-center gap-1.5">
            <button onClick={() => navegarPeriodo(-1)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <IconChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 min-w-[160px] text-center">
              {labelDoFiltro(filtro)}
            </span>
            <button onClick={() => navegarPeriodo(1)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <IconChevronRight className="w-4 h-4" />
            </button>
            <Button variant="secondary" className="!px-2.5 !py-1 !text-xs ml-1" onClick={irParaHoje}>Hoje</Button>
          </div>
        </div>

        {granularidade === 'dia' && (
          <div className="flex flex-wrap items-start gap-5 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <MiniCalendario
              mes={mesCalendario}
              onMudarMes={setMesCalendario}
              selecionado={diaSemanaSel === null ? dataRef : null}
              onSelecionar={selecionarDiaCalendario}
              diaSemanaDestaque={diaSemanaSel}
            />
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Ou filtre tarefas diárias por dia da semana (dentro do mês exibido)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {NOMES_DIA_CURTO.map((n, i) => (
                  <button
                    key={n}
                    onClick={() => alternarDiaSemana(i)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      diaSemanaSel === i
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Card>

      {mostrarPainel && (
        <PainelPrazos
          tarefas={aba === 'colaborador' ? tarefas.filter(t => chaveRespTarefa(t) === colabAtivo) : tarefas}
          concluidas={aba === 'colaborador' ? registrosColab : filtrados}
          onEditar={onEditar}
        />
      )}

      <div className="mb-6">
        {aba === 'geral' ? (
          <ResumoBloco
            regs={filtrados}
            filtro={filtro}
            metricExtra={{ label: 'Pessoas ativas', value: porResponsavel.length.toString(), accent: 'text-blue-600' }}
            ranking={{ titulo: 'Concluídas por responsável', dados: porResponsavel }}
          />
        ) : (
          <ResumoBloco
            regs={registrosColab}
            filtro={filtro}
            metricExtra={{ label: 'Clientes atendidos', value: porCliente.total.toString(), accent: 'text-emerald-600' }}
            ranking={{ titulo: 'Clientes mais atendidos', dados: porCliente.top }}
          />
        )}
      </div>

      <FeitasNaoFeitas feitas={feitasBloco} naoFeitas={naoFeitas} historico={registros} filtro={filtro} />
    </div>
  )
}
