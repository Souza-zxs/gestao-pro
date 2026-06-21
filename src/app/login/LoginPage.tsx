import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { homeRoute } from '@/lib/rbac'
import { portalUrl } from '@/lib/subdomain'
import type { Role } from '@/lib/types'
import { Field, Input, Button } from '@/components/ui'

export default function LoginPage() {
  const navigate = useNavigate()
  const { user, role: currentRole, loading: authLoading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!authLoading && user) redirectByRole(currentRole)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user])

  function redirectByRole(r: Role) {
    const home = homeRoute(r)
    if (home === '/__portal__') window.location.assign(portalUrl('/'))
    else navigate(home, { replace: true })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setLoading(true)
    try {
      await signIn(email, password)
      // O redirecionamento acontece no efeito quando a sessão é atualizada.
    } catch {
      setErro('E-mail ou senha inválidos.')
    } finally {
      setLoading(false)
    }
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
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Bem-vindo de volta</h2>
          <p className="text-sm text-gray-500 mb-6">Entre com seu e-mail e senha</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="E-mail">
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" autoComplete="email" />
            </Field>
            <Field label="Senha">
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} autoComplete="current-password" />
            </Field>

            {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{erro}</p>}

            <Button type="submit" disabled={loading} className="w-full !py-2.5">
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-gray-400">
            O acesso é liberado após a contratação. Em caso de problemas com o login, fale com o suporte.
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Autenticação segura via Supabase
        </p>
      </div>
    </div>
  )
}
