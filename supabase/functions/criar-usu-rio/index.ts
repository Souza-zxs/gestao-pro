// Cria um usuário de equipe (colaborador) já com e-mail confirmado, sem
// depender do envio de e-mail de confirmação do Supabase — o limite de envio
// da conta padrão (sem SMTP próprio) é baixíssimo e travava o cadastro pela
// tela de Configurações (erro "email rate limit exceeded").
//
// Só faz sentido pular a confirmação aqui porque é o ADMIN, já autenticado,
// criando a conta de alguém em quem ele confia — diferente do autocadastro
// público do portal (PortalLogin.tsx), que continua exigindo confirmação.
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

const CARGOS_VALIDOS = ['admin', 'instrutor', 'aluno', 'user']

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    // Client "como o usuário" — confirma quem está chamando e, mais adiante,
    // roda set_user_role() com o auth.uid() correto do admin (não do service
    // role), preservando a trava de "admin não rebaixa a si mesmo" e o
    // efeito colateral de entrar em Equipe/membros quando o cargo é instrutor.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Não autenticado.' }, 401)

    const { data: perfil } = await userClient.from('usuarios').select('cargo').eq('id', user.id).single()
    if (perfil?.cargo !== 'admin') {
      return json({ error: 'Acesso negado: apenas administradores podem criar usuários.' }, 403)
    }

    const { name, email, password, role } = await req.json()
    if (!name?.trim() || !email?.trim()) return json({ error: 'Nome e e-mail são obrigatórios.' }, 400)
    if (!password || password.length < 6) return json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, 400)
    if (!CARGOS_VALIDOS.includes(role)) return json({ error: `Cargo inválido: ${role}` }, 400)

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true, // já nasce confirmado — não depende de envio de e-mail
      user_metadata: { name: name.trim(), role },
    })
    if (createErr) return json({ error: createErr.message }, 400)

    const newId = created.user.id

    // Fixa o cargo em public.usuarios (fonte de verdade) via a mesma RPC que
    // o admin usaria pra promover alguém — cobre também o insert automático
    // em membros quando role = 'instrutor' (migrations 028/029).
    const { error: roleErr } = await userClient.rpc('set_user_role', { target_user: newId, new_role: role })
    if (roleErr) {
      return json({
        aviso: 'Usuário criado, mas falhou ao fixar o cargo: ' + roleErr.message + '. Ajuste na lista de usuários.',
      })
    }

    return json({ ok: true })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro inesperado.' }, 500)
  }
})
