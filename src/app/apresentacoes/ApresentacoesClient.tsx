'use client'

import { useEffect, useState } from 'react'
import { getAll, insert, update, remove } from '@/lib/store'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  PageHeader, Card, Metric, Modal, Field, Input, Select, Textarea, Badge,
  EmptyState, AddButton, Button, RowActions, IconAction,
} from '@/components/ui'
import { IconPresentation, IconEdit, IconTrash, IconClock, IconMapPin, IconCheck, IconBan } from '@/components/icons'

interface Apresentacao {
  id: string; titulo: string; descricao: string; data: string; local: string
  status: 'agendada' | 'realizada' | 'cancelada'; criado_em: string
}
type BadgeColor = 'blue' | 'green' | 'red'
const STATUS: Record<Apresentacao['status'], { color: BadgeColor; label: string }> = {
  agendada: { color: 'blue', label: 'Agendada' },
  realizada: { color: 'green', label: 'Realizada' },
  cancelada: { color: 'red', label: 'Cancelada' },
}

export default function ApresentacoesClient() {
  const [apresentacoes, setApresentacoes] = useState<Apresentacao[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Apresentacao | null>(null)
  const [form, setForm] = useState({ titulo: '', descricao: '', data: '', local: '', status: 'agendada' as Apresentacao['status'] })
  const [filtro, setFiltro] = useState<string>('todos')

  useEffect(() => { load() }, [])
  async function load() { setApresentacoes((await getAll<Apresentacao>('apresentacoes')).sort((a, b) => a.data.localeCompare(b.data))) }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (editando) await update<Apresentacao>('apresentacoes', editando.id, form)
    else await insert('apresentacoes', { ...form })
    setShowModal(false); setEditando(null); setForm({ titulo: '', descricao: '', data: '', local: '', status: 'agendada' }); await load()
  }
  async function excluir(id: string) { if (confirm('Excluir apresentação?')) { await remove('apresentacoes', id); await load() } }
  async function alterarStatus(a: Apresentacao, status: Apresentacao['status']) { await update<Apresentacao>('apresentacoes', a.id, { status }); await load() }

  const filtradas = apresentacoes.filter(a => filtro === 'todos' || a.status === filtro)
  const agendadas = apresentacoes.filter(a => a.status === 'agendada').length
  const realizadas = apresentacoes.filter(a => a.status === 'realizada').length
  const canceladas = apresentacoes.filter(a => a.status === 'cancelada').length

  const novo = () => { setEditando(null); setForm({ titulo: '', descricao: '', data: '', local: '', status: 'agendada' }); setShowModal(true) }

  return (
    <div>
      <PageHeader
        title="Apresentações"
        subtitle="Planeje e acompanhe shows, palestras e eventos"
        action={<AddButton onClick={novo}>Nova Apresentação</AddButton>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Metric label="Agendadas" value={agendadas.toString()} accent="text-blue-600" />
        <Metric label="Realizadas" value={realizadas.toString()} accent="text-green-600" />
        <Metric label="Canceladas" value={canceladas.toString()} accent="text-red-600" />
      </div>

      <div className="flex gap-2 mb-4">
        {[['todos', 'Todas'], ['agendada', 'Agendadas'], ['realizada', 'Realizadas'], ['cancelada', 'Canceladas']].map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filtro === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}>{l}</button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          icon={<IconPresentation className="w-6 h-6" />}
          title={apresentacoes.length === 0 ? 'Nenhuma apresentação cadastrada' : 'Nenhuma apresentação neste filtro'}
          description={apresentacoes.length === 0 ? 'Cadastre apresentações com data, local e status.' : undefined}
          action={apresentacoes.length === 0 ? <AddButton onClick={novo}>Nova Apresentação</AddButton> : undefined}
        />
      ) : (
        <div className="grid gap-4">
          {filtradas.map(a => {
            const st = STATUS[a.status]
            return (
              <Card key={a.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-semibold text-gray-900">{a.titulo}</h3>
                      <Badge color={st.color}>{st.label}</Badge>
                    </div>
                    {a.descricao && <p className="text-sm text-gray-600 mb-2">{a.descricao}</p>}
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      {a.data && <span className="flex items-center gap-1"><IconClock className="w-3.5 h-3.5" />{format(parseISO(a.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>}
                      {a.local && <span className="flex items-center gap-1"><IconMapPin className="w-3.5 h-3.5" />{a.local}</span>}
                    </div>
                    {a.status === 'agendada' && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => alterarStatus(a, 'realizada')} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors"><IconCheck className="w-3.5 h-3.5" /> Realizada</button>
                        <button onClick={() => alterarStatus(a, 'cancelada')} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"><IconBan className="w-3.5 h-3.5" /> Cancelar</button>
                      </div>
                    )}
                  </div>
                  <RowActions>
                    <IconAction onClick={() => { setEditando(a); setForm({ titulo: a.titulo, descricao: a.descricao, data: a.data, local: a.local, status: a.status }); setShowModal(true) }} title="Editar" color="blue"><IconEdit className="w-4 h-4" /></IconAction>
                    <IconAction onClick={() => excluir(a.id)} title="Excluir" color="red"><IconTrash className="w-4 h-4" /></IconAction>
                  </RowActions>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={`${editando ? 'Editar' : 'Nova'} Apresentação`} size="lg">
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Título"><Input required value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} /></Field>
          <Field label="Descrição"><Textarea rows={3} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data"><Input type="date" required value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} /></Field>
            <Field label="Status">
              <Select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Apresentacao['status'] }))}>
                <option value="agendada">Agendada</option><option value="realizada">Realizada</option><option value="cancelada">Cancelada</option>
              </Select>
            </Field>
          </div>
          <Field label="Local"><Input value={form.local} onChange={e => setForm(p => ({ ...p, local: e.target.value }))} placeholder="Ex: Teatro Municipal, Online..." /></Field>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
