-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Colaboradores
CREATE TABLE IF NOT EXISTS colaboradores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo_contrato TEXT NOT NULL CHECK (tipo_contrato IN ('CLT', 'PJ')),
  data_admissao DATE NOT NULL,
  salario_base NUMERIC(10,2) NOT NULL DEFAULT 0,
  vt NUMERIC(10,2) NOT NULL DEFAULT 0,
  vr NUMERIC(10,2) NOT NULL DEFAULT 0,
  va NUMERIC(10,2) NOT NULL DEFAULT 0,
  convenio NUMERIC(10,2) NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações de pagamento
CREATE TABLE IF NOT EXISTS pagamentos_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  dia_pagamento INTEGER NOT NULL DEFAULT 5,
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Faltas e horas extras
CREATE TABLE IF NOT EXISTS faltas_horas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL,
  faltas INTEGER NOT NULL DEFAULT 0,
  horas_extras INTEGER NOT NULL DEFAULT 0,
  UNIQUE(colaborador_id, mes, ano)
);

-- Agendamentos
CREATE TABLE IF NOT EXISTS agendamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_nome TEXT NOT NULL,
  data DATE NOT NULL,
  horario TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'cancelado', 'pendente')),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Horários disponíveis
CREATE TABLE IF NOT EXISTS horarios_disponiveis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(user_id, dia_semana)
);

-- Bloqueios de data
CREATE TABLE IF NOT EXISTS bloqueios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  motivo TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Turmas
CREATE TABLE IF NOT EXISTS turmas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Alunos
CREATE TABLE IF NOT EXISTS alunos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  turma_id UUID REFERENCES turmas(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'trancado', 'formado')),
  data_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Eventos
CREATE TABLE IF NOT EXISTS eventos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  data DATE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Ingressos
CREATE TABLE IF NOT EXISTS ingressos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  comprador TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE faltas_horas ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_disponiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueios ENABLE ROW LEVEL SECURITY;
ALTER TABLE turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingressos ENABLE ROW LEVEL SECURITY;

-- Colaboradores policies
CREATE POLICY "Users can manage own colaboradores" ON colaboradores
  FOR ALL USING (auth.uid() = user_id);

-- Pagamentos config policies
CREATE POLICY "Users can manage own pagamentos_config" ON pagamentos_config
  FOR ALL USING (auth.uid() = user_id);

-- Faltas horas policies
CREATE POLICY "Users can manage own faltas_horas" ON faltas_horas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM colaboradores c WHERE c.id = colaborador_id AND c.user_id = auth.uid())
  );

-- Agendamentos policies
CREATE POLICY "Users can manage own agendamentos" ON agendamentos
  FOR ALL USING (auth.uid() = user_id);

-- Horarios policies
CREATE POLICY "Users can manage own horarios" ON horarios_disponiveis
  FOR ALL USING (auth.uid() = user_id);

-- Bloqueios policies
CREATE POLICY "Users can manage own bloqueios" ON bloqueios
  FOR ALL USING (auth.uid() = user_id);

-- Turmas policies
CREATE POLICY "Users can manage own turmas" ON turmas
  FOR ALL USING (auth.uid() = user_id);

-- Alunos policies
CREATE POLICY "Users can manage own alunos" ON alunos
  FOR ALL USING (auth.uid() = user_id);

-- Eventos policies
CREATE POLICY "Users can manage own eventos" ON eventos
  FOR ALL USING (auth.uid() = user_id);

-- Ingressos policies
CREATE POLICY "Users can manage own ingressos" ON ingressos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM eventos e WHERE e.id = evento_id AND e.user_id = auth.uid())
  );
