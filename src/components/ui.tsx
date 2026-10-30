import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Check, LoaderCircle, X } from 'lucide-react'
import clsx from 'clsx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}) {
  return (
    <button
      className={clsx('btn', `btn-${variant}`, `btn-${size}`, className)}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle size={16} className="spin" /> : icon}
      {children ? <span>{children}</span> : null}
    </button>
  )
}

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('card', className)} {...props}>
      {children}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'up' | 'down' | 'gold' | 'green' | 'blue' | 'purple'
  className?: string
}) {
  return <span className={clsx('badge', `badge-${tone}`, className)}>{children}</span>
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={clsx('field', className)}>
      {label ? <span className="field-label">{label}</span> : null}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx('input', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx('textarea', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx('select', className)} {...props}>
      {children}
    </select>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={clsx('segmented', className)}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={clsx('segmented-item', value === option.value && 'is-active')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 620,
  className,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('modal-open')
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('modal-open')
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="modal-layer" role="presentation">
      <div className="modal-backdrop" onClick={onClose} />
      <div className={clsx('modal', className)} role="dialog" aria-modal="true" style={{ width }}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  tone = 'danger',
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description: ReactNode
  confirmText?: string
  tone?: 'danger' | 'primary'
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={440}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="confirm-text">{description}</p>
    </Modal>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={clsx('empty-state', compact && 'is-compact')}>
      {icon ? <div className="empty-icon">{icon}</div> : null}
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className={clsx('icon-btn', className)} aria-label={label} title={label} {...props}>
      {children}
    </button>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
}) {
  return (
    <label className="toggle-row">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={clsx('toggle', checked && 'is-on')}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
      {label ? <span>{label}</span> : null}
    </label>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const id = useId()
  return (
    <div className={clsx('search-input', className)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value ? (
        <button type="button" onClick={() => onChange('')} aria-label="清空搜索">
          <X size={14} />
        </button>
      ) : null}
    </div>
  )
}

export function ToastStack({
  items,
  onDismiss,
}: {
  items: { id: string; message: string; tone: 'success' | 'error' | 'info' }[]
  onDismiss: (id: string) => void
}) {
  return createPortal(
    <div className="toast-stack" aria-live="polite">
      {items.map((item) => (
        <div className={clsx('toast', `toast-${item.tone}`)} key={item.id}>
          <span className="toast-icon">
            {item.tone === 'success' ? <Check size={15} /> : item.tone === 'error' ? <AlertCircle size={15} /> : null}
          </span>
          <span>{item.message}</span>
          <button type="button" onClick={() => onDismiss(item.id)} aria-label="关闭提示">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}

export function useOutsideClick<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onOutside])
  return ref
}

export function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
