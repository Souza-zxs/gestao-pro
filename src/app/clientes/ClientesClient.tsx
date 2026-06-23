'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAll, insert, update, remove } from '@/lib/store'
import { format, parseISO, isValid } from 'date-fns'
import type { Cliente } from '@/lib/types'
import {
  PageHeader, Card, Metric, Modal, Field, Input, Select, Badge,
  EmptyState, Th, AddButton, Button, RowActions, IconAction,
} from '@/components/ui'
import { IconUserCircle, IconEdit, IconTrash, IconSearch, IconEye, IconEyeOff, IconLock, IconCopy, IconCheck } from '@/components/icons'

// Campo de acesso (login ou senha) com botão de copiar. Senhas ficam ocultas
// por padrão e são reveladas no ícone de olho.
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
            <button type="button" onClick={() => setRevelado(r => !r)} title={revelado ? 'Ocultar senha' : 'Revelar senha'}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
              {revelado ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
            </button>
          )}
          <button type="button" onClick={copiar} disabled={!value} title="Copiar"
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40">
            {copiado ? <IconCheck className="w-4 h-4 text-green-600" /> : <IconCopy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </Field>
  )
}

// Opções dos campos de seleção (ajuste livre conforme o seu funil).
const FASES = ['Fase 1 - Implementação', 'Fase 2 - Primeiras Vendas', 'Fase 3 - Crescimento', 'Fase 4 - Pré Escala', 'Fase 5 - Escala']
const FATURAMENTOS = ['0 a 20k', '21 a 50k', '51 a 100k', '100k+']
const EVOLUCOES = ['Crescente', 'Estável', 'Decrescente']
const PLATAFORMAS = ['Shopee', 'Mercado Livre', 'Amazon', 'Site próprio']
const COBRANCAS = ['Mensalidade', 'Pedido']

type BadgeColor = 'blue' | 'green' | 'gray' | 'red' | 'amber'
const faseColor = (f: string): BadgeColor => f.startsWith('Fase 5') ? 'green' : f.startsWith('Fase 4') || f.startsWith('Fase 3') ? 'blue' : f ? 'amber' : 'gray'
const fatColor = (v: string): BadgeColor => v.includes('100k') ? 'green' : v.includes('21') || v.includes('51') ? 'blue' : v ? 'amber' : 'gray'
const evoColor = (v: string): BadgeColor => v === 'Crescente' ? 'green' : v === 'Decrescente' ? 'red' : 'gray'

const fmtData = (d?: string | null) => d && isValid(parseISO(d)) ? format(parseISO(d), 'dd/MM/yyyy') : '—'

// Título de seção dentro do formulário.
function SecaoTitulo({ children }: { children: string }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">{children}</p>
}

const FORM_INICIAL = {
  nome: '', loja: '', telefone: '', data_entrada: '', responsavel: '',
  ja_vende: false, ultimo_acompanhamento: '', proximo_acompanhamento: '',
  evolucao_vendas: '', fase_conta: '', faturamento_mensal: '', plataforma: 'Shopee',
  numero_contas: '1', tipo_cobranca: '', login_upseller: '', senha_upseller: '',
  login_seller_finance: '', senha_seller_finance: '',
}

