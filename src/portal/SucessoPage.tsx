import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getAll } from '@/lib/store'
import { brl } from '@/lib/format'
import type { Pedido } from '@/lib/types'
import { IconCheck, IconClock, IconPlayCircle } from '@/components/icons'

export default function SucessoPage() {
  const { pedidoId = '' } = useParams()
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const rows = await getAll<Pedido>('pedidos', { match: { id: pedidoId } })
      if (vivo) { setPedido(rows[0] ?? null); setLoading(false) }
    })()
    return () => { vivo = false }
  }, [pedidoId])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-700 font-medium">Pedido não encontrado</p>
        <Link to="/" className="text-blue-600 text-sm mt-2 inline-block">Voltar ao catálogo</Link>
      </div>
    )
  }

  const pago = pedido.status === 'pago'

  return (
    <div className="max-w-md mx-auto text-center py-10">
      <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-5 ${pago ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
        {pago ? <IconCheck className="w-8 h-8" /> : <IconClock className="w-8 h-8" />}
      </div>
      <h1 className="text-2xl font-bold text-gray-900">{pago ? 'Pagamento confirmado!' : 'Pedido recebido'}</h1>
      <p className="mt-2 text-gray-500">
        {pago
          ? 'Seu acesso ao curso já está liberado. Bons estudos!'
          : 'Assim que o pagamento for compensado, seu acesso será liberado automaticamente.'}
      </p>

      <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-left">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Curso</span>
          <span className="font-medium text-gray-900">{pedido.curso_titulo}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-gray-500">Valor</span>
          <span className="font-medium text-gray-900">{brl(pedido.valor)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-gray-500">Pedido</span>
          <span className="font-mono text-xs text-gray-400">#{pedido.id.slice(0, 8)}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {pago && (
          <Link to={`/aprender/${pedido.curso_id}`} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            <IconPlayCircle className="w-4 h-4" /> Começar o curso
          </Link>
        )}
        <Link to="/minha-area" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Ir para Minha área</Link>
      </div>
    </div>
  )
}
