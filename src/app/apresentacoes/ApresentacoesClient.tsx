'use client'

import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { getAll, insert, update, remove } from '@/lib/store'
import { uploadArquivo, urlAssinada, removerArquivo } from '@/lib/storage'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  PageHeader, Card, Metric, Modal, Field, Input, Textarea, Badge,
  EmptyState, Button, RowActions, IconAction,
} from '@/components/ui'
import {
  IconPresentation, IconEdit, IconTrash, IconUpload, IconDownload,
  IconFile, IconSearch, IconEye,
} from '@/components/icons'
// Carregado sob demanda: o PDF.js (~1,4 MB) só entra quando o usuário abre uma
// apresentação, mantendo leve o carregamento inicial do app.
const SlideViewer = lazy(() => import('@/components/SlideViewer'))

interface Apresentacao {
  id: string; titulo: string; descricao: string
  arquivo_path: string; arquivo_nome: string; arquivo_tipo: string; arquivo_tamanho: number
  criado_em: string
}

// Classifica o arquivo por formato para badge e ícone.
function formatoDoArquivo(a: Pick<Apresentacao, 'arquivo_nome' | 'arquivo_tipo'>): {
  label: string; color: 'red' | 'amber' | 'blue' | 'gray'; ext: string
} {
  const ext = (a.arquivo_nome.split('.').pop() || '').toLowerCase()
  if (ext === 'pdf' || a.arquivo_tipo === 'application/pdf') return { label: 'PDF', color: 'red', ext }
  if (ext === 'ppt' || ext === 'pptx') return { label: 'PowerPoint', color: 'amber', ext }
  if (ext === 'odp') return { label: 'Impress', color: 'blue', ext }
  if (ext === 'key') return { label: 'Keynote', color: 'gray', ext }
  return { label: ext ? ext.toUpperCase() : 'Arquivo', color: 'gray', ext }
}

// O slideshow nativo (PDF.js) só lê PDF. Arquivos antigos em outro formato
// caem no fallback de download.
function ehPdf(a: Pick<Apresentacao, 'arquivo_nome' | 'arquivo_tipo'>): boolean {
  return formatoDoArquivo(a).ext === 'pdf' || a.arquivo_tipo === 'application/pdf'
}

