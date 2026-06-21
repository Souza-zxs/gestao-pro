-- Quadro de tarefas da equipe.
-- Visibilidade: o ADMIN vê todas; cada COLABORADOR vê apenas as atribuídas a ele
-- (pelo e-mail) ou as que ele mesmo criou. Depende da 008 (is_admin/is_team).
create extension if not exists "uuid-ossp";

create table if not exists tarefas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- quem criou
  titulo text not null,
  descricao text not null default '',
  responsavel_nome text not null default '',
  responsavel_email text not null default '',   -- identidade do responsável (p/ a RLS)
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  status text not null default 'a_fazer' check (status in ('a_fazer', 'fazendo', 'concluida')),
  recorrencia text not null default 'nenhuma' check (recorrencia in ('nenhuma', 'diaria', 'semanal', 'mensal')),
  prazo date,
  criado_em timestamptz default now()
);

create index if not exists tarefas_status_idx on tarefas (status);
create index if not exists tarefas_responsavel_idx on tarefas (responsavel_email);

alter table tarefas enable row level security;

-- "Minha tarefa" = atribuída a mim (e-mail) OU criada por mim.
drop policy if exists "tarefas ver" on tarefas;
drop policy if exists "tarefas criar" on tarefas;
drop policy if exists "tarefas editar" on tarefas;
drop policy if exists "tarefas apagar" on tarefas;

create policy "tarefas ver" on tarefas for select to authenticated using (
  public.is_admin()
  or responsavel_email = (auth.jwt() ->> 'email')
  or user_id = auth.uid()
);

-- Criar tarefa: só admin.
create policy "tarefas criar" on tarefas for insert to authenticated with check (public.is_admin());

create policy "tarefas editar" on tarefas for update to authenticated using (
  public.is_admin()
  or responsavel_email = (auth.jwt() ->> 'email')
  or user_id = auth.uid()
) with check (
  public.is_admin()
  or responsavel_email = (auth.jwt() ->> 'email')
  or user_id = auth.uid()
);

create policy "tarefas apagar" on tarefas for delete to authenticated using (
  public.is_admin() or user_id = auth.uid()
);
