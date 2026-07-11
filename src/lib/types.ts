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

export interface Cliente {
  id: string
  user_id: string
  nome: string                      // Nome do Cliente
  loja: string                      // Nr e Loja (ex: "01 - Modas LB")
  telefone: string
  data_entrada: string | null       // date
  responsavel: string               // quem atende a conta
  ja_vende: boolean                 // Já vende?
  ultimo_acompanhamento: string | null   // date
  proximo_acompanhamento: string | null  // date
  evolucao_vendas: string           // Crescente / Estável / Decrescente
  fase_conta: string                // Fase 1..5
  faturamento_mensal: string        // faixa: "0 a 20k", "21 a 50k"...
  plataforma: string                // Shopee, Mercado Livre...
  numero_contas: number
  tipo_cobranca: string             // Mensalidade / Pedido
  login_upseller: string
  senha_upseller: string
  login_seller_finance: string
  senha_seller_finance: string
  criado_em?: string
}

export interface Membro {
  id: string
  user_id: string
  nome: string
  email: string
  criado_em?: string
}

// Cliente vinculado a uma tarefa (denormalizado no array `clientes`).
// Nas cópias de tarefa padrão (template_id setado) este array funciona como
// uma checklist de subtarefas — por isso os 4 campos extras, usados só ali.
export interface TarefaCliente {
  id: string | null
  nome: string
  numero: string   // nº da carteira (ex: "12"), extraído do início da loja
  loja: string
  telefone: string
  responsavel_nome?: string    // só em subtarefas de cópia padrão
  responsavel_email?: string
  concluido?: boolean
  concluido_em?: string | null
}

export interface Tarefa {
  id: string
  user_id: string
  titulo: string
  descricao: string
  responsavel_nome: string
  responsavel_email: string
  prioridade: 'baixa' | 'media' | 'alta'
  status: 'a_fazer' | 'fazendo' | 'concluida'
  recorrencia: 'nenhuma' | 'diaria' | 'semanal' | 'mensal'
  prazo: string | null
  cliente_id: string | null       // legado = 1º cliente (filtros/análise)
  cliente_nome: string            // legado = nome do 1º cliente
  clientes: TarefaCliente[]       // todos os clientes vinculados
  // Tarefa padrão (geral): modelo que se aplica a TODO cliente. O modelo tem
  // padrao=true e nenhum cliente; cada cliente ganha uma cópia (padrao=false)
  // com template_id apontando para o modelo. Ver src/lib/tarefas.ts.
  padrao: boolean
  template_id: string | null
  criado_em?: string
}

// Registro histórico de cada conclusão de tarefa (inclui recorrentes, que não
// viram status 'concluida'). Alimenta o painel de análise do admin.
export interface TarefaConcluida {
  id: string
  user_id: string
  tarefa_id: string | null
  titulo: string
  responsavel_nome: string
  responsavel_email: string
  prioridade: 'baixa' | 'media' | 'alta'
  recorrencia: 'nenhuma' | 'diaria' | 'semanal' | 'mensal'
  cliente_nome: string
  criada_em: string | null
  concluida_em: string
}

// Resultado mensal de um cliente (faturamento por semana), pertencente a um
// colaborador. O admin atribui (colaborador + cliente + mês); o colaborador
// preenche os números. Espelha a planilha "Resultado <Colaborador>".
export interface Resultado {
  id: string
  user_id: string
  colaborador_nome: string
  colaborador_email: string
  cliente_id: string | null
  cliente_nome: string
  mes: string                  // 'YYYY-MM'
  faturamento_anterior: number
  meta_mes: number
  semana_1: number
  semana_2: number
  semana_3: number
  semana_4: number
  semana_5: number
  pedidos_1: number            // "todos os pedidos" (semana 1)
  pedidos_2: number
  pedidos_3: number
  pedidos_4: number
  pedidos_5: number
  cancelados_1: number         // pedidos cancelados por semana
  cancelados_2: number
  cancelados_3: number
  cancelados_4: number
  cancelados_5: number
  pedidos_cancelados: number   // legado = soma das semanas (válidos = pedidos - cancelados)
  projecao: number
  status: string
  criado_em?: string
}

/* ---------- Financeiro / Fluxo de Caixa (estilo Seller Finance) ---------- */
export type LancamentoTipo = 'entrada' | 'saida'
// realizado = já entrou/saiu do caixa; previsto = a receber / a pagar
export type LancamentoStatus = 'realizado' | 'previsto'
export type FormaPagamento =
  | 'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito'
  | 'boleto' | 'transferencia' | 'outro'
export type RecorrenciaFin = 'nenhuma' | 'semanal' | 'mensal' | 'anual'

export interface CategoriaFinanceira {
  id: string
  user_id: string
  nome: string
  tipo: LancamentoTipo
  cor: string                  // hex, ex: '#22c55e'
  criado_em?: string
}

export interface Lancamento {
  id: string
  user_id: string
  descricao: string
  valor: number
  tipo: LancamentoTipo
  status: LancamentoStatus
  categoria: string            // nome da categoria (snapshot)
  conta: string                // carteira/conta, ex: "Seller Finance"
  forma_pagamento: FormaPagamento | ''
  cliente_fornecedor: string
  documento: string            // nº nota/pedido/ref
  observacao: string
  data: string                 // competência/pagamento (yyyy-MM-dd)
  data_vencimento: string | null
  recorrencia: RecorrenciaFin
  criado_em?: string
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
// 'user' = cadastro do portal sem nenhum curso liberado ainda; é promovido a
// 'aluno' automaticamente ao ganhar a primeira matrícula ativa.
export type Role = 'admin' | 'instrutor' | 'aluno' | 'user'

/* ---------- Cursos ---------- */
export interface Curso {
  id: string
  titulo: string
  subtitulo: string
  descricao: string
  preco: number
  capa?: string
  categoria?: string
  nivel: string             // Iniciante / Intermediário / Avançado
  carga_horaria: number     // em horas
  aprendizado: string       // um item por linha
  requisitos: string        // um item por linha
  instrutor_id: string      // e-mail de quem criou
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
  video_apivideo_id?: string | null
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
  metodo: 'pix' | 'cartao' | 'boleto' | 'indefinido'
  status: 'pendente' | 'pago' | 'falhou' | 'cancelado'
  gateway_checkout_id?: string | null
  mensagem_erro?: string | null
  criado_em?: string
}
