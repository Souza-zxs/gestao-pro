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
