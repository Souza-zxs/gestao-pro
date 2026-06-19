import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { ROLE_LABELS } from '@/lib/rbac'
import type { Role } from '@/lib/types'
import {
  IconDashboard, IconUsers, IconCalendar, IconGraduation, IconNews,
  IconPresentation, IconWallet, IconSettings, IconMenu, IconLogout, IconChevronDown, IconTarget, IconBook, IconClose,
} from './icons'

const allNavItems: { label: string; href: string; icon: typeof IconDashboard; roles: Role[] }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: IconDashboard, roles: ['admin', 'instrutor'] },
  { label: 'Colaboradores', href: '/colaboradores', icon: IconUsers, roles: ['admin'] },
  { label: 'Calendário', href: '/calendario', icon: IconCalendar, roles: ['admin', 'instrutor'] },
  { label: 'Cursos', href: '/cursos', icon: IconBook, roles: ['admin', 'instrutor'] },
  { label: 'Alunos', href: '/alunos', icon: IconGraduation, roles: ['admin', 'instrutor'] },
  { label: 'Leads', href: '/leads', icon: IconTarget, roles: ['admin'] },
  { label: 'News', href: '/news', icon: IconNews, roles: ['admin', 'instrutor'] },
  { label: 'Apresentações', href: '/apresentacoes', icon: IconPresentation, roles: ['admin'] },
  { label: 'Financeiro', href: '/financeiro', icon: IconWallet, roles: ['admin'] },
  { label: 'Configurações', href: '/configuracoes', icon: IconSettings, roles: ['admin'] },
]

export default function Navbar({ userName, role = 'admin' }: { userName?: string; role?: Role }) {
  const pathname = useLocation().pathname
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)     // popover do usuário
  const [drawerOpen, setDrawerOpen] = useState(false) // drawer mobile

  const navItems = allNavItems.filter(item => item.roles.includes(role))

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  const initials = userName
    ? userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  const Logo = (
    <Link to="/dashboard" className="flex items-center gap-2 shrink-0" onClick={() => setDrawerOpen(false)}>
      <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">G</span>
      <span className="font-bold text-lg text-gray-900">Gestão Pro</span>
    </Link>
  )

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
      {navItems.map(item => {
        const active = pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            to={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              active ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  // Rodapé do usuário (sidebar/drawer) com popover que abre para cima.
  const UserFooter = (
    <div className="relative border-t border-gray-100 p-3">
      {menuOpen && (
        <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden gp-pop z-10">
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
        className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-gray-800 truncate">{userName || 'Usuário'}</p>
          <p className="text-xs text-blue-600 font-medium">{ROLE_LABELS[role]}</p>
        </div>
        <IconChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
  )

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-60 bg-white border-r border-gray-200 z-30">
        <div className="h-14 flex items-center px-5 border-b border-gray-100">{Logo}</div>
        <NavLinks />
        {UserFooter}
      </aside>

      {/* Top bar mobile */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between h-14 px-4">
          <button
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
          >
            <IconMenu className="w-5 h-5" />
          </button>
          {Logo}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-1.5 p-0.5 rounded-full hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                {initials}
              </div>
              <IconChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden gp-pop z-30">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">{userName || 'Usuário'}</p>
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
      </header>

      {/* Drawer mobile */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-gray-900/50 gp-backdrop" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col gp-pop">
            <div className="h-14 flex items-center justify-between px-5 border-b border-gray-100">
              {Logo}
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:bg-gray-100" aria-label="Fechar menu">
                <IconClose className="w-5 h-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setDrawerOpen(false)} />
            {UserFooter}
          </aside>
        </div>
      )}

      {/* Backdrop para fechar o popover do usuário no desktop */}
      {menuOpen && <div className="hidden lg:block fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />}
    </>
  )
}
