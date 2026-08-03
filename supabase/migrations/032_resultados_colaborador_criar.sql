-- ============================================================================
-- 032 — Colaborador (instrutor) também pode criar resultados
-- ============================================================================
-- Antes só o admin criava linhas (ele atribuía cliente + colaborador). Agora
-- o colaborador também pode criar um resultado, mas só atribuído a si mesmo
-- (o with check trava colaborador_email no e-mail do próprio JWT — não dá pra
-- criar em nome de outro colaborador por essa via). Depende da 008 (is_team).

drop policy if exists "resultados criar" on resultados;
create policy "resultados criar" on resultados for insert to authenticated with check (
  public.is_admin() or (public.is_team() and colaborador_email = (auth.jwt() ->> 'email'))
);
