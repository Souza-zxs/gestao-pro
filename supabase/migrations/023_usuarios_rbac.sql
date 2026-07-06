-- ============================================================================
-- 023 — Tabela public.usuarios como fonte de verdade do RBAC/RLS
-- ============================================================================
-- Até aqui o cargo (role) de cada pessoa morava só no JWT (app_metadata /
-- user_metadata de auth.users), lido por public.jwt_role() (migration 008).
-- Problema conhecido (documentado na migration 012): ao trocar o cargo de
-- alguém, o JWT que a pessoa já tem em mãos continua com o cargo antigo até
-- renovar (~1h ou próximo login).
--
-- Esta migration cria public.usuarios (id/email/nome/cargo), migra todo mundo
-- que já existe preservando o cargo efetivo atual, e faz is_admin()/is_team()
-- passarem a consultar essa tabela em vez do JWT. Os NOMES das funções não
-- mudam, então as policies que já existem (migrations 008, 013, 014...)
-- continuam funcionando sem qualquer alteração.
--
-- Cargo novo: 'user' (cadastro sem nenhuma permissão de curso). 'aluno'
-- continua igual (curso liberado). Todo cadastro novo no portal nasce 'user'
-- e é promovido a 'aluno' automaticamente ao ganhar a primeira matrícula
-- ativa (trigger no fim deste arquivo); e rebaixado de volta se perder todas.

-- ---------------------------------------------------------------------------
-- 1) Tabela
-- ---------------------------------------------------------------------------
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text not null default '',
  cargo text not null default 'user' check (cargo in ('admin', 'instrutor', 'aluno', 'user')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) Backfill — todo mundo que já existe hoje, mantendo o cargo atual.
--    Mesmo fallback que jwt_role() já usa (sem role definido => 'admin'),
--    para não tirar acesso de ninguém que já tem hoje.
-- ---------------------------------------------------------------------------
insert into public.usuarios (id, email, nome, cargo)
select
  u.id,
  u.email::text,
  coalesce(u.raw_user_meta_data ->> 'name', split_part(u.email::text, '@', 1)),
  coalesce(u.raw_app_meta_data ->> 'role', u.raw_user_meta_data ->> 'role', 'admin')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Trigger — todo cadastro NOVO em auth.users entra automaticamente aqui.
--    Default aqui é 'user' (não 'admin'): cadastro novo sem cargo explícito
--    nasce sem permissão nenhuma (comportamento seguro).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.usuarios (id, email, nome, cargo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_app_meta_data ->> 'role', new.raw_user_meta_data ->> 'role', 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4) RBAC — is_admin()/is_team() passam a ler a tabela, não o JWT.
--    security definer: independe das policies de "usuarios" e evita qualquer
--    recursão de RLS (a função sempre pode ler, mesmo sem policy explícita).
--    Fallback sem linha (não deveria acontecer, o trigger cobre) = 'user'
--    (menor privilégio) em vez do antigo 'admin'.
-- ---------------------------------------------------------------------------
create or replace function public.current_cargo() returns text
language sql stable security definer set search_path = public as $$
  select case
    when auth.role() = 'authenticated' then
      coalesce((select cargo from public.usuarios where id = auth.uid()), 'user')
    else 'anon'
  end
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_cargo() = 'admin'
$$;

create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_cargo() in ('admin', 'instrutor')
$$;

-- jwt_role() fica obsoleta (nada mais deveria chamá-la), mas não é removida
-- aqui para não quebrar nada que ainda referencie o nome por engano.
create or replace function public.jwt_role() returns text
language sql stable security definer set search_path = public as $$
  select public.current_cargo()
$$;

-- ---------------------------------------------------------------------------
-- 5) RLS de public.usuarios
-- ---------------------------------------------------------------------------
alter table public.usuarios enable row level security;

drop policy if exists "usuario ve proprio cadastro" on public.usuarios;
create policy "usuario ve proprio cadastro" on public.usuarios
  for select to authenticated using (id = auth.uid());

drop policy if exists "admin ve todos os usuarios" on public.usuarios;
create policy "admin ve todos os usuarios" on public.usuarios
  for select to authenticated using (public.is_admin());

drop policy if exists "admin edita cargos" on public.usuarios;
create policy "admin edita cargos" on public.usuarios
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Sem policy de INSERT/DELETE, nem de UPDATE geral, para clientes: só o
-- trigger handle_new_user() e as funções security definer (aqui e abaixo)
-- escrevem nesta tabela — RLS não se aplica a elas. Um usuário comum troca o
-- PRÓPRIO nome só via set_meu_nome() (não pode se auto-promover de cargo).

create or replace function public.set_meu_nome(novo_nome text)
returns void
language sql security definer set search_path = public as $$
  update public.usuarios set nome = novo_nome, atualizado_em = now() where id = auth.uid()
$$;

revoke all on function public.set_meu_nome(text) from public, anon;
grant execute on function public.set_meu_nome(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) list_team_users() / set_user_role() (migration 012) agora leem/escrevem
--    public.usuarios em vez de auth.users app_metadata. Mesma assinatura RPC.
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
    select u.id, u.email, u.nome, u.cargo
    from public.usuarios u
    order by u.email;
end;
$$;

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

  if new_role not in ('admin', 'instrutor', 'aluno', 'user') then
    raise exception 'Cargo inválido: %', new_role;
  end if;

  -- Trava de segurança: um admin não pode rebaixar a si mesmo (evita ficar
  -- sem nenhum admin / se trancar para fora da gestão).
  if target_user = auth.uid() and new_role <> 'admin' then
    raise exception 'Você não pode remover seu próprio acesso de administrador';
  end if;

  update public.usuarios
  set cargo = new_role, atualizado_em = now()
  where id = target_user;

  if not found then
    raise exception 'Usuário não encontrado';
  end if;
end;
$$;

revoke all on function public.list_team_users()              from public, anon;
revoke all on function public.set_user_role(uuid, text)      from public, anon;
grant execute on function public.list_team_users()           to authenticated;
grant execute on function public.set_user_role(uuid, text)   to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Promoção automática user <-> aluno conforme matrícula ativa.
--    Nunca mexe em admin/instrutor.
-- ---------------------------------------------------------------------------
create or replace function public.trg_matricula_promove_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  alvo_email text;
  tem_ativa boolean;
begin
  -- NEW não existe (não pode nem ser referenciado) num evento de DELETE, e
  -- OLD não existe num INSERT — por isso o if por TG_OP, em vez de coalesce.
  if TG_OP = 'DELETE' then
    alvo_email := old.aluno_email;
  else
    alvo_email := new.aluno_email;
  end if;

  select exists(
    select 1 from public.matriculas m
    where m.aluno_email = alvo_email and m.status = 'ativa'
  ) into tem_ativa;

  update public.usuarios
  set cargo = case
        when tem_ativa and cargo = 'user' then 'aluno'
        when not tem_ativa and cargo = 'aluno' then 'user'
        else cargo
      end,
      atualizado_em = now()
  where email = alvo_email
    and cargo in ('user', 'aluno');

  if TG_OP = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

drop trigger if exists matriculas_promove_usuario on public.matriculas;
create trigger matriculas_promove_usuario
  after insert or update or delete on public.matriculas
  for each row execute function public.trg_matricula_promove_usuario();
