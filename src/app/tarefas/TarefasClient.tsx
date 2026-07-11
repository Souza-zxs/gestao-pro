'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAll, insert, update, remove, currentUserId } from '@/lib/store'
import {
  aplicarPadraoATodos, limparPadroesDeNaoVendem, sincronizarResponsaveis,
  alternarConcluido, todasConcluidas, resetarConclusao,
} from '@/lib/tarefas'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import {
  format, parseISO, isValid, isBefore, isAfter, startOfDay,
  addDays, addWeeks, addMonths,
} from 'date-fns'
import type { Tarefa, Membro, TarefaConcluida, Cliente, TarefaCliente } from '@/lib/types'
import AnaliseTarefas from './AnaliseTarefas'
import {
  PageHeader, Metric, Modal, Field, Input, Select, Textarea, Badge,
  EmptyState, AddButton, Button, IconAction, RowActions, Tabs,
} from '@/components/ui'
import { IconClipboard, IconEdit, IconTrash, IconUsers, IconCheck, IconPlus, IconClock, IconCalendar } from '@/components/icons'

type Status = Tarefa['status']
type Prioridade = Tarefa['prioridade']
type Recorrencia = Tarefa['recorrencia']

// Só duas colunas: tarefa concluída "some" do quadro.
const COLUNAS: { key: Exclude<Status, 'concluida'>; label: string; dot: string }[] = [
  { key: 'a_fazer', label: 'A fazer', dot: 'bg-gray-400' },
  { key: 'fazendo', label: 'Fazendo', dot: 'bg-blue-500' },
]
const PRIO: Record<Prioridade, { label: string; color: 'red' | 'amber' | 'gray' }> = {
  alta: { label: 'Alta', color: 'red' },
  media: { label: 'Média', color: 'amber' },
  baixa: { label: 'Baixa', color: 'gray' },
}
const PRIO_DOT: Record<Prioridade, string> = {
  alta: 'bg-red-500', media: 'bg-amber-500', baixa: 'bg-gray-300 dark:bg-gray-600',
}
const REC_LABEL: Record<Recorrencia, string> = {
  nenhuma: 'Sem recorrência', diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal',
}

const FORM_INICIAL = {
  titulo: '', descricao: '', responsavel_nome: '', responsavel_email: '',
  prioridade: 'media' as Prioridade, status: 'a_fazer' as Status,
  recorrencia: 'nenhuma' as Recorrencia, prazo: '', padrao: false,
}

// Número da carteira = dígitos no início da loja (ex: "12 - LLModas" -> "12").
const numeroDaLoja = (loja: string) => { const m = (loja || '').match(/^\s*(\d+)/); return m ? m[1].padStart(2, '0') : '' }

// Avatar de iniciais: cor determinística a partir do nome (mesma pessoa = mesma cor).
const AVATAR_CORES = [
  'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300',
  'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300',
  'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
  'bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-700 dark:text-fuchsia-300',
  'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
]
function corAvatar(nome: string): string {
  const s = nome || '?'
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_CORES[h % AVATAR_CORES.length]
}
function iniciais(nome: string): string {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase()
}

// Normaliza o array de clientes vindo do banco (JSONB) — tolera linhas antigas.
function clientesDe(t: Tarefa): TarefaCliente[] {
  if (Array.isArray(t.clientes) && t.clientes.length) return t.clientes
  if (t.cliente_nome) return [{ id: t.cliente_id, nome: t.cliente_nome, numero: '', loja: '', telefone: '' }]
  return []
}

// Subconjunto de clientesDe(t) visível para o usuário atual: num card padrão
// compartilhado (template_id setado), colaborador não-admin só enxerga os
// próprios clientes — os demais somem da tela (não só ficam desabilitados).
// Admin e tarefas comuns (não-padrão) sempre veem a lista inteira.
function clientesVisiveisDe(t: Tarefa, isAdmin: boolean, email: string): TarefaCliente[] {
  const todos = clientesDe(t)
  if (!t.template_id || isAdmin) return todos
  return todos.filter(c => c.responsavel_email === email)
}

// Mensagem amigável a partir de um erro do Supabase/PostgREST.
function mensagemErro(err: unknown): string {
  const e = err as { message?: string; code?: string; hint?: string }
  // 42501 = insufficient_privilege (violação de política RLS).
  if (e?.code === '42501' || /row-level security|violates row-level/i.test(e?.message ?? '')) {
    return 'Você não tem permissão para esta ação. Apenas a equipe (admin/instrutor) pode criar tarefas.'
  }
  if (/relation .*tarefas.* does not exist|could not find the table/i.test(e?.message ?? '')) {
    return 'A tabela de tarefas não existe no banco. Aplique as migrations do Supabase (010 e 013).'
  }
  if (/function public\.is_admin|is_team/i.test(e?.message ?? '')) {
    return 'Funções de permissão ausentes no banco. Aplique a migration 008 do Supabase.'
  }
  return e?.message || 'Erro desconhecido. Tente novamente.'
}

const hoje = () => startOfDay(new Date())
const fmtData = (d?: string | null) => d && isValid(parseISO(d)) ? format(parseISO(d), 'dd/MM') : ''
const atrasada = (t: Tarefa) => t.prazo && isValid(parseISO(t.prazo)) && isBefore(parseISO(t.prazo), hoje())

