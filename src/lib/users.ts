// Gestão de usuários e cargos — só admin. Listar/alterar cargo/excluir batem
// em funções SECURITY DEFINER no banco (migration 012+), que validam o papel
// do chamador — não precisa da chave service_role no frontend pra isso.
//
// Criar usuário É diferente: precisa da Admin API do Supabase (service_role)
// pra nascer com e-mail já confirmado, sem depender do envio de e-mail de
// confirmação (o limite da conta padrão sem SMTP próprio é baixíssimo e
// travava o cadastro — "email rate limit exceeded"). Por isso passa pela
// Edge Function criar-usuario em vez de auth.signUp() direto no navegador.

import { supabase } from './supabase'
import type { Role } from './types'

export interface TeamUser {
  id: string
  email: string
  name: string
  role: Role
}

/** Lista todos os usuários com o cargo efetivo. Lança erro se não for admin. */
export async function listTeamUsers(): Promise<TeamUser[]> {
  const { data, error } = await supabase.rpc('list_team_users')
  if (error) throw error
  return (data ?? []) as TeamUser[]
}

/** Define o cargo de um usuário. Lança erro se não for admin ou cargo inválido. */
export async function setUserRole(userId: string, role: Role): Promise<void> {
  const { error } = await supabase.rpc('set_user_role', {
    target_user: userId,
    new_role: role,
  })
  if (error) throw error
}

/** Exclui um usuário. Lança erro se não for admin ou se for a própria conta. */
export async function deleteTeamUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_team_user', { target_user: userId })
  if (error) throw error
}

export interface NovoUsuario {
  name: string
  email: string
  password: string
  role: Role
}

/** Cria um usuário de equipe já confirmado (Edge Function criar-usuario, service_role). */
export async function createTeamUser(input: NovoUsuario): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; aviso?: string; error?: string }>(
    'criar-usuario',
    { body: input },
  )
  if (error) {
    let mensagem = error.message
    try {
      const corpo = await (error as unknown as { context?: Response }).context?.json()
      if (corpo?.error) mensagem = corpo.error
    } catch { /* mantém a mensagem genérica do SDK */ }
    throw new Error(mensagem)
  }
  if (data?.error) throw new Error(data.error)
  if (data?.aviso) throw new Error(data.aviso)

  return { needsConfirmation: false }
}
