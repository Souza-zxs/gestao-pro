// Camada de pagamento ISOLADA.
// Hoje usa um provider simulado (mock). Para plugar um gateway real (Mercado Pago,
// Stripe, etc.) basta implementar a interface PaymentProvider e chamar
// setPaymentProvider(...) — nenhuma tela de checkout precisa mudar.

import { insert } from './store'
import type { Pedido } from './types'

export interface CheckoutInput {
  curso: { id: string; titulo: string; preco: number }
  comprador: { nome: string; email: string }
  metodo: Pedido['metodo']
}

export interface PaymentResult {
  aprovado: boolean
  status: Pedido['status']
  mensagem?: string
}

export interface PaymentOutcome extends PaymentResult {
  pedido: Pedido
}

export interface PaymentProvider {
  id: string
  label: string
  processar(input: CheckoutInput): Promise<PaymentResult>
}

/** Provider simulado: aprova após um pequeno delay (PIX/cartão aprovam na hora). */
export const mockProvider: PaymentProvider = {
  id: 'mock',
  label: 'Pagamento simulado',
  async processar(input) {
    await new Promise(r => setTimeout(r, 1200))
    // boleto fica pendente; pix e cartão aprovam imediatamente (simulação)
    const status: Pedido['status'] = input.metodo === 'boleto' ? 'pendente' : 'pago'
    return {
      aprovado: status === 'pago',
      status,
      mensagem: status === 'pago' ? 'Pagamento aprovado' : 'Aguardando compensação do boleto',
    }
  },
}

// >>> Ponto único de troca por um gateway real <<<
let provider: PaymentProvider = mockProvider
export function setPaymentProvider(p: PaymentProvider) { provider = p }
export function getPaymentProvider(): PaymentProvider { return provider }

/** Processa o pagamento e registra o pedido no store. */
export async function checkout(input: CheckoutInput): Promise<PaymentOutcome> {
  const result = await provider.processar(input)
  const pedido = await insert<Omit<Pedido, 'id' | 'criado_em'>>('pedidos', {
    curso_id: input.curso.id,
    curso_titulo: input.curso.titulo,
    comprador_nome: input.comprador.nome,
    comprador_email: input.comprador.email,
    valor: input.curso.preco,
    metodo: input.metodo,
    status: result.status,
  })
  return { ...result, pedido }
}
