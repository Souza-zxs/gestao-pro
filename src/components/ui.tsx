'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { IconClose, IconPlus } from './icons'

/* ---------- Cabeçalho de página ---------- */
export function PageHeader({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/* ---------- Card ---------- */
export function Card({
  children, className = '', padded = true,
}: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${padded ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  )
}

/* ---------- Botão ---------- */
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
  secondary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
  ghost: 'text-gray-600 hover:bg-gray-100',
}

export function Button({
  variant = 'primary', icon, children, className = '', ...props
}: { variant?: ButtonVariant; icon?: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${buttonVariants[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

export function AddButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button icon={<IconPlus className="w-4 h-4" />} {...props}>{children}</Button>
  )
}

/* ---------- Modal ---------- */
export function Modal({
  open, onClose, title, children, size = 'md',
}: {
  open: boolean; onClose: () => void; title: string; children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  const maxW = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }[size]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 gp-backdrop"
      style={{ backgroundColor: 'rgba(17,24,39,0.55)', backdropFilter: 'blur(2px)' }}
      onMouseDown={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${maxW} gp-pop`}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <IconClose className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

/* ---------- Campos de formulário ---------- */
export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

const fieldClass =
  'w-full px-3 py-2.5 rounded-lg text-sm border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 transition-shadow'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${props.className ?? ''}`} />
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldClass} ${props.className ?? ''}`} />
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldClass} resize-none ${props.className ?? ''}`} />
}

/* ---------- Métrica ---------- */
export function Metric({
  label, value, sub, accent = 'text-gray-900', icon,
}: { label: string; value: string; sub?: string; accent?: string; icon?: ReactNode }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${accent}`}>{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        {icon && <div className="text-blue-600/80">{icon}</div>}
      </div>
    </Card>
  )
}

/* ---------- Badge ---------- */
type BadgeColor = 'blue' | 'green' | 'gray' | 'red' | 'amber'
const badgeColors: Record<BadgeColor, string> = {
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  gray: 'bg-gray-100 text-gray-600',
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
}
export function Badge({ color = 'gray', children }: { color?: BadgeColor; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeColors[color]}`}>
      {children}
    </span>
  )
}

/* ---------- Estado vazio ---------- */
export function EmptyState({
  icon, title, description, action,
}: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <Card className="py-14 flex flex-col items-center text-center">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-3">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="text-xs text-gray-400 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  )
}

/* ---------- Abas ---------- */
export function Tabs<T extends string>({
  tabs, active, onChange,
}: { tabs: { value: T; label: string }[]; active: T; onChange: (v: T) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const prevLeft = useRef(0)
  const [indicator, setIndicator] = useState({ left: 0, right: 0, movingRight: true })

  useLayoutEffect(() => {
    const el = btnRefs.current[active]
    const container = containerRef.current
    if (!el || !container) return
    const left = el.offsetLeft
    const right = container.offsetWidth - (el.offsetLeft + el.offsetWidth)
    const movingRight = left >= prevLeft.current
    prevLeft.current = left
    setIndicator({ left, right, movingRight })
  }, [active, tabs])

  // A borda da frente parte primeiro e a de trás alcança depois → a barra
  // estica enquanto viaja e depois contrai, simulando um scroll elástico.
  const ease = 'cubic-bezier(0.65, 0, 0.35, 1)'
  const lead = `300ms 0ms ${ease}`
  const trail = `300ms 80ms ${ease}`

  return (
    <div ref={containerRef} className="relative flex gap-1 mb-6 border-b border-gray-200">
      {tabs.map(t => {
        const on = active === t.value
        return (
          <button
            key={t.value}
            ref={el => { btnRefs.current[t.value] = el }}
            onClick={() => onChange(t.value)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              on ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        )
      })}
      <span
        className="absolute bottom-0 h-0.5 bg-blue-600 rounded-full"
        style={{
          left: indicator.left,
          right: indicator.right,
          transition: indicator.movingRight
            ? `left ${trail}, right ${lead}`
            : `left ${lead}, right ${trail}`,
        }}
      />
    </div>
  )
}

/* ---------- Tabela ---------- */
export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${className}`}>
      {children}
    </th>
  )
}

/* ---------- Spinner ---------- */
export function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  )
}

/* ---------- Botões de ação em tabela ---------- */
export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex gap-1.5">{children}</div>
}
export function IconAction({
  onClick, title, color = 'gray', children,
}: { onClick: () => void; title: string; color?: 'blue' | 'red' | 'gray'; children: ReactNode }) {
  const colors = {
    blue: 'text-blue-600 hover:bg-blue-50',
    red: 'text-red-600 hover:bg-red-50',
    gray: 'text-gray-500 hover:bg-gray-100',
  }
  return (
    <button onClick={onClick} title={title} className={`p-1.5 rounded-lg transition-colors ${colors[color]}`}>
      {children}
    </button>
  )
}
