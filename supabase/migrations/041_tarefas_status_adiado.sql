-- ============================================================================
-- 041 — Tarefas: status ganha o valor "adiado"
-- ============================================================================
-- supabase/migrations/010_tarefas.sql criou `status` com um check constraint
-- restrito a ('a_fazer', 'fazendo', 'concluida'). A reformulação da aba
-- Tarefas (tabela agrupada por data, estilo Notion) precisa de um 4º valor
-- organizacional ("Adiado") pras tarefas que ainda estão pendentes — não
-- afeta a lógica de conclusão, que continua baseada em remover/reagendar a
-- linha (ver tarefasAcoes.ts), não em mudar `status` para `concluida`.

alter table tarefas drop constraint if exists tarefas_status_check;
alter table tarefas add constraint tarefas_status_check
  check (status in ('a_fazer', 'fazendo', 'adiado', 'concluida'));
