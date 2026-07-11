-- ============================================================================
-- 026 — Tarefas padrão: 1 card por tarefa, clientes viram subtarefas
-- ============================================================================
-- Antes (021): cada modelo (padrao=true) gerava UMA LINHA POR CLIENTE
-- (template_id -> várias cópias, cada uma com clientes = [1 cliente]).
-- Agora: cada modelo tem NO MÁXIMO UMA linha-cópia, cujo array `clientes`
-- guarda todos os clientes elegíveis — cada item funciona como uma
-- subtarefa (checklist), carregando seu próprio responsável e um estado de
-- conclusão (concluido/concluido_em). A materialização em
-- src/lib/tarefas.ts e a UI em TarefasClient.tsx dependem deste formato.
-- Depende da 021 (padrao/template_id) e da 020 (coluna clientes jsonb).

-- ----------------------------------------------------------------------------
-- 1) Backfill: consolida as cópias existentes de cada modelo numa única linha
-- ----------------------------------------------------------------------------
-- Escolhe a cópia mais antiga como "sobrevivente", agrega o cliente de cada
-- cópia desse template num item do array (responsavel_nome/email = os da
-- linha de origem; concluido=false — hoje uma cópia concluída já é apagada,
-- então não existe estado "concluído" a preservar) e apaga as demais linhas.
do $$
declare
  tpl record;
  sobrevivente uuid;
begin
  for tpl in select id from tarefas where padrao = true loop
    select id into sobrevivente from tarefas
      where template_id = tpl.id
      order by criado_em asc nulls last
      limit 1;

    continue when sobrevivente is null;

    update tarefas t
       set clientes = coalesce(agg.clientes, '[]'::jsonb),
           cliente_id = null,
           cliente_nome = ''
      from (
        select jsonb_agg(
                 item || jsonb_build_object(
                   'responsavel_nome', src.responsavel_nome,
                   'responsavel_email', src.responsavel_email,
                   'concluido', false,
                   'concluido_em', null
                 )
               ) as clientes
          from tarefas src
          cross join lateral jsonb_array_elements(src.clientes) as item
         where src.template_id = tpl.id
      ) agg
     where t.id = sobrevivente;

    delete from tarefas where template_id = tpl.id and id <> sobrevivente;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 2) RLS: colaborador vê/edita o card inteiro se tiver PELO MENOS UM cliente
--    (subtarefa) dele no array `clientes` — além da regra antiga por
--    responsavel_email de linha (continua valendo para tarefas comuns).
-- ----------------------------------------------------------------------------
drop policy if exists "tarefas ver" on tarefas;
create policy "tarefas ver" on tarefas for select to authenticated using (
  public.is_admin()
  or responsavel_email = (auth.jwt() ->> 'email')
  or exists (
       select 1 from jsonb_array_elements(clientes) c
        where c ->> 'responsavel_email' = (auth.jwt() ->> 'email')
     )
);

drop policy if exists "tarefas editar" on tarefas;
create policy "tarefas editar" on tarefas for update to authenticated using (
  public.is_admin()
  or responsavel_email = (auth.jwt() ->> 'email')
  or exists (
       select 1 from jsonb_array_elements(clientes) c
        where c ->> 'responsavel_email' = (auth.jwt() ->> 'email')
     )
) with check (
  public.is_admin()
  or responsavel_email = (auth.jwt() ->> 'email')
  or exists (
       select 1 from jsonb_array_elements(clientes) c
        where c ->> 'responsavel_email' = (auth.jwt() ->> 'email')
     )
);

-- "tarefas apagar" fica como está (014): só admin ou dono do responsavel_email
-- de linha. Um colaborador não pode apagar um card compartilhado só porque um
-- cliente dele está lá dentro.
