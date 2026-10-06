-- ============================================================================
-- 037 — Resultados: de "mês com 5 semanas" para "ano com 12 meses"
-- ============================================================================
-- Cada linha deixa de representar UM MÊS (colaborador+cliente+mes, com
-- semana_1..5/pedidos_1..5/cancelados_1..5) e passa a representar UM ANO
-- (colaborador+cliente+ano), com um slot por mês (1..12) para faturamento,
-- pedidos, cancelados, meta e faturamento do mês anterior — a mesma
-- granularidade que as semanas tinham, só que agora por mês dentro do ano.
--
-- Migração de dados (idempotente — só roda enquanto a coluna legada `mes`
-- existir): para cada grupo (colaborador_email, cliente_id, ano) escolhe uma
-- linha "titular" e dobra todas as linhas mensais daquele ano nela (cada mês
-- antigo = soma das suas 5 semanas cai no slot fat_<mês> certo); as linhas
-- mensais restantes do grupo são apagadas depois de somadas. `projecao` e
-- `status` continuam como estão (agora representam o ano inteiro, não o mês).

-- 1) novas colunas — um slot por mês (1..12), sempre idempotente (IF NOT EXISTS)
do $$
declare i int;
begin
  for i in 1..12 loop
    execute format('alter table resultados add column if not exists fat_%1$s numeric not null default 0', i);
    execute format('alter table resultados add column if not exists pedidos_%1$s integer not null default 0', i);
    execute format('alter table resultados add column if not exists cancelados_%1$s integer not null default 0', i);
    execute format('alter table resultados add column if not exists meta_%1$s numeric not null default 0', i);
    execute format('alter table resultados add column if not exists fat_anterior_%1$s numeric not null default 0', i);
  end loop;
end $$;

alter table resultados add column if not exists ano text;

-- 2) migra os dados mensais existentes para o formato anual (só roda uma vez)
do $$
declare
  r record;
  mnum int;
begin
  if exists (select 1 from information_schema.columns where table_name = 'resultados' and column_name = 'mes') then

    -- titular (mantido) de cada grupo colaborador+cliente+ano
    update resultados res set ano = grp.ano
    from (
      select colaborador_email, cliente_id, left(mes, 4) as ano, min(id::text)::uuid as keeper
      from resultados
      group by colaborador_email, cliente_id, left(mes, 4)
    ) grp
    where grp.keeper = res.id;

    -- dobra cada linha mensal (inclusive a titular) no slot do mês certo do titular
    for r in
      select res.*, grp.keeper
      from resultados res
      join (
        select colaborador_email, cliente_id, left(mes, 4) as ano, min(id::text)::uuid as keeper
        from resultados
        group by colaborador_email, cliente_id, left(mes, 4)
      ) grp
        on grp.colaborador_email = res.colaborador_email
        and grp.cliente_id is not distinct from res.cliente_id
        and grp.ano = left(res.mes, 4)
    loop
      mnum := substring(r.mes from 6 for 2)::int;
      execute format(
        'update resultados set
           fat_%1$s = fat_%1$s + $1,
           pedidos_%1$s = pedidos_%1$s + $2,
           cancelados_%1$s = cancelados_%1$s + $3,
           meta_%1$s = greatest(meta_%1$s, $4),
           fat_anterior_%1$s = greatest(fat_anterior_%1$s, $5)
         where id = $6',
        mnum
      ) using
        (coalesce(r.semana_1,0)+coalesce(r.semana_2,0)+coalesce(r.semana_3,0)+coalesce(r.semana_4,0)+coalesce(r.semana_5,0)),
        (coalesce(r.pedidos_1,0)+coalesce(r.pedidos_2,0)+coalesce(r.pedidos_3,0)+coalesce(r.pedidos_4,0)+coalesce(r.pedidos_5,0)),
        (coalesce(r.cancelados_1,0)+coalesce(r.cancelados_2,0)+coalesce(r.cancelados_3,0)+coalesce(r.cancelados_4,0)+coalesce(r.cancelados_5,0)),
        coalesce(r.meta_mes, 0),
        coalesce(r.faturamento_anterior, 0),
        r.keeper;
    end loop;

    -- remove as linhas mensais que já foram somadas no titular do grupo
    delete from resultados res
    using (
      select colaborador_email, cliente_id, left(mes, 4) as ano, min(id::text)::uuid as keeper
      from resultados
      group by colaborador_email, cliente_id, left(mes, 4)
    ) grp
    where grp.colaborador_email = res.colaborador_email
      and grp.cliente_id is not distinct from res.cliente_id
      and grp.ano = left(res.mes, 4)
      and res.id <> grp.keeper;

    -- colunas legadas (mês/semanas) não fazem mais sentido no formato anual
    alter table resultados
      drop column mes,
      drop column faturamento_anterior,
      drop column meta_mes,
      drop column semana_1, drop column semana_2, drop column semana_3, drop column semana_4, drop column semana_5,
      drop column pedidos_1, drop column pedidos_2, drop column pedidos_3, drop column pedidos_4, drop column pedidos_5,
      drop column cancelados_1, drop column cancelados_2, drop column cancelados_3, drop column cancelados_4, drop column cancelados_5,
      drop column pedidos_cancelados;

  end if;
end $$;

alter table resultados alter column ano set not null;
create index if not exists resultados_ano_idx on resultados (ano);
