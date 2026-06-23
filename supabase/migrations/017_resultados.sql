-- ============================================================================
-- 017 — Resultados (faturamento mensal por cliente, por colaborador)
-- ============================================================================
-- Espelha a planilha "Resultado <Colaborador> - Shopee": cada linha é o
-- resultado de UM cliente em UM mês, pertencente a UM colaborador.
--   • O ADMIN cria as linhas e atribui (colaborador + cliente + mês).
--   • Cada COLABORADOR vê e edita apenas os SEUS resultados (preenche os números).
-- Depende da 008 (is_admin/is_team) e da 006 (clientes).

create extension if not exists "uuid-ossp";

create table if not exists resultados (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,   -- admin dono
  colaborador_nome text not null default '',
  colaborador_email text not null default '',     -- identidade p/ a RLS
  cliente_id uuid references clientes(id) on delete set null,
  cliente_nome text not null default '',
  mes text not null default '',                    -- 'YYYY-MM' (mês de referência)
  faturamento_anterior numeric not null default 0, -- Faturamento do Mês Anterior
  meta_mes numeric not null default 0,             -- Meta do mês
  semana_1 numeric not null default 0,
  semana_2 numeric not null default 0,
  semana_3 numeric not null default 0,
  semana_4 numeric not null default 0,
  semana_5 numeric not null default 0,
  pedidos_1 integer not null default 0,            -- "todos os pedidos" (semana 1)
  pedidos_2 integer not null default 0,
  pedidos_3 integer not null default 0,
  pedidos_4 integer not null default 0,
  pedidos_5 integer not null default 0,
  pedidos_cancelados integer not null default 0,   -- Pedidos Cancelados (novo)
  projecao numeric not null default 0,
  status text not null default 'Linear',
  criado_em timestamptz default now()
);

create index if not exists resultados_colab_idx on resultados (colaborador_email);
create index if not exists resultados_mes_idx on resultados (mes);

alter table resultados enable row level security;

-- Ver: admin vê tudo; colaborador só os seus.
drop policy if exists "resultados ver" on resultados;
create policy "resultados ver" on resultados for select to authenticated using (
  public.is_admin() or colaborador_email = (auth.jwt() ->> 'email')
);

-- Criar/atribuir: só admin (é ele quem coloca os clientes de cada colaborador).
drop policy if exists "resultados criar" on resultados;
create policy "resultados criar" on resultados for insert to authenticated with check (public.is_admin());

-- Editar: admin tudo; colaborador só os seus (o with check impede reatribuir p/ outro).
drop policy if exists "resultados editar" on resultados;
create policy "resultados editar" on resultados for update to authenticated using (
  public.is_admin() or colaborador_email = (auth.jwt() ->> 'email')
) with check (
  public.is_admin() or colaborador_email = (auth.jwt() ->> 'email')
);

-- Apagar: só admin.
drop policy if exists "resultados apagar" on resultados;
create policy "resultados apagar" on resultados for delete to authenticated using (public.is_admin());
