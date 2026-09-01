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
  EmptyState, Th, AddButton, Button, RowActions, IconAction, CurrencyInput,
} from '@/components/ui'
import { IconChart, IconEdit, IconTrash, IconSearch } from '@/components/icons'

const STATUS_OPCOES = ['Linear', 'Crescente', 'Decrescente', 'Atenção']
const statusColor = (s: string): 'green' | 'red' | 'amber' | 'gray' | 'blue' =>
  s === 'Crescente' ? 'green' : s === 'Decrescente' ? 'red' : s === 'Atenção' ? 'amber' : s === 'Linear' ? 'blue' : 'gray'

// Converte texto (aceita separador de milhar . ou ,) em inteiro; vazio/inválido => 0.
const int = (s: string) => { const n = parseInt(String(s).replace(/[.,]/g, ''), 10); return isNaN(n) ? 0 : n }

const MESES = [
  { n: 1, label: 'Janeiro' }, { n: 2, label: 'Fevereiro' }, { n: 3, label: 'Março' }, { n: 4, label: 'Abril' },
  { n: 5, label: 'Maio' }, { n: 6, label: 'Junho' }, { n: 7, label: 'Julho' }, { n: 8, label: 'Agosto' },
  { n: 9, label: 'Setembro' }, { n: 10, label: 'Outubro' }, { n: 11, label: 'Novembro' }, { n: 12, label: 'Dezembro' },
] as const

export const totalAno = (r: Resultado) =>
  r.fat_1 + r.fat_2 + r.fat_3 + r.fat_4 + r.fat_5 + r.fat_6 + r.fat_7 + r.fat_8 + r.fat_9 + r.fat_10 + r.fat_11 + r.fat_12
export const totalPedidos = (r: Resultado) =>
  r.pedidos_1 + r.pedidos_2 + r.pedidos_3 + r.pedidos_4 + r.pedidos_5 + r.pedidos_6
  + r.pedidos_7 + r.pedidos_8 + r.pedidos_9 + r.pedidos_10 + r.pedidos_11 + r.pedidos_12
export const totalCancelados = (r: Resultado) =>
  r.cancelados_1 + r.cancelados_2 + r.cancelados_3 + r.cancelados_4 + r.cancelados_5 + r.cancelados_6
  + r.cancelados_7 + r.cancelados_8 + r.cancelados_9 + r.cancelados_10 + r.cancelados_11 + r.cancelados_12
export const totalMeta = (r: Resultado) =>
  r.meta_1 + r.meta_2 + r.meta_3 + r.meta_4 + r.meta_5 + r.meta_6 + r.meta_7 + r.meta_8 + r.meta_9 + r.meta_10 + r.meta_11 + r.meta_12
// Pedidos válidos = pedidos - cancelados.
export const totalValidos = (r: Resultado) => totalPedidos(r) - totalCancelados(r)
// Projeção (%) automática = meta do ano / faturamento total do ano * 100.
export const calcProjecao = (meta: number, totalFat: number) => totalFat > 0 ? Math.round((meta / totalFat) * 100) : 0
export const projecaoDe = (r: Resultado) => calcProjecao(totalMeta(r), totalAno(r))
// Faturamento de um mês específico (1..12) dentro do registro anual.
export const fatDoMes = (r: Resultado, n: number) => (r as unknown as Record<string, number>)[`fat_${n}`] || 0
export const pedidosDoMes = (r: Resultado, n: number) => (r as unknown as Record<string, number>)[`pedidos_${n}`] || 0
export const canceladosDoMes = (r: Resultado, n: number) => (r as unknown as Record<string, number>)[`cancelados_${n}`] || 0
export const metaDoMes = (r: Resultado, n: number) => (r as unknown as Record<string, number>)[`meta_${n}`] || 0

const anoAtual = () => String(new Date().getFullYear())

