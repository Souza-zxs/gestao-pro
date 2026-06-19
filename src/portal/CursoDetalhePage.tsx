import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { cursoById, modulosDoCurso, aulasDoCurso, matriculaDe } from '@/lib/courses'
import { useAuth } from '@/lib/auth'
import { brl, minutosParaTexto } from '@/lib/format'
import type { Curso, Modulo, Aula } from '@/lib/types'
import { IconArrowLeft, IconPlayCircle, IconLock, IconCheck } from '@/components/icons'

export default function CursoDetalhePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user, email } = useAuth()

  const [curso, setCurso] = useState<Curso | null>(null)
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [aulasPorModulo, setAulasPorModulo] = useState<Record<string, Aula[]>>({})
  const [totalAulas, setTotalAulas] = useState(0)
  const [totalMin, setTotalMin] = useState(0)
  const [matriculado, setMatriculado] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const c = await cursoById(id)
      if (!vivo) return
      if (!c) { setCurso(null); setLoading(false); return }
      const [mods, aulas] = await Promise.all([modulosDoCurso(c.id), aulasDoCurso(c.id)])
      if (!vivo) return
      const map: Record<string, Aula[]> = {}
      aulas.forEach(a => { (map[a.modulo_id] ||= []).push(a) })
      Object.values(map).forEach(arr => arr.sort((x, y) => x.ordem - y.ordem))
      setCurso(c)
      setModulos(mods)
      setAulasPorModulo(map)
      setTotalAulas(aulas.length)
      setTotalMin(aulas.reduce((s, a) => s + (a.duracao_min || 0), 0))
      if (user) {
        const m = await matriculaDe(email, c.id)
        if (vivo) setMatriculado(!!m)
      }
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [id, user, email])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!curso || !curso.publicado) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-700 font-medium">Curso não encontrado</p>
        <Link to="/" className="text-blue-600 text-sm mt-2 inline-block">Voltar ao catálogo</Link>
      </div>
    )
  }

  function comprar() {
    if (!user) { navigate('/entrar', { state: { redirect: `/checkout/${curso!.id}` } }); return }
    navigate(`/checkout/${curso!.id}`)
  }

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <IconArrowLeft className="w-4 h-4" /> Catálogo
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Conteúdo */}
        <div className="lg:col-span-2">
          {curso.categoria && <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium mb-3">{curso.categoria}</span>}
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{curso.titulo}</h1>
          <p className="mt-3 text-gray-600 leading-relaxed">{curso.descricao || 'Sem descrição.'}</p>
          <p className="mt-3 text-sm text-gray-400">
            {totalAulas} aulas · {minutosParaTexto(totalMin)}{curso.instrutor_nome ? ` · por ${curso.instrutor_nome}` : ''}
          </p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">Conteúdo do curso</h2>
          <div className="space-y-3">
            {modulos.length === 0 && <p className="text-sm text-gray-400">Conteúdo em breve.</p>}
            {modulos.map((m, i) => {
              const aulas = aulasPorModulo[m.id] || []
              return (
                <div key={m.id} className="bg-white rounded-xl border border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-100 font-medium text-gray-800 text-sm">
                    <span className="text-gray-400 mr-2">Módulo {i + 1}</span>{m.titulo}
                  </div>
                  <ul>
                    {aulas.map(a => (
                      <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 border-b border-gray-50 last:border-0">
                        {matriculado ? <IconPlayCircle className="w-4 h-4 text-blue-600 shrink-0" /> : <IconLock className="w-4 h-4 text-gray-300 shrink-0" />}
                        <span className="flex-1 truncate">{a.titulo}</span>
                        <span className="text-xs text-gray-400">{minutosParaTexto(a.duracao_min)}</span>
                      </li>
                    ))}
                    {aulas.length === 0 && <li className="px-4 py-2.5 text-sm text-gray-400">Sem aulas.</li>}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>

        {/* Card de compra */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 lg:sticky lg:top-20">
            <div className="h-36 -mx-6 -mt-6 mb-5 rounded-t-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center overflow-hidden">
              {curso.capa ? <img src={curso.capa} alt="" className="w-full h-full object-cover" /> : <IconPlayCircle className="w-12 h-12 text-white/90" />}
            </div>
            <p className="text-3xl font-bold text-gray-900">{brl(curso.preco)}</p>
            <p className="text-xs text-gray-400 mt-1">Acesso vitalício a todas as aulas</p>

            {matriculado ? (
              <Link to={`/aprender/${curso.id}`} className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
                <IconCheck className="w-4 h-4" /> Continuar assistindo
              </Link>
            ) : (
              <button onClick={comprar} className="mt-5 w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
                Comprar curso
              </button>
            )}

            <ul className="mt-5 space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2"><IconCheck className="w-4 h-4 text-green-600" /> {totalAulas} aulas</li>
              <li className="flex items-center gap-2"><IconCheck className="w-4 h-4 text-green-600" /> Certificado de conclusão</li>
              <li className="flex items-center gap-2"><IconCheck className="w-4 h-4 text-green-600" /> Acesso imediato</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
