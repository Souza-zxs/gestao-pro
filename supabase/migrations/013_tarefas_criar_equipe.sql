-- ============================================================================
-- 013 — Corrige criação de tarefas pela equipe
-- ============================================================================
-- A migration 010 deixava a INSERÇÃO restrita a admin (with check is_admin()),
-- mas o próprio modelo prevê que o colaborador veja "as tarefas que ele mesmo
-- criou". Resultado: um instrutor não conseguia criar tarefa nenhuma (a RLS
-- bloqueava silenciosamente).
--
-- Correção: a equipe (admin + instrutor) pode criar tarefas, mas o colaborador
-- só pode criar tarefas em seu próprio nome (user_id = ele). O admin continua
-- podendo criar e atribuir a qualquer pessoa.

drop policy if exists "tarefas criar" on tarefas;

create policy "tarefas criar" on tarefas for insert to authenticated with check (
  public.is_admin()
  or (public.is_team() and user_id = auth.uid())
);
