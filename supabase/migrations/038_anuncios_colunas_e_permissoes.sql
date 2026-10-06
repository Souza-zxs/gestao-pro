-- ============================================================================
-- 038 — Anúncios: colunas de kanban dinâmicas (admin cria) + detalhes só admin
-- ============================================================================
-- (1) `anuncios_colunas`: admin passa a poder criar novas etapas no kanban de
--     Anúncios (antes eram 5 fixas via check constraint). `anuncios.status`
--     passa a referenciar `anuncios_colunas.key` em vez de um enum fixo.
-- (2) Instrutor deixa de poder criar/editar/excluir anúncios — só admin. A
--     única ação que sobra pro instrutor é mover o card entre colunas (mudar
--     `status`), que é como ele acompanha o andamento no dia a dia.

create table if not exists anuncios_colunas (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  label text not null,
  ordem integer not null,
  criado_em timestamptz default now()
);

insert into anuncios_colunas (key, label, ordem) values
  ('imagens_a_fazer',    'Imagens a Fazer',   1),
  ('anuncios_a_fazer',   'Anúncios a Fazer',  2),
  ('anuncio_feito',      'Anúncio Feito',     3),
  ('ganhando_escalando', 'Ganhando Escala',   4),
  ('anuncio_escalado',   'Anúncio Escalado',  5)
on conflict (key) do nothing;

alter table anuncios_colunas enable row level security;

drop policy if exists "equipe ve colunas anuncios" on anuncios_colunas;
create policy "equipe ve colunas anuncios" on anuncios_colunas
  for select to authenticated using (public.is_team());

drop policy if exists "admin gerencia colunas anuncios" on anuncios_colunas;
create policy "admin gerencia colunas anuncios" on anuncios_colunas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- `status` deixa de ser um enum fixo (check) e passa a apontar pra uma coluna real.
alter table anuncios drop constraint if exists anuncios_status_check;
alter table anuncios add constraint anuncios_status_fkey
  foreign key (status) references anuncios_colunas(key);

-- RLS de anuncios: antes 1 policy única (is_team() p/ tudo); agora separada por
-- ação — só admin cria/exclui, e o update em si continua liberado pra equipe
-- (o trigger abaixo é quem trava, linha a linha, o que o instrutor pode mudar).
drop policy if exists "equipe gerencia anuncios" on anuncios;

drop policy if exists "equipe ve anuncios" on anuncios;
create policy "equipe ve anuncios" on anuncios
  for select to authenticated using (public.is_team());

drop policy if exists "admin cria anuncios" on anuncios;
create policy "admin cria anuncios" on anuncios
  for insert to authenticated with check (public.is_admin());

drop policy if exists "equipe atualiza anuncios" on anuncios;
create policy "equipe atualiza anuncios" on anuncios
  for update to authenticated using (public.is_team()) with check (public.is_team());

drop policy if exists "admin exclui anuncios" on anuncios;
create policy "admin exclui anuncios" on anuncios
  for delete to authenticated using (public.is_admin());

-- Trigger: instrutor só pode mudar `status` (mover o card); qualquer outro
-- campo alterado por quem não é admin é rejeitado. Admin não tem restrição.
create or replace function public.anuncios_restringe_edicao_instrutor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.cliente_id is distinct from old.cliente_id
    or new.cliente_nome is distinct from old.cliente_nome
    or new.nome_produto is distinct from old.nome_produto
    or new.prioridade is distinct from old.prioridade
    or new.capa is distinct from old.capa
    or new.quebra_objecao is distinct from old.quebra_objecao
    or new.imagens_secundarias is distinct from old.imagens_secundarias
    or new.foto_url is distinct from old.foto_url
    or new.metodo_anuncio is distinct from old.metodo_anuncio
    or new.drive_produto is distinct from old.drive_produto
    or new.data is distinct from old.data
    or new.data_entrega is distinct from old.data_entrega
    or new.margem_ranqueamento is distinct from old.margem_ranqueamento
    or new.margem_final_esperada is distinct from old.margem_final_esperada
    or new.venda_fake_realizada is distinct from old.venda_fake_realizada
    or new.id_anuncio is distinct from old.id_anuncio
    or new.anuncio is distinct from old.anuncio
    or new.data_alteracao_preco is distinct from old.data_alteracao_preco
    or new.meta_vendas_subir_preco is distinct from old.meta_vendas_subir_preco
    or new.margem_final_realizada is distinct from old.margem_final_realizada
  then
    raise exception 'Apenas admin pode editar os detalhes do anúncio. Instrutor só pode mover o card entre colunas.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists anuncios_restringe_edicao on anuncios;
create trigger anuncios_restringe_edicao
  before update on anuncios
  for each row execute function public.anuncios_restringe_edicao_instrutor();
