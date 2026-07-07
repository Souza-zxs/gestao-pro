// Camada de pagamento ISOLADA.
//
// Produção usa checkout hospedado no Asaas (iniciarCheckoutAsaas): o comprador
// é redirecionado pra uma página do próprio Asaas, escolhe PIX/cartão/boleto
// lá, e a confirmação chega depois via webhook (Edge Function webhook-asaas,
// que marca o pedido como pago e libera a matrícula).
//
// mockProvider/checkout() continuam existindo pra dev local sem o Asaas
// configurado — aprovam na hora, sem gateway nenhum de verdade.

import { insert } from './store'
import { supabase } from './supabase'
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

export interface CheckoutAsaasInput {
  curso: { id: string; titulo: string; preco: number }
  comprador: { nome: string; email: string }
}

/**
 * Cria o pedido como 'pendente' e chama a Edge Function criar-checkout-asaas,
 * que devolve a URL do checkout hospedado do Asaas. Quem chama deve navegar
 * pra essa URL (window.location.href) — o comprador paga fora do site e volta
 * em /sucesso/:pedidoId depois. A confirmação real vem do webhook, não daqui.
 */
export async function iniciarCheckoutAsaas(input: CheckoutAsaasInput): Promise<{ pedido: Pedido; url: string }> {
  const pedido = await insert<Omit<Pedido, 'id' | 'criado_em'>>('pedidos', {
    curso_id: input.curso.id,
    curso_titulo: input.curso.titulo,
    comprador_nome: input.comprador.nome,
    comprador_email: input.comprador.email,
    valor: input.curso.preco,
    metodo: 'indefinido',
    status: 'pendente',
  })

  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(
    'criar-checkout-asaas',
    { body: { pedido_id: pedido.id } },
  )
  if (error) {
    // Em erro (status != 2xx) o supabase-js não parseia o corpo em `data` —
    // o JSON com a mensagem real (ver criar-checkout-asaas/index.ts) fica em
    // error.context (a Response crua).
    let mensagem = error.message
    try {
      const corpo = await (error as unknown as { context?: Response }).context?.json()
      if (corpo?.error) mensagem = corpo.error
    } catch { /* mantém a mensagem genérica do SDK */ }
    throw new Error(mensagem)
  }
  if (!data?.url) throw new Error('Não foi possível iniciar o pagamento.')

  return { pedido, url: data.url }
}