const FORM_INICIAL = {
  colaborador_email: '', colaborador_nome: '', cliente_id: '', cliente_nome: '', ano: '',
  fat_1: 0, fat_2: 0, fat_3: 0, fat_4: 0, fat_5: 0, fat_6: 0, fat_7: 0, fat_8: 0, fat_9: 0, fat_10: 0, fat_11: 0, fat_12: 0,
  meta_1: 0, meta_2: 0, meta_3: 0, meta_4: 0, meta_5: 0, meta_6: 0, meta_7: 0, meta_8: 0, meta_9: 0, meta_10: 0, meta_11: 0, meta_12: 0,
  fat_anterior_1: 0, fat_anterior_2: 0, fat_anterior_3: 0, fat_anterior_4: 0, fat_anterior_5: 0, fat_anterior_6: 0,
  fat_anterior_7: 0, fat_anterior_8: 0, fat_anterior_9: 0, fat_anterior_10: 0, fat_anterior_11: 0, fat_anterior_12: 0,
  pedidos_1: '', pedidos_2: '', pedidos_3: '', pedidos_4: '', pedidos_5: '', pedidos_6: '',
  pedidos_7: '', pedidos_8: '', pedidos_9: '', pedidos_10: '', pedidos_11: '', pedidos_12: '',
  cancelados_1: '', cancelados_2: '', cancelados_3: '', cancelados_4: '', cancelados_5: '', cancelados_6: '',
  cancelados_7: '', cancelados_8: '', cancelados_9: '', cancelados_10: '', cancelados_11: '', cancelados_12: '',
  status: 'Linear',
}

// Campos de texto simples do formulário (os monetários usam CurrencyInput, que já expõe number).
type CampoTexto = 'colaborador_email' | 'colaborador_nome' | 'cliente_id' | 'cliente_nome' | 'ano' | 'status'
  | 'pedidos_1' | 'pedidos_2' | 'pedidos_3' | 'pedidos_4' | 'pedidos_5' | 'pedidos_6'
  | 'pedidos_7' | 'pedidos_8' | 'pedidos_9' | 'pedidos_10' | 'pedidos_11' | 'pedidos_12'
  | 'cancelados_1' | 'cancelados_2' | 'cancelados_3' | 'cancelados_4' | 'cancelados_5' | 'cancelados_6'
  | 'cancelados_7' | 'cancelados_8' | 'cancelados_9' | 'cancelados_10' | 'cancelados_11' | 'cancelados_12'
type CampoMoeda = 'fat_1' | 'fat_2' | 'fat_3' | 'fat_4' | 'fat_5' | 'fat_6' | 'fat_7' | 'fat_8' | 'fat_9' | 'fat_10' | 'fat_11' | 'fat_12'
  | 'meta_1' | 'meta_2' | 'meta_3' | 'meta_4' | 'meta_5' | 'meta_6' | 'meta_7' | 'meta_8' | 'meta_9' | 'meta_10' | 'meta_11' | 'meta_12'
  | 'fat_anterior_1' | 'fat_anterior_2' | 'fat_anterior_3' | 'fat_anterior_4' | 'fat_anterior_5' | 'fat_anterior_6'
  | 'fat_anterior_7' | 'fat_anterior_8' | 'fat_anterior_9' | 'fat_anterior_10' | 'fat_anterior_11' | 'fat_anterior_12'

