-- ============================================================================
-- 021 — Tarefas padrão (gerais) aplicadas a todos os clientes
-- ============================================================================
-- Uma tarefa "padrão" é um MODELO geral que vale para todo cliente:
--   • o modelo tem padrao = true e nenhum cliente (clientes = []);
--   • cada cliente ganha uma CÓPIA (padrao = false) com template_id apontando
--     para o modelo — é essa cópia que vira card no quadro (um kanban por cliente).
-- A materialização das cópias acontece no app (src/lib/tarefas.ts):
--   • ao criar um cliente  -> cria uma cópia de cada modelo para ele;
--   • ao criar um modelo   -> cria uma cópia dele para cada cliente existente.
-- Depende da 020 (coluna clientes jsonb) e da 016 (cliente_id/cliente_nome).

alter table tarefas add column if not exists padrao boolean not null default false;

-- template_id: cópia -> modelo. ON DELETE CASCADE: apagar o modelo remove
-- automaticamente todas as cópias geradas por ele.
alter table tarefas
  add column if not exists template_id uuid null
  references tarefas(id) on delete cascade;

create index if not exists idx_tarefas_template_id on tarefas(template_id);
create index if not exists idx_tarefas_padrao on tarefas(padrao) where padrao;
