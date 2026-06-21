'use client'

// Visualizador de slides nativo, renderizado dentro do app com PDF.js.
// Desenha cada página num <canvas> (fluido, sem travar, sem servidores de
// terceiros). Navegação por botões, setas/espaço do teclado e tela cheia.

import { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { Button } from './ui'
import { IconDownload, IconChevronLeft, IconChevronRight, IconClose } from './icons'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export default function SlideViewer({
  url, title, onClose, onDownload,
}: { url: string; title: string; onClose: () => void; onDownload: () => void }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [fullscreen, setFullscreen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTaskRef = useRef<RenderTask | null>(null)

  // Carrega o documento.
  useEffect(() => {
    let cancelado = false
    setCarregando(true); setErro('')
    const task = pdfjsLib.getDocument(url)
    task.promise
      .then(pdf => {
        if (cancelado) { pdf.destroy(); return }
        setDoc(pdf); setNumPages(pdf.numPages); setPage(1)
      })
      .catch(() => { if (!cancelado) { setErro('Não foi possível carregar o PDF.'); setCarregando(false) } })
    return () => { cancelado = true; task.destroy() }
  }, [url])

  // Renderiza a página atual ajustando à área disponível (com nitidez por DPR).
  const renderPage = useCallback(async () => {
    const stage = stageRef.current, canvas = canvasRef.current
    if (!doc || !stage || !canvas) return
    renderTaskRef.current?.cancel()
    const pg = await doc.getPage(page)
    const base = pg.getViewport({ scale: 1 })
    const escala = Math.min(stage.clientWidth / base.width, stage.clientHeight / base.height) || 1
    const dpr = window.devicePixelRatio || 1
    const viewport = pg.getViewport({ scale: escala * dpr })
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = `${viewport.width / dpr}px`
    canvas.style.height = `${viewport.height / dpr}px`
    const task = pg.render({ canvas, canvasContext: ctx, viewport })
    renderTaskRef.current = task
    try { await task.promise; setCarregando(false) } catch { /* render cancelado por nova página/resize */ }
  }, [doc, page])

  useEffect(() => { renderPage() }, [renderPage])

  // Re-renderiza ao redimensionar a janela ou entrar/sair de tela cheia.
  useEffect(() => {
    const onResize = () => renderPage()
    const onFs = () => { setFullscreen(!!document.fullscreenElement); renderPage() }
    window.addEventListener('resize', onResize)
    document.addEventListener('fullscreenchange', onFs)
    return () => { window.removeEventListener('resize', onResize); document.removeEventListener('fullscreenchange', onFs) }
  }, [renderPage])

  const prev = useCallback(() => setPage(p => Math.max(1, p - 1)), [])
  const next = useCallback(() => setPage(p => Math.min(numPages || 1, p + 1)), [numPages])

  // Teclado: setas/espaço navegam; Esc fecha (a não ser em tela cheia, onde o
  // navegador usa o Esc para sair da tela cheia primeiro).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown': e.preventDefault(); next(); break
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': e.preventDefault(); prev(); break
        case 'Home': setPage(1); break
        case 'End': setPage(numPages || 1); break
        case 'Escape': if (!document.fullscreenElement) onClose(); break
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [next, prev, numPages, onClose])

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen()
    else containerRef.current?.requestFullscreen?.()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gray-900/85 backdrop-blur-sm p-3 sm:p-6"
      onMouseDown={onClose}
    >
      <div
        ref={containerRef}
        className="bg-gray-900 rounded-2xl shadow-xl flex-1 flex flex-col overflow-hidden w-full max-w-6xl mx-auto"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/10">
          <h3 className="font-semibold text-white truncate text-sm">{title}</h3>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" icon={<IconDownload className="w-4 h-4" />} onClick={onDownload}>Baixar</Button>
            <button onClick={onClose} title="Fechar" className="p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors">
              <IconClose className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Palco do slide */}
        <div ref={stageRef} className="flex-1 relative flex items-center justify-center overflow-hidden p-2">
          {erro ? (
            <p className="text-sm text-red-300">{erro}</p>
          ) : (
            <>
              <canvas ref={canvasRef} className="max-w-full max-h-full rounded shadow-lg" />
              {carregando && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                </div>
              )}
              {/* Zonas de clique para avançar/voltar */}
              {numPages > 1 && (
                <>
                  <button onClick={prev} disabled={page <= 1} aria-label="Slide anterior"
                    className="absolute left-0 top-0 h-full w-1/4 flex items-center justify-start pl-2 opacity-0 hover:opacity-100 disabled:cursor-default transition-opacity">
                    <span className="p-2 rounded-full bg-black/40 text-white"><IconChevronLeft className="w-5 h-5" /></span>
                  </button>
                  <button onClick={next} disabled={page >= numPages} aria-label="Próximo slide"
                    className="absolute right-0 top-0 h-full w-1/4 flex items-center justify-end pr-2 opacity-0 hover:opacity-100 disabled:cursor-default transition-opacity">
                    <span className="p-2 rounded-full bg-black/40 text-white"><IconChevronRight className="w-5 h-5" /></span>
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Controles */}
        <div className="flex items-center justify-center gap-4 px-4 py-2.5 border-t border-white/10 text-white">
          <button onClick={prev} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"><IconChevronLeft className="w-5 h-5" /></button>
          <span className="text-sm tabular-nums select-none">{numPages ? `${page} / ${numPages}` : '—'}</span>
          <button onClick={next} disabled={page >= numPages} className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"><IconChevronRight className="w-5 h-5" /></button>
          <button onClick={toggleFullscreen} className="ml-2 text-xs px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
            {fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          </button>
        </div>
      </div>
    </div>
  )
}