export default function ResultadosClient() {
  const { role, name, email } = useAuth()
  const isAdmin = role === 'admin'
  // Colaborador (instrutor) também pode criar resultado, mas só para si mesmo.
  const podeCriar = isAdmin || role === 'instrutor'

  const [resultados, setResultados] = useState<Resultado[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [equipe, setEquipe] = useState<TeamUser[]>([])
  const [busca, setBusca] = useState('')
  const [filtroAno, setFiltroAno] = useState('todos')
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

  // Cliente arquivado sai da lista de atribuição a partir de agora — não dá
  // pra criar/editar um resultado apontando pra ele.
  const clientesAtribuiveis = useMemo(() => {
    const ativos = clientes.filter(c => !c.arquivado)
    if (form.cliente_id && !ativos.some(c => c.id === form.cliente_id)) {
      const atual = clientes.find(c => c.id === form.cliente_id)
      if (atual) return [...ativos, atual]
    }
    return ativos
  }, [clientes, form.cliente_id])

  // IDs de clientes arquivados — usado só pra tirar os resultados deles da
  // lista/KPIs enquanto arquivado. Os dados continuam intactos no banco e
  // reaparecem sozinhos assim que o cliente for restaurado.
  const clientesArquivadosIds = useMemo(() => new Set(clientes.filter(c => c.arquivado).map(c => c.id)), [clientes])

  // Sempre oferece uma janela de anos passados/futuros pra filtrar, mesmo sem
  // nenhum resultado lançado ainda — mescla com qualquer ano fora dessa janela
  // que já tenha dado (histórico mais antigo).
  const anos = useMemo(() => {
    const atual = new Date().getFullYear()
    const gerados: string[] = []
    for (let ano = atual - 3; ano <= atual + 1; ano++) gerados.push(String(ano))
    const existentes = resultados.map(r => r.ano).filter(Boolean)
    return [...new Set([...gerados, ...existentes])].sort().reverse()
  }, [resultados])
  const colaboradores = useMemo(
    () => [...new Map(resultados.filter(r => r.colaborador_email).map(r => [r.colaborador_email, r.colaborador_nome || r.colaborador_email])).entries()],
    [resultados],
  )

  const filtrados = useMemo(() => resultados.filter(r => {
    if (r.cliente_id && clientesArquivadosIds.has(r.cliente_id)) return false
    if (filtroAno !== 'todos' && r.ano !== filtroAno) return false
    if (filtroColab !== 'todos' && r.colaborador_email !== filtroColab) return false
    if (busca) {
      const t = busca.toLowerCase()
      if (![r.cliente_nome, r.colaborador_nome].some(v => (v || '').toLowerCase().includes(t))) return false
    }
    return true
  }), [resultados, clientesArquivadosIds, filtroAno, filtroColab, busca])

  const somaFat = filtrados.reduce((s, r) => s + totalAno(r), 0)
  const somaPedidos = filtrados.reduce((s, r) => s + totalPedidos(r), 0)
  const somaCancelados = filtrados.reduce((s, r) => s + totalCancelados(r), 0)
  const somaValidos = filtrados.reduce((s, r) => s + totalValidos(r), 0)

  const set = (campo: CampoTexto, valor: string) => setForm(p => ({ ...p, [campo]: valor }))
  const setMoeda = (campo: CampoMoeda, valor: number) => setForm(p => ({ ...p, [campo]: valor }))

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
    setForm({ ...FORM_INICIAL, ano: anoAtual() })
    setShowModal(true)
  }
  function editar(r: Resultado) {
    setEditId(r.id); setErro(null)
    setForm({
      colaborador_email: r.colaborador_email, colaborador_nome: r.colaborador_nome,
      cliente_id: r.cliente_id || '', cliente_nome: r.cliente_nome, ano: r.ano,
      fat_1: r.fat_1 || 0, fat_2: r.fat_2 || 0, fat_3: r.fat_3 || 0, fat_4: r.fat_4 || 0, fat_5: r.fat_5 || 0, fat_6: r.fat_6 || 0,
      fat_7: r.fat_7 || 0, fat_8: r.fat_8 || 0, fat_9: r.fat_9 || 0, fat_10: r.fat_10 || 0, fat_11: r.fat_11 || 0, fat_12: r.fat_12 || 0,
      meta_1: r.meta_1 || 0, meta_2: r.meta_2 || 0, meta_3: r.meta_3 || 0, meta_4: r.meta_4 || 0, meta_5: r.meta_5 || 0, meta_6: r.meta_6 || 0,
      meta_7: r.meta_7 || 0, meta_8: r.meta_8 || 0, meta_9: r.meta_9 || 0, meta_10: r.meta_10 || 0, meta_11: r.meta_11 || 0, meta_12: r.meta_12 || 0,
      fat_anterior_1: r.fat_anterior_1 || 0, fat_anterior_2: r.fat_anterior_2 || 0, fat_anterior_3: r.fat_anterior_3 || 0,
      fat_anterior_4: r.fat_anterior_4 || 0, fat_anterior_5: r.fat_anterior_5 || 0, fat_anterior_6: r.fat_anterior_6 || 0,
      fat_anterior_7: r.fat_anterior_7 || 0, fat_anterior_8: r.fat_anterior_8 || 0, fat_anterior_9: r.fat_anterior_9 || 0,
      fat_anterior_10: r.fat_anterior_10 || 0, fat_anterior_11: r.fat_anterior_11 || 0, fat_anterior_12: r.fat_anterior_12 || 0,
      pedidos_1: String(r.pedidos_1 || ''), pedidos_2: String(r.pedidos_2 || ''), pedidos_3: String(r.pedidos_3 || ''),
      pedidos_4: String(r.pedidos_4 || ''), pedidos_5: String(r.pedidos_5 || ''), pedidos_6: String(r.pedidos_6 || ''),
      pedidos_7: String(r.pedidos_7 || ''), pedidos_8: String(r.pedidos_8 || ''), pedidos_9: String(r.pedidos_9 || ''),
      pedidos_10: String(r.pedidos_10 || ''), pedidos_11: String(r.pedidos_11 || ''), pedidos_12: String(r.pedidos_12 || ''),
      cancelados_1: String(r.cancelados_1 || ''), cancelados_2: String(r.cancelados_2 || ''), cancelados_3: String(r.cancelados_3 || ''),
      cancelados_4: String(r.cancelados_4 || ''), cancelados_5: String(r.cancelados_5 || ''), cancelados_6: String(r.cancelados_6 || ''),
      cancelados_7: String(r.cancelados_7 || ''), cancelados_8: String(r.cancelados_8 || ''), cancelados_9: String(r.cancelados_9 || ''),
      cancelados_10: String(r.cancelados_10 || ''), cancelados_11: String(r.cancelados_11 || ''), cancelados_12: String(r.cancelados_12 || ''),
      status: r.status || 'Linear',
    })
    setShowModal(true)
  }
  function fechar() { setShowModal(false); setEditId(null); setForm(FORM_INICIAL); setErro(null) }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    // Admin escolhe o colaborador; colaborador só cria pra si mesmo (a RLS
    // também trava isso do lado do banco).
    const colabNome = isAdmin ? form.colaborador_nome : name
    const colabEmail = (isAdmin ? form.colaborador_email : email).trim().toLowerCase()
    if (isAdmin && !colabEmail) { setErro('Selecione o colaborador responsável.'); return }
    const totalFat = form.fat_1 + form.fat_2 + form.fat_3 + form.fat_4 + form.fat_5 + form.fat_6
      + form.fat_7 + form.fat_8 + form.fat_9 + form.fat_10 + form.fat_11 + form.fat_12
    const totalMetaForm = form.meta_1 + form.meta_2 + form.meta_3 + form.meta_4 + form.meta_5 + form.meta_6
      + form.meta_7 + form.meta_8 + form.meta_9 + form.meta_10 + form.meta_11 + form.meta_12
    const payload = {
      colaborador_nome: colabNome, colaborador_email: colabEmail,
      cliente_id: form.cliente_id || null, cliente_nome: form.cliente_nome,
      ano: form.ano,
      fat_1: form.fat_1, fat_2: form.fat_2, fat_3: form.fat_3, fat_4: form.fat_4, fat_5: form.fat_5, fat_6: form.fat_6,
      fat_7: form.fat_7, fat_8: form.fat_8, fat_9: form.fat_9, fat_10: form.fat_10, fat_11: form.fat_11, fat_12: form.fat_12,
      meta_1: form.meta_1, meta_2: form.meta_2, meta_3: form.meta_3, meta_4: form.meta_4, meta_5: form.meta_5, meta_6: form.meta_6,
      meta_7: form.meta_7, meta_8: form.meta_8, meta_9: form.meta_9, meta_10: form.meta_10, meta_11: form.meta_11, meta_12: form.meta_12,
      fat_anterior_1: form.fat_anterior_1, fat_anterior_2: form.fat_anterior_2, fat_anterior_3: form.fat_anterior_3,
      fat_anterior_4: form.fat_anterior_4, fat_anterior_5: form.fat_anterior_5, fat_anterior_6: form.fat_anterior_6,
      fat_anterior_7: form.fat_anterior_7, fat_anterior_8: form.fat_anterior_8, fat_anterior_9: form.fat_anterior_9,
      fat_anterior_10: form.fat_anterior_10, fat_anterior_11: form.fat_anterior_11, fat_anterior_12: form.fat_anterior_12,
      pedidos_1: int(form.pedidos_1), pedidos_2: int(form.pedidos_2), pedidos_3: int(form.pedidos_3),
      pedidos_4: int(form.pedidos_4), pedidos_5: int(form.pedidos_5), pedidos_6: int(form.pedidos_6),
      pedidos_7: int(form.pedidos_7), pedidos_8: int(form.pedidos_8), pedidos_9: int(form.pedidos_9),
      pedidos_10: int(form.pedidos_10), pedidos_11: int(form.pedidos_11), pedidos_12: int(form.pedidos_12),
      cancelados_1: int(form.cancelados_1), cancelados_2: int(form.cancelados_2), cancelados_3: int(form.cancelados_3),
      cancelados_4: int(form.cancelados_4), cancelados_5: int(form.cancelados_5), cancelados_6: int(form.cancelados_6),
      cancelados_7: int(form.cancelados_7), cancelados_8: int(form.cancelados_8), cancelados_9: int(form.cancelados_9),
      cancelados_10: int(form.cancelados_10), cancelados_11: int(form.cancelados_11), cancelados_12: int(form.cancelados_12),
      // Projeção (%) automática = meta do ano / faturamento total do ano * 100.
      projecao: calcProjecao(totalMetaForm, totalFat),
      status: form.status,
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
  const previewAno = form.fat_1 + form.fat_2 + form.fat_3 + form.fat_4 + form.fat_5 + form.fat_6
    + form.fat_7 + form.fat_8 + form.fat_9 + form.fat_10 + form.fat_11 + form.fat_12
  const previewMeta = form.meta_1 + form.meta_2 + form.meta_3 + form.meta_4 + form.meta_5 + form.meta_6
    + form.meta_7 + form.meta_8 + form.meta_9 + form.meta_10 + form.meta_11 + form.meta_12
  const previewPedidos = int(form.pedidos_1) + int(form.pedidos_2) + int(form.pedidos_3) + int(form.pedidos_4) + int(form.pedidos_5) + int(form.pedidos_6)
    + int(form.pedidos_7) + int(form.pedidos_8) + int(form.pedidos_9) + int(form.pedidos_10) + int(form.pedidos_11) + int(form.pedidos_12)
  const previewCancelados = int(form.cancelados_1) + int(form.cancelados_2) + int(form.cancelados_3) + int(form.cancelados_4) + int(form.cancelados_5) + int(form.cancelados_6)
    + int(form.cancelados_7) + int(form.cancelados_8) + int(form.cancelados_9) + int(form.cancelados_10) + int(form.cancelados_11) + int(form.cancelados_12)
  const previewValidos = previewPedidos - previewCancelados
  const previewProjecao = calcProjecao(previewMeta, previewAno)

  return (
    <div>
      <PageHeader
        title="Resultados"
        subtitle={isAdmin ? 'Faturamento anual por cliente de cada colaborador' : 'Os resultados dos seus clientes'}
        action={podeCriar ? <AddButton onClick={novo}>Novo resultado</AddButton> : undefined}
      />

      {erroCarregar && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
          Não foi possível carregar: {erroCarregar}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Metric label="Faturamento (ano)" value={brl(somaFat)} icon={<IconChart className="w-6 h-6" />} />
        <Metric label="Pedidos" value={somaPedidos.toString()} accent="text-blue-600" />
        <Metric label="Cancelados" value={somaCancelados.toString()} accent="text-red-600" />
        <Metric label="Pedidos válidos" value={somaValidos.toString()} accent="text-green-600" />
        <Metric label="Linhas" value={filtrados.length.toString()} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente ou colaborador…" className="pl-9" />
        </div>
        <Select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className="!w-auto">
          <option value="todos">Todos os anos</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
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
            ? 'Crie um resultado atribuindo um cliente a um colaborador e preencha o faturamento mês a mês.'
            : podeCriar
              ? 'Crie um resultado para um dos seus clientes e preencha o faturamento mês a mês.'
              : 'Seu administrador ainda não atribuiu clientes a você.'}
          action={podeCriar && resultados.length === 0 ? <AddButton onClick={novo}>Novo resultado</AddButton> : undefined}
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <Th>Ano</Th>
                  {isAdmin && <Th>Colaborador</Th>}
                  <Th>Cliente</Th>
                  <Th>Meta (ano)</Th>
                  <Th>Faturamento (ano)</Th>
                  <Th>Pedidos</Th><Th>Cancelados</Th><Th>Pedidos válidos</Th><Th>Projeção</Th><Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r, i, arr) => (
                  <tr
                    key={r.id}
                    onDoubleClick={() => editar(r)}
                    title="Duplo clique para editar (detalhe mês a mês)"
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40 ${i < arr.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-gray-500">{r.ano || '—'}</td>
                    {isAdmin && <td className="px-4 py-3 text-gray-700">{r.colaborador_nome || r.colaborador_email || '—'}</td>}
                    <td className="px-4 py-3 font-medium text-gray-900">{r.cliente_nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{brl(totalMeta(r))}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{brl(totalAno(r))}</td>
                    <td className="px-4 py-3 text-gray-700 text-center">{totalPedidos(r)}</td>
                    <td className="px-4 py-3 text-center"><Badge color={totalCancelados(r) > 0 ? 'red' : 'gray'}>{totalCancelados(r)}</Badge></td>
                    <td className="px-4 py-3 text-center font-semibold text-green-600">{totalValidos(r)}</td>
                    <td className="px-4 py-3 text-gray-500 text-center">{projecaoDe(r)}%</td>
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
                  {clientesAtribuiveis.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}{c.loja ? ` — ${c.loja}` : ''}{c.arquivado ? ' (arquivado)' : ''}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Ano de referência">
                <Input type="number" inputMode="numeric" min="2000" max="2100" step="1" value={form.ano} onChange={e => set('ano', e.target.value)} placeholder="2026" />
              </Field>
            </div>
          </section>

          {/* Meses */}
          <section className="pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Faturamento, meta, pedidos e cancelados por mês</p>
            <div className="space-y-3">
              {MESES.map(({ n, label }) => (
                <div key={n} className="grid grid-cols-[80px_1fr_1fr_1fr_1fr_1fr] items-end gap-3">
                  <span className="text-sm font-medium text-gray-500 pb-2.5">{label}</span>
                  <Field label="Fat. mês anterior">
                    <CurrencyInput value={form[`fat_anterior_${n}` as CampoMoeda]} onValueChange={v => setMoeda(`fat_anterior_${n}` as CampoMoeda, v)} placeholder="0,00" />
                  </Field>
                  <Field label="Meta">
                    <CurrencyInput value={form[`meta_${n}` as CampoMoeda]} onValueChange={v => setMoeda(`meta_${n}` as CampoMoeda, v)} placeholder="0,00" />
                  </Field>
                  <Field label="Faturamento">
                    <CurrencyInput value={form[`fat_${n}` as CampoMoeda]} onValueChange={v => setMoeda(`fat_${n}` as CampoMoeda, v)} placeholder="0,00" />
                  </Field>
                  <Field label="Pedidos">
                    <Input inputMode="numeric" value={form[`pedidos_${n}` as const]} onChange={e => set(`pedidos_${n}` as CampoTexto, e.target.value)} placeholder="0" />
                  </Field>
                  <Field label="Cancelados">
                    <Input inputMode="numeric" value={form[`cancelados_${n}` as const]} onChange={e => set(`cancelados_${n}` as CampoTexto, e.target.value)} placeholder="0" />
                  </Field>
                </div>
              ))}
            </div>
          </section>

          {/* Fechamento */}
          <section className="pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Pedidos válidos, projeção e status</p>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Pedidos válidos">
                <Input value={String(previewValidos)} disabled title="Pedidos válidos = pedidos − cancelados" />
              </Field>
              <Field label="Projeção (%)">
                <Input value={`${previewProjecao}%`} disabled title="Projeção = meta do ano ÷ faturamento total do ano × 100" />
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPCOES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-6 text-sm bg-gray-50 rounded-lg px-4 py-3">
              <span className="text-gray-500">Total do ano: <span className="font-semibold text-gray-900">{brl(previewAno)}</span></span>
              <span className="text-gray-500">Meta do ano: <span className="font-semibold text-gray-900">{brl(previewMeta)}</span></span>
              <span className="text-gray-500">Total de pedidos: <span className="font-semibold text-gray-900">{previewPedidos}</span></span>
              <span className="text-gray-500">Cancelados: <span className="font-semibold text-red-600">{previewCancelados}</span></span>
              <span className="text-gray-500">Pedidos válidos: <span className="font-semibold text-green-600">{previewValidos}</span></span>
              <span className="text-gray-500">Projeção: <span className="font-semibold text-gray-900">{previewProjecao}%</span></span>
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
