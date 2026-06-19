'use client'

import { useEffect, useState } from 'react'
import { getAll, insert, remove } from '@/lib/store'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import {
  PageHeader, Card, Metric, Modal, Field, Input, Select, EmptyState, Th,
  AddButton, Button, Badge, IconAction, RowActions,
} from '@/components/ui'
import { IconWallet, IconTrash } from '@/components/icons'

interface Transacao {
  id: string; descricao: string; valor: number; tipo: 'entrada' | 'saida'
  categoria: string; data: string; criado_em: string
}
const CATEGORIAS = ['Mensalidade', 'Ingresso', 'Material', 'Salário', 'Aluguel', 'Marketing', 'Serviços', 'Outros']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function FinanceiroClient() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ descricao: '', valor: 0, tipo: 'entrada' as 'entrada' | 'saida', categoria: 'Outros', data: '' })
  const now = new Date()
  const [mesSel, setMesSel] = useState(now.getMonth() + 1)
  const [anoSel, setAnoSel] = useState(now.getFullYear())

  useEffect(() => { load() }, [mesSel, anoSel])

  async function load() {
    const mesStr = String(mesSel).padStart(2, '0')
    const inicio = `${anoSel}-${mesStr}-01`, fim = `${anoSel}-${mesStr}-31`
    const all = await getAll<Transacao>('financeiro')
    setTransacoes(all.filter(t => t.data >= inicio && t.data <= fim).sort((a, b) => b.data.localeCompare(a.data)))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    await insert('financeiro', { ...form })
    setShowModal(false); setForm({ descricao: '', valor: 0, tipo: 'entrada', categoria: 'Outros', data: '' }); await load()
  }
  async function excluir(id: string) { if (confirm('Excluir lançamento?')) { await remove('financeiro', id); await load() } }

  const entradas = transacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0)
  const saidas = transacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0)
  const saldo = entradas - saidas

  const byDia: Record<string, { entradas: number; saidas: number }> = {}
  transacoes.forEach(t => {
    const dia = t.data.slice(8, 10)
    if (!byDia[dia]) byDia[dia] = { entradas: 0, saidas: 0 }
    if (t.tipo === 'entrada') byDia[dia].entradas += t.valor; else byDia[dia].saidas += t.valor
  })
  const chartData = Object.entries(byDia).sort().map(([dia, v]) => ({ dia, ...v }))

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Controle de entradas, saídas e fluxo de caixa"
        action={
          <div className="flex items-center gap-3">
            <Select value={mesSel} onChange={e => setMesSel(+e.target.value)} className="!w-auto">
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </Select>
            <Select value={anoSel} onChange={e => setAnoSel(+e.target.value)} className="!w-auto">
              {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </Select>
            <AddButton onClick={() => setShowModal(true)}>Lançamento</AddButton>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Metric label="Entradas" value={`R$ ${entradas.toFixed(2)}`} accent="text-green-600" />
        <Metric label="Saídas" value={`R$ ${saidas.toFixed(2)}`} accent="text-red-600" />
        <Metric label="Saldo" value={`R$ ${saldo.toFixed(2)}`} accent={saldo >= 0 ? 'text-green-600' : 'text-red-600'} />
      </div>

      {transacoes.length === 0 ? (
        <EmptyState
          icon={<IconWallet className="w-6 h-6" />}
          title="Nenhum lançamento neste período"
          description="Registre entradas e saídas para acompanhar o fluxo de caixa."
          action={<AddButton onClick={() => setShowModal(true)}>Lançamento</AddButton>}
        />
      ) : (
        <>
          {chartData.length > 0 && (
            <Card className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Fluxo de caixa — {MESES[mesSel - 1]}/{anoSel}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`R$ ${Number(v).toFixed(2)}`]} />
                  <Bar dataKey="entradas" name="Entradas" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card padded={false}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Lançamentos — {MESES[mesSel - 1]}/{anoSel}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr><Th>Data</Th><Th>Descrição</Th><Th>Categoria</Th><Th>Tipo</Th><Th>Valor</Th><Th className="text-right">Ações</Th></tr>
                </thead>
                <tbody>
                  {transacoes.map((t, i, arr) => (
                    <tr key={t.id} className={i < arr.length - 1 ? 'border-b border-gray-50' : ''}>
                      <td className="px-4 py-3 text-gray-500">{format(new Date(t.data + 'T00:00:00'), 'dd/MM/yyyy')}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{t.descricao}</td>
                      <td className="px-4 py-3 text-gray-500">{t.categoria}</td>
                      <td className="px-4 py-3"><Badge color={t.tipo === 'entrada' ? 'green' : 'red'}>{t.tipo === 'entrada' ? 'Entrada' : 'Saída'}</Badge></td>
                      <td className={`px-4 py-3 font-medium ${t.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.tipo === 'saida' ? '−' : '+'}R$ {t.valor.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <RowActions><IconAction onClick={() => excluir(t.id)} title="Excluir" color="red"><IconTrash className="w-4 h-4" /></IconAction></RowActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Lançamento">
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Descrição"><Input required value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor (R$)"><Input type="number" required min={0} step="0.01" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: +e.target.value }))} /></Field>
            <Field label="Tipo">
              <Select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as 'entrada' | 'saida' }))}>
                <option value="entrada">Entrada</option><option value="saida">Saída</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Categoria">
              <Select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Data"><Input type="date" required value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} /></Field>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
