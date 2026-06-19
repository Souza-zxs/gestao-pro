import { useNavigate, useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { cursoById, matriculaDe, matricular } from '@/lib/courses'
import { checkout } from '@/lib/payment'
import { useAuth } from '@/lib/auth'
import { brl } from '@/lib/format'
import type { Curso, Pedido } from '@/lib/types'
import { IconArrowLeft, IconCreditCard, IconShield, IconLock } from '@/components/icons'

const METODOS: { value: Pedido['metodo']; label: string; hint: string }[] = [
  { value: 'pix', label: 'PIX', hint: 'Aprovação imediata' },
  { value: 'cartao', label: 'Cartão de crédito', hint: 'Em até 12x' },
  { value: 'boleto', label: 'Boleto', hint: 'Compensa em 1-2 dias' },
]

export default function CheckoutPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user, name, email, loading: authLoading } = useAuth()

  const [curso, setCurso] = useState<Curso | null>(null)
  const [loading, setLoading] = useState(true)
  const [metodo, setMetodo] = useState<Pedido['metodo']>('pix')
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/entrar', { state: { redirect: `/checkout/${id}` }, replace: true }); return }
    let vivo = true
    ;(async () => {
      const c = await cursoById(id)
      if (!vivo) return
      if (!c || !c.publicado) { setCurso(null); setLoading(false); return }
      const m = await matriculaDe(email, c.id)
      if (!vivo) return
      if (m) { navigate(`/aprender/${c.id}`, { replace: true }); return }
      setCurso(c); setLoading(false)
    })()
    return () => { vivo = false }
  }, [authLoading, user, id, email, navigate])

  async function pagar() {
    if (!curso) return
    setProcessando(true); setErro('')
    try {
      const { aprovado, pedido } = await checkout({
        curso: { id: curso.id, titulo: curso.titulo, preco: curso.preco },
        comprador: { nome: name, email },
        metodo,
      })
      if (aprovado) {
        await matricular({ cursoId: curso.id, alunoEmail: email, alunoNome: name, pedidoId: pedido.id })
      }
      navigate(`/sucesso/${pedido.id}`, { replace: true })
    } catch {
      setErro('Não foi possível processar o pagamento. Tente novamente.')
      setProcessando(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!curso) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-700 font-medium">Curso indisponível</p>
        <Link to="/" className="text-blue-600 text-sm mt-2 inline-block">Voltar ao catálogo</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link to={`/curso/${curso.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <IconArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Finalizar compra</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Forma de pagamento */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Forma de pagamento</h2>
            <div className="space-y-2">
              {METODOS.map(m => (
                <label key={m.value} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${metodo === m.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="metodo" checked={metodo === m.value} onChange={() => setMetodo(m.value)} className="accent-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{m.label}</p>
                    <p className="text-xs text-gray-400">{m.hint}</p>
                  </div>
                  <IconCreditCard className="w-5 h-5 text-gray-300" />
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Comprador</h2>
            <p className="text-sm text-gray-800">{name}</p>
            <p className="text-sm text-gray-400">{email}</p>
          </div>

          <p className="flex items-center gap-2 text-xs text-gray-400">
            <IconShield className="w-4 h-4 text-green-600" />
            Pagamento simulado (modo demonstração). Nenhuma cobrança real é feita.
          </p>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>

        {/* Resumo */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 md:sticky md:top-20">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Resumo</h2>
            <p className="text-sm font-medium text-gray-900">{curso.titulo}</p>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-xl font-bold text-gray-900">{brl(curso.preco)}</span>
            </div>
            <button onClick={pagar} disabled={processando} className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">
              <IconLock className="w-4 h-4" />
              {processando ? 'Processando...' : `Pagar ${brl(curso.preco)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
