'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getAll, insert, update, remove } from '@/lib/store'
import { uploadFotoAnuncio } from '@/lib/storage'
import { useAuth } from '@/lib/auth'
import { format, parseISO, isValid } from 'date-fns'
import type { Anuncio, AnuncioStatus, AnuncioColuna, Cliente } from '@/lib/types'
import { corAvatar, iniciais } from '../tarefas/avatar'
import {
  PageHeader, Metric, Modal, Field, Input, Select,
  EmptyState, AddButton, Button,
} from '@/components/ui'
import {
  IconMegaphone, IconEdit, IconTrash, IconCheck, IconChevronRight, IconUpload, IconClose, IconPlus, IconCopy,
} from '@/components/icons'

type Prioridade = Anuncio['prioridade']

// Cor do "dot" de cada coluna — ciclada pela posição (colunas são dinâmicas,
// admin pode criar novas, então não dá pra fixar cor por chave conhecida).
const DOT_CORES = [
  'bg-gray-400', 'bg-sky-400', 'bg-blue-500', 'bg-blue-700', 'bg-indigo-900 dark:bg-indigo-500',
  'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-fuchsia-500', 'bg-cyan-500',
]

// Gera uma chave (slug) estável a partir do rótulo digitado pelo admin,
// garantindo que não colida com uma chave já existente.
function slugColuna(label: string, existentes: Set<string>): string {
  const base = label
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'coluna'
  if (!existentes.has(base)) return base
  let i = 2
  while (existentes.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

const PRIO: Record<Prioridade, { label: string; color: 'red' | 'amber' | 'gray' }> = {
  alta: { label: 'Alta', color: 'red' },
  media: { label: 'Média', color: 'amber' },
  baixa: { label: 'Baixa', color: 'gray' },
}
const PRIO_DOT: Record<Prioridade, string> = {
  alta: 'bg-red-500', media: 'bg-amber-500', baixa: 'bg-gray-300 dark:bg-gray-600',
}

const FORM_INICIAL = {
  cliente_id: '', nome_produto: '', status: 'imagens_a_fazer' as AnuncioStatus, prioridade: 'media' as Prioridade,
  capa: '', quebra_objecao: '', imagens_secundarias: '', foto_url: '',
  metodo_anuncio: '', drive_produto: '', data: '', data_entrega: '',
  margem_ranqueamento: '', margem_final_esperada: '', venda_fake_realizada: false,
  id_anuncio: '', anuncio: '', data_alteracao_preco: '', meta_vendas_subir_preco: '',
  margem_final_realizada: '',
}

function mensagemErro(err: unknown): string {
  const e = err as { message?: string; code?: string }
  if (/apenas admin pode editar/i.test(e?.message ?? '')) {
    return e.message as string
  }
  if (e?.code === '42501' || /row-level security|violates row-level/i.test(e?.message ?? '')) {
    return 'Você não tem permissão para esta ação. Apenas a equipe (admin/instrutor) acessa os anúncios.'
  }
  if (/relation .*anuncios.* does not exist|could not find the table/i.test(e?.message ?? '')) {
    return 'A tabela de anúncios não existe no banco. Aplique a migration 035 do Supabase.'
  }
  if (e?.code === '23503') {
    return 'Essa coluna ainda tem anúncios nela — mova ou exclua os anúncios antes de excluir a coluna.'
  }
  return e?.message || 'Erro desconhecido. Tente novamente.'
}

const fmtData = (d?: string | null) => d && isValid(parseISO(d)) ? format(parseISO(d), 'dd/MM/yy') : ''
const pct = (n: number | null) => n === null || n === undefined ? '' : `${n}%`

function StatusBool({ ok }: { ok: boolean }) {
  return ok
    ? <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400"><IconCheck className="w-3 h-3" /> Feito</span>
    : <span className="text-gray-300 dark:text-gray-700">Pendente</span>
}

type Campo = { label: string; node: ReactNode }
const val = (v: string) => v ? <span className="truncate">{v}</span> : <span className="text-gray-300 dark:text-gray-700">—</span>
const valData = (d?: string | null) => fmtData(d) ? <span>{fmtData(d)}</span> : <span className="text-gray-300 dark:text-gray-700">—</span>
const valPct = (n: number | null) => pct(n) ? <span>{pct(n)}</span> : <span className="text-gray-300 dark:text-gray-700">—</span>

function camposDe(a: Anuncio): Campo[] {
  switch (a.status) {
    case 'imagens_a_fazer':
      return [
        { label: 'Capa', node: val(a.capa) },
        { label: 'Quebra Objeção', node: val(a.quebra_objecao) },
        { label: 'Imagens Secundárias', node: val(a.imagens_secundarias) },
        { label: 'Método do anúncio', node: val(a.metodo_anuncio) },
        { label: 'Drive do produto', node: val(a.drive_produto) },
        { label: 'Data', node: valData(a.data) },
        { label: 'Data de entrega', node: valData(a.data_entrega) },
      ]
    case 'anuncios_a_fazer':
      return [
        { label: 'Drive do produto', node: val(a.drive_produto) },
        { label: 'Margem de Ranqueamento', node: valPct(a.margem_ranqueamento) },
        { label: 'Margem Final Esperada', node: valPct(a.margem_final_esperada) },
        { label: 'Método do anúncio', node: val(a.metodo_anuncio) },
        { label: 'Venda Fake Realizada?', node: <StatusBool ok={a.venda_fake_realizada} /> },
        { label: 'Data', node: valData(a.data) },
        { label: 'Data de entrega', node: valData(a.data_entrega) },
      ]
    case 'anuncio_feito':
    case 'ganhando_escalando':
      return [
        { label: 'Id do anúncio', node: val(a.id_anuncio) },
        { label: 'Anúncio', node: val(a.anuncio) },
        { label: 'Margem de Ranqueamento', node: valPct(a.margem_ranqueamento) },
        { label: 'Margem Final Esperada', node: valPct(a.margem_final_esperada) },
        { label: 'Data de alteração de preço', node: valData(a.data_alteracao_preco) },
        { label: 'Meta de vendas para subir preço', node: val(a.meta_vendas_subir_preco) },
      ]
    case 'anuncio_escalado':
      return [
        { label: 'Id do anúncio', node: val(a.id_anuncio) },
        { label: 'Anúncio', node: val(a.anuncio) },
        { label: 'Margem Final Realizada', node: valPct(a.margem_final_realizada) },
        { label: 'Data de alteração de preço', node: valData(a.data_alteracao_preco) },
      ]
    // Coluna criada pelo admin além das 5 padrão — sem campos específicos
    // definidos, mostra um resumo genérico com o que já foi preenchido.
    default:
      return [
        { label: 'Id do anúncio', node: val(a.id_anuncio) },
        { label: 'Anúncio', node: val(a.anuncio) },
        { label: 'Método do anúncio', node: val(a.metodo_anuncio) },
        { label: 'Drive do produto', node: val(a.drive_produto) },
      ]
  }
}

export default function AnunciosClient() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  const [anuncios, setAnuncios] = useState<Anuncio[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [colunas, setColunas] = useState<AnuncioColuna[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editAnuncio, setEditAnuncio] = useState<Anuncio | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [erroForm, setErroForm] = useState<string | null>(null)
  const [erroCarregar, setErroCarregar] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<AnuncioStatus | null>(null)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [duplicandoId, setDuplicandoId] = useState<string | null>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  const [showNovaColuna, setShowNovaColuna] = useState(false)
  const [novaColunaLabel, setNovaColunaLabel] = useState('')
  const [salvandoColuna, setSalvandoColuna] = useState(false)
  const [erroColuna, setErroColuna] = useState<string | null>(null)

  useEffect(() => { load() }, [])
  async function load() {
    try {
      const [as_, cl, cols] = await Promise.all([
        getAll<Anuncio>('anuncios', { order: { column: 'criado_em', ascending: false } }),
        getAll<Cliente>('clientes', { order: { column: 'nome', ascending: true } }).catch(() => [] as Cliente[]),
        getAll<AnuncioColuna>('anuncios_colunas', { order: { column: 'ordem', ascending: true } }).catch(() => [] as AnuncioColuna[]),
      ])
      setAnuncios(as_); setClientes(cl); setColunas(cols); setErroCarregar(null)
    } catch (err) {
      setErroCarregar(mensagemErro(err))
    }
  }

  const set = (campo: keyof typeof FORM_INICIAL, valor: string | boolean) => setForm(p => ({ ...p, [campo]: valor }))

  async function criarColuna(e: React.FormEvent) {
    e.preventDefault()
    const label = novaColunaLabel.trim()
    if (!label) return
    setErroColuna(null)
    setSalvandoColuna(true)
    try {
      const key = slugColuna(label, new Set(colunas.map(c => c.key)))
      const ordem = (colunas.at(-1)?.ordem ?? 0) + 1
      await insert('anuncios_colunas', { key, label, ordem })
      setNovaColunaLabel(''); setShowNovaColuna(false)
      await load()
    } catch (err) {
      setErroColuna(mensagemErro(err))
    } finally {
      setSalvandoColuna(false)
    }
  }

  async function excluirColuna(col: AnuncioColuna) {
    if (anuncios.some(a => a.status === col.key)) return
    if (!confirm(`Excluir a coluna "${col.label}"?`)) return
    try { await remove('anuncios_colunas', col.id); await load() }
    catch (err) { alert('Erro ao excluir coluna: ' + mensagemErro(err)) }
  }

  function novo() {
    setEditAnuncio(null)
    setErroForm(null)
    setForm({ ...FORM_INICIAL, status: colunas[0]?.key ?? FORM_INICIAL.status })
    setShowModal(true)
  }
  function editar(a: Anuncio) {
    setEditAnuncio(a)
    setErroForm(null)
    setForm({
      cliente_id: a.cliente_id || '', nome_produto: a.nome_produto, status: a.status, prioridade: a.prioridade,
      capa: a.capa, quebra_objecao: a.quebra_objecao, imagens_secundarias: a.imagens_secundarias, foto_url: a.foto_url || '',
      metodo_anuncio: a.metodo_anuncio, drive_produto: a.drive_produto,
      data: a.data || '', data_entrega: a.data_entrega || '',
      margem_ranqueamento: a.margem_ranqueamento?.toString() ?? '', margem_final_esperada: a.margem_final_esperada?.toString() ?? '',
      venda_fake_realizada: a.venda_fake_realizada,
      id_anuncio: a.id_anuncio, anuncio: a.anuncio,
      data_alteracao_preco: a.data_alteracao_preco || '', meta_vendas_subir_preco: a.meta_vendas_subir_preco,
      margem_final_realizada: a.margem_final_realizada?.toString() ?? '',
    })
    setShowModal(true)
  }
  function fechar() { setShowModal(false); setEditAnuncio(null); setForm(FORM_INICIAL); setErroForm(null) }

  async function enviarFoto(file: File) {
    setEnviandoFoto(true)
    try {
      const url = await uploadFotoAnuncio(file)
      setForm(p => ({ ...p, foto_url: url }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao enviar a foto.')
    } finally {
      setEnviandoFoto(false)
      if (fotoInputRef.current) fotoInputRef.current.value = ''
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErroForm(null)
    const cliente = clientes.find(c => c.id === form.cliente_id)
    const payload = {
      cliente_id: form.cliente_id || null, cliente_nome: cliente?.nome || '',
      nome_produto: form.nome_produto, status: form.status, prioridade: form.prioridade,
      capa: form.capa, quebra_objecao: form.quebra_objecao, imagens_secundarias: form.imagens_secundarias,
      foto_url: form.foto_url || null,
      metodo_anuncio: form.metodo_anuncio, drive_produto: form.drive_produto,
      data: form.data || null, data_entrega: form.data_entrega || null,
      margem_ranqueamento: form.margem_ranqueamento === '' ? null : Number(form.margem_ranqueamento),
      margem_final_esperada: form.margem_final_esperada === '' ? null : Number(form.margem_final_esperada),
      venda_fake_realizada: form.venda_fake_realizada,
      id_anuncio: form.id_anuncio, anuncio: form.anuncio,
      data_alteracao_preco: form.data_alteracao_preco || null, meta_vendas_subir_preco: form.meta_vendas_subir_preco,
      margem_final_realizada: form.margem_final_realizada === '' ? null : Number(form.margem_final_realizada),
    }
    setSalvando(true)
    try {
      if (editAnuncio) await update<Anuncio>('anuncios', editAnuncio.id, payload)
      else await insert('anuncios', payload)
      fechar(); await load()
    } catch (err) {
      setErroForm(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(a: Anuncio) {
    if (!confirm('Excluir este anúncio?')) return
    try { await remove('anuncios', a.id); await load() }
    catch (err) { alert('Erro ao excluir: ' + mensagemErro(err)) }
  }

  async function duplicar(a: Anuncio) {
    setDuplicandoId(a.id)
    const payload = {
      cliente_id: a.cliente_id, cliente_nome: a.cliente_nome,
      nome_produto: `${a.nome_produto} (cópia)`, status: a.status, prioridade: a.prioridade,
      capa: a.capa, quebra_objecao: a.quebra_objecao, imagens_secundarias: a.imagens_secundarias,
      foto_url: a.foto_url, metodo_anuncio: a.metodo_anuncio, drive_produto: a.drive_produto,
      data: a.data, data_entrega: a.data_entrega,
      margem_ranqueamento: a.margem_ranqueamento, margem_final_esperada: a.margem_final_esperada,
      venda_fake_realizada: a.venda_fake_realizada,
      id_anuncio: a.id_anuncio, anuncio: a.anuncio,
      data_alteracao_preco: a.data_alteracao_preco, meta_vendas_subir_preco: a.meta_vendas_subir_preco,
      margem_final_realizada: a.margem_final_realizada,
    } satisfies Omit<Anuncio, 'id' | 'user_id' | 'criado_em'>
    try { await insert('anuncios', payload); await load() }
    catch (err) { alert('Erro ao duplicar: ' + mensagemErro(err)) }
    finally { setDuplicandoId(null) }
  }

  async function moverStatus(id: string, status: AnuncioStatus) {
    const a = anuncios.find(x => x.id === id)
    if (!a || a.status === status) return
    const anterior = a.status
    setAnuncios(prev => prev.map(x => x.id === id ? { ...x, status } : x))
    try {
      await update<Anuncio>('anuncios', id, { status })
      await load()
    } catch (err) {
      setAnuncios(prev => prev.map(x => x.id === id ? { ...x, status: anterior } : x))
      alert('Erro ao mover: ' + mensagemErro(err))
    }
  }
  function onDrop(status: AnuncioStatus) {
    if (dragId) moverStatus(dragId, status)
    setDragId(null); setOverCol(null)
  }
  function avancar(a: Anuncio) {
    const idx = colunas.findIndex(c => c.key === a.status)
    const prox = colunas[idx + 1]
    if (prox) moverStatus(a.id, prox.key)
  }

  const total = anuncios.length
  const porStatus = (s: AnuncioStatus) => anuncios.filter(a => a.status === s).length

  return (
    <div>
      <PageHeader
        title="Anúncios"
        subtitle="Controle de evolução dos anúncios e imagens"
        action={isAdmin ? <AddButton onClick={novo}>Novo Anúncio</AddButton> : undefined}
      />

      <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-6">
        <Metric label="Total" value={total.toString()} icon={<IconMegaphone className="w-6 h-6" />} />
        {colunas.map(col => (
          <Metric key={col.key} label={col.label} value={porStatus(col.key).toString()} />
        ))}
      </div>

      {erroCarregar && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
          Não foi possível carregar os anúncios: {erroCarregar}
        </p>
      )}

      {total === 0 ? (
        <EmptyState
          icon={<IconMegaphone className="w-6 h-6" />}
          title="Nenhum anúncio cadastrado"
          description={isAdmin ? 'Crie um anúncio e acompanhe sua evolução das imagens até a escala.' : 'Ainda não há anúncios cadastrados pelo admin.'}
          action={isAdmin ? <AddButton onClick={novo}>Novo Anúncio</AddButton> : undefined}
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {colunas.map((col, colIdx) => {
            const cards = anuncios.filter(a => a.status === col.key)
            const ativo = overCol === col.key
            const ultimaColuna = colIdx === colunas.length - 1
            const mostraPrioridade = colIdx < 2
            const dot = DOT_CORES[colIdx % DOT_CORES.length]
            return (
              <div
                key={col.key}
                onDragOver={e => { e.preventDefault(); if (overCol !== col.key) setOverCol(col.key) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(c => c === col.key ? null : c) }}
                onDrop={() => onDrop(col.key)}
                className={`w-[280px] shrink-0 rounded-2xl border transition-colors ${ativo ? 'border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-100 dark:ring-blue-900' : 'border-gray-200/80 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40'}`}
              >
                <div className="flex items-center gap-2 px-3.5 py-3 border-b border-gray-200/60 dark:border-gray-800/60">
                  <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                  <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300 truncate">{col.label}</span>
                  <span className="text-[11px] font-medium text-gray-400 dark:text-gray-600 tabular-nums">{cards.length}</span>
                  {isAdmin && cards.length === 0 && (
                    <button onClick={() => excluirColuna(col)} title="Excluir coluna" className="ml-auto p-1 rounded-md text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0">
                      <IconTrash className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="p-2.5 space-y-2.5 min-h-[120px]">
                  {cards.map(a => (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={() => setDragId(a.id)}
                      onDragEnd={() => { setDragId(null); setOverCol(null) }}
                      onDoubleClick={() => { if (isAdmin) editar(a) }}
                      title={isAdmin ? 'Arraste para mudar a etapa · duplo clique para editar' : 'Arraste para mudar a etapa'}
                      className={`group bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-3.5 cursor-grab active:cursor-grabbing transition-all hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-[0_2px_12px_rgba(15,23,42,0.07)] dark:hover:shadow-[0_2px_12px_rgba(0,0,0,0.3)] ${dragId === a.id ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {a.foto_url && (
                            <img src={a.foto_url} alt="" className="w-8 h-8 rounded-md object-cover border border-gray-200 dark:border-gray-700 shrink-0" />
                          )}
                          <p className="text-[13.5px] font-semibold text-gray-900 dark:text-gray-100 leading-snug truncate">
                            {a.nome_produto || 'Sem nome'}
                          </p>
                        </div>
                        {mostraPrioridade && (
                          <span className="flex items-center gap-1 text-[10.5px] font-medium text-gray-400 dark:text-gray-500 shrink-0 mt-0.5" title={`Prioridade ${PRIO[a.prioridade].label}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${PRIO_DOT[a.prioridade]}`} />
                            {PRIO[a.prioridade].label}
                          </span>
                        )}
                      </div>

                      {a.cliente_nome && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-800 pl-1 pr-2.5 py-0.5 mt-2 max-w-full">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${corAvatar(a.cliente_nome)}`}>{iniciais(a.cliente_nome)}</span>
                          <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300 truncate">{a.cliente_nome}</span>
                        </span>
                      )}

                      <div className="mt-2.5 space-y-1">
                        {camposDe(a).map(f => (
                          <div key={f.label} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-gray-400 dark:text-gray-500 shrink-0">{f.label}</span>
                            <span className="text-gray-700 dark:text-gray-300 font-medium truncate max-w-[60%] text-right">{f.node}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-end gap-0.5 mt-3 pt-2.5 border-t border-gray-50 dark:border-gray-800/60">
                        {!ultimaColuna && (
                          <button onClick={() => avancar(a)} title="Avançar etapa" className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                            Avançar <IconChevronRight className="w-3 h-3" />
                          </button>
                        )}
                        {isAdmin && (<>
                          <button onClick={e => { e.stopPropagation(); duplicar(a) }} disabled={duplicandoId === a.id} title="Duplicar" className="p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"><IconCopy className="w-3.5 h-3.5" /></button>
                          <button onClick={() => editar(a)} title="Editar" className="p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-0 group-hover:opacity-100 transition-all"><IconEdit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => excluir(a)} title="Excluir" className="p-1.5 rounded-md text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"><IconTrash className="w-3.5 h-3.5" /></button>
                        </>)}
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && <p className="text-xs text-gray-300 dark:text-gray-700 text-center py-8 select-none">Solte aqui</p>}
                </div>
              </div>
            )
          })}
          {isAdmin && (
            <button
              onClick={() => setShowNovaColuna(true)}
              className="w-[220px] shrink-0 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-500 dark:hover:text-gray-500 transition-colors flex flex-col items-center justify-center gap-1.5 min-h-[64px] self-start"
            >
              <IconPlus className="w-4 h-4" />
              <span className="text-[12px] font-medium">Nova coluna</span>
            </button>
          )}
        </div>
      )}

      {/* Modal Nova coluna */}
      <Modal open={showNovaColuna} onClose={() => { setShowNovaColuna(false); setNovaColunaLabel(''); setErroColuna(null) }} title="Nova coluna" size="sm">
        <form onSubmit={criarColuna} className="space-y-4">
          <Field label="Nome da coluna">
            <Input value={novaColunaLabel} onChange={e => setNovaColunaLabel(e.target.value)} placeholder="Ex.: Aguardando aprovação" autoFocus />
          </Field>
          {erroColuna && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erroColuna}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => { setShowNovaColuna(false); setNovaColunaLabel('') }} disabled={salvandoColuna}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={salvandoColuna || !novaColunaLabel.trim()}>{salvandoColuna ? 'Criando...' : 'Criar coluna'}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Anúncio */}
      <Modal open={showModal} onClose={fechar} title={editAnuncio ? 'Editar Anúncio' : 'Novo Anúncio'} size="lg">
        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cliente">
              <Select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
                <option value="">Sem cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.loja ? ` — ${c.loja}` : ''}</option>)}
              </Select>
            </Field>
            <Field label="Nome do produto"><Input value={form.nome_produto} onChange={e => set('nome_produto', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Etapa">
              <Select value={form.status} onChange={e => set('status', e.target.value)}>
                {colunas.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select value={form.prioridade} onChange={e => set('prioridade', e.target.value)}>
                <option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
              </Select>
            </Field>
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 pt-1">Imagens</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Capa"><Input value={form.capa} onChange={e => set('capa', e.target.value)} /></Field>
            <Field label="Quebra Objeção"><Input value={form.quebra_objecao} onChange={e => set('quebra_objecao', e.target.value)} /></Field>
            <Field label="Imagens Secundárias" className="col-span-2"><Input value={form.imagens_secundarias} onChange={e => set('imagens_secundarias', e.target.value)} /></Field>
          </div>

          <Field label="Foto">
            <input
              ref={fotoInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files?.[0] && enviarFoto(e.target.files[0])}
            />
            {form.foto_url ? (
              <div className="flex items-center gap-3">
                <img src={form.foto_url} alt="Foto do anúncio" className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
                <Button type="button" variant="secondary" icon={<IconUpload className="w-4 h-4" />} disabled={enviandoFoto} onClick={() => fotoInputRef.current?.click()}>
                  {enviandoFoto ? 'Enviando...' : 'Trocar foto'}
                </Button>
                <button type="button" onClick={() => set('foto_url', '')} title="Remover foto" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-600 transition-colors">
                  <IconClose className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Button type="button" variant="secondary" icon={<IconUpload className="w-4 h-4" />} disabled={enviandoFoto} onClick={() => fotoInputRef.current?.click()}>
                {enviandoFoto ? 'Enviando...' : 'Enviar foto'}
              </Button>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Método do anúncio"><Input value={form.metodo_anuncio} onChange={e => set('metodo_anuncio', e.target.value)} /></Field>
            <Field label="Drive do produto"><Input value={form.drive_produto} onChange={e => set('drive_produto', e.target.value)} placeholder="Link do Drive" /></Field>
            <Field label="Data"><Input type="date" value={form.data} onChange={e => set('data', e.target.value)} /></Field>
            <Field label="Data de entrega"><Input type="date" value={form.data_entrega} onChange={e => set('data_entrega', e.target.value)} /></Field>
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 pt-1">Anúncio</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Id do anúncio"><Input value={form.id_anuncio} onChange={e => set('id_anuncio', e.target.value)} /></Field>
            <Field label="Anúncio"><Input value={form.anuncio} onChange={e => set('anuncio', e.target.value)} /></Field>
            <Field label="Margem de Ranqueamento" hint="%"><Input type="number" step="0.1" value={form.margem_ranqueamento} onChange={e => set('margem_ranqueamento', e.target.value)} /></Field>
            <Field label="Margem Final Esperada" hint="%"><Input type="number" step="0.1" value={form.margem_final_esperada} onChange={e => set('margem_final_esperada', e.target.value)} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={form.venda_fake_realizada} onChange={e => set('venda_fake_realizada', e.target.checked)} className="w-4 h-4 accent-blue-600" /> Venda Fake Realizada?
          </label>

          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 pt-1">Escala</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data de alteração de preço"><Input type="date" value={form.data_alteracao_preco} onChange={e => set('data_alteracao_preco', e.target.value)} /></Field>
            <Field label="Meta de vendas para subir preço"><Input value={form.meta_vendas_subir_preco} onChange={e => set('meta_vendas_subir_preco', e.target.value)} /></Field>
            <Field label="Margem Final Realizada" hint="%"><Input type="number" step="0.1" value={form.margem_final_realizada} onChange={e => set('margem_final_realizada', e.target.value)} /></Field>
          </div>

          {erroForm && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{erroForm}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={fechar} disabled={salvando}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={salvando}>{salvando ? 'Salvando...' : editAnuncio ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
