'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAll, insert, update, remove } from '@/lib/store'
import { useAuth } from '@/lib/auth'
import {
  format, parseISO, isValid, isBefore, isAfter, startOfDay,
  addDays, addWeeks, addMonths,
} from 'date-fns'
import type { Tarefa, Membro } from '@/lib/types'
import {
  PageHeader, Metric, Modal, Field, Input, Select, Textarea, Badge,
  EmptyState, AddButton, Button, IconAction, RowActions,
} from '@/components/ui'
import { IconClipboard, IconEdit, IconTrash, IconUsers, IconCheck, IconPlus } from '@/components/icons'

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
const REC_LABEL: Record<Recorrencia, string> = {
  nenhuma: 'Sem recorrência', diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal',
}

const FORM_INICIAL = {
  titulo: '', descricao: '', responsavel_nome: '', responsavel_email: '',
  prioridade: 'media' as Prioridade, status: 'a_fazer' as Status,
  recorrencia: 'nenhuma' as Recorrencia, prazo: '',
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

// Tarefa visível no quadro: não concluída e, se recorrente, já "vencida" (prazo <= hoje).
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
  const [showModal, setShowModal] = useState(false)
  const [editTarefa, setEditTarefa] = useState<Tarefa | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [filtroResp, setFiltroResp] = useState('todos')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<Status | null>(null)

  const [showEquipe, setShowEquipe] = useState(false)
  const [formMembro, setFormMembro] = useState({ nome: '', email: '' })

  useEffect(() => { load() }, [])
  async function load() {
    const [ts, ms] = await Promise.all([
      getAll<Tarefa>('tarefas', { order: { column: 'criado_em', ascending: false } }),
      getAll<Membro>('membros', { order: { column: 'nome', ascending: true } }).catch(() => [] as Membro[]),
    ])
    setTarefas(ts); setMembros(ms)
  }

  // Opções de responsável: você + membros cadastrados (sem repetir e-mail).
  const opcoesResp = useMemo(() => {
    const base = [{ nome: `${name} (você)`, email }, ...membros.map(m => ({ nome: m.nome, email: m.email }))]
    const vistos = new Set<string>()
    return base.filter(o => o.email && !vistos.has(o.email) && vistos.add(o.email))
  }, [membros, name, email])

  const responsaveis = useMemo(
    () => [...new Map(tarefas.filter(t => t.responsavel_email).map(t => [t.responsavel_email, t.responsavel_nome || t.responsavel_email])).entries()],
    [tarefas],
  )
  const visiveis = tarefas.filter(t => ativa(t) && (filtroResp === 'todos' || t.responsavel_email === filtroResp))

  const set = (campo: keyof typeof FORM_INICIAL, valor: string) => setForm(p => ({ ...p, [campo]: valor }))

  function novo() {
    setEditTarefa(null)
    setForm({ ...FORM_INICIAL, responsavel_nome: name, responsavel_email: email })
    setShowModal(true)
  }
  function editar(t: Tarefa) {
    setEditTarefa(t)
    setForm({
      titulo: t.titulo, descricao: t.descricao,
      responsavel_nome: t.responsavel_nome, responsavel_email: t.responsavel_email,
      prioridade: t.prioridade, status: t.status, recorrencia: t.recorrencia, prazo: t.prazo || '',
    })
    setShowModal(true)
  }
  function fechar() { setShowModal(false); setEditTarefa(null); setForm(FORM_INICIAL) }

  // Admin escolhe o responsável pela lista; isso preenche nome + e-mail juntos.
  function escolherResp(mail: string) {
    const o = opcoesResp.find(x => x.email === mail)
    setForm(p => ({ ...p, responsavel_email: mail, responsavel_nome: o?.nome.replace(' (você)', '') || '' }))
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      titulo: form.titulo, descricao: form.descricao,
      responsavel_nome: form.responsavel_nome, responsavel_email: form.responsavel_email.trim().toLowerCase(),
      prioridade: form.prioridade, status: form.status, recorrencia: form.recorrencia, prazo: form.prazo || null,
    }
    if (editTarefa) await update<Tarefa>('tarefas', editTarefa.id, payload)
    else await insert('tarefas', payload)
    fechar(); await load()
  }
  async function excluir(t: Tarefa) { if (confirm('Excluir tarefa?')) { await remove('tarefas', t.id); await load() } }

  // Concluir: tarefa some do quadro. Se for recorrente, reaparece no próximo período.
  async function concluir(t: Tarefa) {
    if (t.recorrencia === 'nenhuma') {
      await update<Tarefa>('tarefas', t.id, { status: 'concluida' })
    } else {
      await update<Tarefa>('tarefas', t.id, { status: 'a_fazer', prazo: proximaData(t.recorrencia) })
    }
    await load()
  }

  async function moverStatus(id: string, status: Status) {
    const t = tarefas.find(x => x.id === id)
    if (!t || t.status === status) return
    setTarefas(prev => prev.map(x => x.id === id ? { ...x, status } : x))
    await update<Tarefa>('tarefas', id, { status })
    await load()
  }
  function onDrop(status: Status) {
    if (dragId) moverStatus(dragId, status)
    setDragId(null); setOverCol(null)
  }

  /* ---------- Equipe (admin) ---------- */
  async function addMembro(e: React.FormEvent) {
    e.preventDefault()
    await insert('membros', { nome: formMembro.nome, email: formMembro.email.trim().toLowerCase() })
    setFormMembro({ nome: '', email: '' }); await load()
  }
  async function removerMembro(id: string) { await remove('membros', id); await load() }

  const totalAtivas = tarefas.filter(ativa).length
  const porStatus = (s: Status) => tarefas.filter(t => ativa(t) && t.status === s).length
  const recorrentes = tarefas.filter(t => t.recorrencia !== 'nenhuma').length

  return (
    <div>
      <PageHeader
        title="Tarefas"
        subtitle={isAdmin ? 'Quadro de tarefas da equipe' : 'Suas tarefas'}
        action={
          <div className="flex items-center gap-2">
            {isAdmin && <Button variant="secondary" icon={<IconUsers className="w-4 h-4" />} onClick={() => setShowEquipe(true)}>Equipe</Button>}
            <AddButton onClick={novo}>Nova Tarefa</AddButton>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Metric label="Pendentes" value={totalAtivas.toString()} icon={<IconClipboard className="w-6 h-6" />} />
        <Metric label="A fazer" value={porStatus('a_fazer').toString()} accent="text-gray-700" />
        <Metric label="Fazendo" value={porStatus('fazendo').toString()} accent="text-blue-600" />
        <Metric label="Recorrentes" value={recorrentes.toString()} accent="text-violet-600" />
      </div>

      {isAdmin && responsaveis.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <Select value={filtroResp} onChange={e => setFiltroResp(e.target.value)} className="!w-auto">
            <option value="todos">Todos os responsáveis</option>
            {responsaveis.map(([mail, nome]) => <option key={mail} value={mail}>{nome}</option>)}
          </Select>
        </div>
      )}

      {totalAtivas === 0 ? (
        <EmptyState
          icon={<IconClipboard className="w-6 h-6" />}
          title="Nenhuma tarefa pendente"
          description={isAdmin ? 'Crie tarefas e atribua aos colaboradores da equipe.' : 'Você não tem tarefas pendentes.'}
          action={<AddButton onClick={novo}>Nova Tarefa</AddButton>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
          {COLUNAS.map(col => {
            const cards = visiveis.filter(t => t.status === col.key)
            const ativo = overCol === col.key
            return (
              <div
                key={col.key}
                onDragOver={e => { e.preventDefault(); if (overCol !== col.key) setOverCol(col.key) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(c => c === col.key ? null : c) }}
                onDrop={() => onDrop(col.key)}
                className={`rounded-xl border transition-colors ${ativo ? 'border-blue-300 bg-blue-50/50 ring-2 ring-blue-200' : 'border-gray-200 bg-gray-50/70'}`}
              >
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200/70">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                  <span className="text-xs font-medium text-gray-400">{cards.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[120px]">
                  {cards.map(t => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null) }}
                      onDoubleClick={() => editar(t)}
                      title="Arraste para mudar o status · duplo clique para editar"
                      className={`group bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-gray-300 hover:shadow ${dragId === t.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 leading-snug">{t.titulo}</p>
                        <Badge color={PRIO[t.prioridade].color}>{PRIO[t.prioridade].label}</Badge>
                      </div>
                      {t.descricao && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.descricao}</p>}
                      <div className="flex items-center gap-1.5 mt-2">
                        {t.recorrencia !== 'nenhuma' && <Badge color="blue">{REC_LABEL[t.recorrencia]}</Badge>}
                        {t.prazo && <span className={`text-xs ${atrasada(t) ? 'text-red-600 font-medium' : 'text-gray-400'}`}>{fmtData(t.prazo)}</span>}
                      </div>
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-50">
                        <span className="text-xs text-gray-500 truncate max-w-[50%]">{t.responsavel_nome || t.responsavel_email || '—'}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => concluir(t)} title="Concluir" className="flex items-center gap-1 text-xs px-2 py-0.5 rounded text-green-700 bg-green-50 hover:bg-green-100 transition-colors"><IconCheck className="w-3.5 h-3.5" /> Concluir</button>
                          <button onClick={() => editar(t)} title="Editar" className="p-1 text-gray-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"><IconEdit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => excluir(t)} title="Excluir" className="p-1 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><IconTrash className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && <p className="text-xs text-gray-300 text-center py-6 select-none">Solte aqui</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Tarefa */}
      <Modal open={showModal} onClose={fechar} title={editTarefa ? 'Editar Tarefa' : 'Nova Tarefa'} size="lg">
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Título"><Input required value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="O que precisa ser feito" /></Field>
          <Field label="Descrição"><Textarea rows={2} value={form.descricao} onChange={e => set('descricao', e.target.value)} /></Field>
          <Field label="Responsável">
            {isAdmin ? (
              <Select value={form.responsavel_email} onChange={e => escolherResp(e.target.value)}>
                {opcoesResp.map(o => <option key={o.email} value={o.email}>{o.nome}</option>)}
              </Select>
            ) : (
              <Input value={form.responsavel_nome || name} disabled />
            )}
          </Field>
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
            <Field label="Prazo"><Input type="date" value={form.prazo} onChange={e => set('prazo', e.target.value)} /></Field>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={fechar}>Cancelar</Button>
            <Button type="submit" className="flex-1">{editTarefa ? 'Salvar' : 'Criar'}</Button>
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
    </div>
  )
}
