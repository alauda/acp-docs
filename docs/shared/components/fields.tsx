// Form fields and styles shared by the interactive doc components, based on
// the theme variables so that they follow the light and dark themes.
import type { CSSProperties } from 'react'

import { releases } from './alauda-os.js'

export const fieldRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
  marginBottom: '0.75rem',
}

export const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  flex: '1 1 12rem',
  fontSize: '0.875rem',
}

export const controlStyle: CSSProperties = {
  padding: '0.375rem 0.5rem',
  border: '1px solid var(--rp-c-divider)',
  borderRadius: 'var(--rp-radius-small)',
  background: 'var(--rp-c-bg)',
  color: 'var(--rp-c-text-1)',
  font: 'inherit',
}

export const alertStyle: CSSProperties = {
  margin: '0 0 0.75rem',
  color: 'var(--rp-container-danger-text)',
}

export interface AcpVersionFieldProps {
  id: string
  label: string
  value: string
  onChange: (acp: string) => void
}

export function AcpVersionField({ id, label, value, onChange }: AcpVersionFieldProps) {
  return (
    <label htmlFor={id} style={fieldStyle}>
      {label}
      <select id={id} value={value} onChange={event => onChange(event.target.value)} style={controlStyle}>
        {releases.map(release => (
          <option key={release.acp} value={release.acp}>
            {release.acp}
          </option>
        ))}
      </select>
    </label>
  )
}
