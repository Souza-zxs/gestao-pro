-- ============================================================================
-- 028 — Cargo "instrutor" entra automaticamente na Equipe (membros)
-- ============================================================================
-- Até aqui existiam DOIS cadastros de colaborador desconectados:
--   • public.usuarios.cargo  — RBAC (quem loga como admin/instrutor/aluno/user)
--   • public.membros         — "Equipe" gerida à mão em Tarefas → Equipe, usada
--                               pra atribuir Responsável nas tarefas e casar o
--                               campo "Responsável" de um cliente com um e-mail.
-- Promover alguém a instrutor em Configurações → Cargos não fazia essa pessoa
-- aparecer em Tarefas → Equipe — o admin precisava cadastrá-la de novo à mão.
--
-- Esta migration faz o cargo "instrutor" entrar automaticamente como membro da
-- Equipe (colaborador), nos dois sentidos:
--   1) daqui pra frente: set_user_role() insere em membros ao promover alguém
--      a instrutor (idempotente — não duplica se a pessoa já estiver na lista);
--   2) backfill: quem já é instrutor hoje e ainda não está em membros entra
--      agora, associado ao primeiro admin cadastrado (dono da lista).
-- Rebaixar um instrutor NÃO remove ele de membros automaticamente — a saída
-- continua manual (Tarefas → Equipe → remover), pra não desatribuir tarefas
-- ou histórico sem querer.

-- ---------------------------------------------------------------------------
-- 1) Backfill dos instrutores já existentes.
-- ---------------------------------------------------------------------------
do $$
declare admin_id uuid;
begin
  select id into admin_id from public.usuarios where cargo = 'admin' order by criado_em asc limit 1;
  if admin_id is not null then
    insert into public.membros (user_id, nome, email)
    select admin_id, u.nome, u.email
    from public.usuarios u
    where u.cargo = 'instrutor'
      and not exists (
        select 1 from public.membros m
        where m.user_id = admin_id and lower(m.email) = lower(u.email)
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) set_user_role(): ao promover alguém a instrutor, adiciona em membros
--    (dono = quem está chamando a função, sempre um admin — mesma regra de
--    dono usada quando o admin cadastra manualmente em Tarefas → Equipe).
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
        select 1 from public.membros m
        where m.user_id = auth.uid() and lower(m.email) = lower(u.email)
      );
  end if;
end;
$$;

revoke all on function public.set_user_role(uuid, text)      from public, anon;
grant execute on function public.set_user_role(uuid, text)   to authenticated;
