'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAll, insert, update, remove } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import { brl } from '@/lib/format'
import { listTeamUsers, type TeamUser } from '@/lib/users'
import { ROLE_LABELS } from '@/lib/rbac'
import type { Resultado, Cliente } from '@/lib/types'
import {
  PageHeader, Card, Metric, Modal, Field, Input, Select, Badge,
  EmptyState, Th, AddButton, Button, RowActions, IconAction,
} from '@/components/ui'
import { IconChart, IconEdit, IconTrash, IconSearch } from '@/components/icons'

const STATUS_OPCOES = ['Linear', 'Crescente', 'Decrescente', 'Atenção']
const statusColor = (s: string): 'green' | 'red' | 'amber' | 'gray' | 'blue' =>
  s === 'Crescente' ? 'green' : s === 'Decrescente' ? 'red' : s === 'Atenção' ? 'amber' : s === 'Linear' ? 'blue' : 'gray'

// Converte texto (aceita vírgula) em número; vazio/invalid => 0.
const num = (s: string) => { const n = parseFloat(String(s).replace(',', '.')); return isNaN(n) ? 0 : n }
const int = (s: string) => { const n = parseInt(String(s), 10); return isNaN(n) ? 0 : n }

const totalMes = (r: Resultado) => r.semana_1 + r.semana_2 + r.semana_3 + r.semana_4 + r.semana_5
const totalPedidos = (r: Resultado) => r.pedidos_1 + r.pedidos_2 + r.pedidos_3 + r.pedidos_4 + r.pedidos_5

// Rótulo amigável do mês 'YYYY-MM' -> 'mm/yyyy'.
const fmtMes = (m: string) => /^\d{4}-\d{2}$/.test(m) ? `${m.slice(5)}/${m.slice(0, 4)}` : (m || '—')
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

const FORM_INICIAL = {
  colaborador_email: '', colaborador_nome: '', cliente_id: '', cliente_nome: '', mes: '',
  faturamento_anterior: '', meta_mes: '',
  semana_1: '', semana_2: '', semana_3: '', semana_4: '', semana_5: '',
  pedidos_1: '', pedidos_2: '', pedidos_3: '', pedidos_4: '', pedidos_5: '',
  pedidos_cancelados: '', projecao: '', status: 'Linear',
}

