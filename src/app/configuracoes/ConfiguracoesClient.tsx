'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { deleteAllUserData } from '@/lib/store'
import { listTeamUsers, setUserRole, createTeamUser, type TeamUser } from '@/lib/users'
import { ROLES, ROLE_LABELS, ROLE_DESCRICAO, can } from '@/lib/rbac'
import type { Role } from '@/lib/types'
import { PageHeader, Card, Field, Input, Button, Select, Badge, Spinner, Modal, AddButton } from '@/components/ui'
import { IconCheck, IconUsers } from '@/components/icons'

export default function ConfiguracoesClient() {
  const { name, email, updateProfile, user, role } = useAuth()
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

        {can(role, 'usuarios.manage') && <GerenciarCargos currentUserId={user?.id} />}

        <Card className="border-red-200">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Zona de perigo</h3>
          <p className="text-sm text-gray-500 mb-4">Apaga permanentemente todos os dados cadastrados na sua conta.</p>
          <Button variant="danger" onClick={resetarDados}>Apagar todos os dados</Button>
        </Card>

        <Card>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Sobre</h3>
          <p className="text-sm text-gray-500">Insight Assessoria — Sistema de gestão completo</p>
          <p className="text-xs text-gray-400 mt-1">v1.0.0 · React + Vite + TypeScript · Dados no Supabase</p>
        </Card>
      </div>
    </div>
  )
}

const ROLE_BADGE: Record<Role, 'green' | 'blue' | 'gray'> = {
  admin: 'green',
  instrutor: 'blue',
  aluno: 'gray',
}

function GerenciarCargos({ currentUserId }: { currentUserId?: string }) {
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  function carregar() {
    setLoading(true)
    listTeamUsers()
      .then(setUsers)
      .catch(err => setErro(err instanceof Error ? err.message : 'Erro ao carregar usuários'))
      .finally(() => setLoading(false))
  }

  useEffect(carregar, [])

  async function alterarCargo(u: TeamUser, novo: Role) {
    if (novo === u.role) return
    const anterior = u.role
    // Atualização otimista — reverte se der erro.
    setUsers(prev => prev.map(x => (x.id === u.id ? { ...x, role: novo } : x)))
    setSavingId(u.id)
    setErro(null)
    try {
      await setUserRole(u.id, novo)
      setSavedId(u.id)
      setTimeout(() => setSavedId(s => (s === u.id ? null : s)), 2000)
    } catch (err) {
      setUsers(prev => prev.map(x => (x.id === u.id ? { ...x, role: anterior } : x)))
      setErro(err instanceof Error ? err.message : 'Não foi possível alterar o cargo')
    } finally {
      setSavingId(null)
    }
  }

  function onCriado(needsConfirmation: boolean) {
    setModalAberto(false)
    setAviso(
      needsConfirmation
        ? 'Usuário criado! Ele precisa confirmar o e-mail antes do primeiro acesso.'
        : 'Usuário criado com sucesso.',
    )
    setTimeout(() => setAviso(null), 6000)
    carregar()
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <IconUsers className="w-5 h-5 text-gray-700" />
          <h3 className="text-base font-semibold text-gray-900">Cargos e permissões</h3>
        </div>
        <AddButton onClick={() => setModalAberto(true)}>Adicionar usuário</AddButton>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Cadastre usuários e defina o cargo de cada um. A mudança de cargo vale a partir do
        próximo login da pessoa (ou em até 1h, quando a sessão dela é renovada).
      </p>

      {aviso && (
        <p className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-3">
          <IconCheck className="w-4 h-4 shrink-0" /> {aviso}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : erro && users.length === 0 ? (
        <p className="text-sm text-red-600">{erro}</p>
      ) : (
        <>
          {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
          <ul className="divide-y divide-gray-100">
            {users.map(u => {
              const ehVoce = u.id === currentUserId
              return (
                <li key={u.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {u.name}{' '}
                      {ehVoce && <span className="text-xs font-normal text-gray-400">(você)</span>}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  <Badge color={ROLE_BADGE[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                  <div className="w-40">
                    <Select
                      value={u.role}
                      disabled={savingId === u.id}
                      onChange={e => alterarCargo(u, e.target.value as Role)}
                      title={ROLE_DESCRICAO[u.role]}
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </Select>
                  </div>
                  <span className="w-5 shrink-0">
                    {savingId === u.id && <Spinner />}
                    {savedId === u.id && <IconCheck className="w-4 h-4 text-green-600" />}
                  </span>
                </li>
              )
            })}
          </ul>
          {users.length === 0 && (
            <p className="text-sm text-gray-500">Nenhum usuário encontrado.</p>
          )}
        </>
      )}

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title="Adicionar usuário">
        <NovoUsuarioForm onCriado={onCriado} onCancelar={() => setModalAberto(false)} />
      </Modal>
    </Card>
  )
}

function NovoUsuarioForm({
  onCriado,
  onCancelar,
}: {
  onCriado: (needsConfirmation: boolean) => void
  onCancelar: () => void
}) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [cargo, setCargo] = useState<Role>('instrutor')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    setSalvando(true)
    try {
      const { needsConfirmation } = await createTeamUser({
        name: nome.trim(),
        email: email.trim(),
        password: senha,
        role: cargo,
      })
      onCriado(needsConfirmation)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar o usuário')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nome">
        <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do usuário" required />
      </Field>
      <Field label="E-mail">
        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@email.com" required />
      </Field>
      <Field label="Senha" hint="Mínimo de 6 caracteres. O usuário poderá trocá-la depois.">
        <Input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••" required />
      </Field>
      <Field label="Cargo" hint={ROLE_DESCRICAO[cargo]}>
        <Select value={cargo} onChange={e => setCargo(e.target.value as Role)}>
          {ROLES.map(r => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </Select>
      </Field>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancelar} disabled={salvando}>Cancelar</Button>
        <Button type="submit" disabled={salvando}>{salvando ? 'Criando...' : 'Criar usuário'}</Button>
      </div>
    </form>
  )
}
