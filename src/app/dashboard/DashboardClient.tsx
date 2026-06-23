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

export default function DashboardClient() {
  const [proximoEvento, setProximoEvento] = useState<EventoComIngressos | null>(null)
  const [vendaChart, setVendaChart] = useState<{ data: string; receita: number }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [novoEvento, setNovoEvento] = useState({ nome: '', data: '' })
  const [novoIngresso, setNovoIngresso] = useState({ comprador: '', quantidade: 1, valor: 0 })

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

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral das vendas de ingressos do próximo evento"
        action={<AddButton onClick={() => setShowModal(true)}>Novo Evento</AddButton>}
      />

      {!proximoEvento ? (
        <EmptyState
          icon={<IconCalendar className="w-6 h-6" />}
          title="Nenhum evento próximo"
          description="Crie um evento para começar a registrar e acompanhar a venda de ingressos."
          action={<AddButton onClick={() => setShowModal(true)}>Criar Evento</AddButton>}
        />
      ) : (
        <>
          {/* Evento ativo */}
          <div className="flex items-center gap-2.5 mb-6 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg w-fit">
            <IconCalendar className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm font-medium text-gray-900">{proximoEvento.nome}</span>
            <Badge color="blue">
              {format(parseISO(proximoEvento.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </Badge>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Metric
              label="Ingressos vendidos"
              value={proximoEvento.totalVendas.toString()}
              icon={<IconTicket className="w-5 h-5" />}
              accent="ingressos"
            />
            <Metric
              label="Receita total"
              value={`R$ ${proximoEvento.totalReceita.toFixed(2)}`}
              accent="receita"
            />
            <Metric
              label="Transações"
              value={proximoEvento.ingressos.length.toString()}
            />
            <Metric
              label="Ticket médio"
              value={`R$ ${ticketMedio.toFixed(2)}`}
            />
          </div>

          {/* Gráfico + Formulário */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2" padded={false}>
              <div className="px-5 pt-5 pb-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
                  Receita
                </p>
                <h3 className="text-sm font-semibold text-gray-800">Ao longo do tempo</h3>
              </div>
              <div className="px-5 pb-5 pt-4">
                {vendaChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={vendaChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis
                        dataKey="data"
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={v => { try { return format(parseISO(v), 'dd/MM') } catch { return v } }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          fontSize: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        }}
                        formatter={(v) => [`R$ ${Number(v).toFixed(2)}`, 'Receita']}
                        labelFormatter={v => { try { return format(parseISO(v as string), 'dd/MM/yyyy') } catch { return v as string } }}
                      />
                      <Area
                        type="monotone"
                        dataKey="receita"
                        stroke="#2563eb"
                        strokeWidth={2}
                        fill="url(#grad)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
                    Adicione ingressos para visualizar o gráfico
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
                Venda
              </p>
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Registrar</h3>
              <form onSubmit={adicionarIngresso} className="space-y-3">
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
                      type="number"
                      required
                      min={1}
                      value={novoIngresso.quantidade}
                      onChange={e => setNovoIngresso(p => ({ ...p, quantidade: +e.target.value }))}
                    />
                  </Field>
                  <Field label="Valor (R$)">
                    <Input
                      type="number"
                      required
                      min={0}
                      step="0.01"
                      value={novoIngresso.valor}
                      onChange={e => setNovoIngresso(p => ({ ...p, valor: +e.target.value }))}
                    />
                  </Field>
                </div>
                <Button type="submit" className="w-full">Adicionar venda</Button>
              </form>
            </Card>
          </div>

          {/* Tabela */}
          <Card padded={false}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
                  Ingressos
                </p>
                <h3 className="text-sm font-semibold text-gray-800">Recentes</h3>
              </div>
              {proximoEvento.ingressos.length > 0 && (
                <span className="text-xs text-gray-400">
                  {Math.min(10, proximoEvento.ingressos.length)} de {proximoEvento.ingressos.length}
                </span>
              )}
            </div>

            {proximoEvento.ingressos.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">
                Nenhum ingresso vendido ainda
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <Th>Comprador</Th>
                      <Th>Qtd</Th>
                      <Th>Valor unit.</Th>
                      <Th>Total</Th>
                      <Th>Data</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {proximoEvento.ingressos.slice(0, 10).map((ing, i, arr) => (
                      <tr
                        key={ing.id}
                        className={`transition-colors hover:bg-gray-50 ${i < arr.length - 1 ? 'border-b border-gray-50' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{ing.comprador}</td>
                        <td className="px-4 py-3 text-gray-500">{ing.quantidade}</td>
                        <td className="px-4 py-3 text-gray-500">R$ {ing.valor.toFixed(2)}</td>
                        <td className="px-4 py-3 font-medium text-green-600">
                          R$ {(ing.valor * ing.quantidade).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-gray-400 tabular-nums">
                          {ing.criado_em ? format(new Date(ing.criado_em), 'dd/MM/yyyy HH:mm') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Evento">
        <form onSubmit={criarEvento} className="space-y-4">
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
              type="date"
              required
              value={novoEvento.data}
              onChange={e => setNovoEvento(p => ({ ...p, data: e.target.value }))}
            />
          </Field>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">Criar Evento</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}