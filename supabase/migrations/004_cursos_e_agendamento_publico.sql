-- ============================================================================
-- 004 — Tabelas do PORTAL DE CURSOS + policies do agendamento público
-- ============================================================================
-- O portal de cursos (cursos, módulos, aulas, matrículas, pedidos) usava apenas
-- localStorage; aqui criamos o schema real no banco. A propriedade do conteúdo é
-- por E-MAIL (instrutor_id / aluno_email / comprador_email), batendo com o e-mail
-- do usuário autenticado (auth.jwt() ->> 'email').

-- ---------- Cursos ----------
CREATE TABLE IF NOT EXISTS cursos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  capa TEXT,
  categoria TEXT,
  instrutor_id TEXT NOT NULL,            -- e-mail do instrutor dono
  instrutor_nome TEXT,
  publicado BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Módulos ----------
CREATE TABLE IF NOT EXISTS modulos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Aulas ----------
CREATE TABLE IF NOT EXISTS aulas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  modulo_id UUID NOT NULL REFERENCES modulos(id) ON DELETE CASCADE,
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  video_url TEXT,
  duracao_min INTEGER,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- Matrículas ----------
CREATE TABLE IF NOT EXISTS matriculas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  aluno_email TEXT NOT NULL,
  aluno_nome TEXT,
  pedido_id UUID,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada')),
  aulas_concluidas TEXT[] NOT NULL DEFAULT '{}',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (curso_id, aluno_email)
);

-- ---------- Pedidos ----------
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curso_id UUID NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  curso_titulo TEXT NOT NULL,
  comprador_nome TEXT NOT NULL,
  comprador_email TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  metodo TEXT NOT NULL CHECK (metodo IN ('pix', 'cartao', 'boleto')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'falhou', 'cancelado')),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cursos_instrutor_idx ON cursos (instrutor_id);
CREATE INDEX IF NOT EXISTS modulos_curso_idx ON modulos (curso_id);
CREATE INDEX IF NOT EXISTS aulas_curso_idx ON aulas (curso_id);
CREATE INDEX IF NOT EXISTS matriculas_aluno_idx ON matriculas (aluno_email);
CREATE INDEX IF NOT EXISTS pedidos_comprador_idx ON pedidos (comprador_email);

-- ---------- RLS ----------
ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE aulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

-- Cursos: catálogo público (publicados) + gestão pelo instrutor dono.
DROP POLICY IF EXISTS "Cursos publicados são públicos" ON cursos;
CREATE POLICY "Cursos publicados são públicos" ON cursos
  FOR SELECT USING (publicado = TRUE OR instrutor_id = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Instrutor gerencia próprios cursos" ON cursos;
CREATE POLICY "Instrutor gerencia próprios cursos" ON cursos
  FOR ALL USING (instrutor_id = (auth.jwt() ->> 'email'))
  WITH CHECK (instrutor_id = (auth.jwt() ->> 'email'));

-- Módulos: visíveis se o curso é público ou do instrutor; gestão pelo dono do curso.
DROP POLICY IF EXISTS "Ver módulos de cursos visíveis" ON modulos;
CREATE POLICY "Ver módulos de cursos visíveis" ON modulos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cursos c WHERE c.id = curso_id
            AND (c.publicado = TRUE OR c.instrutor_id = (auth.jwt() ->> 'email')))
  );

DROP POLICY IF EXISTS "Instrutor gerencia módulos" ON modulos;
CREATE POLICY "Instrutor gerencia módulos" ON modulos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM cursos c WHERE c.id = curso_id AND c.instrutor_id = (auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM cursos c WHERE c.id = curso_id AND c.instrutor_id = (auth.jwt() ->> 'email'))
  );

-- Aulas: mesma lógica dos módulos.
DROP POLICY IF EXISTS "Ver aulas de cursos visíveis" ON aulas;
CREATE POLICY "Ver aulas de cursos visíveis" ON aulas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cursos c WHERE c.id = curso_id
            AND (c.publicado = TRUE OR c.instrutor_id = (auth.jwt() ->> 'email')))
  );

DROP POLICY IF EXISTS "Instrutor gerencia aulas" ON aulas;
CREATE POLICY "Instrutor gerencia aulas" ON aulas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM cursos c WHERE c.id = curso_id AND c.instrutor_id = (auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM cursos c WHERE c.id = curso_id AND c.instrutor_id = (auth.jwt() ->> 'email'))
  );

-- Matrículas: o aluno gerencia as próprias; o instrutor do curso pode visualizá-las.
DROP POLICY IF EXISTS "Aluno gerencia próprias matrículas" ON matriculas;
CREATE POLICY "Aluno gerencia próprias matrículas" ON matriculas
  FOR ALL USING (aluno_email = (auth.jwt() ->> 'email'))
  WITH CHECK (aluno_email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Instrutor vê matrículas dos seus cursos" ON matriculas;
CREATE POLICY "Instrutor vê matrículas dos seus cursos" ON matriculas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cursos c WHERE c.id = curso_id AND c.instrutor_id = (auth.jwt() ->> 'email'))
  );

-- Pedidos: o comprador gerencia os próprios; o instrutor do curso pode visualizá-los.
DROP POLICY IF EXISTS "Comprador gerencia próprios pedidos" ON pedidos;
CREATE POLICY "Comprador gerencia próprios pedidos" ON pedidos
  FOR ALL USING (comprador_email = (auth.jwt() ->> 'email'))
  WITH CHECK (comprador_email = (auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Instrutor vê pedidos dos seus cursos" ON pedidos;
CREATE POLICY "Instrutor vê pedidos dos seus cursos" ON pedidos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM cursos c WHERE c.id = curso_id AND c.instrutor_id = (auth.jwt() ->> 'email'))
  );

-- ============================================================================
-- Agendamento PÚBLICO (página /agendar/:userId acessada por visitantes anônimos)
-- ============================================================================
-- O visitante (anon) precisa ver os horários/bloqueios do profissional e criar
-- um agendamento para ele. Estas policies liberam exatamente isso.

DROP POLICY IF EXISTS "Horários visíveis publicamente" ON horarios_disponiveis;
CREATE POLICY "Horários visíveis publicamente" ON horarios_disponiveis
  FOR SELECT TO anon USING (TRUE);

DROP POLICY IF EXISTS "Bloqueios visíveis publicamente" ON bloqueios;
CREATE POLICY "Bloqueios visíveis publicamente" ON bloqueios
  FOR SELECT TO anon USING (TRUE);

DROP POLICY IF EXISTS "Visitante pode ver agendamentos" ON agendamentos;
CREATE POLICY "Visitante pode ver agendamentos" ON agendamentos
  FOR SELECT TO anon USING (TRUE);

DROP POLICY IF EXISTS "Visitante pode criar agendamento" ON agendamentos;
CREATE POLICY "Visitante pode criar agendamento" ON agendamentos
  FOR INSERT TO anon WITH CHECK (TRUE);
