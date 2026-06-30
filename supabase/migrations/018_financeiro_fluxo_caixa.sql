-- ============================================================================
-- 018 — Financeiro / Fluxo de Caixa (estilo Seller Finance)
-- ============================================================================
-- Transforma o módulo Financeiro num fluxo de caixa completo:
--   • Categorias customizáveis por usuário (receita/despesa, com cor).
--   • Lançamentos detalhados: status (realizado/previsto = a pagar/a receber),
--     vencimento, conta, forma de pagamento, cliente/fornecedor, documento,
--     observação e recorrência.
-- Depende da 002 (tabela financeiro) e da 008 (is_admin). Financeiro é
-- ADMIN-only, então a tabela de categorias segue a mesma política.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Categorias financeiras (customizáveis)
-- ---------------------------------------------------------------------------
create table if not exists categorias_financeiras (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  cor text not null default '#3b82f6',
  criado_em timestamptz default now(),
  unique (user_id, tipo, nome)
);

create index if not exists categorias_fin_user_idx on categorias_financeiras (user_id);

alter table categorias_financeiras enable row level security;

drop policy if exists "admin gerencia categorias_financeiras" on categorias_financeiras;
create policy "admin gerencia categorias_financeiras" on categorias_financeiras
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Campos detalhados no fluxo de caixa (lançamentos)
-- Colunas novas são nullable / com default, então linhas antigas continuam
-- válidas (viram "realizado", como sempre foram).
-- ---------------------------------------------------------------------------
alter table financeiro
  add column if not exists status text not null default 'realizado'
    check (status in ('realizado', 'previsto')),
  add column if not exists conta text not null default '',
  add column if not exists forma_pagamento text not null default '',
  add column if not exists cliente_fornecedor text not null default '',
  add column if not exists documento text not null default '',
  add column if not exists observacao text not null default '',
  add column if not exists data_vencimento date,
  add column if not exists recorrencia text not null default 'nenhuma'
    check (recorrencia in ('nenhuma', 'semanal', 'mensal', 'anual'));

create index if not exists financeiro_status_idx on financeiro (status);
create index if not exists financeiro_data_idx on financeiro (data);
