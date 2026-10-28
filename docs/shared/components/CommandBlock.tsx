// A shell command shown as a code block with a copy button, for the generators
// whose command changes with the form, which a Markdown code block cannot do.
import { useEffect, useState, type CSSProperties } from 'react'

const preStyle: CSSProperties = {
  margin: 0,
  padding: '1rem',
  overflowX: 'auto',
  border: 'var(--rp-code-block-border)',
  borderRadius: 'var(--rp-radius)',
  background: 'var(--rp-code-block-bg)',
  color: 'var(--rp-code-block-color)',
  fontFamily: 'var(--rp-font-family-mono)',
  fontSize: '0.875rem',
  lineHeight: 1.6,
}

const copyButtonStyle: CSSProperties = {
  position: 'absolute',
  top: '0.5rem',
  right: '0.5rem',
  padding: '0.25rem 0.625rem',
  border: '1px solid var(--rp-c-divider)',
  borderRadius: 'var(--rp-radius-small)',
  background: 'var(--rp-c-bg)',
  color: 'var(--rp-c-text-1)',
  fontSize: '0.75rem',
  cursor: 'pointer',
}

export default function CommandBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = () => {
    // The Clipboard API is unavailable outside secure contexts; the command
    // can still be selected and copied by hand there.
    if (!('clipboard' in navigator)) {
      return
    }
    navigator.clipboard.writeText(command).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <pre data-lang="bash" style={preStyle}>
        <code>{command}</code>
      </pre>
      <button type="button" onClick={copy} style={copyButtonStyle}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
