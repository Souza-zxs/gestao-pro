'use client'

import { useEffect, useState } from 'react'
import { getAll, insert, update, remove } from '@/lib/store'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  PageHeader, Card, Metric, Modal, Field, Input, Textarea, Badge,
  EmptyState, AddButton, Button, RowActions, IconAction,
} from '@/components/ui'
import { IconNews, IconEdit, IconTrash } from '@/components/icons'

interface News { id: string; titulo: string; conteudo: string; publicado: boolean; criado_em: string }
type Filtro = 'todos' | 'publicado' | 'rascunho'

export default function NewsClient() {
  const [news, setNews] = useState<News[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<News | null>(null)
  const [form, setForm] = useState({ titulo: '', conteudo: '', publicado: false })
  const [filtro, setFiltro] = useState<Filtro>('todos')

  useEffect(() => { load() }, [])
  function load() { setNews(getAll<News>('news').sort((a, b) => b.criado_em.localeCompare(a.criado_em))) }

  function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (editando) update<News>('news', editando.id, form)
    else insert('news', { ...form, user_id: 'local' })
    setShowModal(false); setEditando(null); setForm({ titulo: '', conteudo: '', publicado: false }); load()
  }
  function excluir(id: string) { if (confirm('Excluir notícia?')) { remove('news', id); load() } }
  function togglePublicado(n: News) { update<News>('news', n.id, { publicado: !n.publicado }); load() }

  const filtrados = news.filter(n => filtro === 'todos' ? true : filtro === 'publicado' ? n.publicado : !n.publicado)
  const totalPublicados = news.filter(n => n.publicado).length
  const totalRascunhos = news.filter(n => !n.publicado).length

  const novo = () => { setEditando(null); setForm({ titulo: '', conteudo: '', publicado: false }); setShowModal(true) }

  return (
    <div>
      <PageHeader
        title="News"
        subtitle="Crie, publique e gerencie notícias e comunicados"
        action={<AddButton onClick={novo}>Nova Notícia</AddButton>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Metric label="Total" value={news.length.toString()} />
        <Metric label="Publicadas" value={totalPublicados.toString()} accent="text-green-600" />
        <Metric label="Rascunhos" value={totalRascunhos.toString()} accent="text-gray-500" />
      </div>

      <div className="flex gap-2 mb-4">
        {([['todos', 'Todas'], ['publicado', 'Publicadas'], ['rascunho', 'Rascunhos']] as [Filtro, string][]).map(([v, l]) => (
          <button key={v} onClick={() => setFiltro(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filtro === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}>{l}</button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <EmptyState
          icon={<IconNews className="w-6 h-6" />}
          title={news.length === 0 ? 'Nenhuma notícia cadastrada' : 'Nenhuma notícia neste filtro'}
          description={news.length === 0 ? 'Publique comunicados, novidades e avisos para sua equipe.' : undefined}
          action={news.length === 0 ? <AddButton onClick={novo}>Nova Notícia</AddButton> : undefined}
        />
      ) : (
        <div className="grid gap-4">
          {filtrados.map(n => (
            <Card key={n.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="font-semibold text-gray-900">{n.titulo}</h3>
                    <Badge color={n.publicado ? 'green' : 'gray'}>{n.publicado ? 'Publicado' : 'Rascunho'}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{n.conteudo}</p>
                  <p className="text-xs text-gray-400">{format(new Date(n.criado_em), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="secondary" className="!px-2.5 !py-1 !text-xs" onClick={() => togglePublicado(n)}>
                    {n.publicado ? 'Despublicar' : 'Publicar'}
                  </Button>
                  <RowActions>
                    <IconAction onClick={() => { setEditando(n); setForm({ titulo: n.titulo, conteudo: n.conteudo, publicado: n.publicado }); setShowModal(true) }} title="Editar" color="blue"><IconEdit className="w-4 h-4" /></IconAction>
                    <IconAction onClick={() => excluir(n.id)} title="Excluir" color="red"><IconTrash className="w-4 h-4" /></IconAction>
                  </RowActions>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editando ? 'Editar Notícia' : 'Nova Notícia'} size="lg">
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Título"><Input required value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} /></Field>
          <Field label="Conteúdo"><Textarea required rows={6} value={form.conteudo} onChange={e => setForm(p => ({ ...p, conteudo: e.target.value }))} /></Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.publicado} onChange={e => setForm(p => ({ ...p, publicado: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
            <span className="text-sm text-gray-700">Publicar imediatamente</span>
          </label>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
