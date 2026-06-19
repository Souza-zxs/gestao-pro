import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { useState } from 'react'
import { IconBook, IconUserCircle, IconLogout, IconChevronDown } from '@/components/icons'

export default function PortalLayout({ children }: { children: ReactNode }) {
  const { user, name, email, signOut } = useAuth()
  const navigate = useNavigate()
  const pathname = useLocation().pathname
  const [menuOpen, setMenuOpen] = useState(false)

  async function sair() {
    await signOut()
    setMenuOpen(false)
    navigate('/')
  }

  const link = (to: string, label: string) => {
    const active = pathname === to
    return (
      <Link to={to} className={`text-sm font-medium transition-colors ${active ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>
        {label}
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <IconBook className="w-4 h-4" />
            </span>
            <span className="font-bold text-lg text-gray-900">Academy</span>
          </Link>

          <nav className="flex items-center gap-5">
            {link('/', 'Catálogo')}
            {user && link('/minha-area', 'Minha área')}
            {user ? (
              <div className="relative">
                <button onClick={() => setMenuOpen(o => !o)} className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900">
                  <IconUserCircle className="w-6 h-6 text-gray-400" />
                  <span className="hidden sm:block max-w-[120px] truncate">{name}</span>
                  <IconChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden z-30 gp-pop">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                        <p className="text-xs text-gray-400 truncate">{email}</p>
                      </div>
                      <button onClick={sair} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                        <IconLogout className="w-4 h-4" /> Sair
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link to="/entrar" className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                Entrar
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">{children}</main>

      <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-400">
        Academy — portal de cursos · Gestão Pro
      </footer>
    </div>
  )
}
