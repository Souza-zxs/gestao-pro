-- ============================================================================
-- 039 — Subtasks dentro de uma tarefa (checklist livre, estilo Notion)
-- ============================================================================
-- Cada tarefa comum (não-padrão) ganha uma lista de subtasks de texto livre.
-- A regra "só conclui com tudo marcado" vive no front (TarefaDetalhe.tsx /
-- TarefasClient.tsx); aqui só o armazenamento + RLS. Mesmo padrão de
-- visibilidade/escrita de tarefas_comentarios (migration 031): admin ou
-- responsavel_email da tarefa pai.

create table if not exists tarefas_subtarefas (
  id uuid primary key default uuid_generate_v4(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  concluido boolean not null default false,
  concluido_em timestamptz,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists tsub_tarefa_idx on tarefas_subtarefas (tarefa_id, ordem, criado_em);

alter table tarefas_subtarefas enable row level security;

drop policy if exists "tsub ver" on tarefas_subtarefas;
create policy "tsub ver" on tarefas_subtarefas for select to authenticated using (
  public.is_admin()
  or exists (
    select 1 from tarefas t
    where t.id = tarefas_subtarefas.tarefa_id
      and t.responsavel_email = (auth.jwt() ->> 'email')
  )
);

drop policy if exists "tsub escrever" on tarefas_subtarefas;
create policy "tsub escrever" on tarefas_subtarefas for insert to authenticated with check (
  user_id = auth.uid()
  and (
    public.is_admin()
    or exists (
      select 1 from tarefas t
      where t.id = tarefas_subtarefas.tarefa_id
        and t.responsavel_email = (auth.jwt() ->> 'email')
    )
  )
);

drop policy if exists "tsub editar" on tarefas_subtarefas;
create policy "tsub editar" on tarefas_subtarefas for update to authenticated using (
  public.is_admin()
  or exists (
    select 1 from tarefas t
    where t.id = tarefas_subtarefas.tarefa_id
      and t.responsavel_email = (auth.jwt() ->> 'email')
  )
) with check (
  public.is_admin()
  or exists (
    select 1 from tarefas t
    where t.id = tarefas_subtarefas.tarefa_id
      and t.responsavel_email = (auth.jwt() ->> 'email')
  )
);

drop policy if exists "tsub apagar" on tarefas_subtarefas;
create policy "tsub apagar" on tarefas_subtarefas for delete to authenticated using (
  public.is_admin()
  or exists (
    select 1 from tarefas t
    where t.id = tarefas_subtarefas.tarefa_id
      and t.responsavel_email = (auth.jwt() ->> 'email')
  )
);
