-- ============================================================================
-- 015 — Log de conclusões de tarefas (base do painel de análise do admin)
-- ============================================================================
-- As tarefas concluídas comuns viram status 'concluida' e somem do quadro; as
-- RECORRENTES nunca viram 'concluida' (voltam para 'a_fazer' com o próximo
-- prazo). Sem um registro histórico não dá para analisar produtividade.
--
-- Esta tabela guarda UMA LINHA por conclusão, gravada pelo app no momento em que
-- a pessoa conclui a tarefa. Depende da 008 (is_admin/is_team).

create extension if not exists "uuid-ossp";

create table if not exists tarefas_concluidas (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- quem concluiu
  tarefa_id uuid references tarefas(id) on delete set null,           -- pode sumir depois
  titulo text not null,
  responsavel_nome text not null default '',
  responsavel_email text not null default '',
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),
  recorrencia text not null default 'nenhuma' check (recorrencia in ('nenhuma', 'diaria', 'semanal', 'mensal')),
  criada_em timestamptz,                          -- quando a tarefa foi criada (lead time)
  concluida_em timestamptz not null default now()
);

create index if not exists tconcl_concluida_em_idx on tarefas_concluidas (concluida_em);
create index if not exists tconcl_responsavel_idx on tarefas_concluidas (responsavel_email);

alter table tarefas_concluidas enable row level security;

-- Ver: admin vê tudo; instrutor vê apenas as conclusões dele.
drop policy if exists "tconcl ver" on tarefas_concluidas;
create policy "tconcl ver" on tarefas_concluidas for select to authenticated using (
  public.is_admin()
  or responsavel_email = (auth.jwt() ->> 'email')
);

-- Registrar: equipe, e o registro tem que ser do próprio usuário (ou admin).
drop policy if exists "tconcl registrar" on tarefas_concluidas;
create policy "tconcl registrar" on tarefas_concluidas for insert to authenticated with check (
  public.is_team() and (public.is_admin() or user_id = auth.uid())
);