export default function ClientesClient() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [filtroVende, setFiltroVende] = useState<'todos' | 'sim' | 'nao'>('todos')
  const [showModal, setShowModal] = useState(false)
  const [editCliente, setEditCliente] = useState<Cliente | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)

  useEffect(() => { load() }, [])
  async function load() {
    setClientes(await getAll<Cliente>('clientes', { order: { column: 'criado_em', ascending: true } }))
  }

  // Número da loja: extraído do próprio campo "loja" (ex: "03 - Ziv Modas" → 03).
  // Cai para a ordem de cadastro só quando a loja não tem número no início.
  const numeroPorId = useMemo(() => {
    const m = new Map<string, string>()
    clientes.forEach((c, i) => {
      const match = (c.loja || '').match(/^\s*(\d+)/)
      m.set(c.id, match ? match[1].padStart(2, '0') : String(i + 1).padStart(2, '0'))
    })
    return m
  }, [clientes])

  const filtrados = useMemo(() => clientes.filter(c => {
    if (filtroVende === 'sim' && !c.ja_vende) return false
    if (filtroVende === 'nao' && c.ja_vende) return false
    if (!busca) return true
    const t = busca.toLowerCase()
    return [c.nome, c.loja, c.telefone, c.responsavel, c.plataforma, c.fase_conta].some(v => (v || '').toLowerCase().includes(t))
  }).sort((a, b) => Number(numeroPorId.get(a.id)) - Number(numeroPorId.get(b.id))), [clientes, busca, filtroVende, numeroPorId])

  const total = clientes.length
  const vendendo = clientes.filter(c => c.ja_vende).length
  const contas = clientes.reduce((s, c) => s + (c.numero_contas || 0), 0)
  const emEscala = clientes.filter(c => c.fase_conta.startsWith('Fase 5')).length

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      nome: form.nome, loja: form.loja, telefone: form.telefone,
      data_entrada: form.data_entrada || null, responsavel: form.responsavel,
      ja_vende: form.ja_vende,
      ultimo_acompanhamento: form.ultimo_acompanhamento || null,
      proximo_acompanhamento: form.proximo_acompanhamento || null,
      evolucao_vendas: form.evolucao_vendas, fase_conta: form.fase_conta,
      faturamento_mensal: form.faturamento_mensal, plataforma: form.plataforma,
      numero_contas: parseInt(form.numero_contas) || 0, tipo_cobranca: form.tipo_cobranca,
      login_upseller: form.login_upseller, senha_upseller: form.senha_upseller,
      login_seller_finance: form.login_seller_finance, senha_seller_finance: form.senha_seller_finance,
    }
    if (editCliente) await update<Cliente>('clientes', editCliente.id, payload)
    else await insert('clientes', payload)
    fecharModal(); await load()
  }

  async function excluir(id: string) { if (confirm('Excluir cliente?')) { await remove('clientes', id); await load() } }

  function fecharModal() { setShowModal(false); setEditCliente(null); setForm(FORM_INICIAL) }
  const novo = () => { setEditCliente(null); setForm(FORM_INICIAL); setShowModal(true) }
  function editar(c: Cliente) {
    setEditCliente(c)
    setForm({
      nome: c.nome, loja: c.loja, telefone: c.telefone, data_entrada: c.data_entrada || '',
      responsavel: c.responsavel, ja_vende: c.ja_vende,
      ultimo_acompanhamento: c.ultimo_acompanhamento || '', proximo_acompanhamento: c.proximo_acompanhamento || '',
      evolucao_vendas: c.evolucao_vendas, fase_conta: c.fase_conta, faturamento_mensal: c.faturamento_mensal,
      plataforma: c.plataforma, numero_contas: String(c.numero_contas ?? 1), tipo_cobranca: c.tipo_cobranca,
      login_upseller: c.login_upseller, senha_upseller: c.senha_upseller,
      login_seller_finance: c.login_seller_finance, senha_seller_finance: c.senha_seller_finance,
    })
    setShowModal(true)
  }
  const set = (campo: keyof typeof FORM_INICIAL, valor: string | boolean) => setForm(p => ({ ...p, [campo]: valor }))

  return (
    <div>
      <PageHeader
        title="Base de Clientes"
        subtitle="Carteira de lojas: acompanhamento, fase da conta e acessos"
        action={<AddButton onClick={novo}>Novo Cliente</AddButton>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Metric label="Clientes" value={total.toString()} icon={<IconUserCircle className="w-6 h-6" />} />
        <Metric label="Já vendendo" value={vendendo.toString()} accent="text-green-600" sub={total ? `${Math.round((vendendo / total) * 100)}% da base` : undefined} />
        <Metric label="Em Escala" value={emEscala.toString()} accent="text-blue-600" />
        <Metric label="Contas" value={contas.toString()} />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, loja, responsável…" className="pl-9" />
        </div>
        <Select value={filtroVende} onChange={e => setFiltroVende(e.target.value as typeof filtroVende)} className="!w-auto">
          <option value="todos">Todos</option>
          <option value="sim">Já vende</option>
          <option value="nao">Ainda não vende</option>
        </Select>
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={<IconUserCircle className="w-6 h-6" />}
          title={total === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente neste filtro'}
          description={total === 0 ? 'Cadastre as lojas atendidas com acompanhamento, fase e acessos.' : undefined}
          action={total === 0 ? <AddButton onClick={novo}>Novo Cliente</AddButton> : undefined}
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <Th>Nº</Th><Th>Cliente</Th><Th>Loja</Th><Th>Telefone</Th><Th>Responsável</Th>
                  <Th>Já vende</Th><Th>Próx. acomp.</Th><Th>Evolução</Th><Th>Fase</Th><Th>Faturamento</Th>
                  <Th>Plataforma</Th><Th>Contas</Th><Th className="text-right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c, i, arr) => (
                  <tr key={c.id} className={i < arr.length - 1 ? 'border-b border-gray-50' : ''}>
                    <td className="px-4 py-3 font-mono text-gray-400 tabular-nums">{numeroPorId.get(c.id)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                    <td className="px-4 py-3 text-gray-500">{c.loja || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.telefone || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{c.responsavel || '—'}</td>
                    <td className="px-4 py-3"><Badge color={c.ja_vende ? 'green' : 'red'}>{c.ja_vende ? 'Sim' : 'Não'}</Badge></td>
                    <td className="px-4 py-3 text-gray-500">{fmtData(c.proximo_acompanhamento)}</td>
                    <td className="px-4 py-3">{c.evolucao_vendas ? <Badge color={evoColor(c.evolucao_vendas)}>{c.evolucao_vendas}</Badge> : '—'}</td>
                    <td className="px-4 py-3">{c.fase_conta ? <Badge color={faseColor(c.fase_conta)}>{c.fase_conta}</Badge> : '—'}</td>
                    <td className="px-4 py-3">{c.faturamento_mensal ? <Badge color={fatColor(c.faturamento_mensal)}>{c.faturamento_mensal}</Badge> : '—'}</td>
                    <td className="px-4 py-3">{c.plataforma ? <Badge color="amber">{c.plataforma}</Badge> : '—'}</td>
                    <td className="px-4 py-3 text-gray-700 text-center">{c.numero_contas || 0}</td>
                    <td className="px-4 py-3">
                      <RowActions>
                        <IconAction onClick={() => editar(c)} title="Editar" color="blue"><IconEdit className="w-4 h-4" /></IconAction>
                        <IconAction onClick={() => excluir(c.id)} title="Excluir" color="red"><IconTrash className="w-4 h-4" /></IconAction>
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={showModal} onClose={fecharModal} title={editCliente ? 'Editar Cliente' : 'Novo Cliente'} size="xl">
        <form onSubmit={salvar} className="space-y-6">
          {/* Dados do cliente */}
          <section>
            <SecaoTitulo>Dados do cliente</SecaoTitulo>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Nome do Cliente"><Input required value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome de quem você atende" /></Field>
              </div>
              <Field label="Nr e Loja"><Input value={form.loja} onChange={e => set('loja', e.target.value)} placeholder="Ex: 01 - Modas LB" /></Field>
              <Field label="Telefone"><Input value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(00) 00000-0000" /></Field>
              <Field label="Responsável"><Input value={form.responsavel} onChange={e => set('responsavel', e.target.value)} placeholder="Quem atende a conta" /></Field>
              <Field label="Data de Entrada"><Input type="date" value={form.data_entrada} onChange={e => set('data_entrada', e.target.value)} /></Field>
              <Field label="Já vende?">
                <div className="flex gap-2">
                  <button type="button" onClick={() => set('ja_vende', true)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${form.ja_vende ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>Sim</button>
                  <button type="button" onClick={() => set('ja_vende', false)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${!form.ja_vende ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>Não</button>
                </div>
              </Field>
            </div>
          </section>

          {/* Acompanhamento & conta */}
          <section className="pt-5 border-t border-gray-100">
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
              <Field label="Último Acompanhamento"><Input type="date" value={form.ultimo_acompanhamento} onChange={e => set('ultimo_acompanhamento', e.target.value)} /></Field>
              <Field label="Próximo Acompanhamento"><Input type="date" value={form.proximo_acompanhamento} onChange={e => set('proximo_acompanhamento', e.target.value)} /></Field>
              <Field label="Número de Contas"><Input type="number" min="0" value={form.numero_contas} onChange={e => set('numero_contas', e.target.value)} /></Field>
              <Field label="Tipo de Cobrança">
                <Select value={form.tipo_cobranca} onChange={e => set('tipo_cobranca', e.target.value)}>
                  <option value="">—</option>
                  {COBRANCAS.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>
          </section>

          {/* Acessos */}
          <section className="pt-5 border-t border-gray-100">
            <SecaoTitulo>Acessos</SecaoTitulo>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 flex items-center gap-1.5">
              <IconLock className="w-3.5 h-3.5 shrink-0" />
              Informação sigilosa — visível apenas para você. Clique no olho para revelar a senha e não a compartilhe.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <CampoAcesso label="Login Upseller" value={form.login_upseller} onChange={v => set('login_upseller', v)} />
              <CampoAcesso label="Senha Upseller" value={form.senha_upseller} onChange={v => set('senha_upseller', v)} senha />
              <CampoAcesso label="Login Seller Finance" value={form.login_seller_finance} onChange={v => set('login_seller_finance', v)} />
              <CampoAcesso label="Senha Seller Finance" value={form.senha_seller_finance} onChange={v => set('senha_seller_finance', v)} senha />
            </div>
          </section>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={fecharModal}>Cancelar</Button>
            <Button type="submit" className="flex-1">{editCliente ? 'Salvar alterações' : 'Adicionar cliente'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
