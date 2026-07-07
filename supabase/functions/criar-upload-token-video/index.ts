// Gera um "delegated upload token" da api.video — o navegador usa só esse
// token pra subir o vídeo DIRETO pra api.video (sem passar pelo Supabase, sem
// nunca ver a API key real). Só admin/instrutor (quem gerencia conteúdo de
// curso, ver curso.manage em src/lib/rbac.ts) pode pedir um token.
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
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Não autenticado.' }, 401)

    const { data: perfil } = await userClient.from('usuarios').select('cargo').eq('id', user.id).single()
    if (!perfil || !['admin', 'instrutor'].includes(perfil.cargo)) {
      return json({ error: 'Acesso negado: apenas admin/instrutor gerenciam conteúdo de curso.' }, 403)
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: cfg } = await adminClient
      .from('configuracoes_video').select('apivideo_api_key').eq('id', true).single()
    if (!cfg?.apivideo_api_key) {
      return json({ error: 'Vídeo ainda não configurado. Fale com o administrador.' }, 400)
    }

    // HTTP Basic Auth (API key como usuário, senha vazia) — é o esquema
    // documentado em docs.api.video/reference/authentication pra API da
    // api.video em geral. Se vier 401, ver a nota em obter-token-video-aula.
    const tokenRes = await fetch('https://ws.api.video/upload-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(`${cfg.apivideo_api_key}:`)}` },
      body: JSON.stringify({ ttl: 7200 }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) {
      return json({ error: tokenData?.title || 'Falha ao gerar token de upload.', detalhe: tokenData }, 400)
    }

    return json({ tokenId: tokenData.tokenId })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro inesperado.' }, 500)
  }
})
