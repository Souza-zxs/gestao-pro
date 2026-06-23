// RBAC — controle de acesso por papel (role)
// Papéis: admin (gestão total), instrutor (cria/edita cursos), aluno (consome cursos)

import type { Role } from './types'

export const ROLES: Role[] = ['admin', 'instrutor', 'aluno']

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  instrutor: 'Instrutor',
  aluno: 'Aluno',
}

export const ROLE_DESCRICAO: Record<Role, string> = {
  admin: 'Acesso total à gestão e aos cursos',
  instrutor: 'Cria e gerencia cursos e alunos',
  aluno: 'Compra e assiste aos cursos no portal',
}

// Capacidades que o app verifica. '*' = tudo.
export type Capability =
  | 'gestao.view'      // acessar o app de gestão
  | 'colaboradores'    // RH / colaboradores
  | 'financeiro'       // financeiro
  | 'leads'            // leads
  | 'apresentacoes'    // apresentações
  | 'configuracoes'    // configurações
  | 'usuarios.manage'  // gerenciar usuários e seus cargos (somente admin)
  | 'curso.manage'     // criar/editar cursos e conteúdo
  | 'curso.publish'    // publicar curso
  | 'curso.consume'    // assistir cursos (portal)
  | 'pedidos.view'     // ver pedidos/vendas
  | 'alunos.manage'    // gerenciar alunos/turmas

const MATRIX: Record<Role, Capability[] | ['*']> = {
  admin: ['*'],
  instrutor: ['gestao.view', 'curso.manage', 'curso.publish', 'curso.consume', 'pedidos.view', 'alunos.manage'],
  aluno: ['curso.consume'],
}

export function can(role: Role | undefined | null, cap: Capability): boolean {
  if (!role) return false
  const caps = MATRIX[role]
  return (caps as string[]).includes('*') || (caps as string[]).includes(cap)
}

// Itens do menu de gestão e quem pode vê-los
export interface NavGate {
  href: string
  roles: Role[]
}

// Equipe = admin + instrutor (colaborador). Só admin acessa Financeiro,
// Calendário e Colaboradores; o resto a equipe vê (e edita onde permitido).
export const ROUTE_ROLES: Record<string, Role[]> = {
  '/dashboard': ['admin', 'instrutor'],
  '/colaboradores': ['admin'],
  '/calendario': ['admin'],
  '/alunos': ['admin', 'instrutor'],
  '/leads': ['admin', 'instrutor'],
  '/clientes': ['admin', 'instrutor'],
  '/resultados': ['admin', 'instrutor'],
  '/tarefas': ['admin', 'instrutor'],
  '/news': ['admin', 'instrutor'],
  '/apresentacoes': ['admin', 'instrutor'],
  '/financeiro': ['admin'],
  '/cursos': ['admin', 'instrutor'],
  '/configuracoes': ['admin', 'instrutor'],
}

export function canAccessRoute(role: Role | undefined | null, path: string): boolean {
  if (!role) return false
  const allowed = ROUTE_ROLES[path]
  if (!allowed) return true // rota sem restrição explícita
  return allowed.includes(role)
}

// Primeira rota de gestão que o papel pode abrir (para redirecionamento)
export function homeRoute(role: Role | undefined | null): string {
  if (!role) return '/login'
  if (role === 'aluno') return '/__portal__' // alunos vão para o portal de cursos
  const ordem = ['/dashboard', '/cursos', '/alunos', '/calendario']
  return ordem.find(r => canAccessRoute(role, r)) ?? '/dashboard'
}
