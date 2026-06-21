-- Base de Clientes (carteira de lojas atendidas: acompanhamento, fase da conta,
-- faturamento, plataforma e credenciais de acesso de cada conta).
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  loja TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  data_entrada DATE,
  responsavel TEXT NOT NULL DEFAULT '',
  ja_vende BOOLEAN NOT NULL DEFAULT FALSE,
  ultimo_acompanhamento DATE,
  proximo_acompanhamento DATE,
  evolucao_vendas TEXT NOT NULL DEFAULT '',
  fase_conta TEXT NOT NULL DEFAULT '',
  faturamento_mensal TEXT NOT NULL DEFAULT '',
  plataforma TEXT NOT NULL DEFAULT '',
  numero_contas INTEGER NOT NULL DEFAULT 1,
  tipo_cobranca TEXT NOT NULL DEFAULT '',
  login_upseller TEXT NOT NULL DEFAULT '',
  senha_upseller TEXT NOT NULL DEFAULT '',
  login_seller_finance TEXT NOT NULL DEFAULT '',
  senha_seller_finance TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own clientes" ON clientes FOR ALL USING (auth.uid() = user_id);
