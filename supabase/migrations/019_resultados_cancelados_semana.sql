-- ============================================================================
-- 019 — Resultados: pedidos cancelados por semana
-- ============================================================================
-- Antes havia um único "pedidos_cancelados" no fechamento. Agora cada semana
-- tem seus próprios cancelados (ao lado de faturamento/pedidos da semana). O
-- campo do fechamento passa a ser "Pedidos válidos" = pedidos - cancelados,
-- calculado no front a partir destas colunas.
--   pedidos_cancelados (legado) continua existindo e é mantido = soma das
--   semanas, para não quebrar consultas/métricas antigas.
-- Depende da 017 (resultados).

alter table resultados add column if not exists cancelados_1 integer not null default 0;
alter table resultados add column if not exists cancelados_2 integer not null default 0;
alter table resultados add column if not exists cancelados_3 integer not null default 0;
alter table resultados add column if not exists cancelados_4 integer not null default 0;
alter table resultados add column if not exists cancelados_5 integer not null default 0;

-- Migra o total antigo para a 1ª semana (preserva o dado existente).
update resultados
   set cancelados_1 = pedidos_cancelados
 where pedidos_cancelados > 0
   and cancelados_1 = 0 and cancelados_2 = 0 and cancelados_3 = 0
   and cancelados_4 = 0 and cancelados_5 = 0;
