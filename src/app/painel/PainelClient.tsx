'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, PieChart, Pie, Legend, LabelList,
} from 'recharts'
import { getAll } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { brl } from '@/lib/format'
import type { Resultado, Cliente } from '@/lib/types'
import { PageHeader, Card, Metric, Select, Badge, EmptyState, Spinner } from '@/components/ui'
import {
  IconChart, IconUsers, IconUserCircle, IconTarget, IconTrendingUp, IconInbox, IconBan,
} from '@/components/icons'

/* ─────────── Helpers de agregação (espelham ResultadosClient) ─────────── */
const totalMes = (r: Resultado) => r.semana_1 + r.semana_2 + r.semana_3 + r.semana_4 + r.semana_5
const totalPedidos = (r: Resultado) => r.pedidos_1 + r.pedidos_2 + r.pedidos_3 + r.pedidos_4 + r.pedidos_5
const totalCancelados = (r: Resultado) => r.cancelados_1 + r.cancelados_2 + r.cancelados_3 + r.cancelados_4 + r.cancelados_5
const totalValidos = (r: Resultado) => totalPedidos(r) - totalCancelados(r)

// Chave estável do cliente: usa o id quando existe, senão o nome.
const clienteKey = (r: Resultado) => r.cliente_id || `n:${(r.cliente_nome || '').toLowerCase().trim()}`

// 'YYYY-MM' -> 'mm/yyyy'.
const fmtMes = (m: string) => /^\d{4}-\d{2}$/.test(m) ? `${m.slice(5)}/${m.slice(0, 4)}` : (m || '—')
const fmtMesCurto = (m: string) => /^\d{4}-\d{2}$/.test(m) ? m.slice(5) + '/' + m.slice(2, 4) : (m || '—')

// Paleta cíclica para colaboradores/clientes nos gráficos.
const PALETTE = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#14b8a6', '#f97316', '#6366f1']
const corDe = (i: number) => PALETTE[i % PALETTE.length]

// Estilo compartilhado do tooltip (combina com o Dashboard existente).
const TOOLTIP_STYLE = {
  background: 'var(--color-gray-900, #111827)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#fff',
} as const

const eixo = { fontSize: 10, fill: '#9ca3af' }
const grid = 'rgba(0,0,0,0.06)'

// Detecta viewport de celular (< 640px = breakpoint sm do Tailwind) para
// ajustar densidade dos gráficos no toque.
function useIsMobile() {
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const on = () => setMobile(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}

/* ─────────── Card de gráfico ─────────── */
function ChartCard({ title, subtitle, children, className = '' }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string
}) {
  return (
    <Card className={className}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </Card>
  )
}

type Escopo = 'geral' | 'cliente'

// Dados agregados de um cliente para o âmbito individual.
interface DadosCliente {
  nome: string
  colaboradores: { nome: string; fat: number }[]
  ficha: Cliente | undefined
  fat: number; pedidos: number; cancelados: number; validos: number; meta: number; atingimento: number
  evolucao: { mes: string; fat: number; pedidos: number; cancelados: number; meta: number }[]
  semanas: { semana: string; fat: number; pedidos: number }[]
  linhas: number
}

