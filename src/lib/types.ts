export interface Colaborador {
  id: string
  user_id: string
  nome: string
  tipo_contrato: 'CLT' | 'PJ'
  data_admissao: string
  salario_base: number
  vt: number
  vr: number
  va: number
  convenio: number
  criado_em?: string
}

export interface FaltasHoras {
  id?: string
  colaborador_id: string
  mes: number
  ano: number
  faltas: number
  horas_extras: number
}

export interface PagamentosConfig {
  id?: string
  user_id: string
  dia_pagamento: number
}

export interface Agendamento {
  id: string
  user_id: string
  cliente_nome: string
  data: string
  horario: string
  status: 'confirmado' | 'cancelado' | 'pendente'
  criado_em?: string
}

export interface HorarioDisponivel {
  id?: string
  user_id: string
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  ativo: boolean
}

export interface Bloqueio {
  id: string
  user_id: string
  data: string
  motivo?: string
  criado_em?: string
}

export interface Turma {
  id: string
  user_id: string
  nome: string
  ativa: boolean
  criado_em?: string
}

export interface Aluno {
  id: string
  user_id: string
  turma_id?: string
  nome: string
  status: 'ativo' | 'inativo' | 'trancado' | 'formado'
  data_entrada: string
  criado_em?: string
  turmas?: Turma
}

export type Temperatura = 'frio' | 'morno' | 'quente' | 'perdido' | 'fechado'

export interface Lead {
  id: string
  user_id: string
  nome: string
  contato: string
  origem: string
  status: 'novo' | 'contatado' | 'qualificado' | 'convertido' | 'perdido'
  temperatura: Temperatura
  valor: number
  data_entrada: string
  criado_em?: string
}

export interface Evento {
  id: string
  user_id: string
  nome: string
  data: string
  criado_em?: string
}

export interface Ingresso {
  id: string
  evento_id: string
  comprador: string
  quantidade: number
  valor: number
  criado_em?: string
}

/* ---------- RBAC ---------- */
export type Role = 'admin' | 'instrutor' | 'aluno'

/* ---------- Cursos ---------- */
export interface Curso {
  id: string
  titulo: string
  descricao: string
  preco: number
  capa?: string
  categoria?: string
  instrutor_id: string   // e-mail do instrutor dono
  instrutor_nome?: string
  publicado: boolean
  criado_em?: string
}

export interface Modulo {
  id: string
  curso_id: string
  titulo: string
  ordem: number
  criado_em?: string
}

export interface Aula {
  id: string
  modulo_id: string
  curso_id: string
  titulo: string
  video_url?: string
  duracao_min?: number
  ordem: number
  criado_em?: string
}

export interface Matricula {
  id: string
  curso_id: string
  aluno_email: string
  aluno_nome?: string
  pedido_id?: string
  status: 'ativa' | 'cancelada'
  aulas_concluidas: string[]   // ids de aulas
  criado_em?: string
}

export interface Pedido {
  id: string
  curso_id: string
  curso_titulo: string
  comprador_nome: string
  comprador_email: string
  valor: number
  metodo: 'pix' | 'cartao' | 'boleto'
  status: 'pendente' | 'pago' | 'falhou' | 'cancelado'
  criado_em?: string
}
