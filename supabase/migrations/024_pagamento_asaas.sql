-- ============================================================================
-- 024 — Configuração de pagamento (Asaas) + colunas de correlação em pedidos
-- ============================================================================
-- O checkout do portal passa a usar um gateway real (Asaas), com checkout
-- hospedado: o comprador é redirecionado pra uma página do próprio Asaas
-- (que já mostra PIX/cartão/boleto e coleta os dados dele) e volta pro site
-- depois de pagar. A chave de API é do CLIENTE (dono da conta Asaas), não do
-- Samuel — por isso ela é configurável pela própria tela de Configurações do
-- app, em vez de um secret fixo de deploy.
--
-- A chave nunca pode chegar ao navegador. Por isso esta tabela não tem
-- NENHUMA policy de SELECT: só as Edge Functions (que usam a service role,
-- que ignora RLS) conseguem ler. O admin só enxerga um resumo mascarado via
-- RPC (status_config_pagamento), nunca a chave inteira de volta.

-- gen_random_bytes() (usada pra gerar o webhook_token) vem do pgcrypto.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Tabela de 1 linha só (trava via check em cima de uma PK boolean).
-- ---------------------------------------------------------------------------
create table if not exists public.configuracoes_pagamento (
  id boolean primary key default true check (id),
  asaas_api_key text,
  asaas_ambiente text not null default 'sandbox' check (asaas_ambiente in ('sandbox', 'producao')),
  asaas_webhook_token text,
  atualizado_em timestamptz not null default now()
);

insert into public.configuracoes_pagamento (id) values (true) on conflict (id) do nothing;

alter table public.configuracoes_pagamento enable row level security;
-- Sem nenhuma policy: ninguém autenticado lê/escreve direto na tabela.
-- Leitura/escrita só via as funções security definer abaixo, ou pelas Edge
-- Functions usando a service role (que ignora RLS de qualquer forma).

-- ---------------------------------------------------------------------------
-- 2) RPCs admin-only (reaproveitam is_admin() da migration 023).
-- ---------------------------------------------------------------------------
create or replace function public.status_config_pagamento()
returns table (configurado boolean, ambiente text, ultimos4 text, webhook_token text)
language plpgsql security definer set search_path = public as $$
declare
  cfg record;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas administradores podem ver a configuração de pagamento';
  end if;

  select * into cfg from public.configuracoes_pagamento where id = true;

  return query select
    (cfg.asaas_api_key is not null and cfg.asaas_api_key <> ''),
    cfg.asaas_ambiente,
    case when cfg.asaas_api_key is not null and length(cfg.asaas_api_key) >= 4
         then right(cfg.asaas_api_key, 4) else null end,
    cfg.asaas_webhook_token;
end;
$$;

create or replace function public.salvar_config_pagamento(api_key text, ambiente text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas administradores podem configurar pagamento';
  end if;

  if ambiente not in ('sandbox', 'producao') then
    raise exception 'Ambiente inválido: %', ambiente;
  end if;

  update public.configuracoes_pagamento
  set asaas_api_key = api_key,
      asaas_ambiente = ambiente,
      asaas_webhook_token = coalesce(asaas_webhook_token, encode(gen_random_bytes(24), 'hex')),
      atualizado_em = now()
  where id = true;
end;
$$;

revoke all on function public.status_config_pagamento()         from public, anon;
revoke all on function public.salvar_config_pagamento(text, text) from public, anon;
grant execute on function public.status_config_pagamento()         to authenticated;
grant execute on function public.salvar_config_pagamento(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Correlação do pedido com o checkout do Asaas.
-- ---------------------------------------------------------------------------
alter table public.pedidos add column if not exists gateway_checkout_id text;
alter table public.pedidos add column if not exists mensagem_erro text;

create index if not exists pedidos_gateway_checkout_idx on public.pedidos (gateway_checkout_id);

-- No checkout hospedado do Asaas o comprador escolhe PIX/cartão/boleto só na
-- página deles — no momento em que a gente cria o pedido (antes do redirect)
-- ainda não sabe qual vai ser. 'indefinido' cobre esse intervalo; o webhook
-- atualiza pro método real assim que o Asaas informa (billingType).
alter table public.pedidos drop constraint if exists pedidos_metodo_check;
alter table public.pedidos add constraint pedidos_metodo_check
  check (metodo in ('pix', 'cartao', 'boleto', 'indefinido'));
