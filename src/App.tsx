import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { readUserCookie } from '@/lib/auth-mock'
import PageLayout from '@/components/PageLayout'

import LoginPage from './app/login/LoginPage'
import AgendarClient from './app/agendar/AgendarClient'
import DashboardClient from './app/dashboard/DashboardClient'
import ColaboradoresClient from './app/colaboradores/ColaboradoresClient'
import CalendarioClient from './app/calendario/CalendarioClient'
import AlunosClient from './app/alunos/AlunosClient'
import LeadsClient from './app/leads/LeadsClient'
import NewsClient from './app/news/NewsClient'
import ApresentacoesClient from './app/apresentacoes/ApresentacoesClient'
import FinanceiroClient from './app/financeiro/FinanceiroClient'
import ConfiguracoesClient from './app/configuracoes/ConfiguracoesClient'

function ProtectedLayout() {
  const user = readUserCookie()
  if (!user) return <Navigate to="/login" replace />
  return (
    <PageLayout>
      <Outlet />
    </PageLayout>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/agendar" element={<AgendarClient />} />
      <Route path="/agendar/:userId" element={<AgendarClient />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<DashboardClient />} />
        <Route path="/colaboradores" element={<ColaboradoresClient />} />
        <Route path="/calendario" element={<CalendarioClient />} />
        <Route path="/alunos" element={<AlunosClient />} />
        <Route path="/leads" element={<LeadsClient />} />
        <Route path="/news" element={<NewsClient />} />
        <Route path="/apresentacoes" element={<ApresentacoesClient />} />
        <Route path="/financeiro" element={<FinanceiroClient />} />
        <Route path="/configuracoes" element={<ConfiguracoesClient />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
