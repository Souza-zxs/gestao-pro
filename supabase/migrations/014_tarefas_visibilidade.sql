-- ============================================================================
-- 014 — Visibilidade de tarefas: admin vê tudo, instrutor só o que é dele
-- ============================================================================
-- Regra de negócio:
--   • admin     -> vê / edita / remove TODAS as tarefas
--   • instrutor -> só enxerga e mexe nas tarefas DESIGNADAS a ele
--                  (responsavel_email = e-mail do login)
--
-- Antes (010) havia "or user_id = auth.uid()", o que fazia o CRIADOR enxergar
-- tarefas mesmo sem ser o responsável. Removido para casar com a regra acima.
-- A criação continua pela 013 (admin cria p/ qualquer um; instrutor cria p/ si).

-- Ver: admin tudo; demais só as próprias (designadas a eles).
drop policy if exists "tarefas ver" on tarefas;
create policy "tarefas ver" on tarefas for select to authenticated using (
  public.is_admin()
  or responsavel_email = (auth.jwt() ->> 'email')
);

-- Editar (mover status / concluir): admin tudo; instrutor só as designadas a ele.
drop policy if exists "tarefas editar" on tarefas;
create policy "tarefas editar" on tarefas for update to authenticated using (
  public.is_admin()
  or responsavel_email = (auth.jwt() ->> 'email')
) with check (
  public.is_admin()
  or responsavel_email = (auth.jwt() ->> 'email')
);

-- Remover: admin tudo; instrutor só as designadas a ele.
drop policy if exists "tarefas apagar" on tarefas;
create policy "tarefas apagar" on tarefas for delete to authenticated using (
  public.is_admin()
  or responsavel_email = (auth.jwt() ->> 'email')
);
