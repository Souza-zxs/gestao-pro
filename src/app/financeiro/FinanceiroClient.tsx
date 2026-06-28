'use client'

import { useEffect, useState } from 'react'
import { getAll, insert, remove } from '@/lib/store'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import {
  Card, Metric, Modal, Field, Input, Select, EmptyState, Th,
  AddButton, Button, Badge, IconAction, RowActions,
} from '@/components/ui'
import { IconWallet, IconTrash, IconTrendingUp, IconTrendingDown } from '@/components/icons'

interface Transacao {
  id: string; descricao: string; valor: number
  tipo: 'entrada' | 'saida'; categoria: string
  data: string; criado_em: string
}

const CATEGORIAS = ['Mensalidade','Ingresso','Material','Salário','Aluguel','Marketing','Serviços','Outros']
const MESES      = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

/* ─── Tooltip customizado ───────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 dark:bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1.5">Dia {label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill }} className="font-semibold">
          {p.name}: R$ {Number(p.value).toFixed(2)}
        </p>
      ))}
    </div>
  )
}

/* ─── Componente principal ──────────────────────────────────────── */
export default function FinanceiroClient() {
  const now = new Date()
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [showModal,  setShowModal]  = useState(false)
  const [mesSel,     setMesSel]     = useState(now.getMonth() + 1)
  const [anoSel,     setAnoSel]     = useState(now.getFullYear())
  const [form,       setForm]       = useState({
    descricao: '', valor: 0,
    tipo: 'entrada' as 'entrada' | 'saida',
    categoria: 'Outros', data: '',
  })

  // useEffect com dependências — roda load() sempre que mês ou ano mudar
  useEffect(() => { load() }, [mesSel, anoSel])

  async function load() {
    // padStart(2,'0') transforma 1 → '01', 9 → '09'
    const mesStr = String(mesSel).padStart(2, '0')
    const inicio = `${anoSel}-${mesStr}-01`
    const fim    = `${anoSel}-${mesStr}-31`
    const all    = await getAll<Transacao>('financeiro')
    setTransacoes(
      all
        .filter(t => t.data >= inicio && t.data <= fim)
        .sort((a, b) => b.data.localeCompare(a.data))
    )
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    await insert('financeiro', { ...form })
    setShowModal(false)
    setForm({ descricao: '', valor: 0, tipo: 'entrada', categoria: 'Outros', data: '' })
    await load()
  }

  async function excluir(id: string) {
    if (confirm('Excluir lançamento?')) { await remove('financeiro', id); await load() }
  }

  /* ── Estado derivado — calculado direto sem useState ── */
  const entradas = transacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0)
  const saidas   = transacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.valor, 0)
  const saldo    = entradas - saidas

  /* ── Agrupar transações por dia para o gráfico ──
     Record<string, {...}> = dicionário: chave é o dia ('01','02'...),
     valor é o objeto com entradas e saídas acumuladas naquele dia.
  ── */
  const byDia: Record<string, { entradas: number; saidas: number }> = {}
  transacoes.forEach(t => {
    const dia = t.data.slice(8, 10) // pega os últimos 2 chars da data 'yyyy-MM-dd'
    if (!byDia[dia]) byDia[dia] = { entradas: 0, saidas: 0 }
    if (t.tipo === 'entrada') byDia[dia].entradas += t.valor
    else byDia[dia].saidas += t.valor
  })
  // Object.entries transforma o objeto em array de [chave, valor], .sort() ordena por dia
  const chartData = Object.entries(byDia)
    .sort()
    .map(([dia, v]) => ({ dia, ...v }))

  const periodoLabel = `${MESES[mesSel - 1]} ${anoSel}`

  /* ── Render ── */
  return (
    <div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-0.5">
            Gestão Pro
          </p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Financeiro</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Entradas, saídas e fluxo de caixa
          </p>
        </div>

        {/* Seletores de período + botão */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <Select
              value={mesSel}
              onChange={e => setMesSel(+e.target.value)}
              className="!w-auto !bg-transparent !border-none !shadow-none !text-[11px] !py-1 !px-2 text-gray-700 dark:text-gray-300"
            >
              {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </Select>
            <Select
              value={anoSel}
              onChange={e => setAnoSel(+e.target.value)}
              className="!w-auto !bg-transparent !border-none !shadow-none !text-[11px] !py-1 !px-2 text-gray-700 dark:text-gray-300"
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </Select>
          </div>
          <AddButton onClick={() => setShowModal(true)}>Lançamento</AddButton>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <Metric
          label="Entradas"
          value={`R$ ${entradas.toFixed(2)}`}
          color="green"
          icon={<IconTrendingUp className="w-5 h-5" />}
          sub={`${transacoes.filter(t => t.tipo === 'entrada').length} lançamentos`}
        />
        <Metric
          label="Saídas"
          value={`R$ ${saidas.toFixed(2)}`}
          color="red"
          icon={<IconTrendingDown className="w-5 h-5" />}
          sub={`${transacoes.filter(t => t.tipo === 'saida').length} lançamentos`}
        />
        <Metric
          label="Saldo do período"
          value={`R$ ${saldo.toFixed(2)}`}
          color={saldo >= 0 ? 'green' : 'red'}
          sub={saldo >= 0 ? 'Resultado positivo' : 'Resultado negativo'}
        />
      </div>

      {transacoes.length === 0 ? (
        <EmptyState
          icon={<IconWallet className="w-5 h-5" />}
          title="Nenhum lançamento neste período"
          description="Registre entradas e saídas para acompanhar o fluxo de caixa."
          action={<AddButton onClick={() => setShowModal(true)}>Lançamento</AddButton>}
        />
      ) : (
        <>
          {/* Gráfico de fluxo */}
          {chartData.length > 0 && (
            <Card className="mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Fluxo de caixa
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{periodoLabel}</p>
                </div>
                {/* Legenda manual — mais clean que a do Recharts */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">Entradas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">Saídas</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={d => `${d}`}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => `R$${v}`}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas"   name="Saídas"   fill="#f87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Tabela de lançamentos */}
          <Card padded={false}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Lançamentos</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {transacoes.length} registro{transacoes.length !== 1 ? 's' : ''} em {periodoLabel}
                </p>
              </div>
              {/* Mini resumo inline */}
              <div className="hidden sm:flex items-center gap-4 text-xs">
                <span className="text-green-500 dark:text-green-400 font-semibold">
                  +R$ {entradas.toFixed(2)}
                </span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span className="text-red-500 dark:text-red-400 font-semibold">
                  −R$ {saidas.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <Th>Data</Th>
                    <Th>Descrição</Th>
                    <Th>Categoria</Th>
                    <Th>Tipo</Th>
                    <Th>Valor</Th>
                    <Th className="text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {transacoes.map((t, i, arr) => (
                    <tr
                      key={t.id}
                      className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                        i < arr.length - 1 ? 'border-b border-gray-50 dark:border-gray-800/60' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                        {format(new Date(t.data + 'T00:00:00'), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-900 dark:text-gray-100">
                        {t.descricao}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {t.categoria}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={t.tipo === 'entrada' ? 'green' : 'red'}>
                          {t.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                        </Badge>
                      </td>
                      <td className={`px-4 py-3 text-xs font-semibold tabular-nums ${
                        t.tipo === 'entrada'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {t.tipo === 'saida' ? '−' : '+'}R$ {t.valor.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <RowActions>
                          <IconAction onClick={() => excluir(t.id)} title="Excluir" color="red">
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
        </>
      )}

      {/* Modal novo lançamento */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Lançamento">
        <form onSubmit={salvar} className="flex flex-col gap-4">

          <Field label="Descrição">
            <Input
              required
              value={form.descricao}
              onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              placeholder="Ex: Mensalidade João, Aluguel sala…"
            />
          </Field>

          {/* Tipo como toggle — mais visual que select */}
          <Field label="Tipo">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, tipo: 'entrada' }))}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  form.tipo === 'entrada'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                + Entrada
              </button>
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, tipo: 'saida' }))}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  form.tipo === 'saida'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                − Saída
              </button>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor (R$)">
              <Input
                type="number" required min={0} step="0.01"
                value={form.valor}
                onChange={e => setForm(p => ({ ...p, valor: +e.target.value }))}
              />
            </Field>
            <Field label="Data">
              <Input
                type="date" required
                value={form.data}
                onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Categoria">
            <Select
              value={form.categoria}
              onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
            >
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </Select>
          </Field>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}