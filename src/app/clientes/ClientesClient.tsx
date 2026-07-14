'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAll, insert, update, remove } from '@/lib/store'
import { aplicarPadroesAoCliente, removerPadroesDoCliente, atualizarResponsavelDoCliente } from '@/lib/tarefas'
import { criarResultadoInicialDoCliente } from '@/lib/resultados'
import { format, parseISO, isValid } from 'date-fns'
import type { Cliente, Membro } from '@/lib/types'
import {
  Card, Metric, Modal, Field, Input, Select, Badge,
  EmptyState, Th, AddButton, Button, RowActions, IconAction, Tabs,
} from '@/components/ui'
import {
  IconUserCircle, IconEdit, IconTrash, IconSearch,
  IconEye, IconEyeOff, IconLock, IconCopy, IconCheck,
  IconArchive, IconArchiveRestore,
} from '@/components/icons'

/* ─── Campo de acesso com copiar / revelar ─────────────────────────── */
function CampoAcesso({ label, value, onChange, senha = false }: {
  label: string; value: string; onChange: (v: string) => void; senha?: boolean
}) {
  const [revelado, setRevelado] = useState(false)
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    if (!value) return
    try { await navigator.clipboard.writeText(value); setCopiado(true); setTimeout(() => setCopiado(false), 1200) } catch { /* ignore */ }
  }

  return (
    <Field label={label}>
      <div className="relative">
        <Input
          type={senha && !revelado ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={senha ? 'new-password' : 'off'}
          className={senha ? 'pr-16' : 'pr-10'}
          placeholder={senha ? '••••••••' : undefined}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {senha && (
            <button type="button" onClick={() => setRevelado(r => !r)}
              title={revelado ? 'Ocultar senha' : 'Revelar senha'}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {revelado ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
            </button>
          )}
          <button type="button" onClick={copiar} disabled={!value} title="Copiar"
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-40">
            {copiado ? <IconCheck className="w-4 h-4 text-green-500" /> : <IconCopy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </Field>
  )
}

/* ─── Constantes ────────────────────────────────────────────────────── */
const FASES       = ['Fase 1 - Implementação', 'Fase 2 - Primeiras Vendas', 'Fase 3 - Crescimento', 'Fase 4 - Pré Escala', 'Fase 5 - Escala']
const FATURAMENTOS = ['0 a 20k', '21 a 50k', '51 a 100k', '100k+']
const EVOLUCOES   = ['Crescente', 'Estável', 'Decrescente']
const PLATAFORMAS = ['Shopee', 'Mercado Livre', 'Amazon', 'Site próprio']
const COBRANCAS   = ['Mensalidade', 'Pedido']

type BadgeColor = 'blue' | 'green' | 'gray' | 'red' | 'amber'
const faseColor  = (f: string): BadgeColor => f.startsWith('Fase 5') ? 'green' : f.startsWith('Fase 4') || f.startsWith('Fase 3') ? 'blue' : f ? 'amber' : 'gray'
const fatColor   = (v: string): BadgeColor => v.includes('100k') ? 'green' : v.includes('21') || v.includes('51') ? 'blue' : v ? 'amber' : 'gray'
const evoColor   = (v: string): BadgeColor => v === 'Crescente' ? 'green' : v === 'Decrescente' ? 'red' : 'gray'
const fmtData    = (d?: string | null) => d && isValid(parseISO(d)) ? format(parseISO(d), 'dd/MM/yyyy') : '—'

// Mensagem amigável a partir de um erro do Supabase/PostgREST.
function mensagemErro(err: unknown): string {
  const e = err as { message?: string; code?: string; hint?: string }
  if (e?.code === '42501' || /row-level security|violates row-level/i.test(e?.message ?? '')) {
    return 'Você não tem permissão para esta ação.'
  }
  if (/column .*arquivado.* does not exist|could not find.*arquivado/i.test(e?.message ?? '')) {
    return 'A coluna "arquivado" não existe no banco. Aplique a migration 027 do Supabase.'
  }
  return e?.message || 'Erro desconhecido. Tente novamente.'
}

/* ─── Título de seção no formulário ────────────────────────────────── */
function SecaoTitulo({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
      {children}
    </p>
  )
}

/* ─── Iniciais do cliente ───────────────────────────────────────────── */
const AVATAR_COLORS = [
  'bg-blue-900/40 dark:bg-blue-900/60 text-blue-400',
  'bg-purple-900/40 dark:bg-purple-900/60 text-purple-400',
  'bg-amber-900/40 dark:bg-amber-900/60 text-amber-400',
  'bg-green-900/40 dark:bg-green-900/60 text-green-400',
  'bg-red-900/40 dark:bg-red-900/60 text-red-400',
]
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

/* ─── Form inicial ──────────────────────────────────────────────────── */
const FORM_INICIAL = {
  nome: '', loja: '', telefone: '', data_entrada: '', responsavel: '',
  ja_vende: false, ultimo_acompanhamento: '', proximo_acompanhamento: '',
  evolucao_vendas: '', fase_conta: '', faturamento_mensal: '', plataforma: 'Shopee',
  numero_contas: '1', tipo_cobranca: '', login_upseller: '', senha_upseller: '',
  login_seller_finance: '', senha_seller_finance: '',
}

/* ─── Componente principal ──────────────────────────────────────────── */
export default function ClientesClient() {
  const [clientes,    setClientes]    = useState<Cliente[]>([])
  const [membros,     setMembros]     = useState<Membro[]>([])
  const [busca,       setBusca]       = useState('')
  const [filtroVende, setFiltroVende] = useState<'todos' | 'sim' | 'nao'>('todos')
  const [aba,         setAba]         = useState<'ativos' | 'arquivados'>('ativos')
  const [showModal,   setShowModal]   = useState(false)
  const [editCliente, setEditCliente] = useState<Cliente | null>(null)
  const [form,        setForm]        = useState(FORM_INICIAL)

  useEffect(() => { load() }, [])

  async function load() {
    const [cs, ms] = await Promise.all([
      getAll<Cliente>('clientes', { order: { column: 'criado_em', ascending: true } }),
      getAll<Membro>('membros', { order: { column: 'nome', ascending: true } }).catch(() => [] as Membro[]),
    ])
    setClientes(cs); setMembros(ms)
  }

  const numeroPorId = useMemo(() => {
    const m = new Map<string, string>()
    clientes.forEach((c, i) => {
      const match = (c.loja || '').match(/^\s*(\d+)/)
      m.set(c.id, match ? match[1].padStart(2, '0') : String(i + 1).padStart(2, '0'))
    })
    return m
  }, [clientes])

  // A base "ativa" (não arquivada) alimenta os KPIs, independente da aba
  // selecionada — arquivar um cliente tira ele da carteira em acompanhamento.
  const ativosBase    = useMemo(() => clientes.filter(c => !c.arquivado), [clientes])
  const arquivadosBase = useMemo(() => clientes.filter(c => c.arquivado), [clientes])

  const filtrados = useMemo(() => (aba === 'arquivados' ? arquivadosBase : ativosBase).filter(c => {
    if (filtroVende === 'sim' && !c.ja_vende) return false
    if (filtroVende === 'nao' && c.ja_vende)  return false
    if (!busca) return true
    const t = busca.toLowerCase()
    return [c.nome, c.loja, c.telefone, c.responsavel, c.plataforma, c.fase_conta]
      .some(v => (v || '').toLowerCase().includes(t))
  }).sort((a, b) => Number(numeroPorId.get(a.id)) - Number(numeroPorId.get(b.id))),
  [aba, ativosBase, arquivadosBase, busca, filtroVende, numeroPorId])

  const total    = ativosBase.length
  const vendendo = ativosBase.filter(c => c.ja_vende).length
  const contas   = ativosBase.reduce((s, c) => s + (c.numero_contas || 0), 0)
  const emEscala = ativosBase.filter(c => c.fase_conta.startsWith('Fase 5')).length

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      nome: form.nome, loja: form.loja, telefone: form.telefone,
      data_entrada: form.data_entrada || null, responsavel: form.responsavel,
      ja_vende: form.ja_vende,
      ultimo_acompanhamento:  form.ultimo_acompanhamento  || null,
      proximo_acompanhamento: form.proximo_acompanhamento || null,
      evolucao_vendas: form.evolucao_vendas, fase_conta: form.fase_conta,
      faturamento_mensal: form.faturamento_mensal, plataforma: form.plataforma,
      numero_contas: parseInt(form.numero_contas) || 0, tipo_cobranca: form.tipo_cobranca,
      login_upseller: form.login_upseller, senha_upseller: form.senha_upseller,
      login_seller_finance: form.login_seller_finance, senha_seller_finance: form.senha_seller_finance,
    }
    if (editCliente) {
      await update<Cliente>('clientes', editCliente.id, payload)
      const atualizado = { ...editCliente, ...payload } as Cliente
      if (!editCliente.ja_vende && form.ja_vende) {
        // Passou a vender: recebe automaticamente as tarefas padrão (aparecem em
        // Tarefas) e um resultado inicial vazio no mês atual (aparece em Resultados).
        const qtd = await aplicarPadroesAoCliente(atualizado)
        const criouResultado = await criarResultadoInicialDoCliente(atualizado, membros)
        const partes: string[] = []
        if (qtd > 0) partes.push(`${qtd} tarefa(s) padrão atribuída(s)`)
        if (criouResultado) partes.push('1 resultado do mês criado')
        if (partes.length > 0) alert(`Cliente marcado como "já vende". ${partes.join(' e ')} — confira em Tarefas/Resultados.`)
      } else if (editCliente.ja_vende && !form.ja_vende) {
        // Deixou de vender: remove as cópias de tarefa padrão dele.
        const qtd = await removerPadroesDoCliente(editCliente.id)
        if (qtd > 0) alert(`Cliente marcado como "ainda não vende". ${qtd} tarefa(s) padrão removida(s).`)
      }
      // Trocou o responsável: propaga para as tarefas já existentes deste cliente.
      if (editCliente.responsavel !== form.responsavel && form.responsavel.trim()) {
        const n = await atualizarResponsavelDoCliente(atualizado, membros)
        if (n > 0) alert(`Responsável atualizado em ${n} tarefa(s) deste cliente.`)
      }
    } else {
      // Cliente novo: só recebe tarefas padrão/resultado inicial se já vende (senão nada é criado).
      const criado = await insert<Cliente>('clientes', payload as Cliente)
      const qtd = await aplicarPadroesAoCliente(criado)
      const criouResultado = await criarResultadoInicialDoCliente(criado, membros)
      const partes: string[] = []
      if (qtd > 0) partes.push(`${qtd} tarefa(s) padrão atribuída(s) a ele`)
      if (criouResultado) partes.push('1 resultado do mês criado')
      if (partes.length > 0) alert(`Cliente cadastrado. ${partes.join(' e ')}.`)
    }
    fecharModal(); await load()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir cliente definitivamente? Esta ação não pode ser desfeita.')) return
    try { await remove('clientes', id); await load() }
    catch (err) { alert('Erro ao excluir: ' + mensagemErro(err)) }
  }

  async function arquivar(id: string) {
    if (!confirm('Arquivar este cliente? Ele sai da lista de ativos (e some de Tarefas e do dropdown de Resultados), mas os dados são mantidos na aba "Arquivados".')) return
    try { await update<Cliente>('clientes', id, { arquivado: true }); await load() }
    catch (err) { alert('Erro ao arquivar: ' + mensagemErro(err)) }
  }
  async function desarquivar(id: string) {
    try { await update<Cliente>('clientes', id, { arquivado: false }); await load() }
    catch (err) { alert('Erro ao restaurar: ' + mensagemErro(err)) }
  }

  function fecharModal() { setShowModal(false); setEditCliente(null); setForm(FORM_INICIAL) }
  const novo = () => { setEditCliente(null); setForm(FORM_INICIAL); setShowModal(true) }

  function editar(c: Cliente) {
    setEditCliente(c)
    setForm({
      nome: c.nome, loja: c.loja, telefone: c.telefone,
      data_entrada: c.data_entrada || '', responsavel: c.responsavel,
      ja_vende: c.ja_vende,
      ultimo_acompanhamento:  c.ultimo_acompanhamento  || '',
      proximo_acompanhamento: c.proximo_acompanhamento || '',
      evolucao_vendas: c.evolucao_vendas, fase_conta: c.fase_conta,
      faturamento_mensal: c.faturamento_mensal, plataforma: c.plataforma,
      numero_contas: String(c.numero_contas ?? 1), tipo_cobranca: c.tipo_cobranca,
      login_upseller: c.login_upseller, senha_upseller: c.senha_upseller,
      login_seller_finance: c.login_seller_finance, senha_seller_finance: c.senha_seller_finance,
    })
    setShowModal(true)
  }

  const set = (campo: keyof typeof FORM_INICIAL, valor: string | boolean) =>
    setForm(p => ({ ...p, [campo]: valor }))

  /* ── Render ── */
  return (
    <div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-0.5">
            Gestão Pro
          </p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Base de Clientes</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Carteira de lojas · acompanhamento, fase e acessos
          </p>
        </div>
        <AddButton onClick={novo}>Novo Cliente</AddButton>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Metric
          label="Clientes"
          value={total.toString()}
          color="default"
          icon={<IconUserCircle className="w-5 h-5" />}
        />
        <Metric
          label="Já vendendo"
          value={vendendo.toString()}
          color="green"
          sub={total ? `${Math.round((vendendo / total) * 100)}% da base` : undefined}
        />
        <Metric
          label="Em Escala"
          value={emEscala.toString()}
          color="blue"
        />
        <Metric
          label="Contas ativas"
          value={contas.toString()}
          color="amber"
        />
      </div>

      {/* Abas: ativos x arquivados */}
      <Tabs
        active={aba}
        onChange={setAba}
        tabs={[
          { value: 'ativos', label: `Ativos (${ativosBase.length})` },
          { value: 'arquivados', label: `Arquivados (${arquivadosBase.length})` },
        ]}
        className="!mb-4"
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <IconSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, loja, responsável…"
            className="pl-9 text-xs"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {(['todos', 'sim', 'nao'] as const).map(v => (
            <button
              key={v}
              onClick={() => setFiltroVende(v)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
                filtroVende === v
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {v === 'todos' ? 'Todos' : v === 'sim' ? 'Já vende' : 'Não vende'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela / Empty */}
      {filtrados.length === 0 ? (
        <EmptyState
          icon={<IconUserCircle className="w-5 h-5" />}
          title={
            aba === 'arquivados'
              ? 'Nenhum cliente arquivado'
              : total === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente neste filtro'
          }
          description={
            aba === 'arquivados'
              ? 'Clientes arquivados aparecem aqui e podem ser restaurados a qualquer momento.'
              : total === 0 ? 'Cadastre as lojas atendidas com acompanhamento, fase e acessos.' : undefined
          }
          action={aba === 'ativos' && total === 0 ? <AddButton onClick={novo}>Novo Cliente</AddButton> : undefined}
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <Th>Nº</Th>
                  <Th>Cliente</Th>
                  <Th>Loja</Th>
                  <Th>Telefone</Th>
                  <Th>Responsável</Th>
                  <Th>Vende</Th>
                  <Th>Próx. acomp.</Th>
                  <Th>Evolução</Th>
                  <Th>Fase</Th>
                  <Th>Faturamento</Th>
                  <Th>Plataforma</Th>
                  <Th>Contas</Th>
                  <Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c, i, arr) => {
                  const color = AVATAR_COLORS[i % AVATAR_COLORS.length]
                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                        i < arr.length - 1 ? 'border-b border-gray-50 dark:border-gray-800/60' : ''
                      }`}
                    >
                      {/* Número */}
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
                        {numeroPorId.get(c.id)}
                      </td>

                      {/* Cliente com avatar */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${color}`}>
                            {getInitials(c.nome)}
                          </div>
                          <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{c.nome}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{c.loja || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{c.telefone || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{c.responsavel || '—'}</td>

                      <td className="px-4 py-3">
                        <Badge color={c.ja_vende ? 'green' : 'red'}>{c.ja_vende ? 'Sim' : 'Não'}</Badge>
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {fmtData(c.proximo_acompanhamento)}
                      </td>

                      <td className="px-4 py-3">
                        {c.evolucao_vendas
                          ? <Badge color={evoColor(c.evolucao_vendas)}>{c.evolucao_vendas}</Badge>
                          : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                      </td>

                      <td className="px-4 py-3">
                        {c.fase_conta
                          ? <Badge color={faseColor(c.fase_conta)}>{c.fase_conta}</Badge>
                          : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                      </td>

                      <td className="px-4 py-3">
                        {c.faturamento_mensal
                          ? <Badge color={fatColor(c.faturamento_mensal)}>{c.faturamento_mensal}</Badge>
                          : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                      </td>

                      <td className="px-4 py-3">
                        {c.plataforma
                          ? <Badge color="amber">{c.plataforma}</Badge>
                          : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
                      </td>

                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 text-center">
                        {c.numero_contas || 0}
                      </td>

                      <td className="px-4 py-3">
                        <RowActions>
                          <IconAction onClick={() => editar(c)} title="Editar" color="blue">
                            <IconEdit className="w-4 h-4" />
                          </IconAction>
                          {c.arquivado ? (
                            <IconAction onClick={() => desarquivar(c.id)} title="Restaurar para Ativos" color="blue">
                              <IconArchiveRestore className="w-4 h-4" />
                            </IconAction>
                          ) : (
                            <IconAction onClick={() => arquivar(c.id)} title="Arquivar" color="gray">
                              <IconArchive className="w-4 h-4" />
                            </IconAction>
                          )}
                          <IconAction onClick={() => excluir(c.id)} title="Excluir definitivamente" color="red">
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
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={fecharModal} title={editCliente ? 'Editar Cliente' : 'Novo Cliente'} size="xl">
        <form onSubmit={salvar} className="flex flex-col gap-6">

          {/* Dados do cliente */}
          <section>
            <SecaoTitulo>Dados do cliente</SecaoTitulo>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Nome do Cliente">
                  <Input required value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome de quem você atende" />
                </Field>
              </div>
              <Field label="Nr e Loja">
                <Input value={form.loja} onChange={e => set('loja', e.target.value)} placeholder="Ex: 01 - Modas LB" />
              </Field>
              <Field label="Telefone">
                <Input value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(00) 00000-0000" />
              </Field>
              <Field label="Responsável" hint={membros.length === 0 ? 'Cadastre a equipe em Tarefas → Equipe' : 'Colaborador da equipe que atende a conta'}>
                <Select value={form.responsavel} onChange={e => set('responsavel', e.target.value)}>
                  <option value="">— Selecione o colaborador —</option>
                  {membros.map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                  {/* Mantém um responsável antigo que já não esteja na equipe. */}
                  {form.responsavel && !membros.some(m => m.nome === form.responsavel) && (
                    <option value={form.responsavel}>{form.responsavel} (fora da equipe)</option>
                  )}
                </Select>
              </Field>
              <Field label="Data de Entrada">
                <Input type="date" value={form.data_entrada} onChange={e => set('data_entrada', e.target.value)} />
              </Field>
              <Field label="Já vende?" className="sm:col-span-2">
                <div className="flex gap-2">
                  <button type="button" onClick={() => set('ja_vende', true)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      form.ja_vende
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}>
                    Sim
                  </button>
                  <button type="button" onClick={() => set('ja_vende', false)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      !form.ja_vende
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}>
                    Não
                  </button>
                </div>
              </Field>
            </div>
          </section>

          {/* Acompanhamento & conta */}
          <section className="pt-5 border-t border-gray-100 dark:border-gray-800">
            <SecaoTitulo>Acompanhamento &amp; conta</SecaoTitulo>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Plataforma">
                <Select value={form.plataforma} onChange={e => set('plataforma', e.target.value)}>
                  {PLATAFORMAS.map(p => <option key={p} value={p}>{p}</option>)}
                </Select>
              </Field>
              <Field label="Fase da Conta">
                <Select value={form.fase_conta} onChange={e => set('fase_conta', e.target.value)}>
                  <option value="">—</option>
                  {FASES.map(f => <option key={f} value={f}>{f}</option>)}
                </Select>
              </Field>
              <Field label="Faturamento Mensal">
                <Select value={form.faturamento_mensal} onChange={e => set('faturamento_mensal', e.target.value)}>
                  <option value="">—</option>
                  {FATURAMENTOS.map(f => <option key={f} value={f}>{f}</option>)}
                </Select>
              </Field>
              <Field label="Evolução de Vendas">
                <Select value={form.evolucao_vendas} onChange={e => set('evolucao_vendas', e.target.value)}>
                  <option value="">—</option>
                  {EVOLUCOES.map(v => <option key={v} value={v}>{v}</option>)}
                </Select>
              </Field>
              <Field label="Último Acompanhamento">
                <Input type="date" value={form.ultimo_acompanhamento} onChange={e => set('ultimo_acompanhamento', e.target.value)} />
              </Field>
              <Field label="Próximo Acompanhamento">
                <Input type="date" value={form.proximo_acompanhamento} onChange={e => set('proximo_acompanhamento', e.target.value)} />
              </Field>
              <Field label="Número de Contas">
                <Input type="number" min="0" value={form.numero_contas} onChange={e => set('numero_contas', e.target.value)} />
              </Field>
              <Field label="Tipo de Cobrança">
                <Select value={form.tipo_cobranca} onChange={e => set('tipo_cobranca', e.target.value)}>
                  <option value="">—</option>
                  {COBRANCAS.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
          </section>

          {/* Acessos */}
          <section className="pt-5 border-t border-gray-100 dark:border-gray-800">
            <SecaoTitulo>Acessos</SecaoTitulo>
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4">
              <IconLock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Informação sigilosa — visível apenas para você. Clique no olho para revelar a senha e não a compartilhe.</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <CampoAcesso label="Login Upseller"        value={form.login_upseller}        onChange={v => set('login_upseller', v)} />
              <CampoAcesso label="Senha Upseller"        value={form.senha_upseller}        onChange={v => set('senha_upseller', v)}        senha />
              <CampoAcesso label="Login Seller Finance"  value={form.login_seller_finance}  onChange={v => set('login_seller_finance', v)} />
              <CampoAcesso label="Senha Seller Finance"  value={form.senha_seller_finance}  onChange={v => set('senha_seller_finance', v)}  senha />
            </div>
          </section>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={fecharModal}>Cancelar</Button>
            <Button type="submit" className="flex-1">
              {editCliente ? 'Salvar alterações' : 'Adicionar cliente'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}