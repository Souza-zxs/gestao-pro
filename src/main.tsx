import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { resolveApp } from '@/lib/subdomain'
import App from './App'
import PortalApp from './portal/PortalApp'
import './app/globals.css'

// Subdomínio de cursos (ex: cursos.cliente.com) => portal; caso contrário => gestão.
const Root = resolveApp() === 'portal' ? PortalApp : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>,
)
