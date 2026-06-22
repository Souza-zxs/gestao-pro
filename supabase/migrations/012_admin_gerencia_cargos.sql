-- ============================================================================
-- 012 — Admin gerencia cargos (roles) de qualquer usuário
-- ============================================================================
-- O papel (role) de cada usuário vive em auth.users.raw_app_meta_data->>'role'
-- (definido pelo servidor, à prova de adulteração — ver migration 008). O
-- frontend NÃO pode escrever em app_metadata nem listar usuários sem a chave
-- service_role, que jamais pode ir para o navegador.
--
-- Solução: duas funções SECURITY DEFINER (rodam como o dono = postgres, com
-- acesso ao schema auth) que SÓ um admin pode executar. O frontend as chama via
-- supabase.rpc(...). Assim não é preciso Edge Function nem service_role no app.
--
-- OBS: ao trocar o cargo de um usuário, o JWT que ele já tem em mãos continua
-- com o papel antigo até o token renovar (próximo login ou refresh, ~1h). O app
-- avisa o admin sobre isso.

-- ---------------------------------------------------------------------------
-- Lista todos os usuários com seu cargo efetivo (somente admin).
-- ---------------------------------------------------------------------------
create or replace function public.list_team_users()
returns table (id uuid, email text, name text, role text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas administradores podem listar usuários';
  end if;

  return query
    select
      u.id,
      u.email::text,
      coalesce(u.raw_user_meta_data ->> 'name', split_part(u.email::text, '@', 1)) as name,
      coalesce(
        u.raw_app_meta_data  ->> 'role',
        u.raw_user_meta_data ->> 'role',
        'admin'
      ) as role
    from auth.users u
    order by u.email;
end;
$$;

-- ---------------------------------------------------------------------------
-- Define o cargo de um usuário em app_metadata (somente admin).
-- ---------------------------------------------------------------------------
create or replace function public.set_user_role(target_user uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas administradores podem alterar cargos';
  end if;

  if new_role not in ('admin', 'instrutor', 'aluno') then
    raise exception 'Cargo inválido: %', new_role;
  end if;

  -- Trava de segurança: um admin não pode rebaixar a si mesmo (evita ficar
  -- sem nenhum admin / se trancar para fora da gestão).
  if target_user = auth.uid() and new_role <> 'admin' then
    raise exception 'Você não pode remover seu próprio acesso de administrador';
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', new_role)
  where id = target_user;

  if not found then
    raise exception 'Usuário não encontrado';
  end if;
end;
$$;

-- Apenas usuários autenticados podem invocar (o admin-check é feito dentro).
revoke all on function public.list_team_users()              from public, anon;
revoke all on function public.set_user_role(uuid, text)      from public, anon;
grant execute on function public.list_team_users()           to authenticated;
grant execute on function public.set_user_role(uuid, text)   to authenticated;
