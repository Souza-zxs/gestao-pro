// Autenticação real via Supabase Auth (substitui o antigo cookie de demonstração).
// O papel (role) e o nome do usuário vêm de public.usuarios (fonte de verdade
// do RBAC/RLS — migration 023), não mais do JWT/app_metadata.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Role } from './types'

export interface AuthState {
  user: User | null
  session: Session | null
  role: Role
  name: string
  email: string
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string, role: Role) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  /** Atualiza o nome no perfil (user_metadata + public.usuarios). */
  updateProfile: (changes: { name?: string }) => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

interface Perfil { nome: string; cargo: Role }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let vivo = true

    async function aplicarSessao(s: Session | null) {
      setSession(s)
      const u = s?.user ?? null
      if (!u) {
        if (vivo) { setPerfil(null); setLoading(false) }
        return
      }
      // Cargo e nome vêm de public.usuarios (fonte de verdade do RBAC/RLS —
      // migration 023), não mais do JWT: uma troca de cargo pelo admin vale
      // já no próximo login, sem esperar o token renovar.
      const { data } = await supabase.from('usuarios').select('nome, cargo').eq('id', u.id).single()
      if (!vivo) return
      setPerfil(data ? { nome: data.nome, cargo: data.cargo as Role } : null)
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => aplicarSessao(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setLoading(true)
      aplicarSessao(s)
    })
    return () => { vivo = false; sub.subscription.unsubscribe() }
  }, [])

  const user = session?.user ?? null
  const email = user?.email ?? ''
  // Sem linha em usuarios (não deveria acontecer, o trigger cobre) => menor
  // privilégio, nunca acesso amplo por omissão.
  const role: Role = perfil?.cargo ?? 'user'
  const name = perfil?.nome || email.split('@')[0] || 'Usuário'

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(name: string, email: string, password: string, role: Role) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role } },
    })
    if (error) throw error
    // Sem sessão => o projeto exige confirmação de e-mail antes do primeiro login.
    return { needsConfirmation: !data.session }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function updateProfile(changes: { name?: string }) {
    const { error } = await supabase.auth.updateUser({ data: changes })
    if (error) throw error
    if (changes.name && user) {
      const { error: erroPerfil } = await supabase.rpc('set_meu_nome', { novo_nome: changes.name })
      if (erroPerfil) throw erroPerfil
      setPerfil(p => (p ? { ...p, nome: changes.name! } : p))
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, role, name, email, loading, signIn, signUp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
