-- ============================================================================
-- 031 — Painel de prazos: comentários em tarefas + prazo no histórico de concluídas
-- ============================================================================
-- Duas adições para o novo painel "A vencer / Feitas" na aba Tarefas:
-- 1) tarefas_concluidas ganha a coluna `prazo` (o prazo que a tarefa tinha ao
--    ser concluída) para o app comparar com concluida_em e mostrar se foi
--    concluída no prazo ou atrasada. Coluna nova, sem backfill (linhas antigas
--    ficam com prazo=null e aparecem sem o selo de atraso).
-- 2) tarefas_comentarios: comentários por tarefa (fluxo de acompanhamento,
--    inclusive quando a tarefa vence). Ver/escrever: responsável da tarefa +
--    admin. Depende da 008 (is_admin) e 010 (tarefas).

alter table tarefas_concluidas add column if not exists prazo date;

create table if not exists tarefas_comentarios (
  id uuid primary key default uuid_generate_v4(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  autor_nome text not null default '',
  autor_email text not null default '',
  texto text not null,
  criado_em timestamptz not null default now()
);

create index if not exists tcoment_tarefa_idx on tarefas_comentarios (tarefa_id, criado_em);

alter table tarefas_comentarios enable row level security;

-- Ver: admin vê tudo; senão só quem é responsável pela tarefa comentada.
drop policy if exists "tcoment ver" on tarefas_comentarios;
create policy "tcoment ver" on tarefas_comentarios for select to authenticated using (
  public.is_admin()
  or exists (
    select 1 from tarefas t
    where t.id = tarefas_comentarios.tarefa_id
      and t.responsavel_email = (auth.jwt() ->> 'email')
  )
);

-- Escrever: mesma regra de visibilidade, e o registro tem que ser do próprio usuário.
drop policy if exists "tcoment escrever" on tarefas_comentarios;
create policy "tcoment escrever" on tarefas_comentarios for insert to authenticated with check (
  user_id = auth.uid()
  and (
    public.is_admin()
    or exists (
      select 1 from tarefas t
      where t.id = tarefas_comentarios.tarefa_id
        and t.responsavel_email = (auth.jwt() ->> 'email')
    )
  )
);