function tamanhoLegivel(bytes: number): string {
  if (!bytes) return ''
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

const ACEITOS = '.pdf,application/pdf'

export default function ApresentacoesClient() {
  const { role } = useAuth()
  const podeGerenciar = role === 'admin' // não-admins só visualizam/baixam
  const [apresentacoes, setApresentacoes] = useState<Apresentacao[]>([])
  const [busca, setBusca] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [editando, setEditando] = useState<Apresentacao | null>(null)
  const [form, setForm] = useState({ titulo: '', descricao: '' })
  const [erro, setErro] = useState('')
  const [preview, setPreview] = useState<{ a: Apresentacao; url: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!preview) return
    // Em tela cheia o Esc é usado pelo navegador para sair da tela cheia primeiro.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.fullscreenElement) setPreview(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [preview])
  async function load() {
    setApresentacoes(
      (await getAll<Apresentacao>('apresentacoes'))
        .filter(a => a.arquivo_path)
        .sort((a, b) => b.criado_em.localeCompare(a.criado_em)),
    )
  }

  // Upload: envia ao Storage e grava a linha com os metadados do arquivo.
  async function enviarArquivos(files: FileList | File[]) {
    setErro('')
    const lista = Array.from(files)
    const invalidos = lista.filter(f => f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf'))
    if (invalidos.length) {
      setErro(`Só é possível enviar PDF. Exporte ${invalidos.length > 1 ? 'os arquivos' : 'o arquivo'} como PDF antes de subir (no PowerPoint/Keynote: Arquivo → Exportar → PDF).`)
      return
    }
    setEnviando(true)
    try {
      for (const file of lista) {
        const meta = await uploadArquivo(file)
        await insert('apresentacoes', {
          titulo: file.name.replace(/\.[^.]+$/, ''),
          descricao: '',
          ...meta,
        })
      }
      await load()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar o arquivo.')
    } finally {
      setEnviando(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setArrastando(false)
    if (e.dataTransfer.files?.length) enviarArquivos(e.dataTransfer.files)
  }

  // Visualizar = abre o slideshow embutido (PDF.js); formatos antigos têm fallback.
  async function visualizar(a: Apresentacao) {
    setErro('')
    try {
      const url = await urlAssinada(a.arquivo_path)
      setPreview({ a, url })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir o arquivo.')
    }
  }

  async function baixar(a: Apresentacao) {
    setErro('')
    try {
      const url = await urlAssinada(a.arquivo_path)
      const link = document.createElement('a')
      link.href = url; link.download = a.arquivo_nome; link.click()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível baixar o arquivo.')
    }
  }

  async function salvarMeta(e: React.FormEvent) {
    e.preventDefault()
    if (!editando) return
    await update<Apresentacao>('apresentacoes', editando.id, { titulo: form.titulo, descricao: form.descricao })
    setEditando(null); await load()
  }

  async function excluir(a: Apresentacao) {
    if (!confirm('Excluir esta apresentação? O arquivo também será removido.')) return
    try { await removerArquivo(a.arquivo_path) } catch { /* arquivo já pode não existir */ }
    await remove('apresentacoes', a.id)
    await load()
  }

  const filtradas = apresentacoes.filter(a =>
    !busca ||
    a.titulo.toLowerCase().includes(busca.toLowerCase()) ||
    a.descricao.toLowerCase().includes(busca.toLowerCase()) ||
    a.arquivo_nome.toLowerCase().includes(busca.toLowerCase()),
  )
  const total = apresentacoes.length
  const pdfs = apresentacoes.filter(a => formatoDoArquivo(a).label === 'PDF').length
  const espaco = apresentacoes.reduce((s, a) => s + (a.arquivo_tamanho || 0), 0)

  return (
    <div>
      <PageHeader
        title="Apresentações"
        subtitle="Armazém das apresentações de slides em PDF, com visualizador embutido"
        action={
          podeGerenciar ? (
            <Button icon={<IconUpload className="w-4 h-4" />} onClick={() => inputRef.current?.click()} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar arquivo'}
            </Button>
          ) : undefined
        }
      />

      <input
        ref={inputRef} type="file" accept={ACEITOS} multiple className="hidden"
        onChange={e => e.target.files && enviarArquivos(e.target.files)}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Metric label="Apresentações" value={total.toString()} accent="text-blue-600" />
        <Metric label="PDFs" value={pdfs.toString()} accent="text-red-600" />
        <Metric label="Espaço usado" value={tamanhoLegivel(espaco) || '0 KB'} accent="text-gray-900" />
      </div>

      {/* Área de upload por arrastar e soltar (apenas admin) */}
      {podeGerenciar && (
        <div
          onDragOver={e => { e.preventDefault(); setArrastando(true) }}
          onDragLeave={() => setArrastando(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`mb-6 cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            arrastando ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
          }`}
        >
          <IconUpload className="w-6 h-6 mx-auto text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-700">Arraste arquivos aqui ou clique para enviar</p>
          <p className="text-xs text-gray-400 mt-1">Somente PDF — exporte seus slides como PDF antes de enviar</p>
        </div>
      )}

      {erro && <p className="text-sm text-red-600 mb-4">{erro}</p>}

      {total > 0 && (
        <div className="relative mb-4">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por título ou arquivo…" className="pl-9" />
        </div>
      )}

      {filtradas.length === 0 ? (
        <EmptyState
          icon={<IconPresentation className="w-6 h-6" />}
          title={total === 0 ? 'Nenhuma apresentação enviada' : 'Nenhuma apresentação encontrada'}
          description={total === 0 ? 'Envie seus slides em PDF para guardá-los e apresentá-los aqui mesmo.' : undefined}
        />
      ) : (
        <div className="grid gap-3">
          {filtradas.map(a => {
            const fmt = formatoDoArquivo(a)
            return (
              <Card key={a.id} className="hover:shadow-md transition-shadow">
                <div
                  className="flex items-start gap-4 cursor-pointer"
                  onClick={() => visualizar(a)}
                  title="Visualizar apresentação"
                >
                  <div className="w-11 h-11 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                    <IconFile className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{a.titulo}</h3>
                      <Badge color={fmt.color}>{fmt.label}</Badge>
                    </div>
                    {a.descricao && <p className="text-sm text-gray-600 mb-1.5 line-clamp-2">{a.descricao}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      <span className="truncate max-w-[16rem]">{a.arquivo_nome}</span>
                      {a.arquivo_tamanho > 0 && <span>{tamanhoLegivel(a.arquivo_tamanho)}</span>}
                      {a.criado_em && <span>{format(parseISO(a.criado_em), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}</span>}
                    </div>
                  </div>
                  <div onClick={e => e.stopPropagation()}>
                    <RowActions>
                      <IconAction onClick={() => visualizar(a)} title="Visualizar" color="blue"><IconEye className="w-4 h-4" /></IconAction>
                      <IconAction onClick={() => baixar(a)} title="Baixar" color="gray"><IconDownload className="w-4 h-4" /></IconAction>
                      {podeGerenciar && <IconAction onClick={() => { setEditando(a); setForm({ titulo: a.titulo, descricao: a.descricao }) }} title="Editar" color="gray"><IconEdit className="w-4 h-4" /></IconAction>}
                      {podeGerenciar && <IconAction onClick={() => excluir(a)} title="Excluir" color="red"><IconTrash className="w-4 h-4" /></IconAction>}
                    </RowActions>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Slideshow nativo (PDF.js); formatos antigos não-PDF caem no download */}
      {preview && (ehPdf(preview.a) ? (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/85">
            <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        }>
          <SlideViewer
            url={preview.url}
            title={preview.a.titulo}
            onClose={() => setPreview(null)}
            onDownload={() => baixar(preview.a)}
          />
        </Suspense>
      ) : (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-gray-900/80 backdrop-blur-sm p-3 sm:p-6"
          onMouseDown={() => setPreview(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl flex-1 flex flex-col items-center justify-center text-center gap-3 px-6 w-full max-w-md mx-auto"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
              <IconFile className="w-7 h-7" />
            </div>
            <p className="text-sm font-medium text-gray-700">Slideshow disponível apenas para PDF</p>
            <p className="text-xs text-gray-400 max-w-xs">Este arquivo está em {formatoDoArquivo(preview.a).label}. Baixe-o ou reenvie a apresentação exportada como PDF para vê-la aqui.</p>
            <div className="flex gap-2">
              <Button icon={<IconDownload className="w-4 h-4" />} onClick={() => baixar(preview.a)}>Baixar</Button>
              <Button variant="secondary" onClick={() => setPreview(null)}>Fechar</Button>
            </div>
          </div>
        </div>
      ))}

      <Modal open={!!editando} onClose={() => setEditando(null)} title="Editar apresentação" size="lg">
        <form onSubmit={salvarMeta} className="space-y-4">
          <Field label="Título"><Input required value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} /></Field>
          <Field label="Descrição"><Textarea rows={3} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} /></Field>
          {editando && <p className="text-xs text-gray-400">Arquivo: {editando.arquivo_nome}</p>}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button type="submit" className="flex-1">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
