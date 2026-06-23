import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { canAccessRoute, homeRoute } from '@/lib/rbac'
import { portalUrl } from '@/lib/subdomain'
import PageLayout from '@/components/PageLayout'

import LoginPage from './app/login/LoginPage'
import AgendarClient from './app/agendar/AgendarClient'
import DashboardClient from './app/dashboard/DashboardClient'
import ColaboradoresClient from './app/colaboradores/ColaboradoresClient'
import CalendarioClient from './app/calendario/CalendarioClient'
import AlunosClient from './app/alunos/AlunosClient'
import LeadsClient from './app/leads/LeadsClient'
import ClientesClient from './app/clientes/ClientesClient'
import ResultadosClient from './app/resultados/ResultadosClient'
import TarefasClient from './app/tarefas/TarefasClient'
import NewsClient from './app/news/NewsClient'
import ApresentacoesClient from './app/apresentacoes/ApresentacoesClient'
import FinanceiroClient from './app/financeiro/FinanceiroClient'
import ConfiguracoesClient from './app/configuracoes/ConfiguracoesClient'
import CursosClient from './app/cursos/CursosClient'

// Tela de carregamento enquanto a sessão é resolvida.
function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="flex items-center gap-3 text-gray-500">
        <span className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        Carregando...
      </div>
    </div>
  )
}

function ProtectedLayout() {
  const { user, role, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  // Aluno não opera o app de gestão — vai para o portal de cursos.
  if (role === 'aluno') {
    window.location.assign(portalUrl('/'))
    return null
  }
  return (
    <PageLayout>
      <Outlet />
    </PageLayout>
  )
}

// Bloqueia rotas conforme a capacidade do papel; redireciona para a home do papel.
function RequireRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  if (!canAccessRoute(role, pathname)) {
    return <Navigate to={homeRoute(role)} replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/agendar" element={<AgendarClient />} />
      <Route path="/agendar/:userId" element={<AgendarClient />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<RequireRoute><DashboardClient /></RequireRoute>} />
        <Route path="/colaboradores" element={<RequireRoute><ColaboradoresClient /></RequireRoute>} />
        <Route path="/calendario" element={<RequireRoute><CalendarioClient /></RequireRoute>} />
        <Route path="/cursos" element={<RequireRoute><CursosClient /></RequireRoute>} />
        <Route path="/alunos" element={<RequireRoute><AlunosClient /></RequireRoute>} />
        <Route path="/leads" element={<RequireRoute><LeadsClient /></RequireRoute>} />
        <Route path="/clientes" element={<RequireRoute><ClientesClient /></RequireRoute>} />
        <Route path="/resultados" element={<RequireRoute><ResultadosClient /></RequireRoute>} />
        <Route path="/tarefas" element={<RequireRoute><TarefasClient /></RequireRoute>} />
        <Route path="/news" element={<RequireRoute><NewsClient /></RequireRoute>} />
        <Route path="/apresentacoes" element={<RequireRoute><ApresentacoesClient /></RequireRoute>} />
        <Route path="/financeiro" element={<RequireRoute><FinanceiroClient /></RequireRoute>} />
        <Route path="/configuracoes" element={<RequireRoute><ConfiguracoesClient /></RequireRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
