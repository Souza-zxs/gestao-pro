'use client'

import { useEffect, useState } from 'react'
import { getAll, insert, update, remove } from '@/lib/store'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { format, parseISO, getMonth, getYear } from 'date-fns'
import type { Turma, Aluno } from '@/lib/types'
import {
  Card, Tabs, Metric, Modal, Field, Input, Select, Badge,
  EmptyState, Th, AddButton, Button, RowActions, IconAction,
} from '@/components/ui'
import { IconGraduation, IconEdit, IconTrash } from '@/components/icons'

/* ─── Constantes de status ──────────────────────────────────────────
   Record<string, X> = dicionário onde chave e valor têm tipos fixos.
   Centralizar aqui evita repetir strings espalhadas pelo código.
─────────────────────────────────────────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  ativo:    '#3b82f6',
  inativo:  '#f59e0b',
  trancado: '#6b7280',
  formado:  '#22c55e',
}
const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo', inativo: 'Inativo', trancado: 'Trancado', formado: 'Formado',
}
const STATUS_BADGE: Record<string, 'blue' | 'amber' | 'gray' | 'green'> = {
  ativo: 'blue', inativo: 'amber', trancado: 'gray', formado: 'green',
}
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

/* ─── Iniciais do aluno ─────────────────────────────────────────── */
const AVATAR_COLORS = [
  'bg-blue-900/40 text-blue-400',
  'bg-purple-900/40 text-purple-400',
  'bg-amber-900/40 text-amber-400',
  'bg-green-900/40 text-green-400',
]
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

