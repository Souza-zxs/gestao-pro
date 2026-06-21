import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { resolveApp, COURSE_PATH } from '@/lib/subdomain'
import { AuthProvider } from '@/lib/auth'
import App from './App'
import PortalApp from './portal/PortalApp'
import './app/globals.css'

// Caminho /portal => portal de cursos; caso contrário => gestão.
// O portal roda com basename=/portal, então suas rotas internas seguem absolutas.
const isPortal = resolveApp() === 'portal'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter basename={isPortal ? COURSE_PATH : undefined}>
        {isPortal ? <PortalApp /> : <App />}
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
