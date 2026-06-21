import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import PortalLayout from './PortalLayout'
import CatalogoPage from './CatalogoPage'
import CursoDetalhePage from './CursoDetalhePage'
import CheckoutPage from './CheckoutPage'
import SucessoPage from './SucessoPage'
import MinhaAreaPage from './MinhaAreaPage'
import PlayerPage from './PlayerPage'
import PortalLogin from './PortalLogin'

// Catálogo é PÚBLICO (vitrine para vender). Ver detalhe do curso, comprar e
// assistir exigem login — e só ALUNO ou ADMIN entram (colaborador não é cliente).
function PublicLayout() {
  return (
    <PortalLayout>
      <Outlet />
    </PortalLayout>
  )
}

function ProtectedLayout() {
  const { user, role, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 rounded-full border-2 border-gray-300 border-t-blue-600 animate-spin" />
      </div>
    )
  }
  // Sem login => manda para o login guardando o destino para voltar depois.
  if (!user) return <Navigate to="/entrar" replace state={{ redirect: location.pathname + location.search }} />
  // Colaborador (instrutor) não é cliente do portal => volta para a gestão.
  if (role !== 'aluno' && role !== 'admin') {
    window.location.assign('/')
    return null
  }
  return (
    <PortalLayout>
      <Outlet />
    </PortalLayout>
  )
}

export default function PortalApp() {
  return (
    <Routes>
      <Route path="/entrar" element={<PortalLogin />} />

      {/* Público: vitrine */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<CatalogoPage />} />
      </Route>

      {/* Requer login (aluno/admin): detalhe, compra e aprendizado */}
      <Route element={<ProtectedLayout />}>
        <Route path="/curso/:id" element={<CursoDetalhePage />} />
        <Route path="/checkout/:id" element={<CheckoutPage />} />
        <Route path="/sucesso/:pedidoId" element={<SucessoPage />} />
        <Route path="/minha-area" element={<MinhaAreaPage />} />
        <Route path="/aprender/:cursoId" element={<PlayerPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
