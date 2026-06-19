import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { IconBook } from '@/components/icons'

export default function PortalLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirect = (location.state as { redirect?: string } | null)?.redirect || '/minha-area'
  const { signIn, signUp } = useAuth()

  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setAviso(''); setLoading(true)
    try {
      if (isSignUp) {
        // Quem cria conta pelo portal é sempre aluno.
        const { needsConfirmation } = await signUp(name, email, password, 'aluno')
        if (needsConfirmation) {
          setAviso('Conta criada! Confirme seu e-mail para entrar.')
          setIsSignUp(false)
          return
        }
      } else {
        await signIn(email, password)
      }
      navigate(redirect, { replace: true })
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível autenticar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto py-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 text-white mb-3">
          <IconBook className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{isSignUp ? 'Criar conta' : 'Entrar'}</h1>
        <p className="text-sm text-gray-500 mt-1">Acesse seus cursos no portal Academy</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-7">
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo</label>
              <input required value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" className="w-full px-3 py-2.5 rounded-lg text-sm border border-gray-300" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="w-full px-3 py-2.5 rounded-lg text-sm border border-gray-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2.5 rounded-lg text-sm border border-gray-300" />
          </div>
          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erro}</p>}
          {aviso && <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{aviso}</p>}
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
            {loading ? 'Entrando...' : isSignUp ? 'Criar conta' : 'Entrar'}
          </button>
        </form>
        <div className="mt-5 text-center">
          <button onClick={() => { setIsSignUp(!isSignUp); setErro(''); setAviso('') }} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastre-se'}
          </button>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-5">Autenticação segura via Supabase</p>
    </div>
  )
}
