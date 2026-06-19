'use client'

import { useEffect, useState } from 'react'
import { getAll, insert, update, remove } from '@/lib/store'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { format, parseISO, getMonth, getYear } from 'date-fns'
import type { Lead, Temperatura } from '@/lib/types'
import {
  PageHeader, Card, Tabs, Metric, Modal, Field, Input, Select, Badge,
  EmptyState, Th, AddButton, Button, RowActions, IconAction,
} from '@/components/ui'
import { IconTarget, IconEdit, IconTrash } from '@/components/icons'

const STATUS_COLORS: Record<string, string> = { novo: '#6b7280', contatado: '#f59e0b', qualificado: '#2563eb', convertido: '#16a34a', perdido: '#ef4444' }
const STATUS_LABELS: Record<string, string> = { novo: 'Novo', contatado: 'Contatado', qualificado: 'Qualificado', convertido: 'Convertido', perdido: 'Perdido' }
const STATUS_BADGE: Record<string, 'blue' | 'amber' | 'gray' | 'green' | 'red'> = { novo: 'gray', contatado: 'amber', qualificado: 'blue', convertido: 'green', perdido: 'red' }
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const EM_NEGOCIACAO = ['novo', 'contatado', 'qualificado']

type TempMeta = { key: Temperatura; label: string; color: string; bg: string; ring: string; dot: string }
const TEMPERATURAS: TempMeta[] = [
  { key: 'frio',    label: 'Frio',    color: 'text-sky-700',     bg: 'bg-sky-50',     ring: 'ring-sky-300',     dot: 'bg-sky-500' },
  { key: 'morno',   label: 'Morno',   color: 'text-amber-700',   bg: 'bg-amber-50',   ring: 'ring-amber-300',   dot: 'bg-amber-500' },
  { key: 'quente',  label: 'Quente',  color: 'text-red-700',     bg: 'bg-red-50',     ring: 'ring-red-300',     dot: 'bg-red-500' },
  { key: 'fechado', label: 'Fechado', color: 'text-green-700',   bg: 'bg-green-50',   ring: 'ring-green-300',   dot: 'bg-green-500' },
  { key: 'perdido', label: 'Perdido', color: 'text-gray-600',    bg: 'bg-gray-50',    ring: 'ring-gray-300',    dot: 'bg-gray-400' },
]
const TEMP_LABELS: Record<Temperatura, string> = { frio: 'Frio', morno: 'Morno', quente: 'Quente', perdido: 'Perdido', fechado: 'Fechado' }
const tempDe = (l: Lead): Temperatura => l.temperatura ?? 'frio'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const FORM_INICIAL = { nome: '', contato: '', origem: '', status: 'novo', temperatura: 'frio', valor: '', data_entrada: '' }

