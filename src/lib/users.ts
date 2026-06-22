// Gestão de usuários e cargos — só admin. As operações batem em funções
// SECURITY DEFINER no banco (migration 012), que validam o papel do chamador.
// Por isso não é preciso a chave service_role no frontend.

import { createClient } from '@supabase/supabase-js'
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

export interface NovoUsuario {
  name: string
  email: string
  password: string
  role: Role
}

/**
 * Cria um usuário já com cargo. Fluxo:
 *  1. signUp num cliente ISOLADO (persistSession:false) — assim a sessão do
 *     admin logado NÃO é trocada pela do novo usuário.
 *  2. set_user_role (RPC) grava o cargo no app_metadata SEGURO, usando a sessão
 *     do admin. O role no signUp vai só em user_metadata (fallback).
 *
 * Requer "Allow new users to sign up" LIGADO no Supabase (Authentication →
 * Providers). Se a confirmação de e-mail estiver ativa, o usuário precisa
 * confirmar antes do primeiro login (needsConfirmation = true).
 */
export async function createTeamUser(input: NovoUsuario): Promise<{ needsConfirmation: boolean }> {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  const isolated = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const { data, error } = await isolated.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { name: input.name, role: input.role } },
  })
  if (error) throw error

  const newId = data.user?.id
  if (newId) {
    try {
      await setUserRole(newId, input.role)
    } catch (e) {
      throw new Error(
        'Usuário criado, mas falhou ao fixar o cargo seguro (app_metadata): ' +
          (e instanceof Error ? e.message : 'erro desconhecido') +
          '. Ajuste o cargo na lista abaixo.',
      )
    }
  }

  return { needsConfirmation: !data.session }
}
