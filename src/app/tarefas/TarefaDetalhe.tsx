'use client'

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getAll, getById, insert, update, remove } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import type { Tarefa, TarefaSubtarefa, Membro, Cliente, TarefaCliente } from '@/lib/types'
import { clientesDe } from './checklistUtils'
import { concluirTarefa } from './tarefasAcoes'
import { corAvatar, numeroDaLoja } from './avatar'
import ComentariosTarefa from './ComentariosTarefa'
import { Select, Textarea, Button } from '@/components/ui'
import { IconArrowLeft, IconCheck, IconTrash, IconPlus } from '@/components/icons'

type Status = Tarefa['status']
type Prioridade = Tarefa['prioridade']
type Recorrencia = Tarefa['recorrencia']

function mensagemErro(err: unknown): string {
  const e = err as { message?: string; code?: string }
  if (e?.code === '42501' || /row-level security|violates row-level/i.test(e?.message ?? '')) {
    return 'Você não tem permissão para esta ação.'
  }
  if (/relation .*tarefas_subtarefas.* does not exist|could not find the table/i.test(e?.message ?? '')) {
    return 'A tabela de subtasks não existe no banco. Aplique a migration 039 do Supabase.'
  }
  return e?.message || 'Erro desconhecido. Tente novamente.'
}

const PRIO_DOT: Record<Prioridade, string> = {
  alta: 'bg-red-500', media: 'bg-amber-500', baixa: 'bg-gray-300 dark:bg-gray-600',
}

