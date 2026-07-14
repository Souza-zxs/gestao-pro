-- ============================================================================
-- 029 — Corrige duplicação em membros causada pela 028 + trava duplicata futura
-- ============================================================================
-- A 028 só conferia duplicata DENTRO do mesmo user_id (dono da linha). Só que
-- a LEITURA de membros é liberada pra toda a equipe, sem filtro por user_id
-- (policy "membros leitura equipe", migration 011) — na prática é uma lista
-- ÚNICA e compartilhada. Então bastava a linha nova cair com um user_id
-- diferente da linha manual já existente (ex.: o "primeiro admin" escolhido
-- no backfill da 028 não era a mesma conta que já tinha cadastrado aquele
-- colaborador à mão em Tarefas → Equipe, ou o admin logado ao promover
-- alguém a instrutor não era o dono da linha manual pré-existente) pra o
-- mesmo colaborador aparecer duas vezes na tela.

-- ---------------------------------------------------------------------------
-- 1) Dedup: mantém a linha mais antiga de cada e-mail (case-insensitive),
--    apaga o resto. Empate (mesmo instante) resolvido pelo id, pra ficar
--    determinístico.
-- ---------------------------------------------------------------------------
delete from public.membros m
using public.membros m2
where lower(m.email) = lower(m2.email)
  and (coalesce(m.criado_em, 'epoch'::timestamptz), m.id)
    > (coalesce(m2.criado_em, 'epoch'::timestamptz), m2.id);

-- ---------------------------------------------------------------------------
-- 2) Trava: e-mail único (case-insensitive) — impede duplicata futura, seja
--    manual (Tarefas → Equipe) ou automática (set_user_role, 028).
-- ---------------------------------------------------------------------------
create unique index if not exists membros_email_unico on public.membros (lower(email));

-- ---------------------------------------------------------------------------
-- 3) set_user_role(): o dedupe do insert automático passa a olhar QUALQUER
--    linha com aquele e-mail (não só as do admin chamador) — sem isso, dois
--    admins diferentes promovendo/repromovendo o mesmo instrutor ainda
--    duplicariam. "on conflict" é o backstop contra corrida entre sessões
--    simultâneas (a trava do passo 2 garante que ele sempre existe agora).
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

  -- Instrutor = colaborador da Equipe automaticamente (usado em Tarefas
  -- pra atribuir Responsável e em Clientes pra casar o campo Responsável).
  if new_role = 'instrutor' then
    insert into public.membros (user_id, nome, email)
    select auth.uid(), u.nome, u.email
    from public.usuarios u
    where u.id = target_user
      and not exists (
        select 1 from public.membros m where lower(m.email) = lower(u.email)
      )
    on conflict (lower(email)) do nothing;
  end if;
end;
$$;

revoke all on function public.set_user_role(uuid, text)      from public, anon;
grant execute on function public.set_user_role(uuid, text)   to authenticated;
