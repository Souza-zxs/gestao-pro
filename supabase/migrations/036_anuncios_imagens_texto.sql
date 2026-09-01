-- ============================================================================
-- 036 — Anúncios: campos de imagem viram texto livre + foto do anúncio
-- ============================================================================
-- "Capa", "Quebra Objeção" e "Imagens Secundárias" eram um checklist
-- (booleano feito/pendente); viram caixa de texto livre (link/observação).
-- Também adiciona uma foto de referência do anúncio (upload no bucket público
-- "capas", já usado pelas capas de curso — mesmas policies de is_team()).
-- Idempotente: só converte o tipo se ainda estiver booleano.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'anuncios' and column_name = 'capa' and data_type = 'boolean'
  ) then
    alter table anuncios
      alter column capa drop default,
      alter column capa type text using (case when capa then 'Feito' else '' end),
      alter column capa set default '',
      alter column quebra_objecao drop default,
      alter column quebra_objecao type text using (case when quebra_objecao then 'Feito' else '' end),
      alter column quebra_objecao set default '',
      alter column imagens_secundarias drop default,
      alter column imagens_secundarias type text using (case when imagens_secundarias then 'Feito' else '' end),
      alter column imagens_secundarias set default '';
  end if;
end $$;

alter table anuncios add column if not exists foto_url text;
