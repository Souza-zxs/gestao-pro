import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { matriculasDe, cursoById, aulasDoCurso, progressoPct } from '@/lib/courses'
import { useAuth } from '@/lib/auth'
import type { Curso, Matricula } from '@/lib/types'
import { IconBook, IconPlayCircle } from '@/components/icons'

interface ItemArea {
  matricula: Matricula
  curso: Curso
  total: number
  pct: number
}

export default function MinhaAreaPage() {
  const { user, email, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [itens, setItens] = useState<ItemArea[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/entrar', { state: { redirect: '/minha-area' }, replace: true }); return }
    let vivo = true
    ;(async () => {
      const matriculas = await matriculasDe(email)
      const arr: ItemArea[] = []
      for (const m of matriculas) {
        const curso = await cursoById(m.curso_id)
        if (!curso) continue
        const total = (await aulasDoCurso(curso.id)).length
        arr.push({ matricula: m, curso, total, pct: progressoPct(m, total) })
      }
      if (vivo) { setItens(arr); setLoading(false) }
    })()
    return () => { vivo = false }
  }, [authLoading, user, email, navigate])

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Minha área</h1>
      <p className="text-sm text-gray-500 mb-6">Seus cursos e progresso</p>

      {itens.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 mx-auto rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-3">
            <IconBook className="w-7 h-7" />
          </div>
          <p className="text-sm font-medium text-gray-700">Você ainda não tem cursos</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Explore o catálogo e comece a aprender.</p>
          <Link to="/" className="inline-flex px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Ver catálogo</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {itens.map(({ curso, total, pct }) => (
            <Link key={curso.id} to={`/aprender/${curso.id}`} className="group bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
              <div className="h-32 bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center overflow-hidden">
                {curso.capa ? <img src={curso.capa} alt="" className="w-full h-full object-cover" /> : <IconPlayCircle className="w-10 h-10 text-white/90" />}
              </div>
              <div className="p-5">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">{curso.titulo}</h3>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{pct}% concluído</span>
                    <span>{total} aulas</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
