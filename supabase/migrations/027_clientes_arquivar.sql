-- Arquivamento de clientes: soft-delete para tirar clientes inativos da lista
-- principal (aba "Ativos") sem apagar o histórico. Aparecem na aba "Arquivados"
-- e podem ser restaurados a qualquer momento.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT FALSE;
