-- ============================================================================
-- 016 — Vincula tarefas a um cliente (opcional)
-- ============================================================================
-- Uma tarefa pode ser "para um cliente específico". Guardamos o id (FK) e o nome
-- denormalizado (cliente_nome) para exibir sem join e sobreviver à exclusão do
-- cliente (on delete set null zera o id, mas o nome continua no histórico).
-- A leitura de `clientes` pela equipe já é liberada pela migration 008 (is_team).

alter table tarefas
  add column if not exists cliente_id uuid references clientes(id) on delete set null,
  add column if not exists cliente_nome text not null default '';

create index if not exists tarefas_cliente_idx on tarefas (cliente_id);

-- Também no log de conclusões, para análise por cliente.
alter table tarefas_concluidas
  add column if not exists cliente_nome text not null default '';



