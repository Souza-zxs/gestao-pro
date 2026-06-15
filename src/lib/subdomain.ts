// Detecção de subdomínio — decide se renderiza o app de GESTÃO ou o PORTAL de cursos.
//
// Em produção: aponte o subdomínio do cliente (ex: cursos.seudominio.com) para o
// mesmo build. A detecção é 100% no cliente — nenhum servidor extra é necessário,
// pois o bundle é o mesmo; só muda qual "app" é montado conforme o hostname.
//
// Configuração: defina VITE_COURSE_SUBDOMAIN no .env para mudar o rótulo do
// subdomínio (padrão: "cursos"). Assim, quando você tiver o subdomínio do cliente,
// basta ajustar essa variável e apontar o DNS — sem mexer no código.

export const COURSE_SUBDOMAIN: string =
  (import.meta.env.VITE_COURSE_SUBDOMAIN as string | undefined)?.trim() || 'cursos'

const SESSION_KEY = 'gp_app'

export type AppKind = 'portal' | 'main'

/**
 * Resolve qual app montar.
 * - Hostname começando com o subdomínio de cursos (ex: cursos.localhost,
 *   cursos.cliente.com) => 'portal'.
 * - Atalho de dev em localhost simples: ?app=portal / ?app=main (memorizado na
 *   sessão para sobreviver a navegações e refresh).
 */
export function resolveApp(): AppKind {
  if (typeof window === 'undefined') return 'main'

  const params = new URLSearchParams(window.location.search)
  if (params.has('app')) {
    const v = params.get('app') === 'portal' ? 'portal' : 'main'
    try { sessionStorage.setItem(SESSION_KEY, v) } catch { /* ignore */ }
  }

  const firstLabel = window.location.hostname.split('.')[0].toLowerCase()
  if (firstLabel === COURSE_SUBDOMAIN) return 'portal'

  try {
    if (sessionStorage.getItem(SESSION_KEY) === 'portal') return 'portal'
  } catch { /* ignore */ }

  return 'main'
}

export function isCourseHost(): boolean {
  return resolveApp() === 'portal'
}

/** URL absoluta do portal de cursos (usada por links no app de gestão). */
export function portalUrl(path = '/'): string {
  if (typeof window === 'undefined') return path
  const { protocol, hostname, port } = window.location
  const firstLabel = hostname.split('.')[0].toLowerCase()
  // Já estamos num host de cursos? mantém.
  if (firstLabel === COURSE_SUBDOMAIN) return path
  // localhost / IP: usa o atalho de dev.
  const isLocal = hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
  if (isLocal) return `${path}${path.includes('?') ? '&' : '?'}app=portal`
  // domínio real: prefixa o subdomínio
  const portPart = port ? `:${port}` : ''
  return `${protocol}//${COURSE_SUBDOMAIN}.${hostname}${portPart}${path}`
}
