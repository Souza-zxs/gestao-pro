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
  PageHeader, Card, Tabs, Metric, Modal, Field, Input, Select, Badge,
  EmptyState, Th, AddButton, Button, RowActions, IconAction,
} from '@/components/ui'
import { IconGraduation, IconEdit, IconTrash } from '@/components/icons'

const STATUS_COLORS: Record<string, string> = { ativo: '#2563eb', inativo: '#f59e0b', trancado: '#6b7280', formado: '#16a34a' }
const STATUS_LABELS: Record<string, string> = { ativo: 'Ativo', inativo: 'Inativo', trancado: 'Trancado', formado: 'Formado' }
const STATUS_BADGE: Record<string, 'blue' | 'amber' | 'gray' | 'green'> = { ativo: 'blue', inativo: 'amber', trancado: 'gray', formado: 'green' }
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function AlunosClient() {
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [turmaSel, setTurmaSel] = useState('todas')
  const [aba, setAba] = useState<'dashboard' | 'alunos' | 'turmas'>('dashboard')
  const [showAlunoModal, setShowAlunoModal] = useState(false)
  const [showTurmaModal, setShowTurmaModal] = useState(false)
  const [editAluno, setEditAluno] = useState<Aluno | null>(null)
  const [formAluno, setFormAluno] = useState({ nome: '', turma_id: '', status: 'ativo', data_entrada: '' })
  const [formTurma, setFormTurma] = useState({ nome: '', ativa: true })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const t = await getAll<Turma>('turmas')
    const a = (await getAll<Aluno>('alunos')).map(al => ({ ...al, turmas: t.find(tt => tt.id === al.turma_id) }))
    setTurmas(t); setAlunos(a)
  }

  const alunosFiltrados = turmaSel === 'todas' ? alunos : alunos.filter(a => a.turma_id === turmaSel)
  const totalAlunos = alunosFiltrados.length
  const turmasAtivas = turmas.filter(t => t.ativa).length
  const ativos = alunosFiltrados.filter(a => a.status === 'ativo').length
  const inativos = alunosFiltrados.filter(a => a.status === 'inativo').length
  const trancados = alunosFiltrados.filter(a => a.status === 'trancado').length
  const formados = alunosFiltrados.filter(a => a.status === 'formado').length
  const pctAtivos = totalAlunos ? Math.round((ativos / totalAlunos) * 100) : 0

  const chartTurmas = turmas.map(t => ({
    nome: t.nome,
    ativos: alunos.filter(a => a.turma_id === t.id && a.status === 'ativo').length,
    total: alunos.filter(a => a.turma_id === t.id).length,
  }))
  const chartStatus = Object.entries(STATUS_LABELS)
    .map(([key, label]) => ({ name: label, value: alunosFiltrados.filter(a => a.status === key).length, color: STATUS_COLORS[key] }))
    .filter(d => d.value > 0)
  const anoAtual = new Date().getFullYear()
  const chartMes = MESES_ABREV.map((m, i) => ({
    mes: m,
    entradas: alunosFiltrados.filter(a => a.data_entrada && getMonth(parseISO(a.data_entrada)) === i && getYear(parseISO(a.data_entrada)) === anoAtual).length,
  }))
  const anos = [...new Set(alunos.map(a => a.data_entrada ? getYear(parseISO(a.data_entrada)) : null).filter(Boolean) as number[])].sort()
  const chartAno = anos.map(ano => ({ ano: ano.toString(), entradas: alunosFiltrados.filter(a => a.data_entrada && getYear(parseISO(a.data_entrada)) === ano).length }))

  async function salvarAluno(e: React.FormEvent) {
    e.preventDefault()
    const payload = { nome: formAluno.nome, turma_id: formAluno.turma_id || null, status: formAluno.status as Aluno['status'], data_entrada: formAluno.data_entrada }
    if (editAluno) await update('alunos', editAluno.id, payload)
    else await insert('alunos', payload)
    setShowAlunoModal(false); setEditAluno(null); setFormAluno({ nome: '', turma_id: '', status: 'ativo', data_entrada: '' }); await loadAll()
  }
  async function excluirAluno(id: string) { if (confirm('Excluir aluno?')) { await remove('alunos', id); await loadAll() } }
  async function salvarTurma(e: React.FormEvent) {
    e.preventDefault()
    await insert('turmas', { ...formTurma })
    setShowTurmaModal(false); setFormTurma({ nome: '', ativa: true }); await loadAll()
  }
  async function toggleTurma(t: Turma) { await update<Turma>('turmas', t.id, { ativa: !t.ativa }); await loadAll() }
  async function excluirTurma(id: string) { if (confirm('Excluir turma?')) { await remove('turmas', id); await loadAll() } }

  const novoAluno = () => { setEditAluno(null); setFormAluno({ nome: '', turma_id: '', status: 'ativo', data_entrada: '' }); setShowAlunoModal(true) }

  return (
    <div>
      <PageHeader
        title="Alunos"
        subtitle="Acompanhe matrículas, turmas e indicadores"
        action={
          <div className="flex items-center gap-3">
            <Select value={turmaSel} onChange={e => setTurmaSel(e.target.value)} className="!w-auto">
              <option value="todas">Todas as turmas</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Select>
            {aba === 'alunos' && <AddButton onClick={novoAluno}>Novo Aluno</AddButton>}
            {aba === 'turmas' && <AddButton onClick={() => setShowTurmaModal(true)}>Nova Turma</AddButton>}
          </div>
        }
      />

      <Tabs active={aba} onChange={setAba} tabs={[
        { value: 'dashboard', label: 'Dashboard' },
        { value: 'alunos', label: 'Alunos' },
        { value: 'turmas', label: 'Turmas' },
      ]} />

      {/* DASHBOARD */}
      {aba === 'dashboard' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Metric label="Total de Alunos" value={totalAlunos.toString()} icon={<IconGraduation className="w-6 h-6" />} />
            <Metric label="Turmas Ativas" value={turmasAtivas.toString()} />
            <Metric label="Alunos Ativos" value={`${pctAtivos}%`} sub={`${ativos} alunos`} accent="text-blue-600" />
            <Metric label="Inat. / Tranc. / Form." value={`${inativos} / ${trancados} / ${formados}`} />
          </div>

          {totalAlunos === 0 ? (
            <EmptyState icon={<IconGraduation className="w-6 h-6" />} title="Nenhum aluno cadastrado ainda" description="Crie turmas e adicione alunos para visualizar os gráficos." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Alunos por Turma</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartTurmas} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="ativos" name="Ativos" fill="#2563eb" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="total" name="Total" fill="#bfdbfe" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribuição por Status</h3>
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

              {chartAno.length > 0 && (
                <Card>
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Entradas por Ano</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartAno}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="entradas" name="Entradas" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ALUNOS */}
      {aba === 'alunos' && (
        alunosFiltrados.length === 0 ? (
          <EmptyState icon={<IconGraduation className="w-6 h-6" />} title="Nenhum aluno cadastrado" description="Adicione alunos com turma, status e data de entrada." action={<AddButton onClick={novoAluno}>Novo Aluno</AddButton>} />
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr><Th>Nome</Th><Th>Turma</Th><Th>Status</Th><Th>Entrada</Th><Th className="text-right">Ações</Th></tr>
                </thead>
                <tbody>
                  {alunosFiltrados.map((a, i, arr) => (
                    <tr key={a.id} className={i < arr.length - 1 ? 'border-b border-gray-50' : ''}>
                      <td className="px-4 py-3 font-medium text-gray-900">{a.nome}</td>
                      <td className="px-4 py-3 text-gray-500">{(a.turmas as unknown as Turma)?.nome || '—'}</td>
                      <td className="px-4 py-3"><Badge color={STATUS_BADGE[a.status]}>{STATUS_LABELS[a.status]}</Badge></td>
                      <td className="px-4 py-3 text-gray-500">{a.data_entrada ? format(parseISO(a.data_entrada), 'dd/MM/yyyy') : '—'}</td>
                      <td className="px-4 py-3">
                        <RowActions>
                          <IconAction onClick={() => { setEditAluno(a); setFormAluno({ nome: a.nome, turma_id: a.turma_id || '', status: a.status, data_entrada: a.data_entrada }); setShowAlunoModal(true) }} title="Editar" color="blue"><IconEdit className="w-4 h-4" /></IconAction>
                          <IconAction onClick={() => excluirAluno(a.id)} title="Excluir" color="red"><IconTrash className="w-4 h-4" /></IconAction>
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

      {/* TURMAS */}
      {aba === 'turmas' && (
        turmas.length === 0 ? (
          <EmptyState icon={<IconGraduation className="w-6 h-6" />} title="Nenhuma turma cadastrada" description="Crie turmas para organizar seus alunos." action={<AddButton onClick={() => setShowTurmaModal(true)}>Nova Turma</AddButton>} />
        ) : (
          <Card padded={false} className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr><Th>Turma</Th><Th>Alunos</Th><Th>Status</Th><Th className="text-right">Ações</Th></tr>
              </thead>
              <tbody>
                {turmas.map((t, i, arr) => (
                  <tr key={t.id} className={i < arr.length - 1 ? 'border-b border-gray-50' : ''}>
                    <td className="px-4 py-3 font-medium text-gray-900">{t.nome}</td>
                    <td className="px-4 py-3 text-gray-700">{alunos.filter(a => a.turma_id === t.id).length}</td>
                    <td className="px-4 py-3"><Badge color={t.ativa ? 'green' : 'gray'}>{t.ativa ? 'Ativa' : 'Inativa'}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button variant="secondary" className="!px-2.5 !py-1 !text-xs" onClick={() => toggleTurma(t)}>{t.ativa ? 'Desativar' : 'Ativar'}</Button>
                        <IconAction onClick={() => excluirTurma(t.id)} title="Excluir" color="red"><IconTrash className="w-4 h-4" /></IconAction>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}

      <Modal open={showAlunoModal} onClose={() => { setShowAlunoModal(false); setEditAluno(null) }} title={editAluno ? 'Editar Aluno' : 'Novo Aluno'}>
        <form onSubmit={salvarAluno} className="space-y-4">
          <Field label="Nome"><Input required value={formAluno.nome} onChange={e => setFormAluno(p => ({ ...p, nome: e.target.value }))} /></Field>
          <Field label="Turma">
            <Select value={formAluno.turma_id} onChange={e => setFormAluno(p => ({ ...p, turma_id: e.target.value }))}>
              <option value="">Sem turma</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={formAluno.status} onChange={e => setFormAluno(p => ({ ...p, status: e.target.value }))}>
              <option value="ativo">Ativo</option><option value="inativo">Inativo</option><option value="trancado">Trancado</option><option value="formado">Formado</option>
            </Select>
          </Field>
          <Field label="Data de Entrada"><Input type="date" required value={formAluno.data_entrada} onChange={e => setFormAluno(p => ({ ...p, data_entrada: e.target.value }))} /></Field>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => { setShowAlunoModal(false); setEditAluno(null) }}>Cancelar</Button>
            <Button type="submit" className="flex-1">{editAluno ? 'Salvar' : 'Adicionar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showTurmaModal} onClose={() => setShowTurmaModal(false)} title="Nova Turma" size="sm">
        <form onSubmit={salvarTurma} className="space-y-4">
          <Field label="Nome da Turma"><Input required value={formTurma.nome} onChange={e => setFormTurma(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Turma A, 2025.1..." /></Field>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowTurmaModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1">Criar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
