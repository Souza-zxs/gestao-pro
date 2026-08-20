-- ============================================================================
-- 034 — Excluir usuário não apaga mais os dados da equipe
-- ============================================================================
-- Até aqui delete_team_user() (migration 033) só fazia `delete from auth.users`,
-- que dispara o ON DELETE CASCADE de toda tabela com user_id (ver migrations
-- 001 em diante) e apagava JUNTO tudo que a pessoa excluída tinha criado —
-- tarefas, clientes, leads, financeiro etc. — mesmo sendo dado da equipe
-- inteira, não só dela.
--
-- Esta migration reescreve delete_team_user() para, antes de excluir a conta:
--
--   1) "Abrir" tudo que era responsabilidade da pessoa (tarefas.responsavel_*,
--      resultados.colaborador_*, clientes.responsavel, e o checklist por
--      cliente dentro de tarefas.clientes) — fica em branco, pronto pra
--      atribuir a outra pessoa pelas telas que já existem.
--   2) Transferir a "criação" (user_id) de todo registro dela para o admin que
--      está excluindo — assim o CASCADE não tem mais nada da pessoa pra
--      apagar, e nada da equipe se perde.
--
-- Só então a conta é excluída de fato.

create or replace function public.delete_team_user(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
  target_nome   text;
  acting_admin  uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas administradores podem excluir usuários';
  end if;

  if target_user = acting_admin then
    raise exception 'Você não pode excluir sua própria conta';
  end if;

  select email, nome into target_email, target_nome
  from public.usuarios where id = target_user;

  if target_email is null then
    raise exception 'Usuário não encontrado';
  end if;

  -- ---------------------------------------------------------------------
  -- 1) Abre o que era responsabilidade dela, pra reatribuir a outra pessoa.
  -- ---------------------------------------------------------------------
  update tarefas
     set responsavel_nome = '', responsavel_email = ''
   where lower(responsavel_email) = lower(target_email);

  update resultados
     set colaborador_nome = '', colaborador_email = ''
   where lower(colaborador_email) = lower(target_email);

  update clientes
     set responsavel = ''
   where trim(coalesce(responsavel, '')) <> ''
     and (
       lower(trim(responsavel)) = lower(trim(coalesce(target_nome, '')))
       or lower(trim(responsavel)) in (
            select lower(trim(m.nome))
            from membros m
            where lower(m.email) = lower(target_email)
          )
     );

  -- Checklist por cliente dentro da tarefa (cópias de tarefa padrão).
  update tarefas t
     set clientes = coalesce((
       select jsonb_agg(
         case
           when lower(elem ->> 'responsavel_email') = lower(target_email)
             then (elem - 'responsavel_nome' - 'responsavel_email')
                  || jsonb_build_object('responsavel_nome', '', 'responsavel_email', '')
           else elem
         end
       )
       from jsonb_array_elements(t.clientes) elem
     ), '[]'::jsonb)
   where exists (
     select 1 from jsonb_array_elements(t.clientes) e
      where lower(e ->> 'responsavel_email') = lower(target_email)
   );

  -- ---------------------------------------------------------------------
  -- 2) Passa a "criação" dos registros dela pro admin que está excluindo,
  --    pra o CASCADE de auth.users não apagar nada da equipe.
  --    pagamentos_config (user_id único) e horarios_disponiveis
  --    (user_id+dia_semana único) podem colidir com o que o admin já tem —
  --    nesse caso descarta a linha da pessoa excluída (é só configuração,
  --    a do admin prevalece) em vez de transferir.
  -- ---------------------------------------------------------------------
  delete from pagamentos_config
   where user_id = target_user
     and exists (select 1 from pagamentos_config where user_id = acting_admin);
  update pagamentos_config set user_id = acting_admin where user_id = target_user;

  delete from horarios_disponiveis h
   where h.user_id = target_user
     and exists (
       select 1 from horarios_disponiveis h2
        where h2.user_id = acting_admin and h2.dia_semana = h.dia_semana
     );
  update horarios_disponiveis set user_id = acting_admin where user_id = target_user;

  update colaboradores          set user_id = acting_admin where user_id = target_user;
  update agendamentos           set user_id = acting_admin where user_id = target_user;
  update bloqueios              set user_id = acting_admin where user_id = target_user;
  update turmas                 set user_id = acting_admin where user_id = target_user;
  update alunos                 set user_id = acting_admin where user_id = target_user;
  update leads                  set user_id = acting_admin where user_id = target_user;
  update eventos                set user_id = acting_admin where user_id = target_user;
  update news                   set user_id = acting_admin where user_id = target_user;
  update apresentacoes          set user_id = acting_admin where user_id = target_user;
  update financeiro             set user_id = acting_admin where user_id = target_user;
  update categorias_financeiras set user_id = acting_admin where user_id = target_user;
  update clientes               set user_id = acting_admin where user_id = target_user;
  update tarefas                set user_id = acting_admin where user_id = target_user;
  update membros                set user_id = acting_admin where user_id = target_user;
  update tarefas_concluidas     set user_id = acting_admin where user_id = target_user;
  update tarefas_comentarios    set user_id = acting_admin where user_id = target_user;
  update resultados             set user_id = acting_admin where user_id = target_user;

  -- ---------------------------------------------------------------------
  -- 3) Só agora exclui a conta (cascade limpa public.usuarios e o que
  --    sobrou sem nenhuma linha própria).
  -- ---------------------------------------------------------------------
  delete from auth.users where id = target_user;

  if not found then
    raise exception 'Usuário não encontrado';
  end if;
end;
$$;

revoke all on function public.delete_team_user(uuid) from public, anon;
grant execute on function public.delete_team_user(uuid) to authenticated;
