// Cria um checkout hospedado no Asaas (PIX/cartão/boleto, o comprador escolhe
// lá) e devolve a URL de redirecionamento. Chamada autenticada pelo frontend
// via supabase.functions.invoke('criar-checkout-asaas', { body: { pedido_id } }).
//
// A chave de API do Asaas é do CLIENTE (configurada em Configurações →
// Pagamento, tabela public.configuracoes_pagamento) e NUNCA é exposta ao
// navegador — só esta function, com a service role key, consegue lê-la.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    // Client "como o usuário" — herda o JWT de quem chamou, então o SELECT/UPDATE
    // em pedidos abaixo respeita a RLS normal (só o dono do pedido acessa).
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user?.email) return json({ error: 'Não autenticado.' }, 401)

    const { pedido_id } = await req.json()
    if (!pedido_id) return json({ error: 'pedido_id é obrigatório.' }, 400)

    const { data: pedido, error: pedidoErr } = await userClient
      .from('pedidos').select('*').eq('id', pedido_id).single()
    if (pedidoErr || !pedido) return json({ error: 'Pedido não encontrado.' }, 404)
    if (pedido.comprador_email !== user.email) {
      return json({ error: 'Este pedido não pertence a este usuário.' }, 403)
    }
    if (pedido.status === 'pago') return json({ error: 'Este pedido já está pago.' }, 400)

    // Só a service role lê configuracoes_pagamento — a tabela não tem policy
    // de SELECT nenhuma pra ninguém autenticado (migration 024).
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: cfg } = await adminClient
      .from('configuracoes_pagamento').select('*').eq('id', true).single()
    if (!cfg?.asaas_api_key) {
      return json({ error: 'Pagamento ainda não configurado. Fale com o administrador.' }, 400)
    }

    const base = cfg.asaas_ambiente === 'producao'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3'

    const origin = req.headers.get('origin') || new URL(req.url).origin
    const successUrl = `${origin}/sucesso/${pedido.id}`

    // Checkout hospedado: o Asaas mostra PIX/cartão/boleto e coleta os dados
    // do comprador (nome/CPF/e-mail) na própria página deles.
    const asaasRes = await fetch(`${base}/checkouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', access_token: cfg.asaas_api_key },
      body: JSON.stringify({
        billingTypes: ['PIX', 'CREDIT_CARD', 'BOLETO'],
        chargeTypes: ['DETACHED'],
        minutesToExpire: 60,
        externalReference: pedido.id,
        items: [{ description: pedido.curso_titulo, quantity: 1, value: pedido.valor }],
        callback: { successUrl, cancelUrl: successUrl, expiredUrl: successUrl },
      }),
    })
    const asaasData = await asaasRes.json()
    if (!asaasRes.ok) {
      // Repassa o erro real do Asaas — é assim que um nome de campo errado
      // (ex.: em "callback") fica óbvio de corrigir durante o teste em sandbox.
      return json({
        error: asaasData?.errors?.[0]?.description || 'Falha ao criar checkout no Asaas.',
        detalhe: asaasData,
      }, 400)
    }

    const checkoutId = asaasData.id as string
    await userClient.from('pedidos').update({ gateway_checkout_id: checkoutId }).eq('id', pedido.id)

    return json({ url: `https://asaas.com/checkoutSession/show?id=${checkoutId}` })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro inesperado.' }, 500)
  }
})
