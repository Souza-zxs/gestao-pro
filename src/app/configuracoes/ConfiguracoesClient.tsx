'use client'

import { useEffect, useState } from 'react'
import { MOCK_COOKIE, parseMockUser, encodeMockUser } from '@/lib/auth-mock'
import { getAll, upsertBy } from '@/lib/store'
import { PageHeader, Card, Field, Input, Button } from '@/components/ui'
import { IconCheck } from '@/components/icons'

const DATA_KEYS = [
  'colaboradores', 'faltas_horas', 'pagamentos_config', 'agendamentos',
  'horarios_disponiveis', 'bloqueios', 'turmas', 'alunos', 'leads', 'eventos',
  'ingressos', 'news', 'apresentacoes', 'financeiro',
]

function readCookieUser() {
  if (typeof document === 'undefined') return null
  const raw = document.cookie.split('; ').find(c => c.startsWith(MOCK_COOKIE + '='))?.split('=')[1]
  return parseMockUser(raw)
}

export default function ConfiguracoesClient() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [savedPerfil, setSavedPerfil] = useState(false)
  const [savedEmpresa, setSavedEmpresa] = useState(false)

  useEffect(() => {
    const u = readCookieUser()
    if (u) { setNome(u.name || ''); setEmail(u.email || '') }
    const cfg = getAll<{ empresa: string }>('empresa_config')
    if (cfg.length > 0) setEmpresa(cfg[0].empresa)
  }, [])

  function salvarPerfil(e: React.FormEvent) {
    e.preventDefault()
    document.cookie = `${MOCK_COOKIE}=${encodeMockUser(nome, email)}; path=/; max-age=${60 * 60 * 24 * 30}`
    setSavedPerfil(true); setTimeout(() => setSavedPerfil(false), 2000)
  }

  function salvarEmpresa(e: React.FormEvent) {
    e.preventDefault()
    upsertBy('empresa_config', 'id' as never, 'cfg', { id: 'cfg', empresa })
    setSavedEmpresa(true); setTimeout(() => setSavedEmpresa(false), 2000)
  }

  function resetarDados() {
    if (!confirm('Isto vai apagar TODOS os dados cadastrados (colaboradores, alunos, financeiro, etc). Tem certeza?')) return
    DATA_KEYS.forEach(k => localStorage.removeItem(k))
    alert('Todos os dados foram apagados.')
    window.location.reload()
  }

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Gerencie seu perfil, sua empresa e os dados do sistema" />

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-4">Perfil</h3>
          <form onSubmit={salvarPerfil} className="space-y-4">
            <Field label="Nome">
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit">Salvar perfil</Button>
              {savedPerfil && <span className="flex items-center gap-1 text-sm text-green-600"><IconCheck className="w-4 h-4" /> Salvo</span>}
            </div>
          </form>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-4">Empresa</h3>
          <form onSubmit={salvarEmpresa} className="space-y-4">
            <Field label="Nome da empresa" hint="Aparece em relatórios e documentos">
              <Input value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Ex: Studio Samuel" />
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit">Salvar empresa</Button>
              {savedEmpresa && <span className="flex items-center gap-1 text-sm text-green-600"><IconCheck className="w-4 h-4" /> Salvo</span>}
            </div>
          </form>
        </Card>

        <Card className="border-red-200">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Zona de perigo</h3>
          <p className="text-sm text-gray-500 mb-4">Apaga permanentemente todos os dados cadastrados neste navegador.</p>
          <Button variant="danger" onClick={resetarDados}>Apagar todos os dados</Button>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Sobre</h3>
          <p className="text-sm text-gray-500">Gestão Pro — Sistema de gestão completo</p>
          <p className="text-xs text-gray-400 mt-1">v1.0.0 · Next.js + TypeScript + Tailwind CSS · Dados salvos localmente no navegador</p>
        </Card>
      </div>
    </div>
  )
}
