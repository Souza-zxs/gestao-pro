'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { deleteAllUserData } from '@/lib/store'
import { PageHeader, Card, Field, Input, Button } from '@/components/ui'
import { IconCheck } from '@/components/icons'

export default function ConfiguracoesClient() {
  const { name, email, updateProfile, user } = useAuth()
  const [nome, setNome] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [savedPerfil, setSavedPerfil] = useState(false)
  const [savedEmpresa, setSavedEmpresa] = useState(false)
  const [savingPerfil, setSavingPerfil] = useState(false)
  const [savingEmpresa, setSavingEmpresa] = useState(false)

  useEffect(() => {
    setNome(name)
    const meta = (user?.user_metadata ?? {}) as { empresa?: string }
    setEmpresa(meta.empresa ?? '')
  }, [name, user])

  async function salvarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setSavingPerfil(true)
    try {
      await updateProfile({ name: nome })
      setSavedPerfil(true); setTimeout(() => setSavedPerfil(false), 2000)
    } finally {
      setSavingPerfil(false)
    }
  }

  async function salvarEmpresa(e: React.FormEvent) {
    e.preventDefault()
    setSavingEmpresa(true)
    try {
      const { error } = await supabase.auth.updateUser({ data: { empresa } })
      if (error) throw error
      setSavedEmpresa(true); setTimeout(() => setSavedEmpresa(false), 2000)
    } finally {
      setSavingEmpresa(false)
    }
  }

  async function resetarDados() {
    if (!confirm('Isto vai apagar TODOS os dados cadastrados (colaboradores, alunos, financeiro, etc). Tem certeza?')) return
    try {
      await deleteAllUserData()
      alert('Todos os dados foram apagados.')
      window.location.reload()
    } catch (err) {
      alert('Erro ao apagar dados: ' + (err instanceof Error ? err.message : 'desconhecido'))
    }
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
            <Field label="E-mail" hint="O e-mail de login não pode ser alterado aqui">
              <Input type="email" value={email} disabled placeholder="seu@email.com" />
            </Field>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={savingPerfil}>{savingPerfil ? 'Salvando...' : 'Salvar perfil'}</Button>
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
              <Button type="submit" disabled={savingEmpresa}>{savingEmpresa ? 'Salvando...' : 'Salvar empresa'}</Button>
              {savedEmpresa && <span className="flex items-center gap-1 text-sm text-green-600"><IconCheck className="w-4 h-4" /> Salvo</span>}
            </div>
          </form>
        </Card>

        <Card className="border-red-200">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Zona de perigo</h3>
          <p className="text-sm text-gray-500 mb-4">Apaga permanentemente todos os dados cadastrados na sua conta.</p>
          <Button variant="danger" onClick={resetarDados}>Apagar todos os dados</Button>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Sobre</h3>
          <p className="text-sm text-gray-500">Gestão Pro — Sistema de gestão completo</p>
          <p className="text-xs text-gray-400 mt-1">v1.0.0 · React + Vite + TypeScript · Dados no Supabase</p>
        </Card>
      </div>
    </div>
  )
}