// Próxima data de uma recorrência, a partir de hoje (formato yyyy-MM-dd).
function proximaData(rec: Recorrencia): string {
  const base = hoje()
  const d = rec === 'diaria' ? addDays(base, 1) : rec === 'semanal' ? addWeeks(base, 1) : rec === 'mensal' ? addMonths(base, 1) : base
  return format(d, 'yyyy-MM-dd')
}

// Tarefa visível no quadro: ao clicar em "Concluir" ela some.
//  • não-recorrente -> vira 'concluida' e não volta;
//  • recorrente     -> volta para 'a_fazer' com o PRÓXIMO prazo (futuro), então
//    some agora e só reaparece quando esse prazo chega (ver concluir()).
// Tarefas sem prazo (ou prazo já vencido) ficam sempre visíveis.
function ativa(t: Tarefa): boolean {
  if (t.status === 'concluida') return false
  if (t.recorrencia === 'nenhuma') return true
  if (!t.prazo || !isValid(parseISO(t.prazo))) return true
  return !isAfter(parseISO(t.prazo), hoje())
}

export default function TarefasClient() {
  const { role, name, email } = useAuth()
  const isAdmin = role === 'admin'

  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [concluidas, setConcluidas] = useState<TarefaConcluida[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [view, setView] = useState<'quadro' | 'analise'>('quadro')
  const [showModal, setShowModal] = useState(false)
  const [editTarefa, setEditTarefa] = useState<Tarefa | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [selClientes, setSelClientes] = useState<TarefaCliente[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [filtroResp, setFiltroResp] = useState('todos')
  const [filtroCliente, setFiltroCliente] = useState('todos')
  // Aba de recorrência do quadro: todas / diária / semanal / mensal.
  const [filtroRec, setFiltroRec] = useState<'todas' | 'diaria' | 'semanal' | 'mensal'>('todas')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<Status | null>(null)

  const [showEquipe, setShowEquipe] = useState(false)
  const [formMembro, setFormMembro] = useState({ nome: '', email: '' })
  const [showPadrao, setShowPadrao] = useState(false)

  const [erroCarregar, setErroCarregar] = useState<string | null>(null)
  useEffect(() => { load() }, [])
  async function load() {
    try {
      const [ts, ms, cs, cl] = await Promise.all([
        getAll<Tarefa>('tarefas', { order: { column: 'criado_em', ascending: false } }),
        getAll<Membro>('membros', { order: { column: 'nome', ascending: true } }).catch(() => [] as Membro[]),
        isAdmin
          ? getAll<TarefaConcluida>('tarefas_concluidas', { order: { column: 'concluida_em', ascending: false } }).catch(() => [] as TarefaConcluida[])
          : Promise.resolve([] as TarefaConcluida[]),
        getAll<Cliente>('clientes', { order: { column: 'nome', ascending: true } }).catch(() => [] as Cliente[]),
      ])
      setMembros(ms); setConcluidas(cs); setClientes(cl); setErroCarregar(null)
      // Reconciliação (só admin): (1) tarefas padrão são exclusivas de quem já
      // vende — remove cópias de clientes que não vendem; (2) o responsável de
      // cada tarefa segue o colaborador do cliente na aba Clientes. Re-busca as
      // tarefas só quando algo mudou no banco.
      let tarefasFinais = ts
      if (isAdmin) {
        const removidos = await limparPadroesDeNaoVendem(ts, cl)
        const restantes = removidos > 0
          ? await getAll<Tarefa>('tarefas', { order: { column: 'criado_em', ascending: false } })
          : ts
        const sincronizados = await sincronizarResponsaveis(restantes, cl, ms)
        tarefasFinais = sincronizados > 0
          ? await getAll<Tarefa>('tarefas', { order: { column: 'criado_em', ascending: false } })
          : restantes
      }
      setTarefas(tarefasFinais)
    } catch (err) {
      setErroCarregar(mensagemErro(err))
    }
  }

  // Opções de responsável: você + membros cadastrados (sem repetir e-mail).
  const opcoesResp = useMemo(() => {
    const base = [{ nome: `${name} (você)`, email }, ...membros.map(m => ({ nome: m.nome, email: m.email }))]
    const vistos = new Set<string>()
    return base.filter(o => o.email && !vistos.has(o.email) && vistos.add(o.email))
  }, [membros, name, email])

  // Responsáveis para o filtro: da linha (tarefas comuns) + de cada subtarefa
  // (cópias de tarefa padrão, onde o responsável é por cliente).
  const responsaveis = useMemo(() => {
    const mapa = new Map<string, string>()
    tarefas.forEach(t => {
      if (t.responsavel_email) mapa.set(t.responsavel_email, t.responsavel_nome || t.responsavel_email)
      if (t.template_id) clientesDe(t).forEach(c => {
        if (c.responsavel_email) mapa.set(c.responsavel_email, c.responsavel_nome || c.responsavel_email)
      })
    })
    return [...mapa.entries()]
  }, [tarefas])
  // Número da carteira por cliente (mesma regra da tela de Clientes: dígitos no
  // início da loja; se não houver, usa a posição na lista).
  const numeroPorId = useMemo(() => {
    const m = new Map<string, string>()
    clientes.forEach((c, i) => {
      const match = (c.loja || '').match(/^\s*(\d+)/)
      m.set(c.id, match ? match[1].padStart(2, '0') : String(i + 1).padStart(2, '0'))
    })
    return m
  }, [clientes])

  // Clientes que têm tarefa (para o filtro do quadro). Usa clientesVisiveisDe
  // para não listar, no dropdown, clientes de colegas dentro de um card
  // padrão compartilhado.
  const clientesComTarefa = useMemo(
    () => [...new Map(tarefas.flatMap(t => clientesVisiveisDe(t, isAdmin, email)).filter(c => c.id).map(c => [c.id as string, c.nome || '—'])).entries()],
    [tarefas, isAdmin, email],
  )
  // Modelos padrão não vão para o quadro — só sua cópia única (com os
  // clientes como subtarefas).
  const templates = useMemo(() => tarefas.filter(t => t.padrao), [tarefas])
  const copiasPorTemplate = useMemo(() => {
    const m = new Map<string, number>()
    tarefas.forEach(t => { if (t.template_id) m.set(t.template_id, clientesDe(t).length) })
    return m
  }, [tarefas])

  const visiveis = tarefas.filter(t => !t.padrao && ativa(t)
    && (!t.template_id || clientesDe(t).length > 0)
    && (filtroResp === 'todos' || t.responsavel_email === filtroResp || (t.template_id && clientesDe(t).some(c => c.responsavel_email === filtroResp)))
    && (filtroCliente === 'todos' || clientesDe(t).some(c => c.id === filtroCliente))
    && (filtroRec === 'todas' || t.recorrencia === filtroRec))

  const set = (campo: keyof typeof FORM_INICIAL, valor: string) => setForm(p => ({ ...p, [campo]: valor }))

  function novo(padrao = false) {
    setEditTarefa(null)
    setErroForm(null)
    setForm({ ...FORM_INICIAL, responsavel_nome: name, responsavel_email: email, padrao })
    setSelClientes([])
    setShowModal(true)
  }
  function editar(t: Tarefa) {
    setEditTarefa(t)
    setErroForm(null)
    setForm({
      titulo: t.titulo, descricao: t.descricao,
      responsavel_nome: t.responsavel_nome, responsavel_email: t.responsavel_email,
      prioridade: t.prioridade, status: t.status, recorrencia: t.recorrencia, prazo: t.prazo || '',
      padrao: t.padrao,
    })
    setSelClientes(clientesDe(t))
    setShowModal(true)
  }
  function fechar() { setShowModal(false); setEditTarefa(null); setForm(FORM_INICIAL); setSelClientes([]); setErroForm(null) }

  // Admin escolhe o responsável pela lista; isso preenche nome + e-mail juntos.
  function escolherResp(mail: string) {
    const o = opcoesResp.find(x => x.email === mail)
    setForm(p => ({ ...p, responsavel_email: mail, responsavel_nome: o?.nome.replace(' (você)', '') || '' }))
  }

  // Vincula mais um cliente à tarefa (evita duplicar; '' = ignora).
  function adicionarCliente(id: string) {
    if (!id) return
    const c = clientes.find(x => x.id === id)
    if (!c || selClientes.some(s => s.id === id)) return
    setSelClientes(prev => [...prev, { id: c.id, nome: c.nome, numero: numeroPorId.get(c.id) || numeroDaLoja(c.loja), loja: c.loja || '', telefone: c.telefone || '' }])
  }
  function removerCliente(id: string | null) {
    setSelClientes(prev => prev.filter(c => c.id !== id))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErroForm(null)
    // Não-admin sempre cria/edita em seu próprio nome (a RLS exige user_id = ele).
    const respNome = isAdmin ? form.responsavel_nome : name
    const respEmail = (isAdmin ? form.responsavel_email : email).trim().toLowerCase()
    // O prazo só é definido por admin. Ao editar, instrutor preserva o existente.
    // Tarefa recorrente NOVA nasce sem prazo — aparece assim que criada, e o
    // prazo passa a ser 100% automático (só avança após concluída). Ao editar
    // uma já existente, o admin ainda pode ajustar o prazo manualmente.
    const novaRecorrente = !editTarefa && form.recorrencia !== 'nenhuma'
    const prazo = isAdmin ? (novaRecorrente ? null : (form.prazo || null)) : (editTarefa?.prazo ?? null)
    // Campos descritivos comuns a todas as ramificações.
    const base = {
      titulo: form.titulo, descricao: form.descricao,
      responsavel_nome: respNome, responsavel_email: respEmail,
      prioridade: form.prioridade, recorrencia: form.recorrencia, prazo,
    }
    // Só admin cria tarefa padrão (materializa cópias para toda a base).
    const ehPadrao = editTarefa ? editTarefa.padrao : (isAdmin && form.padrao)

    setSalvando(true)
    try {
      if (editTarefa) {
        if (editTarefa.padrao) {
          // Modelo padrão: atualiza o modelo e propaga os campos descritivos às
          // cópias já existentes (não mexe em status/prazo de cada card).
          await update<Tarefa>('tarefas', editTarefa.id, {
            ...base, status: 'a_fazer', padrao: true, template_id: null, clientes: [], cliente_id: null, cliente_nome: '',
          })
          await supabase.from('tarefas')
            .update({ titulo: form.titulo, descricao: form.descricao, prioridade: form.prioridade, recorrencia: form.recorrencia })
            .eq('template_id', editTarefa.id)
        } else {
          // Tarefa comum / cópia: atualiza a própria linha.
          const primeiro = selClientes[0]
          await update<Tarefa>('tarefas', editTarefa.id, {
            ...base, status: form.status, clientes: selClientes,
            cliente_id: primeiro?.id || null, cliente_nome: primeiro?.nome || '',
          })
        }
      } else if (ehPadrao) {
        // Nova tarefa padrão: cria o modelo e gera uma cópia por cliente.
        const modelo = await insert('tarefas', {
          ...base, status: 'a_fazer', padrao: true, template_id: null, clientes: [], cliente_id: null, cliente_nome: '',
        })
        const qtd = await aplicarPadraoATodos(modelo, clientes, membros)
        alert(qtd > 0
          ? `Tarefa padrão criada e atribuída a ${qtd} cliente(s).`
          : 'Tarefa padrão criada. Ela será atribuída automaticamente aos próximos clientes.')
      } else if (selClientes.length > 1) {
        // Vários clientes: um card (kanban) independente por cliente.
        for (const c of selClientes) {
          await insert('tarefas', {
            ...base, status: form.status, padrao: false, template_id: null,
            clientes: [c], cliente_id: c.id, cliente_nome: c.nome,
          })
        }
      } else {
        // Um cliente (ou nenhum): card único, como antes.
        const primeiro = selClientes[0]
        await insert('tarefas', {
          ...base, status: form.status, padrao: false, template_id: null,
          clientes: selClientes, cliente_id: primeiro?.id || null, cliente_nome: primeiro?.nome || '',
        })
      }
      fechar(); await load()
    } catch (err) {
      setErroForm(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }
  async function excluir(t: Tarefa) {
    if (!confirm('Excluir tarefa?')) return
    try { await remove('tarefas', t.id); await load() }
    catch (err) { alert('Erro ao excluir: ' + mensagemErro(err)) }
  }

  // Concluir: tarefa some do quadro. Se for recorrente, reaparece no próximo período.
  // Registra a conclusão no histórico (alimenta o painel de análise). É
  // "best-effort": se falhar (tabela ausente, RLS, etc.) apenas avisa no console
  // e NÃO impede a conclusão da tarefa. Usa return=minimal para não exigir
  // permissão de SELECT logo após o insert.
  async function registrarConclusao(t: Tarefa) {
    try {
      const uid = await currentUserId()
      const { error } = await supabase.from('tarefas_concluidas').insert({
        user_id: uid, tarefa_id: t.id, titulo: t.titulo,
        responsavel_nome: t.responsavel_nome, responsavel_email: t.responsavel_email,
        prioridade: t.prioridade, recorrencia: t.recorrencia,
        cliente_nome: t.cliente_nome ?? '',
        criada_em: t.criado_em ?? null,
      })
      if (error) console.warn('Conclusão não registrada no histórico:', error.message)
    } catch (err) {
      console.warn('Conclusão não registrada no histórico:', err)
    }
  }

  async function concluir(t: Tarefa) {
    try {
      await registrarConclusao(t) // best-effort, nunca lança
      if (t.recorrencia === 'nenhuma') {
        // Não-recorrente: some de vez (fica só no histórico de conclusões).
        await remove('tarefas', t.id)
      } else {
        // Recorrente: volta para "a fazer" com o próximo prazo (futuro) -> some
        // do quadro agora e reaparece quando o período chega.
        await update<Tarefa>('tarefas', t.id, { status: 'a_fazer', prazo: proximaData(t.recorrencia) })
      }
      await load()
    } catch (err) {
      alert('Erro ao concluir: ' + mensagemErro(err))
    }
  }

  // Registra no histórico a conclusão de cada subtarefa (cliente) de uma
  // cópia de tarefa padrão — best-effort, nunca lança.
  async function registrarConclusoesSubtarefas(t: Tarefa, itens: TarefaCliente[]) {
    try {
      const uid = await currentUserId()
      for (const c of itens) {
        const { error } = await supabase.from('tarefas_concluidas').insert({
          user_id: uid, tarefa_id: t.id, titulo: t.titulo,
          responsavel_nome: c.responsavel_nome || '', responsavel_email: c.responsavel_email || '',
          prioridade: t.prioridade, recorrencia: t.recorrencia,
          cliente_nome: c.nome ?? '',
          criada_em: t.criado_em ?? null,
        })
        if (error) console.warn('Conclusão de subtarefa não registrada no histórico:', error.message)
      }
    } catch (err) {
      console.warn('Conclusão de subtarefa não registrada no histórico:', err)
    }
  }

  // Marca/desmarca um cliente (subtarefa) dentro de um card de tarefa padrão.
  // Quando todos os clientes ficam concluídos, o card conclui: some do quadro
  // (não-recorrente) ou reseta o checklist e avança pro próximo período
  // (recorrente) — igual à conclusão de uma tarefa comum.
  async function alternarSubtarefa(t: Tarefa, clienteId: string | null) {
    const itens = alternarConcluido(clientesDe(t), clienteId)
    setTarefas(prev => prev.map(x => x.id === t.id ? { ...x, clientes: itens } : x))
    try {
      if (todasConcluidas(itens)) {
        await registrarConclusoesSubtarefas(t, itens)
        if (t.recorrencia === 'nenhuma') await remove('tarefas', t.id)
        else await update<Tarefa>('tarefas', t.id, { clientes: resetarConclusao(itens), status: 'a_fazer', prazo: proximaData(t.recorrencia) })
      } else {
        await update<Tarefa>('tarefas', t.id, { clientes: itens })
      }
      await load()
    } catch (err) {
      setTarefas(prev => prev.map(x => x.id === t.id ? t : x))
      alert('Erro ao atualizar: ' + mensagemErro(err))
    }
  }

  async function moverStatus(id: string, status: Status) {
    const t = tarefas.find(x => x.id === id)
    if (!t || t.status === status) return
    const anterior = t.status
    setTarefas(prev => prev.map(x => x.id === id ? { ...x, status } : x))
    try {
      await update<Tarefa>('tarefas', id, { status })
      await load()
    } catch (err) {
      setTarefas(prev => prev.map(x => x.id === id ? { ...x, status: anterior } : x))
      alert('Erro ao mover: ' + mensagemErro(err))
    }
  }
  function onDrop(status: Status) {
    if (dragId) moverStatus(dragId, status)
    setDragId(null); setOverCol(null)
  }

  /* ---------- Equipe (admin) ---------- */
  const [erroEquipe, setErroEquipe] = useState<string | null>(null)
  async function addMembro(e: React.FormEvent) {
    e.preventDefault()
    setErroEquipe(null)
    try {
      await insert('membros', { nome: formMembro.nome, email: formMembro.email.trim().toLowerCase() })
      setFormMembro({ nome: '', email: '' }); await load()
    } catch (err) {
      setErroEquipe(mensagemErro(err))
    }
  }
  async function removerMembro(id: string) {
    try { await remove('membros', id); await load() }
    catch (err) { alert('Erro ao remover: ' + mensagemErro(err)) }
  }

  /* ---------- Tarefas padrão (admin) ---------- */
  async function excluirTemplate(t: Tarefa) {
    if (!confirm('Excluir esta tarefa padrão? As cópias já criadas nos clientes também serão removidas.')) return
    try { await remove('tarefas', t.id); await load() } // ON DELETE CASCADE remove as cópias
    catch (err) { alert('Erro ao excluir: ' + mensagemErro(err)) }
  }
  async function reaplicarTemplate(t: Tarefa) {
    try {
      const qtd = await aplicarPadraoATodos(t, clientes, membros)
      await load()
      alert(qtd > 0 ? `${qtd} cliente(s) sem esta tarefa receberam uma cópia.` : 'Todos os clientes já têm esta tarefa.')
    } catch (err) {
      alert('Erro ao reaplicar: ' + mensagemErro(err))
    }
  }

  const totalAtivas = tarefas.filter(t => !t.padrao && ativa(t)).length
  const porStatus = (s: Status) => tarefas.filter(t => !t.padrao && ativa(t) && t.status === s).length
  const recorrentes = tarefas.filter(t => !t.padrao && t.recorrencia !== 'nenhuma').length
  // Contagem por recorrência (tarefas ativas, não-padrão) para as abas do quadro.
  const recPorTipo = {
    diaria: tarefas.filter(t => !t.padrao && ativa(t) && t.recorrencia === 'diaria').length,
    semanal: tarefas.filter(t => !t.padrao && ativa(t) && t.recorrencia === 'semanal').length,
    mensal: tarefas.filter(t => !t.padrao && ativa(t) && t.recorrencia === 'mensal').length,
  }

  return (
    <div>
      <PageHeader
        title="Tarefas"
        subtitle={isAdmin ? 'Quadro de tarefas da equipe' : 'Suas tarefas'}
        action={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="secondary" onClick={() => setView(v => (v === 'quadro' ? 'analise' : 'quadro'))}>
                {view === 'quadro' ? 'Análise' : 'Quadro'}
              </Button>
            )}
            {isAdmin && view === 'quadro' && <Button variant="secondary" icon={<IconClipboard className="w-4 h-4" />} onClick={() => setShowPadrao(true)}>Tarefas padrão</Button>}
            {isAdmin && view === 'quadro' && <Button variant="secondary" icon={<IconUsers className="w-4 h-4" />} onClick={() => setShowEquipe(true)}>Equipe</Button>}
            {view === 'quadro' && <AddButton onClick={() => novo()}>Nova Tarefa</AddButton>}
          </div>
        }
      />

      {erroCarregar && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
          Não foi possível carregar as tarefas: {erroCarregar}
        </p>
      )}

      {view === 'analise' && <AnaliseTarefas registros={concluidas} />}

      {view === 'quadro' && (<>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Metric label="Pendentes" value={totalAtivas.toString()} icon={<IconClipboard className="w-6 h-6" />} />
        <Metric label="A fazer" value={porStatus('a_fazer').toString()} accent="text-gray-700" />
        <Metric label="Fazendo" value={porStatus('fazendo').toString()} accent="text-blue-600" />
        <Metric label="Recorrentes" value={recorrentes.toString()} accent="text-violet-600" />
      </div>

      {/* Abas por recorrência — filtram o quadro (kanban) mantendo as colunas. */}
      <div className="mb-4">
        <Tabs
          active={filtroRec}
          onChange={setFiltroRec}
          tabs={[
            { value: 'todas', label: `Todas (${totalAtivas})` },
            { value: 'diaria', label: `Diárias (${recPorTipo.diaria})` },
            { value: 'semanal', label: `Semanais (${recPorTipo.semanal})` },
            { value: 'mensal', label: `Mensais (${recPorTipo.mensal})` },
          ]}
        />
      </div>

      {((isAdmin && responsaveis.length > 0) || clientesComTarefa.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {isAdmin && responsaveis.length > 0 && (
            <Select value={filtroResp} onChange={e => setFiltroResp(e.target.value)} className="!w-auto">
              <option value="todos">Todos os responsáveis</option>
              {responsaveis.map(([mail, nome]) => <option key={mail} value={mail}>{nome}</option>)}
            </Select>
          )}
          {clientesComTarefa.length > 0 && (
            <Select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} className="!w-auto">
              <option value="todos">Todos os clientes</option>
              {clientesComTarefa.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </Select>
          )}
        </div>
      )}

      {totalAtivas === 0 ? (
        <EmptyState
          icon={<IconClipboard className="w-6 h-6" />}
          title="Nenhuma tarefa pendente"
          description={isAdmin ? 'Crie tarefas e atribua aos colaboradores da equipe.' : 'Você não tem tarefas pendentes.'}
          action={<AddButton onClick={() => novo()}>Nova Tarefa</AddButton>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
          {COLUNAS.map(col => {
            const cards = visiveis.filter(t => t.status === col.key)
            const ativo = overCol === col.key
            return (
              <div
                key={col.key}
                onDragOver={e => { e.preventDefault(); if (overCol !== col.key) setOverCol(col.key) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(c => c === col.key ? null : c) }}
                onDrop={() => onDrop(col.key)}
                className={`rounded-2xl border transition-colors ${ativo ? 'border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-100 dark:ring-blue-900' : 'border-gray-200/80 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40'}`}
              >
                <div className="flex items-center gap-2 px-3.5 py-3 border-b border-gray-200/60 dark:border-gray-800/60">
                  <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                  <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">{col.label}</span>
                  <span className="text-[11px] font-medium text-gray-400 dark:text-gray-600 tabular-nums">{cards.length}</span>
                </div>
                <div className="p-2.5 space-y-2.5 min-h-[120px]">
                  {cards.map(t => {
                    const itens = clientesDe(t)
                    // Colaborador não-admin só vê as subtarefas dos próprios clientes
                    // dentro de um card padrão compartilhado — as dos demais somem da
                    // tela (o admin continua vendo todas).
                    const itensVisiveis = clientesVisiveisDe(t, isAdmin, email)
                    const feitos = itensVisiveis.filter(c => c.concluido).length
                    return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null) }}
                      onDoubleClick={() => { if (!t.template_id) editar(t) }}
                      title={t.template_id ? 'Arraste para mudar o status' : 'Arraste para mudar o status · duplo clique para editar'}
                      className={`group bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-3.5 cursor-grab active:cursor-grabbing transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-[0_2px_12px_rgba(15,23,42,0.07)] dark:hover:shadow-[0_2px_12px_rgba(0,0,0,0.3)] ${dragId === t.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13.5px] font-semibold text-gray-900 dark:text-gray-100 leading-snug">{t.titulo}</p>
                        <span className="flex items-center gap-1 text-[10.5px] font-medium text-gray-400 dark:text-gray-500 shrink-0 mt-0.5" title={`Prioridade ${PRIO[t.prioridade].label}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${PRIO_DOT[t.prioridade]}`} />
                          {PRIO[t.prioridade].label}
                        </span>
                      </div>
                      {t.descricao && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-2 leading-relaxed">{t.descricao}</p>}

                      {/* Padrão: checklist de subtarefas (1 linha por cliente, editável).
                          Não-admin só vê a linha dos próprios clientes (itensVisiveis já
                          vem filtrado) — por isso não precisa de estado desabilitado aqui. */}
                      {t.template_id && itensVisiveis.length > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="h-1 flex-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                              <div className="h-full rounded-full bg-green-500 transition-all duration-300" style={{ width: `${(feitos / itensVisiveis.length) * 100}%` }} />
                            </div>
                            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-600 tabular-nums shrink-0">{feitos}/{itensVisiveis.length}</span>
                          </div>
                          <div className="space-y-0.5 -mx-1.5">
                            {itensVisiveis.map((c, idx) => {
                              const num = c.numero || numeroDaLoja(c.loja)
                              return (
                                <label
                                  key={c.id ?? idx}
                                  className="flex items-center gap-2 rounded-lg px-1.5 py-1 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!c.concluido}
                                    onChange={() => alternarSubtarefa(t, c.id)}
                                    className="sr-only"
                                  />
                                  <span className={`shrink-0 w-4 h-4 rounded-[5px] border flex items-center justify-center transition-colors ${c.concluido ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'}`}>
                                    {c.concluido && <IconCheck className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                  </span>
                                  {num && <span className="font-mono text-[10px] text-gray-300 dark:text-gray-600 tabular-nums shrink-0">{num}</span>}
                                  <span className={`text-xs truncate flex-1 ${c.concluido ? 'text-gray-300 dark:text-gray-600 line-through' : 'text-gray-600 dark:text-gray-300'}`}>{c.nome || '—'}</span>
                                  {isAdmin && c.responsavel_nome && (
                                    <span className="text-[10px] text-gray-300 dark:text-gray-600 shrink-0">{c.responsavel_nome.split(' ')[0]}</span>
                                  )}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tarefa comum: clientes como chips (não editáveis aqui). */}
                      {!t.template_id && itens.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {itens.map((c, idx) => (
                            <span key={c.id ?? idx} className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-800 pl-1 pr-2.5 py-0.5 max-w-full">
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${corAvatar(c.nome)}`}>{iniciais(c.nome)}</span>
                              <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300 truncate">{c.nome || '—'}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11px] text-gray-400 dark:text-gray-500">
                        {t.template_id && (
                          <span className="inline-flex items-center gap-1 font-medium text-blue-500 dark:text-blue-400">
                            <IconClipboard className="w-3 h-3" /> Padrão
                          </span>
                        )}
                        {t.recorrencia !== 'nenhuma' && (
                          <span className="inline-flex items-center gap-1">
                            <IconClock className="w-3 h-3" /> {REC_LABEL[t.recorrencia]}
                          </span>
                        )}
                        {t.prazo && (
                          <span className={`inline-flex items-center gap-1 ${atrasada(t) ? 'text-red-500 dark:text-red-400 font-medium' : ''}`}>
                            <IconCalendar className="w-3 h-3" /> {fmtData(t.prazo)}
                          </span>
                        )}
                      </div>

                      {!t.template_id && (
                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-50 dark:border-gray-800/60">
                          <span className="inline-flex items-center gap-1.5 min-w-0 max-w-[55%]">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${corAvatar(t.responsavel_nome || t.responsavel_email)}`}>{iniciais(t.responsavel_nome || t.responsavel_email)}</span>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{t.responsavel_nome || t.responsavel_email || '—'}</span>
                          </span>
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => concluir(t)} title="Concluir" className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"><IconCheck className="w-3 h-3" /> Concluir</button>
                            <button onClick={() => editar(t)} title="Editar" className="p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-all"><IconEdit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => excluir(t)} title="Excluir" className="p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"><IconTrash className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  )})}
                  {cards.length === 0 && <p className="text-xs text-gray-300 dark:text-gray-700 text-center py-8 select-none">Solte aqui</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
      </>)}

      {/* Modal Tarefa */}
      <Modal
        open={showModal}
        onClose={fechar}
        title={
          (editTarefa ? editTarefa.padrao : form.padrao)
            ? (editTarefa ? 'Editar tarefa padrão' : 'Nova tarefa padrão')
            : (editTarefa ? 'Editar Tarefa' : 'Nova Tarefa')
        }
        size="lg"
      >
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Título"><Input required value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="O que precisa ser feito" /></Field>
          <Field label="Descrição"><Textarea rows={2} value={form.descricao} onChange={e => set('descricao', e.target.value)} /></Field>

          {/* Tarefa padrão (geral): só admin, só ao criar. Aplica a todos os clientes. */}
          {isAdmin && !editTarefa && (
            <label className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 px-3 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.padrao}
                onChange={e => setForm(p => ({ ...p, padrao: e.target.checked }))}
                className="mt-0.5 w-4 h-4 accent-blue-600"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">Tarefa padrão (geral)</span>
                <span className="block text-xs text-gray-400 dark:text-gray-500">
                  Cria um único card com cada cliente como subtarefa, inclusive todo novo cliente cadastrado.
                </span>
              </span>
            </label>
          )}
          {editTarefa?.padrao && (
            <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-3 py-2">
              <IconClipboard className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Tarefa padrão — aplica-se a todos os clientes. Alterar título, descrição, prioridade ou recorrência atualiza as cópias já criadas.</span>
            </div>
          )}

          {/* Responsável: escondido em tarefa padrão — cada cópia vai automaticamente
              para o colaborador do próprio cliente (campo `responsavel` da tabela). */}
          {!(editTarefa ? editTarefa.padrao : form.padrao) && (
            <Field label="Responsável">
              {isAdmin ? (
                <Select value={form.responsavel_email} onChange={e => escolherResp(e.target.value)}>
                  {opcoesResp.map(o => <option key={o.email} value={o.email}>{o.nome}</option>)}
                </Select>
              ) : (
                <Input value={form.responsavel_nome || name} disabled />
              )}
            </Field>
          )}
          {/* Seletor de clientes: escondido quando é tarefa padrão (aplica a todos).
              Ao escolher mais de um cliente, cada um vira um card independente. */}
          {(editTarefa ? editTarefa.padrao : form.padrao) ? (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
              Esta tarefa vale para <span className="font-medium text-gray-700 dark:text-gray-300">todos os clientes</span> — um único card, com cada cliente atribuído automaticamente ao <span className="font-medium text-gray-700 dark:text-gray-300">colaborador dele</span> (campo Responsável na tabela de clientes). Não é preciso escolher.
            </div>
          ) : (
            <Field label="Clientes" hint="Opcional — 2 ou mais criam um card (kanban) por cliente">
              <Select value="" onChange={e => { adicionarCliente(e.target.value); e.target.value = '' }}>
                <option value="">Adicionar cliente…</option>
                {clientes.filter(c => !selClientes.some(s => s.id === c.id)).map(c => (
                  <option key={c.id} value={c.id}>{c.nome}{c.loja ? ` — ${c.loja}` : ''}</option>
                ))}
              </Select>
              {selClientes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selClientes.map((c, idx) => (
                    <span key={c.id ?? idx} className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 pl-2 pr-1 py-1 text-xs text-amber-900">
                      {(c.numero || numeroDaLoja(c.loja)) && <span className="font-mono font-semibold text-amber-700">{c.numero || numeroDaLoja(c.loja)}</span>}
                      <span className="font-medium">{c.nome}</span>
                      {c.loja && <span className="text-amber-700/80">· {c.loja}</span>}
                      <button type="button" onClick={() => removerCliente(c.id)} title="Remover" className="ml-0.5 text-amber-500 hover:text-red-600 leading-none px-1">×</button>
                    </span>
                  ))}
                </div>
              )}
              {selClientes.length > 1 && !editTarefa && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1.5">
                  Serão criados {selClientes.length} cards — um para cada cliente.
                </p>
              )}
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prioridade">
              <Select value={form.prioridade} onChange={e => set('prioridade', e.target.value)}>
                <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
              </Select>
            </Field>
            <Field label="Recorrência" hint="Some ao concluir e volta no período">
              <Select value={form.recorrencia} onChange={e => set('recorrencia', e.target.value)}>
                <option value="nenhuma">Sem recorrência</option>
                <option value="diaria">Diária</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={e => set('status', e.target.value)}>
                {COLUNAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Select>
            </Field>
            {/* Prazo: escondido ao criar uma tarefa recorrente nova — ela sempre
                aparece assim que criada, e o prazo vira automático (só avança
                depois de concluída). Ao editar uma já existente, o admin ainda
                pode ajustar manualmente (ex.: destravar uma que ficou escondida). */}
            {isAdmin && (editTarefa || form.recorrencia === 'nenhuma') && (
              <Field label="Prazo"><Input type="date" value={form.prazo} onChange={e => set('prazo', e.target.value)} /></Field>
            )}
          </div>
          {erroForm && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erroForm}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={fechar} disabled={salvando}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={salvando}>{salvando ? 'Salvando...' : editTarefa ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Equipe (admin) */}
      <Modal open={showEquipe} onClose={() => setShowEquipe(false)} title="Equipe" size="lg">
        <p className="text-sm text-gray-500 mb-4">Cadastre os colaboradores (com o e-mail de login) para poder atribuir tarefas a eles.</p>
        <form onSubmit={addMembro} className="flex flex-wrap items-end gap-2 mb-4">
          <div className="flex-1 min-w-[120px]"><Field label="Nome"><Input required value={formMembro.nome} onChange={e => setFormMembro(p => ({ ...p, nome: e.target.value }))} /></Field></div>
          <div className="flex-1 min-w-[160px]"><Field label="E-mail de login"><Input type="email" required value={formMembro.email} onChange={e => setFormMembro(p => ({ ...p, email: e.target.value }))} placeholder="colaborador@email.com" /></Field></div>
          <Button type="submit" icon={<IconPlus className="w-4 h-4" />}>Adicionar</Button>
        </form>
        {erroEquipe && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{erroEquipe}</p>}
        {membros.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum membro cadastrado.</p>
        ) : (
          <div className="divide-y divide-gray-50 border border-gray-100 rounded-lg">
            {membros.map(m => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.nome}</p>
                  <p className="text-xs text-gray-400 truncate">{m.email}</p>
                </div>
                <RowActions><IconAction onClick={() => removerMembro(m.id)} title="Remover" color="red"><IconTrash className="w-4 h-4" /></IconAction></RowActions>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Modal Tarefas padrão (admin) */}
      <Modal open={showPadrao} onClose={() => setShowPadrao(false)} title="Tarefas padrão" size="lg">
        <div className="flex items-start justify-between gap-3 mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Tarefas gerais aplicadas a <span className="font-medium">todos os clientes</span>. Cada uma vira um único card, com os clientes como subtarefas — inclusive para novos cadastros.
          </p>
          <AddButton onClick={() => { setShowPadrao(false); novo(true) }}>Nova</AddButton>
        </div>
        {templates.length === 0 ? (
          <EmptyState
            icon={<IconClipboard className="w-5 h-5" />}
            title="Nenhuma tarefa padrão"
            description="Crie uma tarefa padrão para que ela seja atribuída automaticamente a todos os clientes."
          />
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-lg">
            {templates.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{t.titulo}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <Badge color={PRIO[t.prioridade].color}>{PRIO[t.prioridade].label}</Badge>
                    {t.recorrencia !== 'nenhuma' && <Badge color="blue">{REC_LABEL[t.recorrencia]}</Badge>}
                    <span className="text-[11px] text-gray-400">{copiasPorTemplate.get(t.id) || 0} cliente(s)</span>
                  </div>
                </div>
                <RowActions>
                  <IconAction onClick={() => reaplicarTemplate(t)} title="Reaplicar aos clientes sem esta tarefa" color="blue"><IconPlus className="w-4 h-4" /></IconAction>
                  <IconAction onClick={() => { setShowPadrao(false); editar(t) }} title="Editar" color="gray"><IconEdit className="w-4 h-4" /></IconAction>
                  <IconAction onClick={() => excluirTemplate(t)} title="Excluir" color="red"><IconTrash className="w-4 h-4" /></IconAction>
                </RowActions>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
