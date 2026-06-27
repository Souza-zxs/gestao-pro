'use client'

import { useEffect, useState } from 'react'
import { getAll, insert } from '@/lib/store'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Evento, Ingresso } from '@/lib/types'
import {
  PageHeader, Card, Metric, Modal, Field, Input, Button, AddButton,
  EmptyState, Th, Badge,
} from '@/components/ui'
import { IconTicket, IconCalendar } from '@/components/icons'

interface EventoComIngressos extends Evento {
  ingressos: Ingresso[]
  totalVendas: number
  totalReceita: number
}

/* Gera iniciais a partir do nome */
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

/* Cores cíclicas para as iniciais dos compradores */
const BUYER_COLORS = [
  { bg: 'bg-blue-900/40 dark:bg-blue-900/60',   text: 'text-blue-400' },
  { bg: 'bg-purple-900/40 dark:bg-purple-900/60', text: 'text-purple-400' },
  { bg: 'bg-amber-900/40 dark:bg-amber-900/60',  text: 'text-amber-400' },
  { bg: 'bg-green-900/40 dark:bg-green-900/60',  text: 'text-green-400' },
  { bg: 'bg-red-900/40 dark:bg-red-900/60',      text: 'text-red-400' },
]

export default function DashboardClient() {
  const [proximoEvento, setProximoEvento] = useState<EventoComIngressos | null>(null)
  const [vendaChart, setVendaChart] = useState<{ data: string; receita: number }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [novoEvento, setNovoEvento] = useState({ nome: '', data: '' })
  const [novoIngresso, setNovoIngresso] = useState({ comprador: '', quantidade: 1, valor: 0 })
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d' | 'all'>('7d')

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    const today = new Date().toISOString().split('T')[0]
    const eventos = (await getAll<Evento>('eventos'))
      .filter(e => e.data >= today)
      .sort((a, b) => a.data.localeCompare(b.data))

    if (eventos.length === 0) { setProximoEvento(null); setVendaChart([]); return }

    const evento = eventos[0]
    const ingressos = (await getAll<Ingresso>('ingressos'))
      .filter(i => i.evento_id === evento.id)
      .sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''))

    const totalVendas = ingressos.reduce((s, i) => s + i.quantidade, 0)
    const totalReceita = ingressos.reduce((s, i) => s + i.valor * i.quantidade, 0)
    setProximoEvento({ ...evento, ingressos, totalVendas, totalReceita })

    const byDay: Record<string, number> = {}
    ingressos.forEach(i => {
      const day = i.criado_em?.split('T')[0] || ''
      byDay[day] = (byDay[day] || 0) + i.valor * i.quantidade
    })
    setVendaChart(
      Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([data, receita]) => ({ data, receita }))
    )
  }

  async function criarEvento(e: React.FormEvent) {
    e.preventDefault()
    await insert('eventos', { ...novoEvento })
    setShowModal(false); setNovoEvento({ nome: '', data: '' }); await loadDashboard()
  }

  async function adicionarIngresso(e: React.FormEvent) {
    e.preventDefault()
    if (!proximoEvento) return
    await insert('ingressos', { ...novoIngresso, evento_id: proximoEvento.id })
    setNovoIngresso({ comprador: '', quantidade: 1, valor: 0 }); await loadDashboard()
  }

  const ticketMedio = proximoEvento?.ingressos.length
    ? proximoEvento.totalReceita / proximoEvento.ingressos.length : 0

  /* Filtra dados do gráfico por período */
  const chartData = (() => {
    if (chartPeriod === 'all') return vendaChart
    const days = chartPeriod === '7d' ? 7 : 30
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    return vendaChart.filter(d => d.data >= cutoffStr)
  })()

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-0.5">
            Insight Assessoria
          </p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          {proximoEvento && (
            <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{proximoEvento.nome}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                · {format(parseISO(proximoEvento.data), "dd MMM yyyy", { locale: ptBR })}
              </span>
            </div>
          )}
          <AddButton onClick={() => setShowModal(true)}>Novo Evento</AddButton>
        </div>
      </div>

      {!proximoEvento ? (
        <EmptyState
          icon={<IconCalendar className="w-5 h-5" />}
          title="Nenhum evento próximo"
          description="Crie um evento para começar a registrar e acompanhar a venda de ingressos."
          action={<AddButton onClick={() => setShowModal(true)}>Criar Evento</AddButton>}
        />
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Metric
              label="Ingressos vendidos"
              value={proximoEvento.totalVendas.toString()}
              color="blue"
              icon={<IconTicket className="w-5 h-5" />}
              sub={proximoEvento.totalVendas === 0 ? 'sem vendas ainda' : undefined}
            />
            <Metric
              label="Receita total"
              value={`R$ ${proximoEvento.totalReceita.toFixed(2)}`}
              color="green"
              sub={proximoEvento.totalReceita === 0 ? 'aguardando evento' : undefined}
            />
            <Metric
              label="Transações"
              value={proximoEvento.ingressos.length.toString()}
              color="amber"
              sub={proximoEvento.ingressos.length === 0 ? 'nenhuma processada' : undefined}
            />
            <Metric
              label="Ticket médio"
              value={`R$ ${ticketMedio.toFixed(2)}`}
              color="accent"
              sub={ticketMedio === 0 ? 'calcular após vendas' : undefined}
            />
          </div>

          {/* ── Gráfico + Formulário ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

            {/* Gráfico */}
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Receita ao longo do tempo</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Evolução de vendas por período</p>
                </div>
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                  {(['7d', '30d', 'all'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setChartPeriod(p)}
                      className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors ${
                        chartPeriod === p
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                      }`}
                    >
                      {p === 'all' ? 'Tudo' : p}
                    </button>
                  ))}
                </div>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis
                      dataKey="data"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      tickFormatter={v => { try { return format(parseISO(v), 'dd/MM') } catch { return v } }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => `R$${v}`}
                    />
                    <Tooltip
                      formatter={(v) => [`R$ ${Number(v).toFixed(2)}`, 'Receita']}
                      labelFormatter={v => { try { return format(parseISO(v as string), 'dd/MM/yyyy') } catch { return v as string } }}
                      contentStyle={{
                        background: 'var(--color-gray-900, #111827)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Area type="monotone" dataKey="receita" stroke="#3b82f6" strokeWidth={2} fill="url(#grad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <IconTicket className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Adicione ingressos para visualizar o gráfico</p>
                </div>
              )}
            </Card>

            {/* Registrar venda */}
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Registrar venda</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Adicionar manualmente</p>
                </div>
                <IconTicket className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              </div>
              <form onSubmit={adicionarIngresso} className="flex flex-col gap-3">
                <Field label="Comprador">
                  <Input
                    required
                    value={novoIngresso.comprador}
                    onChange={e => setNovoIngresso(p => ({ ...p, comprador: e.target.value }))}
                    placeholder="Nome do comprador"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Qtd">
                    <Input
                      type="number" required min={1}
                      value={novoIngresso.quantidade}
                      onChange={e => setNovoIngresso(p => ({ ...p, quantidade: +e.target.value }))}
                    />
                  </Field>
                  <Field label="Valor (R$)">
                    <Input
                      type="number" required min={0} step="0.01"
                      value={novoIngresso.valor}
                      onChange={e => setNovoIngresso(p => ({ ...p, valor: +e.target.value }))}
                    />
                  </Field>
                </div>
                <Button type="submit" className="w-full mt-1">Adicionar venda</Button>
              </form>
            </Card>
          </div>

          {/* ── Ingressos recentes ── */}
          <Card padded={false}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ingressos recentes</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {proximoEvento.ingressos.length > 0
                    ? `${proximoEvento.ingressos.length} transaç${proximoEvento.ingressos.length === 1 ? 'ão' : 'ões'}`
                    : 'Nenhuma venda ainda'}
                </p>
              </div>
              {proximoEvento.ingressos.length > 10 && (
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium cursor-pointer hover:underline">
                  Ver todos →
                </span>
              )}
            </div>

            {proximoEvento.ingressos.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <IconTicket className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500">Nenhum ingresso vendido ainda</p>
              </div>
            ) : (
              <>
                {/* Tabela desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 dark:border-gray-800">
                      <tr>
                        <Th>Comprador</Th>
                        <Th>Qtd</Th>
                        <Th>Valor unit.</Th>
                        <Th>Total</Th>
                        <Th>Data</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {proximoEvento.ingressos.slice(0, 10).map((ing, i, arr) => {
                        const color = BUYER_COLORS[i % BUYER_COLORS.length]
                        return (
                          <tr
                            key={ing.id}
                            className={`group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                              i < arr.length - 1 ? 'border-b border-gray-50 dark:border-gray-800/60' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-lg ${color.bg} ${color.text} flex items-center justify-center text-[10px] font-bold shrink-0`}>
                                  {getInitials(ing.comprador)}
                                </div>
                                <span className="font-medium text-gray-900 dark:text-gray-100 text-xs">{ing.comprador}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{ing.quantidade}</td>
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">R$ {ing.valor.toFixed(2)}</td>
                            <td className="px-4 py-3 text-xs font-semibold text-green-600 dark:text-green-400">
                              R$ {(ing.valor * ing.quantidade).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">
                              {ing.criado_em ? format(new Date(ing.criado_em), 'dd/MM/yyyy HH:mm') : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Lista mobile */}
                <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
                  {proximoEvento.ingressos.slice(0, 10).map((ing, i) => {
                    const color = BUYER_COLORS[i % BUYER_COLORS.length]
                    return (
                      <div key={ing.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <div className={`w-8 h-8 rounded-lg ${color.bg} ${color.text} flex items-center justify-center text-[10px] font-bold shrink-0`}>
                          {getInitials(ing.comprador)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{ing.comprador}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                            {ing.quantidade} ingresso{ing.quantidade > 1 ? 's' : ''}
                            {ing.criado_em ? ` · ${format(new Date(ing.criado_em), 'dd/MM HH:mm')}` : ''}
                          </p>
                        </div>
                        <p className="text-xs font-semibold text-green-600 dark:text-green-400 shrink-0">
                          R$ {(ing.valor * ing.quantidade).toFixed(2)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Card>
        </>
      )}

      {/* ── Modal novo evento ── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Evento">
        <form onSubmit={criarEvento} className="flex flex-col gap-4">
          <Field label="Nome do Evento">
            <Input
              required
              value={novoEvento.nome}
              onChange={e => setNovoEvento(p => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Show do Grupo X"
            />
          </Field>
          <Field label="Data">
            <Input
              type="date" required
              value={novoEvento.data}
              onChange={e => setNovoEvento(p => ({ ...p, data: e.target.value }))}
            />
          </Field>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              Criar Evento
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}