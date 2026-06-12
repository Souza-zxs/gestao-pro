import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MOCK_COOKIE, encodeMockUser, readUserCookie } from '@/lib/auth-mock'
import { Field, Input, Button } from '@/components/ui'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  useEffect(() => {
    if (readUserCookie()) navigate('/dashboard', { replace: true })
  }, [navigate])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const displayName = isSignUp ? name : email.split('@')[0]
    document.cookie = `${MOCK_COOKIE}=${encodeMockUser(displayName, email)}; path=/; max-age=${60 * 60 * 24 * 30}`
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white font-bold text-2xl mb-4 shadow-lg shadow-blue-600/20">
            G
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão Pro</h1>
          <p className="mt-1 text-sm text-gray-500">Sistema de gestão completo</p>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            {isSignUp ? 'Criar conta' : 'Bem-vindo de volta'}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {isSignUp ? 'Preencha seus dados para começar' : 'Entre com seu e-mail e senha'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <Field label="Nome completo">
                <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Seu nome" />
              </Field>
            )}
            <Field label="E-mail">
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
            </Field>
            <Field label="Senha">
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </Field>

            <Button type="submit" disabled={loading} className="w-full !py-2.5">
              {loading ? 'Entrando...' : isSignUp ? 'Criar conta' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Cadastre-se'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Modo demonstração — qualquer e-mail e senha são aceitos
        </p>
      </div>
    </div>
  )
}
