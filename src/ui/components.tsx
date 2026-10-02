import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './ui.css'

import { SEVERITY_LABEL, formatDelta, type Severity } from './severity'

export function Button({
  variant = 'secondary',
  large,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'inverse'; large?: boolean }) {
  return <button type="button" className={`tl-btn tl-btn--${variant}${large ? ' tl-btn--lg' : ''} ${className}`} {...rest} />
}

export function Chip({ tone = 'neutral', children }: { tone?: Severity | 'chem' | 'neutral'; children: ReactNode }) {
  return <span className={`tl-chip tl-chip--${tone}`}>{children}</span>
}

export function SeverityChip({ severity }: { severity: Severity }) {
  return <Chip tone={severity}>{SEVERITY_LABEL[severity]}</Chip>
}

export function Card({ danger, children }: { danger?: boolean; children: ReactNode }) {
  return <section className={`tl-card${danger ? ' tl-card--danger' : ''}`}>{children}</section>
}

export function FixRow({
  label,
  score,
  checked,
  onChange,
}: {
  label: string
  score: number
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="tl-fix">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="tl-fix__label">{label}</span>
      <span className="tl-fix__delta">{formatDelta(score)}</span>
    </label>
  )
}
