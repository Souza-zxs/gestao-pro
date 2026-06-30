'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAll, insert, update, remove } from '@/lib/store'
import { brl } from '@/lib/format'
import type {
  Lancamento, CategoriaFinanceira, LancamentoTipo, LancamentoStatus,
  FormaPagamento, RecorrenciaFin,
} from '@/lib/types'
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { format } from 'date-fns'
import {
  Card, Metric, Modal, Field, Input, Select, Textarea, EmptyState, Th,
  AddButton, Button, Badge, IconAction, RowActions, Tabs, CurrencyInput,
} from '@/components/ui'
import {
  IconWallet, IconTrash, IconEdit, IconTrendingUp, IconTrendingDown,
  IconTag, IconCheck, IconClock, IconSearch,
} from '@/components/icons'

/* ─── Constantes ────────────────────────────────────────────────── */
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const FORMAS: { value: FormaPagamento; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'outro', label: 'Outro' },
]
const formaLabel = (v: string) => FORMAS.find(f => f.value === v)?.label ?? '—'

const RECORRENCIAS: { value: RecorrenciaFin; label: string }[] = [
  { value: 'nenhuma', label: 'Não recorre' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'anual', label: 'Anual' },
]

const CORES = ['#22c55e','#10b981','#14b8a6','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#ec4899','#f43f5e','#ef4444','#f97316','#f59e0b','#eab308','#64748b']

// Categorias padrão de e-commerce/marketplace (semeadas sob demanda)
const SEED: { nome: string; tipo: LancamentoTipo; cor: string }[] = [
  { nome: 'Vendas Marketplace', tipo: 'entrada', cor: '#22c55e' },
  { nome: 'Repasse Shopee',     tipo: 'entrada', cor: '#f97316' },
  { nome: 'Repasse Mercado Livre', tipo: 'entrada', cor: '#eab308' },
  { nome: 'Comissões',          tipo: 'entrada', cor: '#14b8a6' },
  { nome: 'Outras receitas',    tipo: 'entrada', cor: '#06b6d4' },
  { nome: 'Tarifas Marketplace', tipo: 'saida', cor: '#f43f5e' },
  { nome: 'Anúncios / Ads',     tipo: 'saida', cor: '#ec4899' },
  { nome: 'Custo do Produto',   tipo: 'saida', cor: '#8b5cf6' },
  { nome: 'Frete / Logística',  tipo: 'saida', cor: '#6366f1' },
  { nome: 'Impostos',           tipo: 'saida', cor: '#ef4444' },
  { nome: 'Salários',           tipo: 'saida', cor: '#3b82f6' },
  { nome: 'Software / Assinaturas', tipo: 'saida', cor: '#0ea5e9' },
  { nome: 'Outras despesas',    tipo: 'saida', cor: '#64748b' },
]

const hoje = () => format(new Date(), 'yyyy-MM-dd')

const formVazio = () => ({
  descricao: '', valor: 0,
  tipo: 'entrada' as LancamentoTipo,
  status: 'realizado' as LancamentoStatus,
  categoria: '', conta: 'Seller Finance',
  forma_pagamento: 'pix' as FormaPagamento,
  cliente_fornecedor: '', documento: '', observacao: '',
  data: hoje(), data_vencimento: '' as string,
  recorrencia: 'nenhuma' as RecorrenciaFin,
})

