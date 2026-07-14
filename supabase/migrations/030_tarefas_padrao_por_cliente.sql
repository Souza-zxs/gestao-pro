-- ============================================================================
-- 030 — Tarefas padrão: volta a ser 1 card (kanban) por cliente
-- ============================================================================
-- Reverte o redesenho da 026 (1 card compartilhado com clientes como
-- subtarefas/checklist). A app voltou a exigir "cada cliente tem seu próprio
-- kanban": cada cópia de tarefa padrão volta a ser uma linha independente
-- (como na 021), com cliente_id/cliente_nome/responsavel_nome/responsavel_email
-- próprios, arrastável entre colunas e concluída/editada/excluída
-- independentemente das demais.
--
-- 1) Explode cada linha-cópia compartilhada (template_id set, clientes = N
--    itens) em N linhas individuais, uma por cliente, e apaga a linha
--    compartilhada original.
-- 2) Reverte a RLS de "tarefas ver"/"tarefas editar" para a regra simples de
--    antes da 026 (sem a cláusula extra de jsonb_array_elements) — igual à
--    014, já que cada linha volta a pertencer a 1 único responsável.
--
-- Assunção do backfill: se um item já estava concluído (concluido=true) e a
-- tarefa NÃO é recorrente, a nova linha nasce com status='concluida' (não
-- volta a aparecer no quadro); nos demais casos (não concluído, ou
-- recorrente), a nova linha herda o status atual da linha compartilhada.

do $$
declare
  copia record;
  item jsonb;
  novo_status text;
begin
  for copia in select * from tarefas where template_id is not null loop
    for item in select * from jsonb_array_elements(copia.clientes) loop
      novo_status := case
        when copia.recorrencia = 'nenhuma' and (item ->> 'concluido')::boolean is true then 'concluida'
        else copia.status
      end;

      insert into tarefas (
        user_id, titulo, descricao, responsavel_nome, responsavel_email,
        prioridade, status, recorrencia, prazo, cliente_id, cliente_nome,
        clientes, padrao, template_id, criado_em
      ) values (
        copia.user_id, copia.titulo, copia.descricao,
        coalesce(item ->> 'responsavel_nome', ''), coalesce(item ->> 'responsavel_email', ''),
        copia.prioridade, novo_status, copia.recorrencia, copia.prazo,
        nullif(item ->> 'id', '')::uuid, coalesce(item ->> 'nome', ''),
        jsonb_build_array(item - 'responsavel_nome' - 'responsavel_email' - 'concluido' - 'concluido_em'),
        false, copia.template_id, copia.criado_em
      );
    end loop;

    delete from tarefas where id = copia.id;
  end loop;
end $$;

-- RLS: volta à regra simples (igual 014, antes da 026).
drop policy if exists "tarefas ver" on tarefas;
create policy "tarefas ver" on tarefas for select to authenticated using (
  public.is_admin()
  or responsavel_email = (auth.jwt() ->> 'email')
);

drop policy if exists "tarefas editar" on tarefas;
create policy "tarefas editar" on tarefas for update to authenticated using (
  public.is_admin()
  or responsavel_email = (auth.jwt() ->> 'email')
) with check (
  public.is_admin()
  or responsavel_email = (auth.jwt() ->> 'email')
);