export default function LeadsClient() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [statusSel, setStatusSel] = useState('todos')
  const [aba, setAba] = useState<'dashboard' | 'leads'>('dashboard')
  const [showModal, setShowModal] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overTemp, setOverTemp] = useState<Temperatura | null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLeads(await getAll<Lead>('leads'))
  }

  const leadsFiltrados = statusSel === 'todos' ? leads : leads.filter(l => l.status === statusSel)
  const totalLeads = leadsFiltrados.length
  const convertidos = leadsFiltrados.filter(l => l.status === 'convertido').length
  const emNegociacao = leadsFiltrados.filter(l => EM_NEGOCIACAO.includes(l.status)).length
  const taxaConversao = totalLeads ? Math.round((convertidos / totalLeads) * 100) : 0
  const pipeline = leadsFiltrados.filter(l => EM_NEGOCIACAO.includes(l.status)).reduce((s, l) => s + (l.valor || 0), 0)

  const chartStatus = Object.entries(STATUS_LABELS)
    .map(([key, label]) => ({ name: label, value: leadsFiltrados.filter(l => l.status === key).length, color: STATUS_COLORS[key] }))
    .filter(d => d.value > 0)
  const origens = [...new Set(leads.map(l => l.origem).filter(Boolean))]
  const chartOrigem = origens.map(o => ({
    nome: o,
    leads: leadsFiltrados.filter(l => l.origem === o).length,
  }))
  const anoAtual = new Date().getFullYear()
  const chartMes = MESES_ABREV.map((m, i) => ({
    mes: m,
    entradas: leadsFiltrados.filter(l => l.data_entrada && getMonth(parseISO(l.data_entrada)) === i && getYear(parseISO(l.data_entrada)) === anoAtual).length,
  }))

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      nome: form.nome,
      contato: form.contato,
      origem: form.origem,
      status: form.status as Lead['status'],
      temperatura: form.temperatura as Temperatura,
      valor: parseFloat(form.valor) || 0,
      data_entrada: form.data_entrada,
    }
    if (editLead) await update<Lead>('leads', editLead.id, payload)
    else await insert('leads', payload)
    fecharModal(); await loadAll()
  }

  async function excluir(id: string) { if (confirm('Excluir lead?')) { await remove('leads', id); await loadAll() } }

  function fecharModal() { setShowModal(false); setEditLead(null); setForm(FORM_INICIAL) }
  const novoLead = () => { setEditLead(null); setForm(FORM_INICIAL); setShowModal(true) }
  function editar(l: Lead) {
    setEditLead(l)
    setForm({ nome: l.nome, contato: l.contato, origem: l.origem, status: l.status, temperatura: tempDe(l), valor: l.valor ? String(l.valor) : '', data_entrada: l.data_entrada })
    setShowModal(true)
  }

  async function moverTemp(id: string, temperatura: Temperatura) {
    const lead = leads.find(l => l.id === id)
    if (!lead || tempDe(lead) === temperatura) return
    await update<Lead>('leads', id, { temperatura })
    await loadAll()
  }

  function onDrop(temperatura: Temperatura) {
    if (dragId) moverTemp(dragId, temperatura)
    setDragId(null); setOverTemp(null)
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Acompanhe seu funil de prospecção e conversão"
        action={
          <div className="flex items-center gap-3">
            <Select value={statusSel} onChange={e => setStatusSel(e.target.value)} className="!w-auto">
              <option value="todos">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
            {aba === 'leads' && <AddButton onClick={novoLead}>Novo Lead</AddButton>}
          </div>
        }
      />

      <Tabs active={aba} onChange={setAba} tabs={[
        { value: 'dashboard', label: 'Dashboard' },
        { value: 'leads', label: 'Leads' },
      ]} />

      {/* DASHBOARD */}
      {aba === 'dashboard' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Metric label="Total de Leads" value={totalLeads.toString()} icon={<IconTarget className="w-6 h-6" />} />
            <Metric label="Taxa de Conversão" value={`${taxaConversao}%`} sub={`${convertidos} convertidos`} accent="text-green-600" />
            <Metric label="Em Negociação" value={emNegociacao.toString()} accent="text-blue-600" />
            <Metric label="Pipeline" value={fmtBRL(pipeline)} sub="valor em aberto" />
          </div>

          {/* KANBAN DE TEMPERATURA */}
          <Card padded={false} className="mb-6 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Funil por Temperatura</h3>
              <p className="text-xs text-gray-400">
                <span className="hidden sm:inline">Arraste os cards entre as colunas para mudar a temperatura</span>
                <span className="sm:hidden">Arraste os cards ou use o cadastro para mudar a temperatura</span>
              </p>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-1 px-1">
              {TEMPERATURAS.map(t => {
                const cards = leadsFiltrados.filter(l => tempDe(l) === t.key)
                const soma = cards.reduce((s, l) => s + (l.valor || 0), 0)
                const dropAtivo = overTemp === t.key
                return (
                  <div
                    key={t.key}
                    onDragOver={e => { e.preventDefault(); if (overTemp !== t.key) setOverTemp(t.key) }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverTemp(c => c === t.key ? null : c) }}
                    onDrop={() => onDrop(t.key)}
                    className={`snap-start shrink-0 w-[80%] sm:w-52 lg:w-auto lg:flex-1 lg:min-w-0 rounded-xl border transition-colors ${dropAtivo ? `${t.bg} border-transparent ring-2 ${t.ring}` : 'bg-gray-50/70 border-gray-200'}`}
                  >
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200/70">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                        <span className={`text-sm font-semibold ${t.color}`}>{t.label}</span>
                        <span className="text-xs font-medium text-gray-400">{cards.length}</span>
                      </div>
                    </div>
                    <div className="p-2 space-y-2 min-h-[80px]">
                      {cards.map(l => (
                        <div
                          key={l.id}
                          draggable
                          onDragStart={() => setDragId(l.id)}
                          onDragEnd={() => { setDragId(null); setOverTemp(null) }}
                          onDoubleClick={() => editar(l)}
                          title="Arraste para mudar a temperatura · duplo clique para editar"
                          className={`group bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm cursor-grab active:cursor-grabbing hover:border-gray-300 hover:shadow ${dragId === l.id ? 'opacity-40' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{l.nome}</p>
                            <Badge color={STATUS_BADGE[l.status]}>{STATUS_LABELS[l.status]}</Badge>
                          </div>
                          {l.origem && <p className="text-xs text-gray-400 mt-0.5 truncate">{l.origem}</p>}
                          {l.valor > 0 && <p className="text-xs font-medium text-gray-600 mt-1">{fmtBRL(l.valor)}</p>}
                        </div>
                      ))}
                      {cards.length === 0 && (
                        <p className="text-xs text-gray-300 text-center py-4 select-none">Solte aqui</p>
                      )}
                    </div>
                    {soma > 0 && (
                      <div className="px-3 py-2 border-t border-gray-200/70 text-xs text-gray-500">
                        Total: <span className="font-medium text-gray-700">{fmtBRL(soma)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          {totalLeads === 0 ? (
            <EmptyState icon={<IconTarget className="w-6 h-6" />} title="Nenhum lead cadastrado ainda" description="Cadastre leads para visualizar o funil e os indicadores." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Leads por Status</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={chartStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" nameKey="name">
                      {chartStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              {chartOrigem.length > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Leads por Origem</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartOrigem} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip />
                      <Bar dataKey="leads" name="Leads" fill="#2563eb" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              <Card>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Entradas por Mês ({anoAtual})</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="entradas" name="Entradas" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* LEADS */}
      {aba === 'leads' && (
        leadsFiltrados.length === 0 ? (
          <EmptyState icon={<IconTarget className="w-6 h-6" />} title="Nenhum lead cadastrado" description="Adicione leads com contato, origem, status e valor estimado." action={<AddButton onClick={novoLead}>Novo Lead</AddButton>} />
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr><Th>Nome</Th><Th>Contato</Th><Th>Origem</Th><Th>Status</Th><Th>Temperatura</Th><Th>Valor</Th><Th>Entrada</Th><Th className="text-right">Ações</Th></tr>
                </thead>
                <tbody>
                  {leadsFiltrados.map((l, i, arr) => (
                    <tr key={l.id} className={i < arr.length - 1 ? 'border-b border-gray-50' : ''}>
                      <td className="px-4 py-3 font-medium text-gray-900">{l.nome}</td>
                      <td className="px-4 py-3 text-gray-500">{l.contato || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{l.origem || '—'}</td>
                      <td className="px-4 py-3"><Badge color={STATUS_BADGE[l.status]}>{STATUS_LABELS[l.status]}</Badge></td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-gray-600">
                          <span className={`w-2 h-2 rounded-full ${TEMPERATURAS.find(t => t.key === tempDe(l))?.dot ?? 'bg-gray-400'}`} />
                          {TEMP_LABELS[tempDe(l)]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{l.valor ? fmtBRL(l.valor) : '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{l.data_entrada ? format(parseISO(l.data_entrada), 'dd/MM/yyyy') : '—'}</td>
                      <td className="px-4 py-3">
                        <RowActions>
                          <IconAction onClick={() => editar(l)} title="Editar" color="blue"><IconEdit className="w-4 h-4" /></IconAction>
                          <IconAction onClick={() => excluir(l.id)} title="Excluir" color="red"><IconTrash className="w-4 h-4" /></IconAction>
                        </RowActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      <Modal open={showModal} onClose={fecharModal} title={editLead ? 'Editar Lead' : 'Novo Lead'}>
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Nome"><Input required value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} /></Field>
          <Field label="Contato" hint="E-mail ou telefone"><Input value={form.contato} onChange={e => setForm(p => ({ ...p, contato: e.target.value }))} placeholder="email@exemplo.com ou (00) 00000-0000" /></Field>
          <Field label="Origem"><Input value={form.origem} onChange={e => setForm(p => ({ ...p, origem: e.target.value }))} placeholder="Ex: Instagram, Indicação, Site..." /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Temperatura">
            <Select value={form.temperatura} onChange={e => setForm(p => ({ ...p, temperatura: e.target.value }))}>
              {TEMPERATURAS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Valor estimado (R$)"><Input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} placeholder="0,00" /></Field>
          <Field label="Data de Entrada"><Input type="date" required value={form.data_entrada} onChange={e => setForm(p => ({ ...p, data_entrada: e.target.value }))} /></Field>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={fecharModal}>Cancelar</Button>
            <Button type="submit" className="flex-1">{editLead ? 'Salvar' : 'Adicionar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
