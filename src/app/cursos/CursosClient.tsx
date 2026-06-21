'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getAll, insert, update, remove } from '@/lib/store'
import { uploadCapa } from '@/lib/storage'
import { useAuth } from '@/lib/auth'
import { brl, minutosParaTexto } from '@/lib/format'
import { portalUrl } from '@/lib/subdomain'
import type { Curso, Modulo, Aula, Pedido } from '@/lib/types'
import {
  PageHeader, Card, Tabs, Metric, Modal, Field, Input, Select, Textarea, Badge,
  EmptyState, Th, AddButton, Button, RowActions, IconAction,
} from '@/components/ui'
import { IconBook, IconEdit, IconTrash, IconLink, IconCart, IconPlus, IconUpload } from '@/components/icons'

const NIVEIS = ['Iniciante', 'Intermediário', 'Avançado']

const METODO_LABEL: Record<Pedido['metodo'], string> = { pix: 'PIX', cartao: 'Cartão', boleto: 'Boleto' }
const STATUS_BADGE: Record<Pedido['status'], 'green' | 'amber' | 'red' | 'gray'> = {
  pago: 'green', pendente: 'amber', falhou: 'red', cancelado: 'gray',
}
const STATUS_LABEL: Record<Pedido['status'], string> = {
  pago: 'Pago', pendente: 'Pendente', falhou: 'Falhou', cancelado: 'Cancelado',
}

const emptyCurso = {
  titulo: '', subtitulo: '', descricao: '', preco: '', categoria: '', capa: '',
  nivel: '', carga_horaria: '', aprendizado: '', requisitos: '', publicado: false,
}

