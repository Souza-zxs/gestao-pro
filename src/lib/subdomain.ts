// Roteamento entre o app de GESTÃO e o PORTAL de cursos.
//
// Antes era por subdomínio (cursos.cliente.com); agora é por CAMINHO: tudo sob
// /portal carrega o portal de cursos; o resto carrega a gestão. Vantagem: não
// precisa configurar DNS de subdomínio — um domínio só já serve os dois apps
// (a hospedagem só precisa do fallback de SPA para index.html, como qualquer
// rota profunda).
//
// O portal é montado com <BrowserRouter basename="/portal"> (ver main.tsx), então
// dentro dele as rotas continuam absolutas ("/", "/curso/:id", "/entrar"...).

/** Prefixo de caminho do portal de cursos. */
export const COURSE_PATH = '/portal'

export type AppKind = 'portal' | 'main'

/** Resolve qual app montar a partir do caminho atual. */
export function resolveApp(): AppKind {
  if (typeof window === 'undefined') return 'main'
  const p = window.location.pathname
  return p === COURSE_PATH || p.startsWith(`${COURSE_PATH}/`) ? 'portal' : 'main'
}

export function isCourseHost(): boolean {
  return resolveApp() === 'portal'
}

/**
 * URL (caminho) de uma rota do portal, para links vindos do app de gestão.
 * Como gestão e portal são routers separados, esses links devem ser navegação
 * de página inteira (window.location.assign / window.open / <a href>).
 */
export function portalUrl(path = '/'): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return clean === '/' ? COURSE_PATH : `${COURSE_PATH}${clean}`
}
