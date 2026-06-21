// Autenticação real via Supabase Auth (substitui o antigo cookie de demonstração).
// O papel (role) do usuário fica em user_metadata, definido no cadastro.

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
  /** Atualiza nome/role no perfil (user_metadata). */
  updateProfile: (changes: { name?: string; role?: Role }) => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const user = session?.user ?? null
  const meta = (user?.user_metadata ?? {}) as { name?: string; role?: Role }
  // app_metadata só é definível pelo servidor (não pelo usuário), então tem
  // prioridade — bate com a RLS (migration 008) e impede burlar o papel.
  const appMeta = (user?.app_metadata ?? {}) as { role?: Role }
  const role: Role = appMeta.role ?? meta.role ?? 'admin'
  const email = user?.email ?? ''
  const name = meta.name || email.split('@')[0] || 'Usuário'

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

  async function updateProfile(changes: { name?: string; role?: Role }) {
    const { error } = await supabase.auth.updateUser({ data: changes })
    if (error) throw error
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
