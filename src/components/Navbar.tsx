import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { ROLE_LABELS } from '@/lib/rbac'
import { getTheme, setTheme, type Theme } from '@/lib/theme'
import type { Role } from '@/lib/types'
import {
  IconDashboard, IconUsers, IconCalendar, IconGraduation, IconNews,
  IconPresentation, IconWallet, IconSettings, IconMenu, IconLogout,
  IconChevronDown, IconTarget, IconBook, IconClose, IconUserCircle,
  IconClipboard, IconChart, IconSun, IconMoon,
} from './icons'

const allNavItems: { label: string; href: string; icon: typeof IconDashboard; roles: Role[] }[] = [
  { label: 'Dashboard',     href: '/dashboard',     icon: IconDashboard,   roles: ['admin', 'instrutor'] },
  { label: 'Colaboradores', href: '/colaboradores', icon: IconUsers,       roles: ['admin'] },
  { label: 'Calendário',    href: '/calendario',    icon: IconCalendar,    roles: ['admin'] },
  { label: 'Cursos',        href: '/cursos',        icon: IconBook,        roles: ['admin', 'instrutor'] },
  { label: 'Alunos',        href: '/alunos',        icon: IconGraduation,  roles: ['admin', 'instrutor'] },
  { label: 'Leads',         href: '/leads',         icon: IconTarget,      roles: ['admin', 'instrutor'] },
  { label: 'Clientes',      href: '/clientes',      icon: IconUserCircle,  roles: ['admin', 'instrutor'] },
  { label: 'Resultados',    href: '/resultados',    icon: IconChart,       roles: ['admin', 'instrutor'] },
  { label: 'Tarefas',       href: '/tarefas',       icon: IconClipboard,   roles: ['admin', 'instrutor'] },
  { label: 'News',          href: '/news',          icon: IconNews,        roles: ['admin', 'instrutor'] },
  { label: 'Apresentações', href: '/apresentacoes', icon: IconPresentation,roles: ['admin', 'instrutor'] },
  { label: 'Financeiro',    href: '/financeiro',    icon: IconWallet,      roles: ['admin'] },
  { label: 'Configurações', href: '/configuracoes', icon: IconSettings,    roles: ['admin', 'instrutor'] },
]

export default function Navbar({ userName, role = 'admin' }: { userName?: string; role?: Role }) {
  const pathname  = useLocation().pathname
  const navigate  = useNavigate()
  const { signOut } = useAuth()
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [theme,      setThemeState] = useState<Theme>(() => getTheme())

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  const navItems = allNavItems.filter(item => item.roles.includes(role))

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const initials = userName
    ? userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  /* ── Botão de tema ──────────────────────────────────────────────── */
  const ThemeButton = (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
      className="shrink-0 p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
    >
      {theme === 'dark'
        ? <IconSun  className="w-4 h-4" />
        : <IconMoon className="w-4 h-4" />}
    </button>
  )

  /* ── Logo ───────────────────────────────────────────────────────── */
  const Logo = (
    <Link
      to="/dashboard"
      className="flex items-center gap-2.5 min-w-0"
      onClick={() => setDrawerOpen(false)}
    >
      {/* Avatar da marca — usa blue-600 que já é o dourado via globals.css */}
      <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
        I
      </span>
      <span className="font-semibold text-sm text-gray-900 truncate">Insight Assessoria</span>
    </Link>
  )

  /* ── Links de navegação ─────────────────────────────────────────── */
  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
      {navItems.map(item => {
        const active = pathname.startsWith(item.href)
        const Icon   = item.icon
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={`
              flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${active
                /* ativo: fundo dourado suave + texto dourado */
                ? 'bg-blue-50 text-blue-700'
                /* inativo: texto muted, hover suave */
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
              }
            `}
          >
            <Icon
              className={`w-[17px] h-[17px] shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`}
            />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  /* ── Rodapé do usuário ──────────────────────────────────────────── */
  const UserFooter = (
    <div className="relative border-t border-gray-100 p-2">
      {/* Popover de logout — abre para cima */}
      {menuOpen && (
        <div className="absolute bottom-full left-2 right-2 mb-1.5 rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden gp-pop z-10">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p
              className="text-xs font-medium text-gray-800 truncate"
              title={userName}
            >
              {userName || 'Usuário'}
            </p>
            <p className="text-xs text-blue-600 font-medium mt-0.5">{ROLE_LABELS[role]}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <IconLogout className="w-4 h-4" />
            Sair da conta
          </button>
        </div>
      )}

      <button
        onClick={() => setMenuOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-100 transition-colors"
      >
        {/* Avatar do usuário */}
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-xs font-semibold text-gray-800 truncate leading-tight" title={userName}>
            {userName || 'Usuário'}
          </p>
          <p className="text-xs text-blue-600 font-medium leading-tight mt-0.5">{ROLE_LABELS[role]}</p>
        </div>
        <IconChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${menuOpen ? 'rotate-180' : ''}`}
        />
      </button>
    </div>
  )

  return (
    <>
      {/* ── Sidebar desktop ───────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-56 bg-white border-r border-gray-200 z-30">
        <div className="h-14 flex items-center justify-between gap-2 px-4 border-b border-gray-100">
          {Logo}
          {ThemeButton}
        </div>
        <NavLinks />
        {UserFooter}
      </aside>

      {/* ── Top bar mobile ────────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between h-14 px-4">
          <button
            className="p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
          >
            <IconMenu className="w-5 h-5" />
          </button>

          {Logo}

          <div className="flex items-center gap-1">
            {ThemeButton}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center gap-1 p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {initials}
                </div>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden gp-pop z-30">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate" title={userName}>
                        {userName || 'Usuário'}
                      </p>
                      <p className="text-xs text-blue-600 font-medium mt-0.5">{ROLE_LABELS[role]}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <IconLogout className="w-4 h-4" />
                      Sair da conta
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Drawer mobile ─────────────────────────────────────────── */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-gray-900/50 gp-backdrop"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col gp-pop">
            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100">
              {Logo}
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                aria-label="Fechar menu"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>
            <NavLinks onNavigate={() => setDrawerOpen(false)} />
            {UserFooter}
          </aside>
        </div>
      )}

      {/* Backdrop para fechar popover no desktop */}
      {menuOpen && (
        <div className="hidden lg:block fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
      )}
    </>
  )
}

//teste commit 2