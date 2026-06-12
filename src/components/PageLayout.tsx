import type { ReactNode } from 'react'
import { readUserCookie } from '@/lib/auth-mock'
import Navbar from './Navbar'

export default function PageLayout({ children }: { children: ReactNode }) {
  const user = readUserCookie()
  const userName = user?.name || user?.email?.split('@')[0] || 'Usuário'

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar userName={userName} />
      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        {children}
      </main>
    </div>
  )
}
