-- Transforma "apresentacoes" de agenda de eventos em ARMAZÉM DE ARQUIVOS de
-- apresentações de slides (PDF, PPT/PPTX, ODP, etc.). Cada linha passa a
-- representar um arquivo guardado no Supabase Storage; os campos de agenda
-- (data/local/status) ficam opcionais para não quebrar linhas já existentes.

-- 1) Colunas do arquivo --------------------------------------------------------
ALTER TABLE apresentacoes ADD COLUMN IF NOT EXISTS arquivo_path     TEXT;
ALTER TABLE apresentacoes ADD COLUMN IF NOT EXISTS arquivo_nome     TEXT;
ALTER TABLE apresentacoes ADD COLUMN IF NOT EXISTS arquivo_tipo     TEXT;
ALTER TABLE apresentacoes ADD COLUMN IF NOT EXISTS arquivo_tamanho  BIGINT;

-- 2) Campos de agenda deixam de ser obrigatórios -------------------------------
ALTER TABLE apresentacoes ALTER COLUMN data DROP NOT NULL;

-- 3) Bucket privado para os arquivos -------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('apresentacoes', 'apresentacoes', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 4) RLS do Storage: cada usuário só acessa a própria pasta ({user_id}/...) -----
DROP POLICY IF EXISTS "apresentacoes ler proprios"     ON storage.objects;
DROP POLICY IF EXISTS "apresentacoes enviar proprios"  ON storage.objects;
DROP POLICY IF EXISTS "apresentacoes apagar proprios"  ON storage.objects;

CREATE POLICY "apresentacoes ler proprios" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'apresentacoes' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "apresentacoes enviar proprios" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'apresentacoes' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "apresentacoes apagar proprios" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'apresentacoes' AND (storage.foldername(name))[1] = auth.uid()::text
  );
