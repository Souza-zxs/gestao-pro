import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { cursosPublicados } from '@/lib/courses'
import { getAll } from '@/lib/store'
import { brl } from '@/lib/format'
import type { Curso, Aula } from '@/lib/types'
import { IconBook, IconPlayCircle } from '@/components/icons'

export default function CatalogoPage() {
  const [cursos, setCursos] = useState<Curso[]>([])
  const [aulasCount, setAulasCount] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const [cs, aulas] = await Promise.all([cursosPublicados(), getAll<Aula>('aulas')])
      if (!vivo) return
      const map: Record<string, number> = {}
      aulas.forEach(a => { map[a.curso_id] = (map[a.curso_id] || 0) + 1 })
      setCursos(cs); setAulasCount(map); setLoading(false)
    })()
    return () => { vivo = false }
  }, [])

  const filtrados = cursos.filter(c =>
    c.titulo.toLowerCase().includes(busca.toLowerCase()) ||
    (c.categoria || '').toLowerCase().includes(busca.toLowerCase()),
  )

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Aprenda com os melhores cursos</h1>
        <p className="mt-2 text-gray-500">Escolha um curso, garanta seu acesso e comece hoje.</p>
        <div className="mt-5 max-w-md mx-auto">
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar curso..."
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 shadow-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 mx-auto rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-3">
            <IconBook className="w-7 h-7" />
          </div>
          <p className="text-sm font-medium text-gray-700">Nenhum curso disponível</p>
          <p className="text-xs text-gray-400 mt-1">Volte em breve — novos cursos estão a caminho.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtrados.map(c => {
            const nAulas = aulasCount[c.id] || 0
            return (
              <Link key={c.id} to={`/curso/${c.id}`} className="group bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="h-40 bg-gradient-to-br from-blue-500 to-blue-700 relative">
                  {c.capa
                    ? <img src={c.capa} alt={c.titulo} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-white/90"><IconPlayCircle className="w-12 h-12" /></div>}
                  {c.categoria && <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-white/90 text-xs font-medium text-gray-700">{c.categoria}</span>}
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">{c.titulo}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{c.descricao || 'Sem descrição'}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{nAulas} {nAulas === 1 ? 'aula' : 'aulas'}</span>
                    <span className="text-lg font-bold text-gray-900">{brl(c.preco)}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
