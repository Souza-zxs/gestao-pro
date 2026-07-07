// Recebe as notificações do Asaas (configuradas no painel deles em
// Integrações → Webhooks) e libera o curso quando um pagamento é confirmado.
//
// Chamada servidor-a-servidor, sem sessão de usuário nenhuma — por isso usa a
// service role (ignora RLS) e valida a origem pelo header "asaas-access-token"
// (o mesmo token gerado em Configurações → Pagamento, colado no painel do
// Asaas na hora de cadastrar o webhook).
//
// IMPORTANTE: deployar com `supabase functions deploy webhook-asaas --no-verify-jwt`
// — o Asaas não manda um JWT do Supabase, a autenticação é só o header acima.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// CHECKOUT_PAID é o evento esperado; PAYMENT_CONFIRMED/PAYMENT_RECEIVED ficam
// como rede de segurança caso a conta esteja assinando eventos de pagamento
// em vez dos de checkout.
const EVENTOS_PAGO = new Set(['CHECKOUT_PAID', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'])

function metodoDe(billingType?: string): 'pix' | 'cartao' | 'boleto' | undefined {
  if (billingType === 'PIX') return 'pix'
  if (billingType === 'BOLETO') return 'boleto'
  if (billingType === 'CREDIT_CARD') return 'cartao'
  return undefined
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: cfg } = await admin
    .from('configuracoes_pagamento').select('asaas_webhook_token').eq('id', true).single()
  const tokenRecebido = req.headers.get('asaas-access-token')
  if (!cfg?.asaas_webhook_token || tokenRecebido !== cfg.asaas_webhook_token) {
    return new Response('unauthorized', { status: 401 })
  }

  const payload = await req.json().catch(() => null)
  if (!payload?.event || !EVENTOS_PAGO.has(payload.event)) {
    return new Response('ignored', { status: 200 })
  }

  const checkoutId: string | undefined = payload.checkout?.id ?? payload.payment?.checkoutId
  const externalReference: string | undefined =
    payload.payment?.externalReference ?? payload.checkout?.externalReference

  let query = admin.from('pedidos').select('*').limit(1)
  if (checkoutId) query = query.eq('gateway_checkout_id', checkoutId)
  else if (externalReference) query = query.eq('id', externalReference)
  else return new Response('sem referência pra achar o pedido', { status: 200 })

  const { data: pedidos } = await query
  const pedido = pedidos?.[0]
  if (!pedido) return new Response('pedido não encontrado', { status: 200 })

  if (pedido.status !== 'pago') {
    const metodo = metodoDe(payload.payment?.billingType) ?? pedido.metodo

    await admin.from('pedidos').update({ status: 'pago', metodo }).eq('id', pedido.id)

    // Mesma lógica de matricular() em src/lib/courses.ts, feita aqui porque
    // não existe sessão de usuário nesse contexto (chamada vem do Asaas).
    const { data: existente } = await admin
      .from('matriculas')
      .select('id')
      .eq('curso_id', pedido.curso_id)
      .eq('aluno_email', pedido.comprador_email)
      .limit(1)

    if (!existente?.length) {
      await admin.from('matriculas').insert({
        curso_id: pedido.curso_id,
        aluno_email: pedido.comprador_email,
        aluno_nome: pedido.comprador_nome,
        pedido_id: pedido.id,
        status: 'ativa',
        aulas_concluidas: [],
      })
      // O trigger matriculas_promove_usuario (migration 023) promove
      // sozinho o cargo do comprador de 'user' pra 'aluno' a partir daqui.
    }
  }

  return new Response('ok', { status: 200 })
})
