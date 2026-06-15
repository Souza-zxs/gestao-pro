import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import {
  cursoById, modulosDoCurso, aulasDoModulo, aulasDoCurso,
  matriculaDe, alternarAulaConcluida, progressoPct,
} from '@/lib/courses'
import { readUserCookie } from '@/lib/auth-mock'
import { minutosParaTexto } from '@/lib/format'
import type { Aula } from '@/lib/types'
import { IconArrowLeft, IconPlayCircle, IconCheck } from '@/components/icons'

function toEmbed(url?: string): string | null {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return url
}

export default function PlayerPage() {
  const { cursoId = '' } = useParams()
  const navigate = useNavigate()
  const user = readUserCookie()
  const curso = useMemo(() => cursoById(cursoId), [cursoId])
  const modulos = useMemo(() => (curso ? modulosDoCurso(curso.id) : []), [curso])
  const todasAulas = useMemo(() => (curso ? aulasDoCurso(curso.id) : []), [curso])

  const matricula = user && curso ? matriculaDe(user.email, curso.id) : undefined
  const [concluidas, setConcluidas] = useState<string[]>(matricula?.aulas_concluidas || [])
  const [aulaAtual, setAulaAtual] = useState<Aula | undefined>(todasAulas[0])

  if (!user) { navigate('/entrar', { state: { redirect: `/aprender/${cursoId}` }, replace: true }); return null }
  if (!curso) {
    return <div className="text-center py-20"><p className="text-gray-700 font-medium">Curso não encontrado</p><Link to="/minha-area" className="text-blue-600 text-sm mt-2 inline-block">Minha área</Link></div>
  }
  if (!matricula) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-700 font-medium">Você ainda não tem acesso a este curso</p>
        <Link to={`/curso/${curso.id}`} className="text-blue-600 text-sm mt-2 inline-block">Ver curso</Link>
      </div>
    )
  }

  const pct = progressoPct({ ...matricula, aulas_concluidas: concluidas }, todasAulas.length)
  const embed = toEmbed(aulaAtual?.video_url)

  function toggle(aulaId: string) {
    setConcluidas(alternarAulaConcluida({ ...matricula!, aulas_concluidas: concluidas }, aulaId))
  }

  return (
    <div>
      <Link to="/minha-area" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <IconArrowLeft className="w-4 h-4" /> Minha área
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Player */}
        <div className="lg:col-span-2">
          <div className="bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
            {embed
              ? <iframe src={embed} title={aulaAtual?.titulo} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              : <div className="text-white/50 flex flex-col items-center gap-2"><IconPlayCircle className="w-12 h-12" /><span className="text-sm">{aulaAtual ? 'Aula sem vídeo' : 'Selecione uma aula'}</span></div>}
          </div>
          {aulaAtual && (
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{aulaAtual.titulo}</h1>
                <p className="text-sm text-gray-400 mt-0.5">{curso.titulo} · {minutosParaTexto(aulaAtual.duracao_min)}</p>
              </div>
              <button
                onClick={() => toggle(aulaAtual.id)}
                className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  concluidas.includes(aulaAtual.id)
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <IconCheck className="w-4 h-4" /> {concluidas.includes(aulaAtual.id) ? 'Concluída' : 'Marcar concluída'}
              </button>
            </div>
          )}
        </div>

        {/* Lista de aulas */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span className="font-semibold text-gray-700">Progresso</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {modulos.map((m, i) => (
                <div key={m.id}>
                  <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 bg-gray-50">Módulo {i + 1} · {m.titulo}</p>
                  {aulasDoModulo(m.id).map(a => {
                    const ativa = aulaAtual?.id === a.id
                    const feita = concluidas.includes(a.id)
                    return (
                      <button key={a.id} onClick={() => setAulaAtual(a)} className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-gray-50 transition-colors ${ativa ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${feita ? 'bg-green-600 text-white' : 'border border-gray-300 text-transparent'}`}>
                          <IconCheck className="w-3 h-3" />
                        </span>
                        <span className={`flex-1 text-sm truncate ${ativa ? 'text-blue-700 font-medium' : 'text-gray-700'}`}>{a.titulo}</span>
                        <span className="text-xs text-gray-400">{minutosParaTexto(a.duracao_min)}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
              {todasAulas.length === 0 && <p className="px-4 py-6 text-sm text-gray-400 text-center">Conteúdo em breve.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
