// Devolve uma URL de player com "private token" válida pra tocar o vídeo de
// uma aula enviada via api.video. É chamada toda vez que alguém abre uma
// aula — sem isso, o link do vídeo tocaria pra qualquer um (o vídeo é
// privado justamente pra evitar isso, já que é conteúdo de curso pago).
//
// NOTA: a autenticação da api.video usada aqui (HTTP Basic, API key como
// usuário) é a documentada na página geral de autenticação deles
// (docs.api.video/reference/authentication). Se a chamada devolver 401,
// confirmar no painel da api.video se o formato mudou — o erro real deles é
// repassado na resposta pra facilitar o ajuste.
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
    if (userErr || !user?.email) return json({ error: 'Não autenticado.' }, 401)

    const { aula_id } = await req.json()
    if (!aula_id) return json({ error: 'aula_id é obrigatório.' }, 400)

    const { data: aula, error: aulaErr } = await userClient
      .from('aulas').select('curso_id, video_apivideo_id').eq('id', aula_id).single()
    if (aulaErr || !aula) return json({ error: 'Aula não encontrada.' }, 404)
    if (!aula.video_apivideo_id) return json({ error: 'Esta aula não tem vídeo enviado.' }, 400)

    const { data: perfil } = await userClient.from('usuarios').select('cargo').eq('id', user.id).single()
    const podePreVisualizar = perfil && ['admin', 'instrutor'].includes(perfil.cargo)

    if (!podePreVisualizar) {
      const { data: matriculas } = await userClient
        .from('matriculas').select('id')
        .eq('curso_id', aula.curso_id).eq('aluno_email', user.email).eq('status', 'ativa').limit(1)
      if (!matriculas?.length) {
        return json({ error: 'Você não tem acesso a este curso.' }, 403)
      }
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: cfg } = await adminClient
      .from('configuracoes_video').select('apivideo_api_key').eq('id', true).single()
    if (!cfg?.apivideo_api_key) return json({ error: 'Vídeo ainda não configurado.' }, 400)

    const authHeader = `Basic ${btoa(`${cfg.apivideo_api_key}:`)}`
    const videoRes = await fetch(`https://ws.api.video/videos/${aula.video_apivideo_id}`, {
      headers: { Authorization: authHeader },
    })
    const videoData = await videoRes.json()
    if (!videoRes.ok) {
      return json({ error: videoData?.title || 'Falha ao obter o vídeo.', detalhe: videoData }, 400)
    }

    const url = videoData?.assets?.player
    if (!url) return json({ error: 'A api.video não devolveu a URL do player.' }, 500)

    return json({ url })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro inesperado.' }, 500)
  }
})