/* ─── Tooltip de moeda ──────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 dark:bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1.5">Dia {label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || p.fill }} className="font-semibold">
          {p.name}: {brl(Number(p.value))}
        </p>
      ))}
    </div>
  )
}

/* ─── Breakdown por categoria (donut + lista) ───────────────────── */
function Breakdown({
  titulo, dados, total, vazio,
}: {
  titulo: string
  dados: { nome: string; valor: number; cor: string }[]
  total: number
  vazio: string
}) {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">{titulo}</h3>
      {dados.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 py-8 text-center">{vazio}</p>
      ) : (
        <div className="flex items-center gap-5">
          <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dados} dataKey="valor" nameKey="nome" innerRadius={38} outerRadius={56}
                  paddingAngle={dados.length > 1 ? 3 : 0} cornerRadius={4} stroke="none">
                  {dados.map((d, i) => <Cell key={i} fill={d.cor} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[9px] uppercase tracking-widest text-gray-400">Total</span>
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{brl(total)}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            {dados.map((d, i) => {
              const pct = total > 0 ? Math.round((d.valor / total) * 100) : 0
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.cor }} />
                  <span className="flex-1 truncate text-gray-600 dark:text-gray-300">{d.nome}</span>
                  <span className="tabular-nums text-gray-400 dark:text-gray-500">{pct}%</span>
                  <span className="tabular-nums font-semibold text-gray-900 dark:text-gray-100 w-20 text-right">{brl(d.valor)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}

/* ─── Componente principal ──────────────────────────────────────── */
export default function FinanceiroClient() {
  const now = new Date()
  const [tab, setTab] = useState<'visao' | 'lancamentos' | 'categorias'>('visao')

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [categorias, setCategorias]   = useState<CategoriaFinanceira[]>([])
  const [loading, setLoading]         = useState(true)

  const [mesSel, setMesSel] = useState(now.getMonth() + 1)
  const [anoSel, setAnoSel] = useState(now.getFullYear())

  // Modais
  const [showLanc, setShowLanc] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm]         = useState(formVazio())

  const [showCat, setShowCat]   = useState(false)
  const [catForm, setCatForm]   = useState({ nome: '', tipo: 'entrada' as LancamentoTipo, cor: CORES[0] })

  // Filtros da aba Lançamentos
  const [busca, setBusca]             = useState('')
  const [filtroTipo, setFiltroTipo]   = useState<'todos' | LancamentoTipo>('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | LancamentoStatus>('todos')
  const [filtroCat, setFiltroCat]     = useState<string>('todas')

  useEffect(() => { load() }, [mesSel, anoSel])

  async function load() {
    setLoading(true)
    const mesStr = String(mesSel).padStart(2, '0')
    const inicio = `${anoSel}-${mesStr}-01`
    const fim    = `${anoSel}-${mesStr}-31`
    const [todas, cats] = await Promise.all([
      getAll<Lancamento>('financeiro'),
      getAll<CategoriaFinanceira>('categorias_financeiras', { order: { column: 'nome' } }),
    ])
    setLancamentos(
      todas.filter(t => t.data >= inicio && t.data <= fim)
           .sort((a, b) => b.data.localeCompare(a.data))
    )
    setCategorias(cats)
    setLoading(false)
  }

  /* ── Lançamentos ── */
  function abrirNovo() {
    setEditId(null)
    setForm(formVazio())
    setShowLanc(true)
  }
  function abrirEdicao(l: Lancamento) {
    setEditId(l.id)
    setForm({
      descricao: l.descricao, valor: l.valor, tipo: l.tipo, status: l.status,
      categoria: l.categoria, conta: l.conta, forma_pagamento: (l.forma_pagamento || 'pix') as FormaPagamento,
      cliente_fornecedor: l.cliente_fornecedor, documento: l.documento, observacao: l.observacao,
      data: l.data, data_vencimento: l.data_vencimento ?? '', recorrencia: l.recorrencia,
    })
    setShowLanc(true)
  }

  async function salvarLanc(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      data_vencimento: form.status === 'previsto' && form.data_vencimento ? form.data_vencimento : null,
    }
    if (editId) await update<Lancamento>('financeiro', editId, payload)
    else await insert('financeiro', payload)
    setShowLanc(false)
    setEditId(null)
    setForm(formVazio())
    await load()
  }

  async function marcarRealizado(l: Lancamento) {
    await update<Lancamento>('financeiro', l.id, { status: 'realizado', data: hoje() })
    await load()
  }

  async function excluirLanc(id: string) {
    if (confirm('Excluir lançamento?')) { await remove('financeiro', id); await load() }
  }

  /* ── Categorias ── */
  async function salvarCat(e: React.FormEvent) {
    e.preventDefault()
    if (!catForm.nome.trim()) return
    await insert('categorias_financeiras', { ...catForm, nome: catForm.nome.trim() })
    setShowCat(false)
    setCatForm({ nome: '', tipo: 'entrada', cor: CORES[0] })
    await load()
  }
  async function excluirCat(id: string) {
    if (confirm('Excluir categoria? Os lançamentos existentes mantêm o nome.')) {
      await remove('categorias_financeiras', id); await load()
    }
  }
  async function semearCategorias() {
    for (const c of SEED) await insert('categorias_financeiras', c)
    await load()
  }

  /* ── Mapa nome → cor (fallback cinza) ── */
  const corDe = useMemo(() => {
    const m: Record<string, string> = {}
    categorias.forEach(c => { m[c.nome] = c.cor })
    return (nome: string) => m[nome] ?? '#94a3b8'
  }, [categorias])

  /* ── Métricas (estilo Seller Finance) ── */
  const m = useMemo(() => {
    let recReal = 0, despReal = 0, aReceber = 0, aPagar = 0
    for (const l of lancamentos) {
      const real = l.status === 'realizado'
      if (l.tipo === 'entrada') real ? recReal += l.valor : aReceber += l.valor
      else                      real ? despReal += l.valor : aPagar += l.valor
    }
    const saldoReal = recReal - despReal
    return { recReal, despReal, saldoReal, aReceber, aPagar, saldoPrev: saldoReal + aReceber - aPagar }
  }, [lancamentos])

  /* ── Fluxo diário (realizado) + saldo acumulado ── */
  const chartData = useMemo(() => {
    const byDia: Record<string, { entradas: number; saidas: number }> = {}
    lancamentos.filter(l => l.status === 'realizado').forEach(l => {
      const dia = l.data.slice(8, 10)
      byDia[dia] ??= { entradas: 0, saidas: 0 }
      if (l.tipo === 'entrada') byDia[dia].entradas += l.valor
      else byDia[dia].saidas += l.valor
    })
    let acc = 0
    return Object.entries(byDia).sort().map(([dia, v]) => {
      acc += v.entradas - v.saidas
      return { dia, ...v, saldo: acc }
    })
  }, [lancamentos])

  /* ── Breakdown por categoria ── */
  function breakdown(tipo: LancamentoTipo) {
    const byCat: Record<string, number> = {}
    lancamentos.filter(l => l.tipo === tipo).forEach(l => {
      const nome = l.categoria || 'Sem categoria'
      byCat[nome] = (byCat[nome] ?? 0) + l.valor
    })
    return Object.entries(byCat)
      .map(([nome, valor]) => ({ nome, valor, cor: corDe(nome) }))
      .sort((a, b) => b.valor - a.valor)
  }
  const receitasCat = useMemo(() => breakdown('entrada'), [lancamentos, categorias])
  const despesasCat = useMemo(() => breakdown('saida'), [lancamentos, categorias])

  /* ── Lançamentos filtrados (aba Lançamentos) ── */
  const filtrados = useMemo(() => lancamentos.filter(l => {
    if (filtroTipo !== 'todos' && l.tipo !== filtroTipo) return false
    if (filtroStatus !== 'todos' && l.status !== filtroStatus) return false
    if (filtroCat !== 'todas' && l.categoria !== filtroCat) return false
    if (busca && !`${l.descricao} ${l.cliente_fornecedor} ${l.documento}`.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  }), [lancamentos, filtroTipo, filtroStatus, filtroCat, busca])

  const periodoLabel = `${MESES[mesSel - 1]} ${anoSel}`
  const catsDoTipo = (t: LancamentoTipo) => categorias.filter(c => c.tipo === t)
  const emAberto = lancamentos
    .filter(l => l.status === 'previsto')
    .sort((a, b) => (a.data_vencimento ?? a.data).localeCompare(b.data_vencimento ?? b.data))

  /* ── Render ── */
  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-0.5">Gestão Pro</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Fluxo de Caixa</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Lançamentos, contas a pagar/receber e categorias</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <Select value={mesSel} onChange={e => setMesSel(+e.target.value)}
              className="!w-auto !bg-transparent !border-none !shadow-none !text-[11px] !py-1 !px-2 text-gray-700 dark:text-gray-300">
              {MESES.map((mm, i) => <option key={i} value={i + 1}>{mm}</option>)}
            </Select>
            <Select value={anoSel} onChange={e => setAnoSel(+e.target.value)}
              className="!w-auto !bg-transparent !border-none !shadow-none !text-[11px] !py-1 !px-2 text-gray-700 dark:text-gray-300">
              {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </Select>
          </div>
          <AddButton onClick={abrirNovo}>Lançamento</AddButton>
        </div>
      </div>

      <Tabs
        tabs={[
          { value: 'visao', label: 'Visão geral' },
          { value: 'lancamentos', label: 'Lançamentos' },
          { value: 'categorias', label: 'Categorias' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* ══════════ VISÃO GERAL ══════════ */}
      {tab === 'visao' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Metric label="Saldo realizado" value={brl(m.saldoReal)} color={m.saldoReal >= 0 ? 'green' : 'red'}
              icon={<IconWallet className="w-5 h-5" />} sub={`${brl(m.recReal)} − ${brl(m.despReal)}`} />
            <Metric label="A receber" value={brl(m.aReceber)} color="blue"
              icon={<IconTrendingUp className="w-5 h-5" />} sub="Entradas previstas" />
            <Metric label="A pagar" value={brl(m.aPagar)} color="amber"
              icon={<IconTrendingDown className="w-5 h-5" />} sub="Saídas previstas" />
            <Metric label="Saldo previsto" value={brl(m.saldoPrev)} color={m.saldoPrev >= 0 ? 'green' : 'red'}
              sub="Realizado + a receber − a pagar" />
          </div>

          {loading ? null : lancamentos.length === 0 ? (
            <EmptyState icon={<IconWallet className="w-5 h-5" />} title="Nenhum lançamento neste período"
              description="Registre entradas e saídas para acompanhar o fluxo de caixa."
              action={<AddButton onClick={abrirNovo}>Lançamento</AddButton>} />
          ) : (
            <>
              {chartData.length > 0 && (
                <Card className="mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Fluxo de caixa realizado</h3>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{periodoLabel}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-[10px] text-gray-400">Entradas</span></span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[10px] text-gray-400">Saídas</span></span>
                      <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-[10px] text-gray-400">Saldo acum.</span></span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={chartData} barGap={4} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradEntradas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.95} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.45} />
                        </linearGradient>
                        <linearGradient id="gradSaidas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.4} />
                        </linearGradient>
                        <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                      <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={56}
                        tickFormatter={v => `R$${Number(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                      <Area type="monotone" dataKey="saldo" name="Saldo acum." stroke="none" fill="url(#gradSaldo)" />
                      <Bar dataKey="entradas" name="Entradas" fill="url(#gradEntradas)" radius={[5, 5, 0, 0]} maxBarSize={26} />
                      <Bar dataKey="saidas" name="Saídas" fill="url(#gradSaidas)" radius={[5, 5, 0, 0]} maxBarSize={26} />
                      <Line type="monotone" dataKey="saldo" name="Saldo acum." stroke="#3b82f6" strokeWidth={2.5}
                        dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <Breakdown titulo="Receitas por categoria" dados={receitasCat} total={m.recReal + m.aReceber} vazio="Nenhuma receita no período" />
                <Breakdown titulo="Despesas por categoria" dados={despesasCat} total={m.despReal + m.aPagar} vazio="Nenhuma despesa no período" />
              </div>

              {emAberto.length > 0 && (
                <Card padded={false}>
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Contas em aberto</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{emAberto.length} lançamento(s) previsto(s)</p>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
                    {emAberto.map(l => (
                      <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: corDe(l.categoria) }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{l.descricao}</p>
                          <p className="text-[11px] text-gray-400 dark:text-gray-500">
                            {l.categoria || 'Sem categoria'}
                            {l.data_vencimento && ` · vence ${format(new Date(l.data_vencimento + 'T00:00:00'), 'dd/MM')}`}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold tabular-nums ${l.tipo === 'entrada' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {l.tipo === 'saida' ? '−' : '+'}{brl(l.valor)}
                        </span>
                        <IconAction onClick={() => marcarRealizado(l)} title="Marcar como realizado" color="blue">
                          <IconCheck className="w-4 h-4" />
                        </IconAction>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* ══════════ LANÇAMENTOS ══════════ */}
      {tab === 'lancamentos' && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[180px]">
              <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar descrição, cliente, documento…" className="!pl-9" />
            </div>
            <Select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)} className="!w-auto">
              <option value="todos">Todos os tipos</option>
              <option value="entrada">Entradas</option>
              <option value="saida">Saídas</option>
            </Select>
            <Select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as any)} className="!w-auto">
              <option value="todos">Todos os status</option>
              <option value="realizado">Realizado</option>
              <option value="previsto">Previsto</option>
            </Select>
            <Select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} className="!w-auto">
              <option value="todas">Todas as categorias</option>
              {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </Select>
          </div>

          {filtrados.length === 0 ? (
            <EmptyState icon={<IconWallet className="w-5 h-5" />} title="Nenhum lançamento"
              description="Ajuste os filtros ou registre um novo lançamento."
              action={<AddButton onClick={abrirNovo}>Lançamento</AddButton>} />
          ) : (
            <Card padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      <Th>Data</Th><Th>Descrição</Th><Th>Categoria</Th><Th>Cliente / Fornecedor</Th>
                      <Th>Forma</Th><Th>Status</Th><Th className="text-right">Valor</Th><Th className="text-right">Ações</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((l, i, arr) => (
                      <tr key={l.id} className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${i < arr.length - 1 ? 'border-b border-gray-50 dark:border-gray-800/60' : ''}`}>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                          {format(new Date(l.data + 'T00:00:00'), 'dd/MM/yyyy')}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-gray-900 dark:text-gray-100">
                          {l.descricao}
                          {l.documento && <span className="text-gray-400 dark:text-gray-500 font-normal"> · {l.documento}</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: corDe(l.categoria) }} />
                            {l.categoria || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{l.cliente_fornecedor || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{formaLabel(l.forma_pagamento)}</td>
                        <td className="px-4 py-3">
                          {l.status === 'realizado'
                            ? <Badge color="green">Realizado</Badge>
                            : <Badge color="amber">Previsto</Badge>}
                        </td>
                        <td className={`px-4 py-3 text-xs font-semibold tabular-nums text-right whitespace-nowrap ${l.tipo === 'entrada' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {l.tipo === 'saida' ? '−' : '+'}{brl(l.valor)}
                        </td>
                        <td className="px-4 py-3">
                          <RowActions>
                            {l.status === 'previsto' && (
                              <IconAction onClick={() => marcarRealizado(l)} title="Marcar como realizado" color="blue">
                                <IconCheck className="w-4 h-4" />
                              </IconAction>
                            )}
                            <IconAction onClick={() => abrirEdicao(l)} title="Editar" color="gray">
                              <IconEdit className="w-4 h-4" />
                            </IconAction>
                            <IconAction onClick={() => excluirLanc(l.id)} title="Excluir" color="red">
                              <IconTrash className="w-4 h-4" />
                            </IconAction>
                          </RowActions>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ══════════ CATEGORIAS ══════════ */}
      {tab === 'categorias' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400 dark:text-gray-500">{categorias.length} categoria(s)</p>
            <div className="flex gap-2">
              {categorias.length === 0 && (
                <Button variant="secondary" onClick={semearCategorias}>Criar categorias padrão</Button>
              )}
              <AddButton onClick={() => { setCatForm({ nome: '', tipo: 'entrada', cor: CORES[0] }); setShowCat(true) }}>Categoria</AddButton>
            </div>
          </div>

          {categorias.length === 0 ? (
            <EmptyState icon={<IconTag className="w-5 h-5" />} title="Nenhuma categoria ainda"
              description="Crie categorias de receita e despesa para classificar seu fluxo de caixa — ou comece pelas categorias padrão de marketplace."
              action={<Button onClick={semearCategorias}>Criar categorias padrão</Button>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['entrada', 'saida'] as LancamentoTipo[]).map(tipo => (
                <Card key={tipo} padded={false}>
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                    {tipo === 'entrada'
                      ? <IconTrendingUp className="w-4 h-4 text-green-500" />
                      : <IconTrendingDown className="w-4 h-4 text-red-500" />}
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {tipo === 'entrada' ? 'Receitas' : 'Despesas'}
                    </h3>
                    <span className="text-xs text-gray-400">({catsDoTipo(tipo).length})</span>
                  </div>
                  {catsDoTipo(tipo).length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 px-5 py-6">Nenhuma categoria de {tipo === 'entrada' ? 'receita' : 'despesa'}.</p>
                  ) : (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
                      {catsDoTipo(tipo).map(c => (
                        <div key={c.id} className="flex items-center gap-3 px-5 py-2.5 group">
                          <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: c.cor }} />
                          <span className="flex-1 text-xs text-gray-700 dark:text-gray-200">{c.nome}</span>
                          <IconAction onClick={() => excluirCat(c.id)} title="Excluir" color="red">
                            <IconTrash className="w-4 h-4" />
                          </IconAction>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════ MODAL LANÇAMENTO ══════════ */}
      <Modal open={showLanc} onClose={() => setShowLanc(false)} title={editId ? 'Editar lançamento' : 'Novo lançamento'} size="lg">
        <form onSubmit={salvarLanc} className="flex flex-col gap-4">
          {/* Tipo */}
          <Field label="Tipo">
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm(p => ({ ...p, tipo: 'entrada', categoria: '' }))}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${form.tipo === 'entrada' ? 'bg-green-600 text-white border-green-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                + Receita (entrada)
              </button>
              <button type="button" onClick={() => setForm(p => ({ ...p, tipo: 'saida', categoria: '' }))}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${form.tipo === 'saida' ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                − Despesa (saída)
              </button>
            </div>
          </Field>

          {/* Status */}
          <Field label="Status">
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm(p => ({ ...p, status: 'realizado' }))}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center justify-center gap-1.5 ${form.status === 'realizado' ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}>
                <IconCheck className="w-3.5 h-3.5" /> Realizado
              </button>
              <button type="button" onClick={() => setForm(p => ({ ...p, status: 'previsto' }))}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center justify-center gap-1.5 ${form.status === 'previsto' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}>
                <IconClock className="w-3.5 h-3.5" /> Previsto
              </button>
            </div>
          </Field>

          <Field label="Descrição">
            <Input required value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              placeholder="Ex: Repasse Shopee semana 12, Mídia Meta Ads…" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor">
              <CurrencyInput required value={form.valor}
                onValueChange={v => setForm(p => ({ ...p, valor: v }))}
                placeholder="0,00" />
            </Field>
            <Field label="Categoria">
              <Select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                <option value="">Sem categoria</option>
                {catsDoTipo(form.tipo).map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label={form.status === 'previsto' ? 'Data de competência' : 'Data do pagamento'}>
              <Input type="date" required value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
            </Field>
            {form.status === 'previsto' ? (
              <Field label="Vencimento">
                <Input type="date" value={form.data_vencimento} onChange={e => setForm(p => ({ ...p, data_vencimento: e.target.value }))} />
              </Field>
            ) : (
              <Field label="Forma de pagamento">
                <Select value={form.forma_pagamento} onChange={e => setForm(p => ({ ...p, forma_pagamento: e.target.value as FormaPagamento }))}>
                  {FORMAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </Select>
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Cliente / Fornecedor">
              <Input value={form.cliente_fornecedor} onChange={e => setForm(p => ({ ...p, cliente_fornecedor: e.target.value }))}
                placeholder="Ex: Loja LB, Meta, Correios…" />
            </Field>
            <Field label="Conta / Carteira">
              <Input value={form.conta} onChange={e => setForm(p => ({ ...p, conta: e.target.value }))} placeholder="Ex: Seller Finance, Nubank…" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Documento / Referência">
              <Input value={form.documento} onChange={e => setForm(p => ({ ...p, documento: e.target.value }))} placeholder="Nº NF, pedido…" />
            </Field>
            <Field label="Recorrência">
              <Select value={form.recorrencia} onChange={e => setForm(p => ({ ...p, recorrencia: e.target.value as RecorrenciaFin }))}>
                {RECORRENCIAS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Observação">
            <Textarea rows={2} value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))}
              placeholder="Detalhes adicionais (opcional)" />
          </Field>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowLanc(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1">{editId ? 'Salvar alterações' : 'Salvar'}</Button>
          </div>
        </form>
      </Modal>

      {/* ══════════ MODAL CATEGORIA ══════════ */}
      <Modal open={showCat} onClose={() => setShowCat(false)} title="Nova categoria">
        <form onSubmit={salvarCat} className="flex flex-col gap-4">
          <Field label="Tipo">
            <div className="flex gap-2">
              <button type="button" onClick={() => setCatForm(p => ({ ...p, tipo: 'entrada' }))}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${catForm.tipo === 'entrada' ? 'bg-green-600 text-white border-green-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}>
                Receita
              </button>
              <button type="button" onClick={() => setCatForm(p => ({ ...p, tipo: 'saida' }))}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${catForm.tipo === 'saida' ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}>
                Despesa
              </button>
            </div>
          </Field>

          <Field label="Nome">
            <Input required value={catForm.nome} onChange={e => setCatForm(p => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Tarifas Marketplace" />
          </Field>

          <Field label="Cor">
            <div className="flex flex-wrap gap-2">
              {CORES.map(cor => (
                <button key={cor} type="button" onClick={() => setCatForm(p => ({ ...p, cor }))}
                  className={`w-7 h-7 rounded-full transition-transform ${catForm.cor === cor ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-gray-100 dark:ring-offset-gray-900 scale-110' : ''}`}
                  style={{ background: cor }} aria-label={cor} />
              ))}
            </div>
          </Field>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowCat(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
