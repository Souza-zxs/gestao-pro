-- Tabela Leads (funil de prospecção + kanban de temperatura)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  contato TEXT NOT NULL DEFAULT '',
  origem TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'novo'
    CHECK (status IN ('novo', 'contatado', 'qualificado', 'convertido', 'perdido')),
  temperatura TEXT NOT NULL DEFAULT 'frio'
    CHECK (temperatura IN ('frio', 'morno', 'quente', 'fechado', 'perdido')),
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  data_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Caso a tabela já exista sem a coluna de temperatura do kanban, adiciona-a
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS temperatura TEXT NOT NULL DEFAULT 'frio';

-- Garante o CHECK das temperaturas do kanban (frio, morno, quente, fechado, perdido)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_temperatura_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_temperatura_check
  CHECK (temperatura IN ('frio', 'morno', 'quente', 'fechado', 'perdido'));

-- Índice para o agrupamento por temperatura no kanban
CREATE INDEX IF NOT EXISTS leads_user_temperatura_idx ON leads (user_id, temperatura);

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own leads" ON leads;
CREATE POLICY "Users can manage own leads" ON leads
  FOR ALL USING (auth.uid() = user_id);