export default function CursosClient() {
  const { email, name, role } = useAuth()
  const isAdmin = role === 'admin'

  const [aba, setAba] = useState<'cursos' | 'conteudo' | 'pedidos'>('cursos')
  const [cursos, setCursos] = useState<Curso[]>([])
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [aulas, setAulas] = useState<Aula[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])

  const [cursoSel, setCursoSel] = useState('')
  const [showCursoModal, setShowCursoModal] = useState(false)
  const [editCurso, setEditCurso] = useState<Curso | null>(null)
  const [formCurso, setFormCurso] = useState(emptyCurso)
  const [enviandoCapa, setEnviandoCapa] = useState(false)
  const capaInputRef = useRef<HTMLInputElement>(null)

  const [showModuloModal, setShowModuloModal] = useState(false)
  const [formModulo, setFormModulo] = useState('')

  const [showAulaModal, setShowAulaModal] = useState(false)
  const [aulaModuloId, setAulaModuloId] = useState('')
  const [editAula, setEditAula] = useState<Aula | null>(null)
  const [formAula, setFormAula] = useState({ titulo: '', video_url: '', duracao_min: '' })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [cs, ms, as, ps] = await Promise.all([
      getAll<Curso>('cursos'),
      getAll<Modulo>('modulos'),
      getAll<Aula>('aulas'),
      getAll<Pedido>('pedidos'),
    ])
    setCursos(cs); setModulos(ms); setAulas(as); setPedidos(ps)
  }

  // Tenant único: toda a equipe vê e gerencia os cursos (a RLS garante no banco).
  const cursosVisiveis = cursos
  const idsVisiveis = useMemo(() => new Set(cursos.map(c => c.id)), [cursos])
  const pedidosVisiveis = pedidos.filter(p => idsVisiveis.has(p.curso_id))
  const receita = pedidosVisiveis.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0)

  const cursoAtual = cursosVisiveis.find(c => c.id === cursoSel) || cursosVisiveis[0]
  const modulosDoCurso = cursoAtual
    ? modulos.filter(m => m.curso_id === cursoAtual.id).sort((a, b) => a.ordem - b.ordem)
    : []

  /* ---------- Curso ---------- */
  function abrirNovoCurso() {
    setEditCurso(null); setFormCurso(emptyCurso); setShowCursoModal(true)
  }
  function abrirEditarCurso(c: Curso) {
    setEditCurso(c)
    setFormCurso({
      titulo: c.titulo, subtitulo: c.subtitulo || '', descricao: c.descricao,
      preco: String(c.preco), categoria: c.categoria || '', capa: c.capa || '',
      nivel: c.nivel || '', carga_horaria: c.carga_horaria ? String(c.carga_horaria) : '',
      aprendizado: c.aprendizado || '', requisitos: c.requisitos || '', publicado: c.publicado,
    })
    setShowCursoModal(true)
  }
  async function enviarCapa(file: File) {
    setEnviandoCapa(true)
    try {
      const url = await uploadCapa(file)
      setFormCurso(p => ({ ...p, capa: url }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao enviar a capa.')
    } finally {
      setEnviandoCapa(false)
      if (capaInputRef.current) capaInputRef.current.value = ''
    }
  }
  async function salvarCurso(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      titulo: formCurso.titulo,
      subtitulo: formCurso.subtitulo,
      descricao: formCurso.descricao,
      preco: parseFloat(formCurso.preco) || 0,
      categoria: formCurso.categoria,
      capa: formCurso.capa,
      nivel: formCurso.nivel,
      carga_horaria: parseInt(formCurso.carga_horaria) || 0,
      aprendizado: formCurso.aprendizado,
      requisitos: formCurso.requisitos,
      publicado: formCurso.publicado,
    }
    if (editCurso) {
      await update<Curso>('cursos', editCurso.id, payload)
    } else {
      await insert<Omit<Curso, 'id' | 'criado_em'>>('cursos', {
        ...payload,
        instrutor_id: email,
        instrutor_nome: name,
      })
    }
    setShowCursoModal(false); setEditCurso(null); setFormCurso(emptyCurso); await loadAll()
  }
  async function togglePublicar(c: Curso) { await update<Curso>('cursos', c.id, { publicado: !c.publicado }); await loadAll() }
  async function excluirCurso(c: Curso) {
    if (!confirm(`Excluir o curso "${c.titulo}" e todo o seu conteúdo?`)) return
    // Módulos e aulas somem por ON DELETE CASCADE no banco.
    await remove('cursos', c.id)
    await loadAll()
  }

  /* ---------- Módulo ---------- */
  async function salvarModulo(e: React.FormEvent) {
    e.preventDefault()
    if (!cursoAtual) return
    await insert<Omit<Modulo, 'id' | 'criado_em'>>('modulos', {
      curso_id: cursoAtual.id, titulo: formModulo, ordem: modulosDoCurso.length,
    })
    setShowModuloModal(false); setFormModulo(''); await loadAll()
  }
  async function excluirModulo(m: Modulo) {
    if (!confirm(`Excluir o módulo "${m.titulo}" e suas aulas?`)) return
    // Aulas do módulo somem por ON DELETE CASCADE no banco.
    await remove('modulos', m.id); await loadAll()
  }

  /* ---------- Aula ---------- */
  function abrirNovaAula(moduloId: string) {
    setEditAula(null); setAulaModuloId(moduloId)
    setFormAula({ titulo: '', video_url: '', duracao_min: '' }); setShowAulaModal(true)
  }
  function abrirEditarAula(a: Aula) {
    setEditAula(a); setAulaModuloId(a.modulo_id)
    setFormAula({ titulo: a.titulo, video_url: a.video_url || '', duracao_min: a.duracao_min ? String(a.duracao_min) : '' })
    setShowAulaModal(true)
  }
  async function salvarAula(e: React.FormEvent) {
    e.preventDefault()
    if (!cursoAtual) return
    const aulasDoMod = aulas.filter(a => a.modulo_id === aulaModuloId)
    const payload = {
      titulo: formAula.titulo,
      video_url: formAula.video_url,
      duracao_min: parseInt(formAula.duracao_min) || 0,
    }
    if (editAula) {
      await update<Aula>('aulas', editAula.id, payload)
    } else {
      await insert<Omit<Aula, 'id' | 'criado_em'>>('aulas', {
        ...payload, modulo_id: aulaModuloId, curso_id: cursoAtual.id, ordem: aulasDoMod.length,
      })
    }
    setShowAulaModal(false); setEditAula(null); await loadAll()
  }
  async function excluirAula(a: Aula) { if (confirm('Excluir aula?')) { await remove('aulas', a.id); await loadAll() } }

  function totalAulasCurso(cursoId: string) { return aulas.filter(a => a.curso_id === cursoId).length }

  return (
    <div>
      <PageHeader
        title="Cursos"
        subtitle="Crie cursos, organize o conteúdo e acompanhe as vendas"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<IconLink className="w-4 h-4" />} onClick={() => window.open(portalUrl('/'), '_blank')}>
              Ver portal
            </Button>
            {aba === 'cursos' && <AddButton onClick={abrirNovoCurso}>Novo Curso</AddButton>}
          </div>
        }
      />

      <Tabs active={aba} onChange={setAba} tabs={[
        { value: 'cursos', label: 'Cursos' },
        { value: 'conteudo', label: 'Conteúdo' },
        { value: 'pedidos', label: 'Pedidos' },
      ]} />

      {/* CURSOS */}
      {aba === 'cursos' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Metric label="Cursos" value={cursosVisiveis.length.toString()} icon={<IconBook className="w-6 h-6" />} />
            <Metric label="Publicados" value={cursosVisiveis.filter(c => c.publicado).length.toString()} accent="text-green-600" />
            <Metric label="Vendas Pagas" value={pedidosVisiveis.filter(p => p.status === 'pago').length.toString()} />
            <Metric label="Receita" value={brl(receita)} accent="text-blue-600" />
          </div>

          {cursosVisiveis.length === 0 ? (
            <EmptyState icon={<IconBook className="w-6 h-6" />} title="Nenhum curso criado" description="Crie seu primeiro curso para começar a vender no portal." action={<AddButton onClick={abrirNovoCurso}>Novo Curso</AddButton>} />
          ) : (
            <Card padded={false} className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr><Th>Curso</Th><Th>Categoria</Th><Th>Aulas</Th><Th>Preço</Th><Th>Status</Th><Th className="text-right">Ações</Th></tr>
                  </thead>
                  <tbody>
                    {cursosVisiveis.map((c, i, arr) => (
                      <tr key={c.id} className={i < arr.length - 1 ? 'border-b border-gray-50' : ''}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{c.titulo}</p>
                          {!isAdmin ? null : <p className="text-xs text-gray-400">{c.instrutor_nome || c.instrutor_id}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{c.categoria || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{totalAulasCurso(c.id)}</td>
                        <td className="px-4 py-3 text-gray-700">{brl(c.preco)}</td>
                        <td className="px-4 py-3"><Badge color={c.publicado ? 'green' : 'gray'}>{c.publicado ? 'Publicado' : 'Rascunho'}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button variant="secondary" className="!px-2.5 !py-1 !text-xs" onClick={() => { setCursoSel(c.id); setAba('conteudo') }}>Conteúdo</Button>
                            <Button variant="secondary" className="!px-2.5 !py-1 !text-xs" onClick={() => togglePublicar(c)}>{c.publicado ? 'Despublicar' : 'Publicar'}</Button>
                            <IconAction onClick={() => abrirEditarCurso(c)} title="Editar" color="blue"><IconEdit className="w-4 h-4" /></IconAction>
                            <IconAction onClick={() => excluirCurso(c)} title="Excluir" color="red"><IconTrash className="w-4 h-4" /></IconAction>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* CONTEÚDO */}
      {aba === 'conteudo' && (
        cursosVisiveis.length === 0 ? (
          <EmptyState icon={<IconBook className="w-6 h-6" />} title="Crie um curso primeiro" description="Você precisa de um curso para adicionar módulos e aulas." />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={cursoAtual?.id || ''} onChange={e => setCursoSel(e.target.value)} className="!w-auto">
                {cursosVisiveis.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </Select>
              <AddButton onClick={() => setShowModuloModal(true)}>Novo Módulo</AddButton>
            </div>

            {modulosDoCurso.length === 0 ? (
              <EmptyState icon={<IconBook className="w-6 h-6" />} title="Nenhum módulo" description="Adicione módulos e, dentro deles, as aulas do curso." action={<AddButton onClick={() => setShowModuloModal(true)}>Novo Módulo</AddButton>} />
            ) : (
              modulosDoCurso.map((m, idx) => {
                const aulasMod = aulas.filter(a => a.modulo_id === m.id).sort((a, b) => a.ordem - b.ordem)
                return (
                  <Card key={m.id}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">
                        <span className="text-gray-400 mr-2">Módulo {idx + 1}</span>{m.titulo}
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <Button variant="secondary" className="!px-2.5 !py-1 !text-xs" icon={<IconPlus className="w-3.5 h-3.5" />} onClick={() => abrirNovaAula(m.id)}>Aula</Button>
                        <IconAction onClick={() => excluirModulo(m)} title="Excluir módulo" color="red"><IconTrash className="w-4 h-4" /></IconAction>
                      </div>
                    </div>
                    {aulasMod.length === 0 ? (
                      <p className="text-sm text-gray-400">Nenhuma aula neste módulo.</p>
                    ) : (
                      <ul className="divide-y divide-gray-50">
                        {aulasMod.map(a => (
                          <li key={a.id} className="flex items-center justify-between py-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{a.titulo}</p>
                              <p className="text-xs text-gray-400">{minutosParaTexto(a.duracao_min)}{a.video_url ? ' · com vídeo' : ''}</p>
                            </div>
                            <RowActions>
                              <IconAction onClick={() => abrirEditarAula(a)} title="Editar" color="blue"><IconEdit className="w-4 h-4" /></IconAction>
                              <IconAction onClick={() => excluirAula(a)} title="Excluir" color="red"><IconTrash className="w-4 h-4" /></IconAction>
                            </RowActions>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                )
              })
            )}
          </div>
        )
      )}

      {/* PEDIDOS */}
      {aba === 'pedidos' && (
        pedidosVisiveis.length === 0 ? (
          <EmptyState icon={<IconCart className="w-6 h-6" />} title="Nenhum pedido ainda" description="As compras feitas no portal de cursos aparecem aqui." />
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr><Th>Curso</Th><Th>Comprador</Th><Th>Método</Th><Th>Valor</Th><Th>Status</Th></tr>
                </thead>
                <tbody>
                  {pedidosVisiveis.slice().reverse().map((p, i, arr) => (
                    <tr key={p.id} className={i < arr.length - 1 ? 'border-b border-gray-50' : ''}>
                      <td className="px-4 py-3 font-medium text-gray-900">{p.curso_titulo}</td>
                      <td className="px-4 py-3 text-gray-500">
                        <p className="text-gray-800">{p.comprador_nome}</p>
                        <p className="text-xs text-gray-400">{p.comprador_email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{METODO_LABEL[p.metodo]}</td>
                      <td className="px-4 py-3 text-gray-700">{brl(p.valor)}</td>
                      <td className="px-4 py-3"><Badge color={STATUS_BADGE[p.status]}>{STATUS_LABEL[p.status]}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {/* Modal Curso */}
      <Modal open={showCursoModal} onClose={() => { setShowCursoModal(false); setEditCurso(null) }} title={editCurso ? 'Editar Curso' : 'Novo Curso'} size="xl">
        <form onSubmit={salvarCurso} className="space-y-6">
          {/* Dados do curso */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Dados do curso</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Título"><Input required value={formCurso.titulo} onChange={e => setFormCurso(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: React do Zero ao Pro" /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Subtítulo" hint="Uma frase curta de destaque"><Input value={formCurso.subtitulo} onChange={e => setFormCurso(p => ({ ...p, subtitulo: e.target.value }))} placeholder="Domine React criando projetos reais" /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Descrição"><Textarea rows={3} value={formCurso.descricao} onChange={e => setFormCurso(p => ({ ...p, descricao: e.target.value }))} placeholder="Sobre o que é o curso..." /></Field>
              </div>
              <Field label="Categoria"><Input value={formCurso.categoria} onChange={e => setFormCurso(p => ({ ...p, categoria: e.target.value }))} placeholder="Ex: Programação" /></Field>
              <Field label="Nível">
                <Select value={formCurso.nivel} onChange={e => setFormCurso(p => ({ ...p, nivel: e.target.value }))}>
                  <option value="">—</option>
                  {NIVEIS.map(n => <option key={n} value={n}>{n}</option>)}
                </Select>
              </Field>
              <Field label="Preço (R$)"><Input type="number" min="0" step="0.01" required value={formCurso.preco} onChange={e => setFormCurso(p => ({ ...p, preco: e.target.value }))} placeholder="297.00" /></Field>
              <Field label="Carga horária (h)"><Input type="number" min="0" value={formCurso.carga_horaria} onChange={e => setFormCurso(p => ({ ...p, carga_horaria: e.target.value }))} placeholder="12" /></Field>
            </div>
          </section>

          {/* Capa */}
          <section className="pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Capa</p>
            <input ref={capaInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && enviarCapa(e.target.files[0])} />
            <div className="flex items-center gap-4">
              <div className="w-32 h-20 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                {formCurso.capa
                  ? <img src={formCurso.capa} alt="Capa" className="w-full h-full object-cover" />
                  : <IconBook className="w-6 h-6 text-gray-300" />}
              </div>
              <div className="flex flex-col gap-2">
                <Button type="button" variant="secondary" icon={<IconUpload className="w-4 h-4" />} disabled={enviandoCapa} onClick={() => capaInputRef.current?.click()}>
                  {enviandoCapa ? 'Enviando…' : formCurso.capa ? 'Trocar imagem' : 'Enviar imagem'}
                </Button>
                {formCurso.capa && (
                  <button type="button" onClick={() => setFormCurso(p => ({ ...p, capa: '' }))} className="text-xs text-red-600 hover:text-red-700 text-left">Remover capa</button>
                )}
                <p className="text-xs text-gray-400">Exibida no catálogo do portal.</p>
              </div>
            </div>
          </section>

          {/* Detalhes */}
          <section className="pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Detalhes</p>
            <div className="space-y-4">
              <Field label="O que o aluno vai aprender" hint="Um item por linha"><Textarea rows={3} value={formCurso.aprendizado} onChange={e => setFormCurso(p => ({ ...p, aprendizado: e.target.value }))} placeholder={'Criar componentes\nGerenciar estado\nConsumir APIs'} /></Field>
              <Field label="Requisitos" hint="Um item por linha"><Textarea rows={2} value={formCurso.requisitos} onChange={e => setFormCurso(p => ({ ...p, requisitos: e.target.value }))} placeholder={'Lógica de programação\nNoções de HTML/CSS'} /></Field>
            </div>
          </section>

          {/* Publicação */}
          <section className="pt-5 border-t border-gray-100">
            <Field label="Publicação">
              <div className="flex gap-2">
                <button type="button" onClick={() => setFormCurso(p => ({ ...p, publicado: true }))}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${formCurso.publicado ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>Publicado no portal</button>
                <button type="button" onClick={() => setFormCurso(p => ({ ...p, publicado: false }))}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${!formCurso.publicado ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>Rascunho</button>
              </div>
            </Field>
          </section>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => { setShowCursoModal(false); setEditCurso(null) }}>Cancelar</Button>
            <Button type="submit" className="flex-1">{editCurso ? 'Salvar alterações' : 'Criar curso'}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Módulo */}
      <Modal open={showModuloModal} onClose={() => setShowModuloModal(false)} title="Novo Módulo" size="sm">
        <form onSubmit={salvarModulo} className="space-y-4">
          <Field label="Título do Módulo"><Input required value={formModulo} onChange={e => setFormModulo(e.target.value)} placeholder="Ex: Introdução" /></Field>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModuloModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1">Criar</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Aula */}
      <Modal open={showAulaModal} onClose={() => { setShowAulaModal(false); setEditAula(null) }} title={editAula ? 'Editar Aula' : 'Nova Aula'}>
        <form onSubmit={salvarAula} className="space-y-4">
          <Field label="Título"><Input required value={formAula.titulo} onChange={e => setFormAula(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Configurando o ambiente" /></Field>
          <Field label="URL do vídeo" hint="YouTube, Vimeo ou link direto"><Input value={formAula.video_url} onChange={e => setFormAula(p => ({ ...p, video_url: e.target.value }))} placeholder="https://..." /></Field>
          <Field label="Duração (min)"><Input type="number" min="0" value={formAula.duracao_min} onChange={e => setFormAula(p => ({ ...p, duracao_min: e.target.value }))} placeholder="12" /></Field>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => { setShowAulaModal(false); setEditAula(null) }}>Cancelar</Button>
            <Button type="submit" className="flex-1">{editAula ? 'Salvar' : 'Adicionar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
