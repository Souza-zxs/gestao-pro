-- ============================================================================
-- 035 — Dashboard de Acompanhamento de Anúncios
-- ============================================================================
-- Kanban de evolução de um anúncio: cada linha é UM anúncio que nasce em
-- "Imagens a Fazer" e avança (arrastando o card) até "Anúncio Escalado",
-- ganhando mais campos preenchidos a cada etapa. Mesmo modelo de permissão de
-- Tarefas/Clientes: equipe toda (admin + instrutor) vê e edita tudo — sem
-- responsável fixo por linha, então usa o padrão "equipe gerencia" (is_team()),
-- igual à migration 008.

create extension if not exists "uuid-ossp";

create table if not exists anuncios (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- quem criou
  cliente_id uuid references clientes(id) on delete set null,
  cliente_nome text not null default '',
  nome_produto text not null default '',
  status text not null default 'imagens_a_fazer' check (status in (
    'imagens_a_fazer', 'anuncios_a_fazer', 'anuncio_feito', 'ganhando_escalando', 'anuncio_escalado'
  )),
  prioridade text not null default 'media' check (prioridade in ('baixa', 'media', 'alta')),

  -- Imagens a Fazer
  capa boolean not null default false,
  quebra_objecao boolean not null default false,
  imagens_secundarias boolean not null default false,
  metodo_anuncio text not null default '',
  drive_produto text not null default '',
  data date,
  data_entrega date,

  -- Anúncios a Fazer
  margem_ranqueamento numeric(6,2),
  margem_final_esperada numeric(6,2),
  venda_fake_realizada boolean not null default false,

  -- Anúncio Feito / Ganhando Escalando
  id_anuncio text not null default '',
  anuncio text not null default '',
  data_alteracao_preco date,
  meta_vendas_subir_preco text not null default '',

  -- Anúncio Escalado
  margem_final_realizada numeric(6,2),

  criado_em timestamptz default now()
);

create index if not exists anuncios_status_idx on anuncios (status);
create index if not exists anuncios_cliente_idx on anuncios (cliente_id);

alter table anuncios enable row level security;

drop policy if exists "equipe gerencia anuncios" on anuncios;
create policy "equipe gerencia anuncios" on anuncios
  for all to authenticated using (public.is_team()) with check (public.is_team());
