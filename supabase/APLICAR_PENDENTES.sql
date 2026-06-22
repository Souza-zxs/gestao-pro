-- ============================================================================
-- APLICAR PENDENTES — cole TUDO isto no Supabase (SQL Editor) e clique RUN.
-- ============================================================================
-- Diagnóstico (jun/2026): a tabela `membros` não existia (migration 011 não
-- aplicada) e a criação de tarefas pela equipe estava bloqueada (faltava a 013).
-- Este script é idempotente — pode rodar quantas vezes quiser, sem quebrar nada.
-- Depende da migration 008 (funções is_admin()/is_team()), que já está aplicada.

-- ---------------------------------------------------------------------------
-- 011 — Tabela `membros` (colaboradores para atribuir tarefas)
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";

create table if not exists membros (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  criado_em timestamptz default now()
);

create index if not exists membros_email_idx on membros (email);

alter table membros enable row level security;

drop policy if exists "membros leitura equipe" on membros;
drop policy if exists "membros admin gerencia" on membros;
create policy "membros leitura equipe" on membros for select to authenticated using (public.is_team());
create policy "membros admin gerencia" on membros for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 013 — Equipe pode criar tarefas (corrige o quadro de tarefas vazio)
-- ---------------------------------------------------------------------------
drop policy if exists "tarefas criar" on tarefas;
create policy "tarefas criar" on tarefas for insert to authenticated with check (
  public.is_admin()
  or (public.is_team() and user_id = auth.uid())
);