export default function PainelClient() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  const [resultados, setResultados] = useState<Resultado[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [escopo, setEscopo] = useState<Escopo>('geral')
  const [filtroMes, setFiltroMes] = useState('todos')
  const [filtroColab, setFiltroColab] = useState('todos')
  const [clienteSel, setClienteSel] = useState('')

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    try {
      const [rs, cl] = await Promise.all([
        getAll<Resultado>('resultados', { order: { column: 'mes', ascending: true } }),
        getAll<Cliente>('clientes', { order: { column: 'nome', ascending: true } }).catch(() => [] as Cliente[]),
      ])
      setResultados(rs); setClientes(cl); setErro(null)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  /* ─────────── Opções de filtro ─────────── */
  const meses = useMemo(
    () => [...new Set(resultados.map(r => r.mes).filter(Boolean))].sort().reverse(),
    [resultados],
  )
  const colaboradores = useMemo(
    () => [...new Map(
      resultados.filter(r => r.colaborador_email)
        .map(r => [r.colaborador_email, r.colaborador_nome || r.colaborador_email]),
    ).entries()],
    [resultados],
  )
  // Clientes que têm resultados (para o âmbito individual).
  const clienteOpcoes = useMemo(() => {
    const map = new Map<string, string>()
    resultados.forEach(r => { if (r.cliente_nome) map.set(clienteKey(r), r.cliente_nome) })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [resultados])

  // Base filtrada pelo mês e colaborador (compartilhada pelo âmbito geral).
  const base = useMemo(() => resultados.filter(r => {
    if (filtroMes !== 'todos' && r.mes !== filtroMes) return false
    if (filtroColab !== 'todos' && r.colaborador_email !== filtroColab) return false
    return true
  }), [resultados, filtroMes, filtroColab])

  /* ─────────── Agregações do âmbito GERAL ─────────── */
  const kpis = useMemo(() => {
    const fat = base.reduce((s, r) => s + totalMes(r), 0)
    const pedidos = base.reduce((s, r) => s + totalPedidos(r), 0)
    const cancelados = base.reduce((s, r) => s + totalCancelados(r), 0)
    const validos = pedidos - cancelados
    const meta = base.reduce((s, r) => s + r.meta_mes, 0)
    const nClientes = new Set(base.map(clienteKey)).size
    const nColabs = new Set(base.filter(r => r.colaborador_email).map(r => r.colaborador_email)).size
    const ticket = validos > 0 ? fat / validos : 0
    const atingimento = meta > 0 ? (fat / meta) * 100 : 0
    return { fat, pedidos, cancelados, validos, meta, nClientes, nColabs, ticket, atingimento }
  }, [base])

  const porColaborador = useMemo(() => {
    const map = new Map<string, { nome: string; fat: number; pedidos: number; validos: number; cancelados: number; meta: number; clientes: Set<string> }>()
    base.forEach(r => {
      const k = r.colaborador_email || 's/ colaborador'
      const cur = map.get(k) || { nome: r.colaborador_nome || r.colaborador_email || '—', fat: 0, pedidos: 0, validos: 0, cancelados: 0, meta: 0, clientes: new Set<string>() }
      cur.fat += totalMes(r); cur.pedidos += totalPedidos(r)
      cur.validos += totalValidos(r); cur.cancelados += totalCancelados(r)
      cur.meta += r.meta_mes; cur.clientes.add(clienteKey(r))
      map.set(k, cur)
    })
    return [...map.values()]
      .map(v => ({ ...v, nClientes: v.clientes.size, atingimento: v.meta > 0 ? (v.fat / v.meta) * 100 : 0 }))
      .sort((a, b) => b.fat - a.fat)
  }, [base])

  const porCliente = useMemo(() => {
    const map = new Map<string, { nome: string; colab: string; fat: number; pedidos: number; validos: number; cancelados: number }>()
    base.forEach(r => {
      const k = clienteKey(r)
      const cur = map.get(k) || { nome: r.cliente_nome || '—', colab: r.colaborador_nome || '—', fat: 0, pedidos: 0, validos: 0, cancelados: 0 }
      cur.fat += totalMes(r); cur.pedidos += totalPedidos(r)
      cur.validos += totalValidos(r); cur.cancelados += totalCancelados(r)
      map.set(k, cur)
    })
    return [...map.values()].sort((a, b) => b.fat - a.fat)
  }, [base])

  // Evolução mensal (ignora o filtro de mês, mantém o de colaborador).
  const evolucaoMensal = useMemo(() => {
    const map = new Map<string, { mes: string; fat: number; pedidos: number; cancelados: number; meta: number }>()
    resultados
      .filter(r => filtroColab === 'todos' || r.colaborador_email === filtroColab)
      .forEach(r => {
        if (!r.mes) return
        const cur = map.get(r.mes) || { mes: r.mes, fat: 0, pedidos: 0, cancelados: 0, meta: 0 }
        cur.fat += totalMes(r); cur.pedidos += totalPedidos(r)
        cur.cancelados += totalCancelados(r); cur.meta += r.meta_mes
        map.set(r.mes, cur)
      })
    return [...map.values()].sort((a, b) => a.mes.localeCompare(b.mes))
  }, [resultados, filtroColab])

  /* ─────────── Âmbito INDIVIDUAL de cliente ─────────── */
  const dadosCliente = useMemo<DadosCliente | null>(() => {
    if (!clienteSel) return null
    const rows = resultados.filter(r => clienteKey(r) === clienteSel)
    if (rows.length === 0) return null

    const nome = rows[0].cliente_nome || '—'
    // Colaboradores responsáveis (aparecem na hora ao escolher o cliente).
    const colabMap = new Map<string, { nome: string; fat: number }>()
    rows.forEach(r => {
      const k = r.colaborador_email || r.colaborador_nome || '—'
      const cur = colabMap.get(k) || { nome: r.colaborador_nome || r.colaborador_email || '—', fat: 0 }
      cur.fat += totalMes(r); colabMap.set(k, cur)
    })
    const colaboradores = [...colabMap.values()].sort((a, b) => b.fat - a.fat)

    // Ficha do cliente (loja/plataforma/responsável) da tabela clientes.
    const ficha = clientes.find(c => c.id === rows[0].cliente_id) ||
      clientes.find(c => (c.nome || '').toLowerCase().trim() === (nome || '').toLowerCase().trim())

    const fat = rows.reduce((s, r) => s + totalMes(r), 0)
    const pedidos = rows.reduce((s, r) => s + totalPedidos(r), 0)
    const cancelados = rows.reduce((s, r) => s + totalCancelados(r), 0)
    const validos = pedidos - cancelados
    const meta = rows.reduce((s, r) => s + r.meta_mes, 0)
    const atingimento = meta > 0 ? (fat / meta) * 100 : 0

    // Evolução mês a mês.
    const porMes = new Map<string, { mes: string; fat: number; pedidos: number; cancelados: number; meta: number }>()
    rows.forEach(r => {
      if (!r.mes) return
      const cur = porMes.get(r.mes) || { mes: r.mes, fat: 0, pedidos: 0, cancelados: 0, meta: 0 }
      cur.fat += totalMes(r); cur.pedidos += totalPedidos(r)
      cur.cancelados += totalCancelados(r); cur.meta += r.meta_mes
      porMes.set(r.mes, cur)
    })
    const evolucao = [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes))

    // Faturamento/pedidos por semana — soma as linhas do mês selecionado, ou de tudo.
    const alvo = filtroMes !== 'todos' ? rows.filter(r => r.mes === filtroMes) : rows
    const semanas = [1, 2, 3, 4, 5].map(n => ({
      semana: `Sem ${n}`,
      fat: alvo.reduce((s, r) => s + (r[`semana_${n}` as keyof Resultado] as number || 0), 0),
      pedidos: alvo.reduce((s, r) => s + (r[`pedidos_${n}` as keyof Resultado] as number || 0), 0),
    }))

    return { nome, colaboradores, ficha, fat, pedidos, cancelados, validos, meta, atingimento, evolucao, semanas, linhas: rows.length }
  }, [clienteSel, resultados, clientes, filtroMes])

  if (loading) return <Spinner />

  const semDados = resultados.length === 0

  return (
    <div>
      <PageHeader
        title="Painel de Faturamento"
        subtitle="Faturamento e pedidos por cliente e colaborador — visão geral e individual"
      />

      {erro && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mb-4">
          Não foi possível carregar: {erro}
        </p>
      )}

      {semDados ? (
        <EmptyState
          icon={<IconChart className="w-6 h-6" />}
          title="Nenhum resultado cadastrado"
          description="Cadastre resultados (faturamento e pedidos por cliente) em Resultados para alimentar este painel."
        />
      ) : (
        <>
          {/* ── Barra de filtros ── */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 sm:gap-3 mb-6">
            {/* Segmented control de âmbito (full-width no celular) */}
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 w-full sm:w-auto">
              {([['geral', 'Geral'], ['cliente', 'Por cliente']] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setEscopo(v)}
                  className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    escopo === v
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <Select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className="!w-full sm:!w-auto">
              <option value="todos">Todos os meses</option>
              {meses.map(m => <option key={m} value={m}>{fmtMes(m)}</option>)}
            </Select>

            {escopo === 'geral' && colaboradores.length > 0 && (
              <Select value={filtroColab} onChange={e => setFiltroColab(e.target.value)} className="!w-full sm:!w-auto">
                <option value="todos">Todos os colaboradores</option>
                {colaboradores.map(([mail, nome]) => <option key={mail} value={mail}>{nome}</option>)}
              </Select>
            )}

            {escopo === 'cliente' && (
              <Select value={clienteSel} onChange={e => setClienteSel(e.target.value)} className="!w-full sm:!w-auto sm:min-w-[200px]">
                <option value="">Selecione um cliente…</option>
                {clienteOpcoes.map(([k, nome]) => <option key={k} value={k}>{nome}</option>)}
              </Select>
            )}
          </div>

          {escopo === 'geral'
            ? <VisaoGeral kpis={kpis} porColaborador={porColaborador} porCliente={porCliente} evolucaoMensal={evolucaoMensal} isAdmin={isAdmin} />
            : <VisaoCliente dados={dadosCliente} />}
        </>
      )}
    </div>
  )
}

/* ══════════════════════ ÂMBITO GERAL ══════════════════════ */
function VisaoGeral({ kpis, porColaborador, porCliente, evolucaoMensal, isAdmin }: {
  kpis: {
    fat: number; pedidos: number; cancelados: number; validos: number; meta: number
    nClientes: number; nColabs: number; ticket: number; atingimento: number
  }
  porColaborador: { nome: string; fat: number; pedidos: number; validos: number; cancelados: number; meta: number; nClientes: number; atingimento: number }[]
  porCliente: { nome: string; colab: string; fat: number; pedidos: number; validos: number; cancelados: number }[]
  evolucaoMensal: { mes: string; fat: number; pedidos: number; cancelados: number; meta: number }[]
  isAdmin: boolean
}) {
  const isMobile = useIsMobile()
  // No celular encurta rótulos, estreita o eixo e some com os labels R$ (o valor
  // aparece no tooltip ao tocar) para dar espaço às barras.
  const topClientes = porCliente.slice(0, 8).map(c => ({ ...c, label: c.nome.length > (isMobile ? 12 : 16) ? c.nome.slice(0, isMobile ? 11 : 15) + '…' : c.nome }))
  const colabChart = porColaborador.map(c => ({ ...c, label: c.nome.length > (isMobile ? 10 : 14) ? c.nome.slice(0, isMobile ? 9 : 13) + '…' : c.nome }))
  const barMargin = { top: 4, right: isMobile ? 12 : 56, left: 8, bottom: 4 }

  return (
    <>
      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <Metric label="Faturamento" value={brl(kpis.fat)} color="green" icon={<IconTrendingUp className="w-5 h-5" />} />
        <Metric label="Pedidos" value={kpis.pedidos.toLocaleString('pt-BR')} color="blue" icon={<IconInbox className="w-5 h-5" />} />
        <Metric label="Pedidos válidos" value={kpis.validos.toLocaleString('pt-BR')} color="green" />
        <Metric label="Cancelados" value={kpis.cancelados.toLocaleString('pt-BR')} color="red" icon={<IconBan className="w-5 h-5" />} />
        <Metric label="Ticket médio" value={brl(kpis.ticket)} color="accent" />
        <Metric label="Atingimento meta" value={kpis.meta > 0 ? `${kpis.atingimento.toFixed(0)}%` : '—'} color="amber" icon={<IconTarget className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Metric label="Clientes" value={kpis.nClientes.toString()} icon={<IconUserCircle className="w-5 h-5" />} />
        {isAdmin && <Metric label="Colaboradores" value={kpis.nColabs.toString()} icon={<IconUsers className="w-5 h-5" />} />}
        <Metric label="Meta total" value={brl(kpis.meta)} />
        <Metric label="Taxa cancelamento" value={kpis.pedidos > 0 ? `${((kpis.cancelados / kpis.pedidos) * 100).toFixed(1)}%` : '—'} color="red" />
      </div>

      {/* ── Evolução mensal ── */}
      <ChartCard
        title="Evolução mensal"
        subtitle="Faturamento (barras), meta (linha) e pedidos ao longo dos meses"
        className="mb-4"
      >
        {evolucaoMensal.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={evolucaoMensal} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="mes" tickFormatter={fmtMesCurto} tick={eixo} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={eixo} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="r" orientation="right" tick={eixo} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={m => fmtMes(m as string)}
                formatter={(v, n) => n === 'Pedidos' ? [Number(v).toLocaleString('pt-BR'), n] : [brl(Number(v)), n]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="l" dataKey="fat" name="Faturamento" fill="url(#gFat)" radius={[5, 5, 0, 0]} maxBarSize={48} />
              <Line yAxisId="l" type="monotone" dataKey="meta" name="Meta" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="pedidos" name="Pedidos" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <SemGrafico />}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Faturamento por colaborador */}
        <ChartCard title="Faturamento por colaborador" subtitle="Participação de cada colaborador no período">
          {colabChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, colabChart.length * 44)}>
              <BarChart data={colabChart} layout="vertical" margin={barMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                <XAxis type="number" tick={eixo} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="label" tick={eixo} axisLine={false} tickLine={false} width={isMobile ? 68 : 96} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                  formatter={(v) => [brl(Number(v)), 'Faturamento']} />
                <Bar dataKey="fat" radius={[0, 5, 5, 0]} maxBarSize={30}>
                  {colabChart.map((_, i) => <Cell key={i} fill={corDe(i)} />)}
                  {!isMobile && <LabelList dataKey="fat" position="right" formatter={(v: unknown) => brl(Number(v) || 0)} style={{ fontSize: 10, fill: '#9ca3af' }} />}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <SemGrafico />}
        </ChartCard>

        {/* Distribuição por colaborador (pizza) */}
        <ChartCard title="Distribuição do faturamento" subtitle="Fatia de cada colaborador">
          {colabChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, colabChart.length * 44)}>
              <PieChart>
                <Pie data={colabChart} dataKey="fat" nameKey="nome" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {colabChart.map((_, i) => <Cell key={i} fill={corDe(i)} stroke="transparent" />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [brl(Number(v)), n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <SemGrafico />}
        </ChartCard>
      </div>

      {/* Top clientes por faturamento */}
      <ChartCard title="Top clientes por faturamento" subtitle="Os 8 clientes que mais faturaram no período" className="mb-4">
        {topClientes.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, topClientes.length * 40)}>
            <BarChart data={topClientes} layout="vertical" margin={barMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
              <XAxis type="number" tick={eixo} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="label" tick={eixo} axisLine={false} tickLine={false} width={isMobile ? 84 : 120} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                formatter={(v) => [brl(Number(v)), 'Faturamento']} />
              <Bar dataKey="fat" fill="#3b82f6" radius={[0, 5, 5, 0]} maxBarSize={26}>
                {!isMobile && <LabelList dataKey="fat" position="right" formatter={(v: unknown) => brl(Number(v) || 0)} style={{ fontSize: 10, fill: '#9ca3af' }} />}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <SemGrafico />}
      </ChartCard>

      {/* Ranking de colaboradores (tabela) */}
      <Card padded={false}>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ranking de colaboradores</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Faturamento, pedidos e atingimento de meta</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">#</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Colaborador</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Faturamento</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Clientes</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Pedidos</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Cancelados</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Meta</th>
              </tr>
            </thead>
            <tbody>
              {porColaborador.map((c, i, arr) => (
                <tr key={i} className={i < arr.length - 1 ? 'border-b border-gray-50 dark:border-gray-800/60' : ''}>
                  <td className="px-5 py-3">
                    <span className="inline-flex w-6 h-6 rounded-lg items-center justify-center text-[11px] font-bold text-white" style={{ background: corDe(i) }}>{i + 1}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{c.nome}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">{brl(c.fat)}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{c.nClientes}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{c.pedidos.toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-right"><Badge color={c.cancelados > 0 ? 'red' : 'gray'}>{c.cancelados}</Badge></td>
                  <td className="px-5 py-3 text-right">
                    {c.meta > 0
                      ? <Badge color={c.atingimento >= 100 ? 'green' : c.atingimento >= 70 ? 'amber' : 'red'}>{c.atingimento.toFixed(0)}%</Badge>
                      : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

/* ══════════════════════ ÂMBITO INDIVIDUAL DE CLIENTE ══════════════════════ */
function VisaoCliente({ dados }: { dados: DadosCliente | null }) {
  if (!dados) {
    return (
      <EmptyState
        icon={<IconUserCircle className="w-6 h-6" />}
        title="Escolha um cliente"
        description="Selecione um cliente no filtro acima para ver o faturamento, os pedidos e o colaborador responsável."
      />
    )
  }

  const { nome, colaboradores, ficha, fat, pedidos, cancelados, validos, meta, atingimento, evolucao, semanas, linhas } = dados
  const colabPrincipal = colaboradores[0]

  return (
    <>
      {/* ── Cabeçalho do cliente + colaborador responsável ── */}
      <Card className="mb-5">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
              {nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 tracking-tight truncate">{nome}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {ficha?.loja && <Badge color="gray">{ficha.loja}</Badge>}
                {ficha?.plataforma && <Badge color="blue">{ficha.plataforma}</Badge>}
                <span className="text-xs text-gray-400 dark:text-gray-500">{linhas} {linhas === 1 ? 'registro' : 'registros'}</span>
              </div>
            </div>
          </div>

          {/* Colaborador responsável — aparece na hora ao escolher o cliente */}
          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3 w-full sm:w-auto sm:min-w-[220px]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">
              Colaborador responsável
            </p>
            {colabPrincipal ? (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full text-white flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: corDe(0) }}>
                  {colabPrincipal.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{colabPrincipal.nome}</p>
                  {colaboradores.length > 1 && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">+{colaboradores.length - 1} outro(s)</p>
                  )}
                </div>
              </div>
            ) : <p className="text-sm text-gray-400">—</p>}
            {ficha?.responsavel && ficha.responsavel !== colabPrincipal?.nome && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5">Conta atendida por {ficha.responsavel}</p>
            )}
          </div>
        </div>

        {/* Se houver mais de um colaborador com resultados neste cliente */}
        {colaboradores.length > 1 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-2">
            {colaboradores.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-gray-50 dark:bg-gray-800 rounded-full pl-1 pr-3 py-1">
                <span className="w-5 h-5 rounded-full text-white flex items-center justify-center text-[9px] font-bold" style={{ background: corDe(i) }}>
                  {c.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <span className="text-gray-700 dark:text-gray-300 font-medium">{c.nome}</span>
                <span className="text-gray-400">· {brl(c.fat)}</span>
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* ── KPIs do cliente ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <Metric label="Faturamento" value={brl(fat)} color="green" icon={<IconTrendingUp className="w-5 h-5" />} />
        <Metric label="Pedidos" value={pedidos.toLocaleString('pt-BR')} color="blue" icon={<IconInbox className="w-5 h-5" />} />
        <Metric label="Pedidos válidos" value={validos.toLocaleString('pt-BR')} color="green" />
        <Metric label="Cancelados" value={cancelados.toLocaleString('pt-BR')} color="red" icon={<IconBan className="w-5 h-5" />} />
        <Metric label="Meta" value={meta > 0 ? brl(meta) : '—'} color="amber" icon={<IconTarget className="w-5 h-5" />} />
        <Metric label="Atingimento" value={meta > 0 ? `${atingimento.toFixed(0)}%` : '—'} color="accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolução mensal do cliente */}
        <ChartCard title="Evolução mensal" subtitle="Faturamento, meta e pedidos do cliente">
          {evolucao.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={evolucao} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCli" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="mes" tickFormatter={fmtMesCurto} tick={eixo} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={eixo} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="r" orientation="right" tick={eixo} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={m => fmtMes(m as string)}
                  formatter={(v, n) => n === 'Pedidos' ? [Number(v).toLocaleString('pt-BR'), n] : [brl(Number(v)), n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="fat" name="Faturamento" fill="url(#gCli)" radius={[5, 5, 0, 0]} maxBarSize={44} />
                <Line yAxisId="l" type="monotone" dataKey="meta" name="Meta" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                <Line yAxisId="r" type="monotone" dataKey="pedidos" name="Pedidos" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <SemGrafico />}
        </ChartCard>

        {/* Faturamento por semana */}
        <ChartCard title="Faturamento por semana" subtitle="Distribuição semanal (mês selecionado ou soma de todos)">
          {semanas.some(s => s.fat > 0 || s.pedidos > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={semanas} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="semana" tick={eixo} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={eixo} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="r" orientation="right" tick={eixo} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE}
                  formatter={(v, n) => n === 'Pedidos' ? [Number(v).toLocaleString('pt-BR'), n] : [brl(Number(v)), n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="fat" name="Faturamento" fill="#8b5cf6" radius={[5, 5, 0, 0]} maxBarSize={44} />
                <Line yAxisId="r" type="monotone" dataKey="pedidos" name="Pedidos" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : <SemGrafico />}
        </ChartCard>
      </div>
    </>
  )
}

function SemGrafico() {
  return (
    <div className="h-[200px] flex flex-col items-center justify-center gap-2">
      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <IconChart className="w-4 h-4 text-gray-300 dark:text-gray-600" />
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">Sem dados para exibir</p>
    </div>
  )
}
