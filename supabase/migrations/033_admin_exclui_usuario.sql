-- ============================================================================
-- 033 — Admin exclui usuário da equipe
-- ============================================================================
-- Mesma lógica de 012_admin_gerencia_cargos.sql: função SECURITY DEFINER,
-- só admin pode chamar, sem precisar da service_role no frontend.
--
-- ATENÇÃO: todas as tabelas com user_id referenciam auth.users(id) ON DELETE
-- CASCADE (ver migration 001 em diante). Excluir um usuário apaga junto tudo
-- que ele criou (tarefas, leads, clientes, financeiro etc. com user_id dele).
-- O app avisa disso na confirmação antes de chamar esta função.

create or replace function public.delete_team_user(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas administradores podem excluir usuários';
  end if;

  if target_user = auth.uid() then
    raise exception 'Você não pode excluir sua própria conta';
  end if;

  delete from auth.users where id = target_user;

  if not found then
    raise exception 'Usuário não encontrado';
  end if;
end;
$$;

revoke all on function public.delete_team_user(uuid) from public, anon;
grant execute on function public.delete_team_user(uuid) to authenticated;
