-- ============================================================================
-- 009 — Cursos: schema completo + campos novos + compartilhamento de equipe
--                + bucket de capas (upload de imagem)
-- ============================================================================
-- Autossuficiente: cria as tabelas do sistema de cursos se ainda não existirem
-- (idempotente com a 004) e aplica os ajustes pedidos.

create extension if not exists "uuid-ossp";

-- ---------- Tabelas (criadas só se faltarem) --------------------------------
create table if not exists cursos (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  descricao text not null default '',
  preco numeric(10,2) not null default 0,
  capa text,
  categoria text,
  instrutor_id text not null,            -- e-mail de quem criou
  instrutor_nome text,
  publicado boolean not null default false,
  criado_em timestamptz default now()
);

create table if not exists modulos (
  id uuid primary key default uuid_generate_v4(),
  curso_id uuid not null references cursos(id) on delete cascade,
  titulo text not null,
  ordem integer not null default 0,
  criado_em timestamptz default now()
);

create table if not exists aulas (
  id uuid primary key default uuid_generate_v4(),
  modulo_id uuid not null references modulos(id) on delete cascade,
  curso_id uuid not null references cursos(id) on delete cascade,
  titulo text not null,
  video_url text,
  duracao_min integer,
  ordem integer not null default 0,
  criado_em timestamptz default now()
);

create table if not exists matriculas (
  id uuid primary key default uuid_generate_v4(),
  curso_id uuid not null references cursos(id) on delete cascade,
  aluno_email text not null,
  aluno_nome text,
  pedido_id uuid,
  status text not null default 'ativa' check (status in ('ativa', 'cancelada')),
  aulas_concluidas text[] not null default '{}',
  criado_em timestamptz default now(),
  unique (curso_id, aluno_email)
);

create table if not exists pedidos (
  id uuid primary key default uuid_generate_v4(),
  curso_id uuid not null references cursos(id) on delete cascade,
  curso_titulo text not null,
  comprador_nome text not null,
  comprador_email text not null,
  valor numeric(10,2) not null default 0,
  metodo text not null check (metodo in ('pix', 'cartao', 'boleto')),
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'falhou', 'cancelado')),
  criado_em timestamptz default now()
);

-- ---------- Campos novos do curso -------------------------------------------
alter table cursos add column if not exists subtitulo     text not null default '';
alter table cursos add column if not exists nivel         text not null default '';
alter table cursos add column if not exists carga_horaria integer not null default 0; -- em horas
alter table cursos add column if not exists aprendizado   text not null default '';   -- um item por linha
alter table cursos add column if not exists requisitos    text not null default '';   -- um item por linha

create index if not exists cursos_instrutor_idx on cursos (instrutor_id);
create index if not exists modulos_curso_idx on modulos (curso_id);
create index if not exists aulas_curso_idx on aulas (curso_id);
create index if not exists matriculas_aluno_idx on matriculas (aluno_email);
create index if not exists pedidos_comprador_idx on pedidos (comprador_email);

-- ---------- RLS: cursos/módulos/aulas agora são da EQUIPE -------------------
alter table cursos enable row level security;
alter table modulos enable row level security;
alter table aulas enable row level security;
alter table matriculas enable row level security;
alter table pedidos enable row level security;

-- Cursos: catálogo público (publicados) + gestão por toda a equipe.
drop policy if exists "Cursos publicados são públicos" on cursos;
drop policy if exists "Instrutor gerencia próprios cursos" on cursos;
drop policy if exists "cursos leitura" on cursos;
drop policy if exists "cursos equipe gerencia" on cursos;
create policy "cursos leitura" on cursos for select using (publicado = true or public.is_team());
create policy "cursos equipe gerencia" on cursos for all to authenticated using (public.is_team()) with check (public.is_team());

-- Módulos: visíveis se o curso é público ou para a equipe; gestão pela equipe.
drop policy if exists "Ver módulos de cursos visíveis" on modulos;
drop policy if exists "Instrutor gerencia módulos" on modulos;
drop policy if exists "modulos leitura" on modulos;
drop policy if exists "modulos equipe gerencia" on modulos;
create policy "modulos leitura" on modulos for select using (
  public.is_team() or exists (select 1 from cursos c where c.id = curso_id and c.publicado = true)
);
create policy "modulos equipe gerencia" on modulos for all to authenticated using (public.is_team()) with check (public.is_team());

-- Aulas: mesma lógica dos módulos.
drop policy if exists "Ver aulas de cursos visíveis" on aulas;
drop policy if exists "Instrutor gerencia aulas" on aulas;
drop policy if exists "aulas leitura" on aulas;
drop policy if exists "aulas equipe gerencia" on aulas;
create policy "aulas leitura" on aulas for select using (
  public.is_team() or exists (select 1 from cursos c where c.id = curso_id and c.publicado = true)
);
create policy "aulas equipe gerencia" on aulas for all to authenticated using (public.is_team()) with check (public.is_team());

-- Matrículas: o aluno gerencia as próprias; a equipe vê todas.
drop policy if exists "Aluno gerencia próprias matrículas" on matriculas;
drop policy if exists "Instrutor vê matrículas dos seus cursos" on matriculas;
drop policy if exists "equipe vê matrículas" on matriculas;
create policy "Aluno gerencia próprias matrículas" on matriculas
  for all using (aluno_email = (auth.jwt() ->> 'email')) with check (aluno_email = (auth.jwt() ->> 'email'));
create policy "equipe vê matrículas" on matriculas for select to authenticated using (public.is_team());

-- Pedidos: o comprador gerencia os próprios; a equipe vê todos.
drop policy if exists "Comprador gerencia próprios pedidos" on pedidos;
drop policy if exists "Instrutor vê pedidos dos seus cursos" on pedidos;
drop policy if exists "equipe vê pedidos" on pedidos;
create policy "Comprador gerencia próprios pedidos" on pedidos
  for all using (comprador_email = (auth.jwt() ->> 'email')) with check (comprador_email = (auth.jwt() ->> 'email'));
create policy "equipe vê pedidos" on pedidos for select to authenticated using (public.is_team());

-- ---------- Storage: bucket público de capas (upload de imagem) -------------
insert into storage.buckets (id, name, public)
values ('capas', 'capas', true)
on conflict (id) do nothing;

-- Bucket público: leitura é via URL pública; a equipe envia/apaga.
drop policy if exists "capas enviar equipe" on storage.objects;
drop policy if exists "capas apagar equipe" on storage.objects;
create policy "capas enviar equipe" on storage.objects for insert to authenticated with check (bucket_id = 'capas' and public.is_team());
create policy "capas apagar equipe" on storage.objects for delete to authenticated using (bucket_id = 'capas' and public.is_team());
