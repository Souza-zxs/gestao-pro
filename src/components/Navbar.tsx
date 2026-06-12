import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { MOCK_COOKIE } from '@/lib/auth-mock'
import {
  IconDashboard, IconUsers, IconCalendar, IconGraduation, IconNews,
  IconPresentation, IconWallet, IconSettings, IconMenu, IconLogout, IconChevronDown, IconTarget,
} from './icons'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: IconDashboard },
  { label: 'Colaboradores', href: '/colaboradores', icon: IconUsers },
  { label: 'Calendário', href: '/calendario', icon: IconCalendar },
  { label: 'Alunos', href: '/alunos', icon: IconGraduation },
  { label: 'Leads', href: '/leads', icon: IconTarget },
  { label: 'News', href: '/news', icon: IconNews },
  { label: 'Apresentações', href: '/apresentacoes', icon: IconPresentation },
  { label: 'Financeiro', href: '/financeiro', icon: IconWallet },
  { label: 'Configurações', href: '/configuracoes', icon: IconSettings },
]

export default function Navbar({ userName }: { userName?: string }) {
  const pathname = useLocation().pathname
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function handleLogout() {
    document.cookie = `${MOCK_COOKIE}=; path=/; max-age=0`
    navigate('/login')
  }

  const initials = userName
    ? userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6 min-w-0">
            <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
              <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">G</span>
              <span className="font-bold text-lg text-gray-900 hidden sm:block">Gestão Pro</span>
            </Link>

            <div className="hidden lg:flex items-center gap-0.5">
              {navItems.map(item => {
                const active = pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      active ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
            >
              <IconMenu className="w-5 h-5" />
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {initials}
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">{userName || 'Usuário'}</span>
                <IconChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden gp-pop">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">{userName || 'Usuário'}</p>
                    <p className="text-xs text-gray-400">Conta ativa</p>
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
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden pb-3 pt-1 border-t border-gray-100 grid grid-cols-2 gap-1">
            {navItems.map(item => {
              const active = pathname.startsWith(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                    active ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {menuOpen && <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />}
    </nav>
  )
}