export default function TarefaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role, name, email } = useAuth()
  const isAdmin = role === 'admin'

  const [tarefa, setTarefa] = useState<Tarefa | null>(null)
  const [subtarefas, setSubtarefas] = useState<TarefaSubtarefa[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [novaSubtask, setNovaSubtask] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => { if (id) carregar(id) }, [id])

  async function carregar(tarefaId: string) {
    setCarregando(true)
    try {
      const [t, subs, ms, cl] = await Promise.all([
        getById<Tarefa>('tarefas', tarefaId),
        getAll<TarefaSubtarefa>('tarefas_subtarefas', { match: { tarefa_id: tarefaId }, order: { column: 'ordem', ascending: true } }).catch(() => [] as TarefaSubtarefa[]),
        getAll<Membro>('membros', { order: { column: 'nome', ascending: true } }).catch(() => [] as Membro[]),
        getAll<Cliente>('clientes', { order: { column: 'nome', ascending: true } }).catch(() => [] as Cliente[]),
      ])
      if (!t) { setErro('Tarefa não encontrada.'); setTarefa(null); setCarregando(false); return }
      setTarefa(t); setTitulo(t.titulo); setDescricao(t.descricao)
      setSubtarefas(subs); setMembros(ms); setClientes(cl); setErro(null)
    } catch (err) {
      setErro(mensagemErro(err))
    } finally {
      setCarregando(false)
    }
  }

  async function carregarSubtarefas() {
    if (!id) return
    setSubtarefas(await getAll<TarefaSubtarefa>('tarefas_subtarefas', { match: { tarefa_id: id }, order: { column: 'ordem', ascending: true } }))
  }

  async function salvarCampo<K extends keyof Tarefa>(campo: K, valor: Tarefa[K]) {
    if (!tarefa) return
    const anterior = tarefa[campo]
    setTarefa(prev => prev ? { ...prev, [campo]: valor } : prev)
    try {
      await update<Tarefa>('tarefas', tarefa.id, { [campo]: valor } as Partial<Tarefa>)
    } catch (err) {
      setErro(mensagemErro(err))
      setTarefa(prev => prev ? { ...prev, [campo]: anterior } : prev)
    }
  }

  const opcoesResp = (() => {
    const base = [{ nome: `${name} (você)`, email }, ...membros.map(m => ({ nome: m.nome, email: m.email }))]
    const vistos = new Set<string>()
    return base.filter(o => o.email && !vistos.has(o.email) && vistos.add(o.email))
  })()

  async function escolherResp(mail: string) {
    if (!tarefa) return
    const o = opcoesResp.find(x => x.email === mail)
    if (!o) return
    const nome = o.nome.replace(' (você)', '')
    const anterior = { responsavel_email: tarefa.responsavel_email, responsavel_nome: tarefa.responsavel_nome }
    setTarefa(prev => prev ? { ...prev, responsavel_email: mail, responsavel_nome: nome } : prev)
    try {
      await update<Tarefa>('tarefas', tarefa.id, { responsavel_email: mail, responsavel_nome: nome })
    } catch (err) {
      setErro(mensagemErro(err))
      setTarefa(prev => prev ? { ...prev, ...anterior } : prev)
    }
  }

  const selClientes = tarefa ? clientesDe(tarefa) : []

  async function adicionarCliente(cid: string) {
    if (!cid || !tarefa) return
    const c = clientes.find(x => x.id === cid)
    if (!c || selClientes.some(s => s.id === cid)) return
    const novo: TarefaCliente = { id: c.id, nome: c.nome, numero: numeroDaLoja(c.loja), loja: c.loja || '', telefone: c.telefone || '' }
    const lista = [...selClientes, novo]
    const campos = { clientes: lista, cliente_id: lista[0]?.id || null, cliente_nome: lista[0]?.nome || '' }
    const anterior = { clientes: tarefa.clientes, cliente_id: tarefa.cliente_id, cliente_nome: tarefa.cliente_nome }
    setTarefa(prev => prev ? { ...prev, ...campos } : prev)
    try {
      await update<Tarefa>('tarefas', tarefa.id, campos)
    } catch (err) {
      setErro(mensagemErro(err))
      setTarefa(prev => prev ? { ...prev, ...anterior } : prev)
    }
  }

  async function removerCliente(cid: string | null) {
    if (!tarefa) return
    const lista = selClientes.filter(c => c.id !== cid)
    const campos = { clientes: lista, cliente_id: lista[0]?.id || null, cliente_nome: lista[0]?.nome || '' }
    const anterior = { clientes: tarefa.clientes, cliente_id: tarefa.cliente_id, cliente_nome: tarefa.cliente_nome }
    setTarefa(prev => prev ? { ...prev, ...campos } : prev)
    try {
      await update<Tarefa>('tarefas', tarefa.id, campos)
    } catch (err) {
      setErro(mensagemErro(err))
      setTarefa(prev => prev ? { ...prev, ...anterior } : prev)
    }
  }

  async function alternarSubtask(s: TarefaSubtarefa) {
    const concluido = !s.concluido
    const concluido_em = concluido ? new Date().toISOString() : null
    setSubtarefas(prev => prev.map(x => x.id === s.id ? { ...x, concluido, concluido_em } : x))
    try {
      await update<TarefaSubtarefa>('tarefas_subtarefas', s.id, { concluido, concluido_em })
    } catch (err) {
      setErro(mensagemErro(err))
      await carregarSubtarefas()
    }
  }

  async function removerSubtask(s: TarefaSubtarefa) {
    setSubtarefas(prev => prev.filter(x => x.id !== s.id))
    try {
      await remove('tarefas_subtarefas', s.id)
    } catch (err) {
      setErro(mensagemErro(err))
      await carregarSubtarefas()
    }
  }

  async function adicionarSubtask(e: React.FormEvent) {
    e.preventDefault()
    const texto = novaSubtask.trim()
    if (!texto || !id) return
    setNovaSubtask('')
    try {
      const criada = await insert<{ tarefa_id: string; titulo: string; ordem: number }>('tarefas_subtarefas', {
        tarefa_id: id, titulo: texto, ordem: subtarefas.length,
      })
      setSubtarefas(prev => [...prev, criada as unknown as TarefaSubtarefa])
    } catch (err) {
      setErro(mensagemErro(err))
    }
  }

  async function concluir() {
    if (!tarefa) return
    try {
      await concluirTarefa(tarefa)
      navigate('/tarefas')
    } catch (err) {
      setErro('Erro ao concluir: ' + mensagemErro(err))
    }
  }

  async function excluir() {
    if (!tarefa) return
    if (!confirm('Excluir tarefa?')) return
    try {
      await remove('tarefas', tarefa.id)
      navigate('/tarefas')
    } catch (err) {
      setErro('Erro ao excluir: ' + mensagemErro(err))
    }
  }

  if (carregando) return <p className="text-sm text-gray-400 px-1">Carregando…</p>

  if (!tarefa) {
    return (
      <div>
        <button onClick={() => navigate('/tarefas')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4">
          <IconArrowLeft className="w-4 h-4" /> Voltar para o quadro
        </button>
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro || 'Tarefa não encontrada.'}</p>
      </div>
    )
  }

  const pendentes = subtarefas.filter(s => !s.concluido).length

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/tarefas')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-5">
        <IconArrowLeft className="w-4 h-4" /> Voltar para o quadro
      </button>

      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{erro}</p>}

      <div className="flex items-center gap-2.5 mb-5">
        <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${corAvatar(tarefa.id)}`} />
        <input
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          onBlur={() => { if (titulo.trim() && titulo !== tarefa.titulo) salvarCampo('titulo', titulo.trim()) }}
          className="w-full text-2xl font-bold bg-transparent border-none outline-none text-gray-900 dark:text-gray-100"
          placeholder="Título da tarefa"
        />
      </div>

      <div className="space-y-0.5 mb-5">
        <div className="flex items-center gap-3 py-1.5">
          <span className="w-24 shrink-0 text-[13px] text-gray-400 dark:text-gray-500">Responsável</span>
          {isAdmin ? (
            <Select value={tarefa.responsavel_email} onChange={e => escolherResp(e.target.value)} className="!w-auto !border-none !shadow-none !bg-transparent !px-1">
              {opcoesResp.map(o => <option key={o.email} value={o.email}>{o.nome}</option>)}
            </Select>
          ) : (
            <span className="text-[13px] text-gray-700 dark:text-gray-300">{tarefa.responsavel_nome || tarefa.responsavel_email}</span>
          )}
        </div>
        <div className="flex items-center gap-3 py-1.5">
          <span className="w-24 shrink-0 text-[13px] text-gray-400 dark:text-gray-500">Status</span>
          <Select
            value={tarefa.status === 'concluida' ? 'a_fazer' : tarefa.status}
            onChange={e => salvarCampo('status', e.target.value as Status)}
            className="!w-auto !border-none !shadow-none !bg-transparent !px-1"
          >
            <option value="a_fazer">A fazer</option>
            <option value="fazendo">Fazendo</option>
            <option value="adiado">Adiado</option>
          </Select>
        </div>
        <div className="flex items-center gap-3 py-1.5">
          <span className="w-24 shrink-0 text-[13px] text-gray-400 dark:text-gray-500">Data</span>
          {isAdmin ? (
            <input
              type="date"
              value={tarefa.prazo || ''}
              onChange={e => salvarCampo('prazo', e.target.value || null)}
              className="text-[13px] bg-transparent border-none outline-none text-gray-700 dark:text-gray-300"
            />
          ) : (
            <span className="text-[13px] text-gray-700 dark:text-gray-300">{tarefa.prazo || 'Vazio'}</span>
          )}
        </div>
        <div className="flex items-center gap-3 py-1.5">
          <span className="w-24 shrink-0 text-[13px] text-gray-400 dark:text-gray-500">Concluídos</span>
          <input
            type="checkbox"
            disabled={pendentes > 0}
            onChange={concluir}
            className="w-4 h-4 rounded accent-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
            title={pendentes > 0 ? `Conclua as ${pendentes} subtask(s) pendente(s)` : 'Concluir'}
          />
        </div>
        <div className="flex items-center gap-3 py-1.5">
          <span className="w-24 shrink-0 text-[13px] text-gray-400 dark:text-gray-500">Urgências</span>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${PRIO_DOT[tarefa.prioridade]}`} />
            <Select value={tarefa.prioridade} onChange={e => salvarCampo('prioridade', e.target.value as Prioridade)} className="!w-auto !border-none !shadow-none !bg-transparent !px-1">
              <option value="alta">Urgente</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3 py-1.5">
          <span className="w-24 shrink-0 text-[13px] text-gray-400 dark:text-gray-500">Recorrência</span>
          <Select value={tarefa.recorrencia} onChange={e => salvarCampo('recorrencia', e.target.value as Recorrencia)} className="!w-auto !border-none !shadow-none !bg-transparent !px-1">
            <option value="nenhuma">Sem recorrência</option>
            <option value="diaria">Diária</option>
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
          </Select>
        </div>
        <div className="flex items-start gap-3 py-1.5">
          <span className="w-24 shrink-0 text-[13px] text-gray-400 dark:text-gray-500 pt-1">Clientes</span>
          <div className="flex-1 min-w-0">
            <Select value="" onChange={e => { adicionarCliente(e.target.value); e.target.value = '' }} className="!w-auto !border-none !shadow-none !bg-transparent !px-1">
              <option value="">Adicionar cliente…</option>
              {clientes.filter(c => !selClientes.some(s => s.id === c.id)).map(c => (
                <option key={c.id} value={c.id}>{c.nome}{c.loja ? ` — ${c.loja}` : ''}</option>
              ))}
            </Select>
            {selClientes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {selClientes.map((c, idx) => (
                  <span key={c.id ?? idx} className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 pl-2 pr-1 py-1 text-xs text-amber-900">
                    {(c.numero || numeroDaLoja(c.loja)) && <span className="font-mono font-semibold text-amber-700">{c.numero || numeroDaLoja(c.loja)}</span>}
                    <span className="font-medium">{c.nome}</span>
                    {c.loja && <span className="text-amber-700/80">· {c.loja}</span>}
                    <button type="button" onClick={() => removerCliente(c.id)} className="ml-0.5 text-amber-500 hover:text-red-600 leading-none px-1">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 py-1.5 text-gray-300 dark:text-gray-700">
          <IconPlus className="w-3.5 h-3.5" />
          <span className="text-[13px]">Add a property</span>
        </div>
      </div>

      <ComentariosTarefa tarefaId={tarefa.id} />

      <div className="my-6 border-t border-gray-100 dark:border-gray-800" />

      <Textarea
        rows={2}
        value={descricao}
        onChange={e => setDescricao(e.target.value)}
        onBlur={() => { if (descricao !== tarefa.descricao) salvarCampo('descricao', descricao) }}
        placeholder="Adicionar descrição…"
        className="!border-none !shadow-none !px-0 !bg-transparent mb-5"
      />

      <div className="mb-6">
        <h4 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
          Subtasks{subtarefas.length > 0 && ` · ${subtarefas.length - pendentes}/${subtarefas.length}`}
        </h4>
        <div className="space-y-1 mb-2">
          {subtarefas.map(s => (
            <div key={s.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <button
                type="button"
                onClick={() => alternarSubtask(s)}
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${s.concluido ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}
              >
                {s.concluido && <IconCheck className="w-3 h-3" />}
              </button>
              <span className={`text-sm flex-1 ${s.concluido ? 'line-through text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'}`}>{s.titulo}</span>
              <button type="button" onClick={() => removerSubtask(s)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-opacity shrink-0">
                <IconTrash className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={adicionarSubtask} className="flex items-center gap-2 px-2">
          <IconPlus className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            value={novaSubtask}
            onChange={e => setNovaSubtask(e.target.value)}
            placeholder="Adicionar subtask…"
            className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-gray-400 text-gray-700 dark:text-gray-200 py-1"
          />
        </form>
      </div>

      <div className="flex items-center gap-3 mb-8">
        <Button onClick={concluir} disabled={pendentes > 0} title={pendentes > 0 ? `Conclua as ${pendentes} subtask(s) pendente(s)` : undefined}>
          Concluir tarefa
        </Button>
        <Button variant="secondary" onClick={excluir}>Excluir</Button>
      </div>
    </div>
  )
}
