-- ============================================================================
-- 008 — RBAC de equipe (tenant único, dados compartilhados pela equipe)
-- ============================================================================
-- Modelo: uma equipe só. Papéis vêm do JWT (app_metadata.role tem prioridade
-- sobre user_metadata.role; sem role => 'admin', como no app).
--   • admin     -> acesso total
--   • instrutor -> "colaborador": vê quase tudo; edita Leads/Eventos/Clientes;
--                   só VÊ Apresentações; NÃO acessa Financeiro/Calendário/Colaboradores
--   • aluno     -> portal de cursos (sem gestão)
--
-- ATENÇÃO (segurança): user_metadata é editável pelo próprio usuário. Para que o
-- papel seja à prova de adulteração, defina o role do colaborador em
-- app_metadata (Supabase Dashboard > Authentication > usuário > app_metadata:
-- {"role":"instrutor"}). Estas funções priorizam app_metadata justamente por isso.

create or replace function public.jwt_role() returns text
language sql stable as $$
  select case
    when auth.role() = 'authenticated' then coalesce(
      auth.jwt() -> 'app_metadata'  ->> 'role',
      auth.jwt() -> 'user_metadata' ->> 'role',
      'admin'
    )
    else 'anon'
  end
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select public.jwt_role() = 'admin' $$;

create or replace function public.is_team() returns boolean
language sql stable as $$ select public.jwt_role() in ('admin', 'instrutor') $$;

-- ---------------------------------------------------------------------------
-- Equipe vê E edita: Leads, Eventos, Ingressos, Clientes, Alunos, Turmas, News
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['leads','eventos','ingressos','clientes','alunos','turmas','news'] loop
    execute format('drop policy if exists "Users can manage own %s" on %I', t, t);
    execute format('drop policy if exists "equipe gerencia %1$s" on %1$I', t);
    execute format($f$create policy "equipe gerencia %1$s" on %1$I
      for all to authenticated using (public.is_team()) with check (public.is_team())$f$, t);
  end loop;
end $$;
-- (nomes de policy antigos divergentes são tratados abaixo, caso a caso)
drop policy if exists "Users can manage own ingressos" on ingressos;
drop policy if exists "Users can manage own horarios" on horarios_disponiveis;

-- ---------------------------------------------------------------------------
-- Equipe só VÊ; Admin edita: Apresentações
-- ---------------------------------------------------------------------------
drop policy if exists "Users can manage own apresentacoes" on apresentacoes;
drop policy if exists "apresentacoes leitura equipe" on apresentacoes;
drop policy if exists "apresentacoes escrita admin" on apresentacoes;
drop policy if exists "apresentacoes update admin" on apresentacoes;
drop policy if exists "apresentacoes delete admin" on apresentacoes;
create policy "apresentacoes leitura equipe" on apresentacoes for select to authenticated using (public.is_team());
create policy "apresentacoes escrita admin"  on apresentacoes for insert to authenticated with check (public.is_admin());
create policy "apresentacoes update admin"   on apresentacoes for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "apresentacoes delete admin"   on apresentacoes for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Somente Admin: Financeiro, Colaboradores, Pagamentos, Faltas, Calendário
-- (as policies públicas TO anon do agendamento, da migration 004, permanecem)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['financeiro','colaboradores','pagamentos_config','faltas_horas','agendamentos','horarios_disponiveis','bloqueios'] loop
    execute format('drop policy if exists "Users can manage own %s" on %I', t, t);
    execute format('drop policy if exists "admin gerencia %1$s" on %1$I', t);
    execute format($f$create policy "admin gerencia %1$s" on %1$I
      for all to authenticated using (public.is_admin()) with check (public.is_admin())$f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage do bucket "apresentacoes": equipe lê todos os arquivos; admin envia/apaga.
-- (substitui as policies por-dono da migration 005)
-- ---------------------------------------------------------------------------
drop policy if exists "apresentacoes ler proprios"    on storage.objects;
drop policy if exists "apresentacoes enviar proprios" on storage.objects;
drop policy if exists "apresentacoes apagar proprios" on storage.objects;
drop policy if exists "apresentacoes ler equipe"   on storage.objects;
drop policy if exists "apresentacoes enviar admin"  on storage.objects;
drop policy if exists "apresentacoes apagar admin"  on storage.objects;
create policy "apresentacoes ler equipe"  on storage.objects for select to authenticated using (bucket_id = 'apresentacoes' and public.is_team());
create policy "apresentacoes enviar admin" on storage.objects for insert to authenticated with check (bucket_id = 'apresentacoes' and public.is_admin());
create policy "apresentacoes apagar admin" on storage.objects for delete to authenticated using (bucket_id = 'apresentacoes' and public.is_admin());

