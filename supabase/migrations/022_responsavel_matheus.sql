-- Unifica o colaborador "Matheus Sales" -> "Matheus Silva" (mesma pessoa).
-- Ajusta a aba Clientes e propaga para as tarefas já existentes. Idempotente.
-- Rode no SQL editor do Supabase (bypassa RLS como owner).

-- 1) Base de clientes: o responsável passa a ser "Matheus Silva".
update clientes
   set responsavel = 'Matheus Silva'
 where responsavel = 'Matheus Sales';

-- 2) Tarefas (cards por cliente) que estavam com o nome antigo.
update tarefas
   set responsavel_nome = 'Matheus Silva'
 where responsavel_nome = 'Matheus Sales';

-- 3) Preenche o e-mail dessas tarefas com o do membro da Equipe (se cadastrado),
--    para que o colaborador enxergue os cards (RLS por responsavel_email).
update tarefas t
   set responsavel_email = m.email
  from membros m
 where lower(m.nome) = 'matheus silva'
   and m.user_id = t.user_id
   and t.responsavel_nome = 'Matheus Silva'
   and coalesce(t.responsavel_email, '') = '';
