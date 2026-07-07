-- ============================================================================
-- 025 — Configuração de vídeo (api.video) + coluna de vídeo enviado em aulas
-- ============================================================================
-- Upload de vídeo direto dentro do Gestão Pro, sem passar pelo Panda Video
-- (descartado: exige a API key completa embutida no próprio pedido de upload,
-- o que só pode ser montado no servidor — e uma Edge Function não aguenta
-- proxiar um arquivo de vídeo grande, tem limite de ~150s). A api.video
-- resolve isso com "delegated upload tokens": o servidor gera um token
-- limitado sem nunca expor a API key, e o navegador sobe o arquivo direto pra
-- api.video com esse token — sem passar pelo Supabase.
--
-- Mesma receita de segurança da migration 024 (configuracoes_pagamento): a
-- chave nunca pode chegar ao navegador, então esta tabela também não tem
-- NENHUMA policy de SELECT — só as Edge Functions (service role) leem.

create table if not exists public.configuracoes_video (
  id boolean primary key default true check (id),
  apivideo_api_key text,
  atualizado_em timestamptz not null default now()
);

insert into public.configuracoes_video (id) values (true) on conflict (id) do nothing;

alter table public.configuracoes_video enable row level security;
-- Sem nenhuma policy: leitura/escrita só via as funções security definer
-- abaixo, ou pelas Edge Functions usando a service role.

create or replace function public.status_config_video()
returns table (configurado boolean, ultimos4 text)
language plpgsql security definer set search_path = public as $$
declare
  cfg record;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas administradores podem ver a configuração de vídeo';
  end if;

  select * into cfg from public.configuracoes_video where id = true;

  return query select
    (cfg.apivideo_api_key is not null and cfg.apivideo_api_key <> ''),
    case when cfg.apivideo_api_key is not null and length(cfg.apivideo_api_key) >= 4
         then right(cfg.apivideo_api_key, 4) else null end;
end;
$$;

create or replace function public.salvar_config_video(api_key text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas administradores podem configurar vídeo';
  end if;

  update public.configuracoes_video
  set apivideo_api_key = api_key, atualizado_em = now()
  where id = true;
end;
$$;

revoke all on function public.status_config_video()   from public, anon;
revoke all on function public.salvar_config_video(text) from public, anon;
grant execute on function public.status_config_video()   to authenticated;
grant execute on function public.salvar_config_video(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Vídeo enviado (api.video). video_url continua existindo pra quem preferir
-- colar um link (YouTube/Vimeo/outro) — os dois campos coexistem, o admin
-- escolhe um dos dois por aula.
-- ---------------------------------------------------------------------------
alter table public.aulas add column if not exists video_apivideo_id text;
