-- Tabela News
CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL DEFAULT '',
  publicado BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela Apresentações
CREATE TABLE IF NOT EXISTS apresentacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  data DATE NOT NULL,
  local TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'realizada', 'cancelada')),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela Financeiro
CREATE TABLE IF NOT EXISTS financeiro (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  categoria TEXT NOT NULL DEFAULT 'Outros',
  data DATE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE apresentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own news" ON news FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own apresentacoes" ON apresentacoes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own financeiro" ON financeiro FOR ALL USING (auth.uid() = user_id);
