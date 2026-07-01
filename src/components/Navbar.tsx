'use client'

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
  IconClipboard, IconChart, IconSun, IconMoon, IconTrendingUp,
} from './icons'

const allNavItems: { label: string; href: string; icon: typeof IconDashboard; roles: Role[]; section: string }[] = [
  { label: 'Dashboard',     href: '/dashboard',     icon: IconDashboard,    roles: ['admin', 'instrutor'], section: 'Principal' },
  { label: 'Painel',        href: '/painel',        icon: IconTrendingUp,   roles: ['admin', 'instrutor'], section: 'Gestão' },
  { label: 'Ingressos',     href: '/ingressos',     icon: IconChart,        roles: ['admin', 'instrutor'], section: 'Principal' },
  { label: 'Clientes',      href: '/clientes',      icon: IconUserCircle,   roles: ['admin', 'instrutor'], section: 'Principal' },
  { label: 'Calendário',    href: '/calendario',    icon: IconCalendar,     roles: ['admin'],              section: 'Principal' },
  { label: 'Colaboradores', href: '/colaboradores', icon: IconUsers,        roles: ['admin'],              section: 'Gestão' },
  { label: 'Resultados',    href: '/resultados',    icon: IconChart,        roles: ['admin', 'instrutor'], section: 'Gestão' },
  { label: 'Financeiro',    href: '/financeiro',    icon: IconWallet,       roles: ['admin'],              section: 'Gestão' },
  { label: 'Tarefas',       href: '/tarefas',       icon: IconClipboard,    roles: ['admin', 'instrutor'], section: 'Gestão' },
  { label: 'Cursos',        href: '/cursos',        icon: IconBook,         roles: ['admin', 'instrutor'], section: 'Conteúdo' },
  { label: 'Alunos',        href: '/alunos',        icon: IconGraduation,   roles: ['admin', 'instrutor'], section: 'Conteúdo' },
  { label: 'Leads',         href: '/leads',         icon: IconTarget,       roles: ['admin', 'instrutor'], section: 'Gestão' },
  { label: 'News',          href: '/news',          icon: IconNews,         roles: ['admin', 'instrutor'], section: 'Conteúdo' },
  { label: 'Apresentações', href: '/apresentacoes', icon: IconPresentation, roles: ['admin', 'instrutor'], section: 'Conteúdo' },
  { label: 'Configurações', href: '/configuracoes', icon: IconSettings,     roles: ['admin', 'instrutor'], section: 'Configurações' },
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
  const sections = ['Principal', 'Gestão', 'Conteúdo', 'Configurações']

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const initials = userName
    ? userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  /* ── Logo ───────────────────────────────────────────────────────── */
  const Logo = (
    <Link
      to="/dashboard"
      className="flex items-center gap-2.5 min-w-0"
      onClick={() => setDrawerOpen(false)}
    >
      <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
        G
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-sm text-gray-900 truncate leading-tight">Gestão Pro</p>
        <p className="text-[10px] text-gray-400 leading-tight">Painel de controle</p>
      </div>
    </Link>
  )

  /* ── Links de navegação com seções ─────────────────────────────── */
  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      {sections.map(section => {
        const items = navItems.filter(i => i.section === section)
        if (items.length === 0) return null
        return (
          <div key={section} className="mb-4">
            <p className="px-3 mb-1 text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
              {section}
            </p>
            <div className="space-y-0.5">
              {items.map(item => {
                const active = pathname.startsWith(item.href)
                const Icon   = item.icon
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={onNavigate}
                    className={`
                      relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors
                      ${active
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                      }
                    `}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-600 dark:bg-blue-400 rounded-full" />
                    )}
                    <Icon className={`w-[15px] h-[15px] shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )

  /* ── Rodapé do usuário com toggle de tema ───────────────────────── */
  const UserFooter = (
    <div className="relative border-t border-gray-100 dark:border-gray-800 p-2">
      {/* Popover de logout */}
      {menuOpen && (
        <div className="absolute bottom-full left-2 right-2 mb-1.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden gp-pop z-10">
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate" title={userName}>
              {userName || 'Usuário'}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">{ROLE_LABELS[role]}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <IconLogout className="w-4 h-4" />
            Sair da conta
          </button>
        </div>
      )}

      <div className="flex items-center gap-1">
        {/* Botão de usuário */}
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="flex-1 flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors min-w-0"
        >
          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate leading-tight" title={userName}>
              {userName || 'Usuário'}
            </p>
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium leading-tight mt-0.5">{ROLE_LABELS[role]}</p>
          </div>
          <IconChevronDown
            className={`w-3 h-3 text-gray-400 transition-transform shrink-0 ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Toggle de tema — ao lado do usuário no rodapé */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          className="shrink-0 p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          {theme === 'dark'
            ? <IconSun  className="w-4 h-4" />
            : <IconMoon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Sidebar desktop ───────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-30">
        <div className="h-14 flex items-center px-4 border-b border-gray-100 dark:border-gray-800">
          {Logo}
        </div>
        <NavLinks />
        {UserFooter}
      </aside>

      {/* ── Top bar mobile ────────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between h-14 px-4">
          <button
            className="p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
          >
            <IconMenu className="w-5 h-5" />
          </button>

          {Logo}

          <div className="flex items-center gap-1">
            {/* Toggle de tema no mobile também */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {theme === 'dark'
                ? <IconSun  className="w-4 h-4" />
                : <IconMoon className="w-4 h-4" />}
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {initials}
                </div>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden gp-pop z-30">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" title={userName}>
                        {userName || 'Usuário'}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">{ROLE_LABELS[role]}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
          <aside className="absolute inset-y-0 left-0 w-64 bg-white dark:bg-gray-900 shadow-xl flex flex-col gp-pop">
            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800">
              {Logo}
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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