import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  )
}

export const IconDashboard    = (p: IconProps) => (<Base {...p}><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></Base>)
export const IconSun          = (p: IconProps) => (<Base {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></Base>)
export const IconMoon         = (p: IconProps) => (<Base {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></Base>)
export const IconChart        = (p: IconProps) => (<Base {...p}><path d="M3 3v18h18" /><rect x="7" y="11" width="3" height="7" rx="0.5" /><rect x="12" y="7" width="3" height="11" rx="0.5" /><rect x="17" y="4" width="3" height="14" rx="0.5" /></Base>)
export const IconUsers        = (p: IconProps) => (<Base {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Base>)
export const IconCalendar     = (p: IconProps) => (<Base {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Base>)
export const IconGraduation   = (p: IconProps) => (<Base {...p}><path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1 2 3 6 3s6-2 6-3v-5" /></Base>)
export const IconNews         = (p: IconProps) => (<Base {...p}><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" /><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" /></Base>)
export const IconPresentation = (p: IconProps) => (<Base {...p}><path d="M2 3h20M3 3v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V3M12 15v6M9 21h6M8 9l2 2 4-4" /></Base>)
export const IconWallet       = (p: IconProps) => (<Base {...p}><path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" /><path d="M18 12a1 1 0 0 0 0 2h3v-2Z" /></Base>)
export const IconSettings     = (p: IconProps) => (<Base {...p}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></Base>)
export const IconPlus         = (p: IconProps) => (<Base {...p}><path d="M5 12h14M12 5v14" /></Base>)
export const IconClose        = (p: IconProps) => (<Base {...p}><path d="M18 6 6 18M6 6l12 12" /></Base>)
export const IconChevronLeft  = (p: IconProps) => (<Base {...p}><path d="m15 18-6-6 6-6" /></Base>)
export const IconChevronRight = (p: IconProps) => (<Base {...p}><path d="m9 18 6-6-6-6" /></Base>)
export const IconChevronDown  = (p: IconProps) => (<Base {...p}><path d="m6 9 6 6 6-6" /></Base>)
export const IconEdit         = (p: IconProps) => (<Base {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></Base>)
export const IconTrash        = (p: IconProps) => (<Base {...p}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></Base>)
export const IconCheck        = (p: IconProps) => (<Base {...p}><path d="M20 6 9 17l-5-5" /></Base>)
export const IconClock        = (p: IconProps) => (<Base {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></Base>)
export const IconMapPin       = (p: IconProps) => (<Base {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Base>)
export const IconLink         = (p: IconProps) => (<Base {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Base>)
export const IconLogout       = (p: IconProps) => (<Base {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Base>)
export const IconMenu         = (p: IconProps) => (<Base {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Base>)
export const IconTicket       = (p: IconProps) => (<Base {...p}><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v14" /></Base>)
export const IconInbox        = (p: IconProps) => (<Base {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" /></Base>)
export const IconBan          = (p: IconProps) => (<Base {...p}><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></Base>)
export const IconTarget       = (p: IconProps) => (<Base {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></Base>)
export const IconBook         = (p: IconProps) => (<Base {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></Base>)
export const IconPlay         = (p: IconProps) => (<Base {...p}><path d="M6 4v16l13-8-13-8Z" /></Base>)
export const IconPlayCircle   = (p: IconProps) => (<Base {...p}><circle cx="12" cy="12" r="10" /><path d="m10 8 6 4-6 4V8Z" /></Base>)
export const IconCart         = (p: IconProps) => (<Base {...p}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></Base>)
export const IconLock         = (p: IconProps) => (<Base {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Base>)
export const IconShield       = (p: IconProps) => (<Base {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /></Base>)
export const IconCreditCard   = (p: IconProps) => (<Base {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></Base>)
export const IconUserCircle   = (p: IconProps) => (<Base {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3" /><path d="M6.5 19a6 6 0 0 1 11 0" /></Base>)
export const IconArrowLeft    = (p: IconProps) => (<Base {...p}><path d="M19 12H5M12 19l-7-7 7-7" /></Base>)
export const IconSpark        = (p: IconProps) => (<Base {...p}><path d="M9.94 14.06 6 18M14.06 9.94 18 6" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></Base>)
export const IconUpload       = (p: IconProps) => (<Base {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></Base>)
export const IconDownload     = (p: IconProps) => (<Base {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></Base>)
export const IconFile         = (p: IconProps) => (<Base {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></Base>)
export const IconSearch       = (p: IconProps) => (<Base {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></Base>)
export const IconCopy         = (p: IconProps) => (<Base {...p}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Base>)
export const IconClipboard    = (p: IconProps) => (<Base {...p}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /></Base>)
export const IconEye          = (p: IconProps) => (<Base {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Base>)
export const IconEyeOff       = (p: IconProps) => (<Base {...p}><path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61" /><path d="m2 2 20 20" /></Base>)

/* ─── Novos ícones adicionados ──────────────────────────────────────
   Seguem o mesmo padrão Base: SVG 24x24, stroke, sem fill.
   IconTrendingUp  — linha subindo da esquerda pra direita (entradas)
   IconTrendingDown — linha descendo da esquerda pra direita (saídas)
─────────────────────────────────────────────────────────────────── */
export const IconTrendingUp   = (p: IconProps) => (<Base {...p}><path d="m23 7-7 7-4-4-9 9" /><path d="M17 7h6v6" /></Base>)
export const IconTrendingDown = (p: IconProps) => (<Base {...p}><path d="m23 17-7-7-4 4-9-9" /><path d="M17 17h6v-6" /></Base>)