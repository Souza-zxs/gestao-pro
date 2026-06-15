import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import PortalLayout from './PortalLayout'
import CatalogoPage from './CatalogoPage'
import CursoDetalhePage from './CursoDetalhePage'
import CheckoutPage from './CheckoutPage'
import SucessoPage from './SucessoPage'
import MinhaAreaPage from './MinhaAreaPage'
import PlayerPage from './PlayerPage'
import PortalLogin from './PortalLogin'

function LayoutRoute() {
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
      <Route element={<LayoutRoute />}>
        <Route path="/" element={<CatalogoPage />} />
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
