import type { ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import Navbar from './Navbar'

export default function PageLayout({ children }: { children: ReactNode }) {
  const { name, role } = useAuth()

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar userName={name} role={role} />
      <div className="lg:pl-60">
        <main className="max-w-6xl mx-auto px-4 py-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
