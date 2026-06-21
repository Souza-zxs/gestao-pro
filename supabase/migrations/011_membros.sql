-- Membros da equipe (para atribuir tarefas por seleção, em vez de digitar e-mail).
-- O admin gerencia a lista; toda a equipe pode ler (para os selects). Depende da 008.
create extension if not exists "uuid-ossp";

create table if not exists membros (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- admin dono da lista
  nome text not null,
  email text not null,                 -- e-mail de login do colaborador
  criado_em timestamptz default now()
);

create index if not exists membros_email_idx on membros (email);

alter table membros enable row level security;

drop policy if exists "membros leitura equipe" on membros;
drop policy if exists "membros admin gerencia" on membros;
create policy "membros leitura equipe" on membros for select to authenticated using (public.is_team());
create policy "membros admin gerencia" on membros for all to authenticated using (public.is_admin()) with check (public.is_admin());