/* ─── Tooltip customizado para os gráficos ──────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 dark:bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

/* ─── Componente principal ──────────────────────────────────────── */
export default function AlunosClient() {
  const [turmas,       setTurmas]       = useState<Turma[]>([])
  const [alunos,       setAlunos]       = useState<Aluno[]>([])
  const [turmaSel,     setTurmaSel]     = useState('todas')
  const [aba,          setAba]          = useState<'dashboard' | 'alunos' | 'turmas'>('dashboard')
  const [showAlunoModal, setShowAlunoModal] = useState(false)
  const [showTurmaModal, setShowTurmaModal] = useState(false)
  const [editAluno,    setEditAluno]    = useState<Aluno | null>(null)
  const [formAluno,    setFormAluno]    = useState({ nome: '', turma_id: '', status: 'ativo', data_entrada: '' })
  const [formTurma,    setFormTurma]    = useState({ nome: '', ativa: true })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const t = await getAll<Turma>('turmas')
    // .map() transforma cada aluno adicionando o objeto da turma correspondente
    // É estado derivado: calculado na hora, não armazenado separado
    const a = (await getAll<Aluno>('alunos'))
      .map(al => ({ ...al, turmas: t.find(tt => tt.id === al.turma_id) }))
    setTurmas(t)
    setAlunos(a)
  }

  /* ── Estado derivado — calculado direto, sem useState extra ── */
  const alunosFiltrados = turmaSel === 'todas'
    ? alunos
    : alunos.filter(a => a.turma_id === turmaSel)

  const totalAlunos  = alunosFiltrados.length
  const turmasAtivas = turmas.filter(t => t.ativa).length
  const ativos       = alunosFiltrados.filter(a => a.status === 'ativo').length
  const inativos     = alunosFiltrados.filter(a => a.status === 'inativo').length
  const trancados    = alunosFiltrados.filter(a => a.status === 'trancado').length
  const formados     = alunosFiltrados.filter(a => a.status === 'formado').length
  const pctAtivos    = totalAlunos ? Math.round((ativos / totalAlunos) * 100) : 0

  /* ── Dados para os gráficos ── */
  const chartTurmas = turmas.map(t => ({
    nome:   t.nome,
    ativos: alunos.filter(a => a.turma_id === t.id && a.status === 'ativo').length,
    total:  alunos.filter(a => a.turma_id === t.id).length,
  }))

  const chartStatus = Object.entries(STATUS_LABELS)
    .map(([key, label]) => ({
      name:  label,
      value: alunosFiltrados.filter(a => a.status === key).length,
      color: STATUS_COLORS[key],
    }))
    .filter(d => d.value > 0)

  const anoAtual = new Date().getFullYear()
  const chartMes = MESES_ABREV.map((m, i) => ({
    mes:      m,
    entradas: alunosFiltrados.filter(a =>
      a.data_entrada &&
      getMonth(parseISO(a.data_entrada)) === i &&
      getYear(parseISO(a.data_entrada)) === anoAtual
    ).length,
  }))

  // [...new Set(...)] = deduplitar: Set ignora duplicatas, spread converte de volta pra array
  const anos = [...new Set(
    alunos.map(a => a.data_entrada ? getYear(parseISO(a.data_entrada)) : null)
      .filter(Boolean) as number[]
  )].sort()

  const chartAno = anos.map(ano => ({
    ano:      ano.toString(),
    entradas: alunosFiltrados.filter(a =>
      a.data_entrada && getYear(parseISO(a.data_entrada)) === ano
    ).length,
  }))

  /* ── Ações ── */
  async function salvarAluno(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      nome:          formAluno.nome,
      turma_id:      formAluno.turma_id || null,
      status:        formAluno.status as Aluno['status'],
      data_entrada:  formAluno.data_entrada,
    }
    if (editAluno) await update('alunos', editAluno.id, payload)
    else await insert('alunos', payload)
    fecharAlunoModal()
    await loadAll()
  }

  async function excluirAluno(id: string) {
    if (confirm('Excluir aluno?')) { await remove('alunos', id); await loadAll() }
  }

  async function salvarTurma(e: React.FormEvent) {
    e.preventDefault()
    await insert('turmas', { ...formTurma })
    setShowTurmaModal(false)
    setFormTurma({ nome: '', ativa: true })
    await loadAll()
  }

  async function toggleTurma(t: Turma) {
    await update<Turma>('turmas', t.id, { ativa: !t.ativa })
    await loadAll()
  }

  async function excluirTurma(id: string) {
    if (confirm('Excluir turma?')) { await remove('turmas', id); await loadAll() }
  }

  function novoAluno() {
    setEditAluno(null)
    setFormAluno({ nome: '', turma_id: '', status: 'ativo', data_entrada: '' })
    setShowAlunoModal(true)
  }

  function editarAluno(a: Aluno) {
    setEditAluno(a)
    setFormAluno({ nome: a.nome, turma_id: a.turma_id || '', status: a.status, data_entrada: a.data_entrada })
    setShowAlunoModal(true)
  }

  function fecharAlunoModal() {
    setShowAlunoModal(false)
    setEditAluno(null)
    setFormAluno({ nome: '', turma_id: '', status: 'ativo', data_entrada: '' })
  }

  /* ── Render ── */
  return (
    <div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-0.5">
            Gestão Pro
          </p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Alunos</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Matrículas, turmas e indicadores</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={turmaSel} onChange={e => setTurmaSel(e.target.value)} className="!w-auto text-xs">
            <option value="todas">Todas as turmas</option>
            {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </Select>
          {aba === 'alunos' && <AddButton onClick={novoAluno}>Novo Aluno</AddButton>}
          {aba === 'turmas' && <AddButton onClick={() => setShowTurmaModal(true)}>Nova Turma</AddButton>}
        </div>
      </div>

      <Tabs
        active={aba}
        onChange={setAba}
        tabs={[
          { value: 'dashboard', label: 'Dashboard' },
          { value: 'alunos',    label: 'Alunos' },
          { value: 'turmas',    label: 'Turmas' },
        ]}
      />

      {/* ── ABA: DASHBOARD ── */}
      {aba === 'dashboard' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Metric label="Total de Alunos"       value={totalAlunos.toString()}  color="default" icon={<IconGraduation className="w-5 h-5" />} />
            <Metric label="Turmas Ativas"         value={turmasAtivas.toString()} color="blue" />
            <Metric label="Alunos Ativos"         value={`${pctAtivos}%`}         color="green" sub={`${ativos} alunos`} />
            <Metric label="Inat. / Tranc. / Form." value={`${inativos} / ${trancados} / ${formados}`} color="amber" />
          </div>

          {totalAlunos === 0 ? (
            <EmptyState
              icon={<IconGraduation className="w-5 h-5" />}
              title="Nenhum aluno cadastrado ainda"
              description="Crie turmas e adicione alunos para visualizar os gráficos."
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Alunos por turma */}
              <Card>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Alunos por Turma</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Ativos vs total por turma</p>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartTurmas} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#9ca3af' }} width={80} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="ativos" name="Ativos" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="total"  name="Total"  fill="rgba(59,130,246,0.2)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Distribuição por status */}
              <Card>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Distribuição por Status</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Proporção de cada status</p>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={chartStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={2}>
                      {chartStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              {/* Entradas por mês */}
              <Card>
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Entradas por Mês</h3>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{anoAtual}</p>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="entradas" name="Entradas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Entradas por ano */}
              {chartAno.length > 0 && (
                <Card>
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Entradas por Ano</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Histórico de matrículas</p>
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartAno}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="ano" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} allowDecimals={false} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ABA: ALUNOS ── */}
      {aba === 'alunos' && (
        alunosFiltrados.length === 0 ? (
          <EmptyState
            icon={<IconGraduation className="w-5 h-5" />}
            title="Nenhum aluno cadastrado"
            description="Adicione alunos com turma, status e data de entrada."
            action={<AddButton onClick={novoAluno}>Novo Aluno</AddButton>}
          />
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <Th>Nome</Th>
                    <Th>Turma</Th>
                    <Th>Status</Th>
                    <Th>Entrada</Th>
                    <Th className="text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {alunosFiltrados.map((a, i, arr) => {
                    const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
                    return (
                      <tr
                        key={a.id}
                        className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                          i < arr.length - 1 ? 'border-b border-gray-50 dark:border-gray-800/60' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${color}`}>
                              {getInitials(a.nome)}
                            </div>
                            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{a.nome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                          {(a.turmas as unknown as Turma)?.nome || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge color={STATUS_BADGE[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                          {a.data_entrada ? format(parseISO(a.data_entrada), 'dd/MM/yyyy') : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <RowActions>
                            <IconAction onClick={() => editarAluno(a)} title="Editar" color="blue">
                              <IconEdit className="w-4 h-4" />
                            </IconAction>
                            <IconAction onClick={() => excluirAluno(a.id)} title="Excluir" color="red">
                              <IconTrash className="w-4 h-4" />
                            </IconAction>
                          </RowActions>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* ── ABA: TURMAS ── */}
      {aba === 'turmas' && (
        turmas.length === 0 ? (
          <EmptyState
            icon={<IconGraduation className="w-5 h-5" />}
            title="Nenhuma turma cadastrada"
            description="Crie turmas para organizar seus alunos."
            action={<AddButton onClick={() => setShowTurmaModal(true)}>Nova Turma</AddButton>}
          />
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <Th>Turma</Th>
                    <Th>Alunos</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {turmas.map((t, i, arr) => (
                    <tr
                      key={t.id}
                      className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                        i < arr.length - 1 ? 'border-b border-gray-50 dark:border-gray-800/60' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-xs font-medium text-gray-900 dark:text-gray-100">
                        {t.nome}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {alunos.filter(a => a.turma_id === t.id).length} alunos
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={t.ativa ? 'green' : 'gray'}>{t.ativa ? 'Ativa' : 'Inativa'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="secondary" className="!px-2.5 !py-1 !text-[11px]" onClick={() => toggleTurma(t)}>
                            {t.ativa ? 'Desativar' : 'Ativar'}
                          </Button>
                          <IconAction onClick={() => excluirTurma(t.id)} title="Excluir" color="red">
                            <IconTrash className="w-4 h-4" />
                          </IconAction>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* ── Modal: Aluno ── */}
      <Modal
        open={showAlunoModal}
        onClose={fecharAlunoModal}
        title={editAluno ? 'Editar Aluno' : 'Novo Aluno'}
      >
        <form onSubmit={salvarAluno} className="flex flex-col gap-4">
          <Field label="Nome">
            <Input required value={formAluno.nome} onChange={e => setFormAluno(p => ({ ...p, nome: e.target.value }))} />
          </Field>
          <Field label="Turma">
            <Select value={formAluno.turma_id} onChange={e => setFormAluno(p => ({ ...p, turma_id: e.target.value }))}>
              <option value="">Sem turma</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={formAluno.status} onChange={e => setFormAluno(p => ({ ...p, status: e.target.value }))}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="trancado">Trancado</option>
              <option value="formado">Formado</option>
            </Select>
          </Field>
          <Field label="Data de Entrada">
            <Input type="date" required value={formAluno.data_entrada} onChange={e => setFormAluno(p => ({ ...p, data_entrada: e.target.value }))} />
          </Field>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={fecharAlunoModal}>Cancelar</Button>
            <Button type="submit" className="flex-1">{editAluno ? 'Salvar' : 'Adicionar'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Modal: Turma ── */}
      <Modal open={showTurmaModal} onClose={() => setShowTurmaModal(false)} title="Nova Turma" size="sm">
        <form onSubmit={salvarTurma} className="flex flex-col gap-4">
          <Field label="Nome da Turma">
            <Input required value={formTurma.nome} onChange={e => setFormTurma(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Turma A, 2025.1..." />
          </Field>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowTurmaModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1">Criar</Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}