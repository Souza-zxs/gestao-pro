-- ============================================================================
-- 020 — Tarefas: múltiplos clientes por tarefa
-- ============================================================================
-- Antes uma tarefa vinculava a NO MÁXIMO um cliente (cliente_id/cliente_nome).
-- Agora pode vincular vários. Guardamos um array JSONB denormalizado com os
-- dados necessários para exibir no quadro sem join e sobreviver à exclusão do
-- cliente: [{ id, nome, loja, telefone }].
--   cliente_id / cliente_nome continuam existindo (= 1º cliente) para não
--   quebrar os filtros e o painel de análise (tarefas_concluidas.cliente_nome).
-- Depende da 016 (cliente_id/cliente_nome em tarefas).

alter table tarefas add column if not exists clientes jsonb not null default '[]'::jsonb;

-- Backfill: leva o cliente único existente para dentro do array. O "numero" é
-- extraído do início do campo loja (ex: "12 - LLModas" -> "12").
update tarefas t
   set clientes = jsonb_build_array(jsonb_build_object(
         'id', t.cliente_id,
         'nome', t.cliente_nome,
         'numero', coalesce((regexp_match(c.loja, '^\s*(\d+)'))[1], ''),
         'loja', coalesce(c.loja, ''),
         'telefone', coalesce(c.telefone, '')
       ))
  from clientes c
 where c.id = t.cliente_id
   and t.cliente_nome <> ''
   and (t.clientes is null or t.clientes = '[]'::jsonb);