export default function ResultadosClient() {
  const { role, name, email } = useAuth()
  const isAdmin = role === 'admin'

  const [resultados, setResultados] = useState<Resultado[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [equipe, setEquipe] = useState<TeamUser[]>([])
  const [busca, setBusca] = useState('')
  const [filtroMes, setFiltroMes] = useState('todos')
  const [filtroColab, setFiltroColab] = useState('todos')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)

  useEffect(() => { load() }, [])
  async function load() {
    try {
      const [rs, cl, eq] = await Promise.all([
        getAll<Resultado>('resultados', { order: { column: 'criado_em', ascending: false } }),
        getAll<Cliente>('clientes', { order: { column: 'nome', ascending: true } }).catch(() => [] as Cliente[]),
        // Colaboradores = usuários reais do sistema (mesma fonte de Configurações → Cargos).
        isAdmin ? listTeamUsers().catch(() => [] as TeamUser[]) : Promise.resolve([] as TeamUser[]),
      ])
      setResultados(rs); setClientes(cl); setEquipe(eq); setErroCarregar(null)
    } catch (err) {
      setErroCarregar(err instanceof Error ? err.message : 'Erro ao carregar resultados')
    }
  }

  const meses = useMemo(() => [...new Set(resultados.map(r => r.mes).filter(Boolean))].sort().reverse(), [resultados])
  const colaboradores = useMemo(
    () => [...new Map(resultados.filter(r => r.colaborador_email).map(r => [r.colaborador_email, r.colaborador_nome || r.colaborador_email])).entries()],
    [resultados],
  )

  const filtrados = useMemo(() => resultados.filter(r => {
    if (filtroMes !== 'todos' && r.mes !== filtroMes) return false
    if (filtroColab !== 'todos' && r.colaborador_email !== filtroColab) return false
    if (busca) {
      const t = busca.toLowerCase()
      if (![r.cliente_nome, r.colaborador_nome].some(v => (v || '').toLowerCase().includes(t))) return false
    }
    return true
  }), [resultados, filtroMes, filtroColab, busca])

  const somaFat = filtrados.reduce((s, r) => s + totalMes(r), 0)
  const somaPedidos = filtrados.reduce((s, r) => s + totalPedidos(r), 0)
  const somaCancelados = filtrados.reduce((s, r) => s + r.pedidos_cancelados, 0)

  const set = (campo: keyof typeof FORM_INICIAL, valor: string) => setForm(p => ({ ...p, [campo]: valor }))

  // Colaboradores atribuíveis = equipe real (admin + instrutor), exceto alunos.
  const colaboradoresEquipe = useMemo(() => equipe.filter(u => u.role !== 'aluno'), [equipe])

  function escolherColaborador(mail: string) {
    const u = colaboradoresEquipe.find(x => x.email === mail)
    setForm(p => ({ ...p, colaborador_email: mail, colaborador_nome: u?.name || '' }))
  }
  function escolherCliente(id: string) {
    const c = clientes.find(x => x.id === id)
    setForm(p => ({ ...p, cliente_id: id, cliente_nome: c?.nome || '' }))
  }

  function novo() {
    setEditId(null); setErro(null)
    setForm({ ...FORM_INICIAL, mes: mesAtual() })
    setShowModal(true)
  }
  function editar(r: Resultado) {
    setEditId(r.id); setErro(null)
    setForm({
      colaborador_email: r.colaborador_email, colaborador_nome: r.colaborador_nome,
      cliente_id: r.cliente_id || '', cliente_nome: r.cliente_nome, mes: r.mes,
      faturamento_anterior: String(r.faturamento_anterior || ''), meta_mes: String(r.meta_mes || ''),
      semana_1: String(r.semana_1 || ''), semana_2: String(r.semana_2 || ''), semana_3: String(r.semana_3 || ''),
      semana_4: String(r.semana_4 || ''), semana_5: String(r.semana_5 || ''),
      pedidos_1: String(r.pedidos_1 || ''), pedidos_2: String(r.pedidos_2 || ''), pedidos_3: String(r.pedidos_3 || ''),
      pedidos_4: String(r.pedidos_4 || ''), pedidos_5: String(r.pedidos_5 || ''),
      pedidos_cancelados: String(r.pedidos_cancelados || ''), projecao: String(r.projecao || ''), status: r.status || 'Linear',
    })
    setShowModal(true)
  }
  function fechar() { setShowModal(false); setEditId(null); setForm(FORM_INICIAL); setErro(null) }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    // Colaborador é definido pelo admin. Ao criar como colaborador (não deve
    // acontecer pela RLS), cairia em si mesmo.
    const colabNome = isAdmin ? form.colaborador_nome : name
    const colabEmail = (isAdmin ? form.colaborador_email : email).trim().toLowerCase()
    if (isAdmin && !colabEmail) { setErro('Selecione o colaborador responsável.'); return }
    const payload = {
      colaborador_nome: colabNome, colaborador_email: colabEmail,
      cliente_id: form.cliente_id || null, cliente_nome: form.cliente_nome,
      mes: form.mes,
      faturamento_anterior: num(form.faturamento_anterior), meta_mes: num(form.meta_mes),
      semana_1: num(form.semana_1), semana_2: num(form.semana_2), semana_3: num(form.semana_3),
      semana_4: num(form.semana_4), semana_5: num(form.semana_5),
      pedidos_1: int(form.pedidos_1), pedidos_2: int(form.pedidos_2), pedidos_3: int(form.pedidos_3),
      pedidos_4: int(form.pedidos_4), pedidos_5: int(form.pedidos_5),
      pedidos_cancelados: int(form.pedidos_cancelados), projecao: num(form.projecao), status: form.status,
    }
    setSalvando(true)
    try {
      if (editId) await update<Resultado>('resultados', editId, payload)
      else await insert('resultados', payload)
      fechar(); await load()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este resultado?')) return
    try { await remove('resultados', id); await load() }
    catch (err) { alert('Erro ao excluir: ' + (err instanceof Error ? err.message : 'desconhecido')) }
  }

  // Pré-visualização dos totais no formulário.
  const previewMes = num(form.semana_1) + num(form.semana_2) + num(form.semana_3) + num(form.semana_4) + num(form.semana_5)
  const previewPedidos = int(form.pedidos_1) + int(form.pedidos_2) + int(form.pedidos_3) + int(form.pedidos_4) + int(form.pedidos_5)

  return (
    <div>
      <PageHeader
        title="Resultados"
        subtitle={isAdmin ? 'Faturamento mensal por cliente de cada colaborador' : 'Os resultados dos seus clientes'}
        action={isAdmin ? <AddButton onClick={novo}>Novo resultado</AddButton> : undefined}
      />

      {erroCarregar && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
          Não foi possível carregar: {erroCarregar}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Metric label="Faturamento (mês)" value={brl(somaFat)} icon={<IconChart className="w-6 h-6" />} />
        <Metric label="Pedidos" value={somaPedidos.toString()} accent="text-blue-600" />
        <Metric label="Cancelados" value={somaCancelados.toString()} accent="text-red-600" />
        <Metric label="Linhas" value={filtrados.length.toString()} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente ou colaborador…" className="pl-9" />
        </div>
        <Select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className="!w-auto">
          <option value="todos">Todos os meses</option>
          {meses.map(m => <option key={m} value={m}>{fmtMes(m)}</option>)}
        </Select>
        {isAdmin && colaboradores.length > 0 && (
          <Select value={filtroColab} onChange={e => setFiltroColab(e.target.value)} className="!w-auto">
            <option value="todos">Todos os colaboradores</option>
            {colaboradores.map(([mail, nome]) => <option key={mail} value={mail}>{nome}</option>)}
          </Select>
        )}
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={<IconChart className="w-6 h-6" />}
          title={resultados.length === 0 ? 'Nenhum resultado cadastrado' : 'Nada neste filtro'}
          description={isAdmin
            ? 'Crie um resultado atribuindo um cliente a um colaborador e preencha o faturamento por semana.'
            : 'Seu administrador ainda não atribuiu clientes a você.'}
          action={isAdmin && resultados.length === 0 ? <AddButton onClick={novo}>Novo resultado</AddButton> : undefined}
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <Th>Mês</Th>
                  {isAdmin && <Th>Colaborador</Th>}
                  <Th>Cliente</Th>
                  <Th>Fat. anterior</Th><Th>Meta</Th>
                  <Th>Sem 1</Th><Th>Ped 1</Th><Th>Sem 2</Th><Th>Ped 2</Th><Th>Sem 3</Th><Th>Ped 3</Th>
                  <Th>Sem 4</Th><Th>Ped 4</Th><Th>Sem 5</Th><Th>Ped 5</Th>
                  <Th>Cancelados</Th><Th>Total mês</Th><Th>Total ped.</Th><Th>Projeção</Th><Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r, i, arr) => (
                  <tr key={r.id} className={i < arr.length - 1 ? 'border-b border-gray-50' : ''}>
                    <td className="px-4 py-3 text-gray-500">{fmtMes(r.mes)}</td>
                    {isAdmin && <td className="px-4 py-3 text-gray-700">{r.colaborador_nome || r.colaborador_email || '—'}</td>}
                    <td className="px-4 py-3 font-medium text-gray-900">{r.cliente_nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{brl(r.faturamento_anterior)}</td>
                    <td className="px-4 py-3 text-gray-500">{brl(r.meta_mes)}</td>
                    <td className="px-4 py-3 text-gray-500">{brl(r.semana_1)}</td><td className="px-4 py-3 text-gray-400 text-center">{r.pedidos_1 || 0}</td>
                    <td className="px-4 py-3 text-gray-500">{brl(r.semana_2)}</td><td className="px-4 py-3 text-gray-400 text-center">{r.pedidos_2 || 0}</td>
                    <td className="px-4 py-3 text-gray-500">{brl(r.semana_3)}</td><td className="px-4 py-3 text-gray-400 text-center">{r.pedidos_3 || 0}</td>
                    <td className="px-4 py-3 text-gray-500">{brl(r.semana_4)}</td><td className="px-4 py-3 text-gray-400 text-center">{r.pedidos_4 || 0}</td>
                    <td className="px-4 py-3 text-gray-500">{brl(r.semana_5)}</td><td className="px-4 py-3 text-gray-400 text-center">{r.pedidos_5 || 0}</td>
                    <td className="px-4 py-3 text-center"><Badge color={r.pedidos_cancelados > 0 ? 'red' : 'gray'}>{r.pedidos_cancelados || 0}</Badge></td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{brl(totalMes(r))}</td>
                    <td className="px-4 py-3 text-gray-700 text-center">{totalPedidos(r)}</td>
                    <td className="px-4 py-3 text-gray-500">{brl(r.projecao)}</td>
                    <td className="px-4 py-3">{r.status ? <Badge color={statusColor(r.status)}>{r.status}</Badge> : '—'}</td>
                    <td className="px-4 py-3">
                      <RowActions>
                        <IconAction onClick={() => editar(r)} title="Editar" color="blue"><IconEdit className="w-4 h-4" /></IconAction>
                        {isAdmin && <IconAction onClick={() => excluir(r.id)} title="Excluir" color="red"><IconTrash className="w-4 h-4" /></IconAction>}
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={showModal} onClose={fechar} title={editId ? 'Editar resultado' : 'Novo resultado'} size="xl">
        <form onSubmit={salvar} className="space-y-6">
          {/* Atribuição */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Atribuição</p>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Colaborador">
                {isAdmin ? (
                  colaboradoresEquipe.length > 0 ? (
                    <Select value={form.colaborador_email} onChange={e => escolherColaborador(e.target.value)}>
                      <option value="">Selecione…</option>
                      {colaboradoresEquipe.map(u => <option key={u.id} value={u.email}>{u.name} — {ROLE_LABELS[u.role]}</option>)}
                    </Select>
                  ) : (
                    <Input value="" disabled placeholder="Cadastre usuários em Configurações → Cargos" />
                  )
                ) : (
                  <Input value={name} disabled />
                )}
              </Field>
              <Field label="Cliente">
                <Select value={form.cliente_id} onChange={e => escolherCliente(e.target.value)}>
                  <option value="">Selecione…</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.loja ? ` — ${c.loja}` : ''}</option>)}
                </Select>
              </Field>
              <Field label="Mês de referência">
                <Input type="month" value={form.mes} onChange={e => set('mes', e.target.value)} />
              </Field>
            </div>
          </section>

          {/* Metas */}
          <section className="pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Metas</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Faturamento do mês anterior"><Input inputMode="decimal" value={form.faturamento_anterior} onChange={e => set('faturamento_anterior', e.target.value)} placeholder="0,00" /></Field>
              <Field label="Meta do mês"><Input inputMode="decimal" value={form.meta_mes} onChange={e => set('meta_mes', e.target.value)} placeholder="0,00" /></Field>
            </div>
          </section>

          {/* Semanas */}
          <section className="pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Faturamento e pedidos por semana</p>
            <div className="space-y-3">
              {([1, 2, 3, 4, 5] as const).map(n => (
                <div key={n} className="grid grid-cols-[auto_1fr_1fr] items-end gap-3">
                  <span className="text-sm font-medium text-gray-500 pb-2.5 w-16">Semana {n}</span>
                  <Field label="Faturamento">
                    <Input inputMode="decimal" value={form[`semana_${n}` as const]} onChange={e => set(`semana_${n}` as keyof typeof FORM_INICIAL, e.target.value)} placeholder="0,00" />
                  </Field>
                  <Field label={n === 1 ? 'Pedidos (todos)' : 'Pedidos'}>
                    <Input inputMode="numeric" value={form[`pedidos_${n}` as const]} onChange={e => set(`pedidos_${n}` as keyof typeof FORM_INICIAL, e.target.value)} placeholder="0" />
                  </Field>
                </div>
              ))}
            </div>
          </section>

          {/* Fechamento */}
          <section className="pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Cancelados, projeção e status</p>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Pedidos cancelados"><Input inputMode="numeric" value={form.pedidos_cancelados} onChange={e => set('pedidos_cancelados', e.target.value)} placeholder="0" /></Field>
              <Field label="Projeção"><Input inputMode="decimal" value={form.projecao} onChange={e => set('projecao', e.target.value)} placeholder="0,00" /></Field>
              <Field label="Status">
                <Select value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPCOES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-6 text-sm bg-gray-50 rounded-lg px-4 py-3">
              <span className="text-gray-500">Total do mês: <span className="font-semibold text-gray-900">{brl(previewMes)}</span></span>
              <span className="text-gray-500">Total de pedidos: <span className="font-semibold text-gray-900">{previewPedidos}</span></span>
            </div>
          </section>

          {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={fechar} disabled={salvando}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={salvando}>{salvando ? 'Salvando...' : editId ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
