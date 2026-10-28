// Generates the command that creates the ConfigMap registering a Huawei DCS
// VM template on the global cluster. The Kubernetes version and etcd tag of
// each ACP version come from ../alauda-os/version-mapping.json: to add a
// release, append an entry there (see ../alauda-os/README.md), not here.
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'

import versionMapping from '../alauda-os/version-mapping.json' with { type: 'json' }

const { releases } = versionMapping
const latestRelease = releases[releases.length - 1]

const OS_OPTIONS = [
  { value: 'm55', label: 'SLE Micro 5.5 (m55)' },
  { value: 'k25', label: 'KubeOS (k25)' },
]
const OTHER_OS = 'other'

// Kubernetes label value syntax. The template name is used verbatim as a
// label value, so a name outside this syntax cannot be registered.
const LABEL_VALUE = /^[A-Za-z0-9]([A-Za-z0-9._-]{0,61}[A-Za-z0-9])?$/

// The ConfigMap name must be a DNS-1123 subdomain.
const toNamePart = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')

// Quoted values stay strings in YAML even when they look like numbers; a JSON
// string is a valid YAML double-quoted scalar.
const quote = (value: string) => JSON.stringify(value)

interface CommandValues {
  configMapName: string
  templateName: string
  acpVersion: string
  kubernetesVersion: string
  etcdTag: string
}

const renderCommand = ({
  configMapName,
  templateName,
  acpVersion,
  kubernetesVersion,
  etcdTag,
}: CommandValues) =>
  [
    "kubectl apply -f - <<'EOF'",
    'apiVersion: v1',
    'kind: ConfigMap',
    'metadata:',
    `  name: ${configMapName}`,
    '  namespace: cpaas-system',
    '  labels:',
    `    cpaas.io/dcs-vm-template: ${quote(templateName)}`,
    `    cpaas.io/distribution-version: ${quote(acpVersion)}`,
    'data:',
    `  kubernetesVersion: ${quote(kubernetesVersion)}`,
    `  etcdTag: ${quote(etcdTag)}`,
    'EOF',
  ].join('\n')

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  flex: '1 1 12rem',
  fontSize: '0.875rem',
}

const controlStyle: CSSProperties = {
  padding: '0.375rem 0.5rem',
  border: '1px solid var(--rp-c-divider)',
  borderRadius: 'var(--rp-radius-small)',
  background: 'var(--rp-c-bg)',
  color: 'var(--rp-c-text-1)',
  font: 'inherit',
}

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

const note = (
  <p>
    Run the command on the <code>global</code> cluster. In a DR environment, run it on both{' '}
    <code>global</code> clusters: the ConfigMaps are not synchronized between them.
  </p>
)

export interface DcsVmTemplateConfigMapProps {
  /**
   * Shown only in the Markdown output of the page, where the generator is not
   * interactive and the command keeps its placeholders. Use it to point to the
   * values of each ACP version.
   */
  children?: ReactNode
}

export default function DcsVmTemplateConfigMap({ children }: DcsVmTemplateConfigMapProps) {
  const id = useId()
  const [templateName, setTemplateName] = useState('')
  const [acpVersion, setAcpVersion] = useState(latestRelease.acp)
  const [os, setOs] = useState(OS_OPTIONS[0].value)
  const [customOs, setCustomOs] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) {
      return
    }
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  if (import.meta.env.SSG_MD) {
    return (
      <>
        <pre data-lang="bash">
          <code>
            {renderCommand({
              configMapName: 'dcs-vm-template-<os>-<acp-version>',
              templateName: '<vm-template-name>',
              acpVersion: '<acp-version>',
              kubernetesVersion: '<kubernetes-version>',
              etcdTag: '<etcd-tag>',
            })}
          </code>
        </pre>
        {children}
        {note}
      </>
    )
  }

  const release = releases.find(item => item.acp === acpVersion) ?? latestRelease
  const trimmedName = templateName.trim()
  const osPart = toNamePart(os === OTHER_OS ? customOs : os)
  const command = renderCommand({
    configMapName: `dcs-vm-template-${osPart || '<os>'}-${toNamePart(release.acp)}`,
    templateName: trimmedName || '<vm-template-name>',
    acpVersion: release.acp,
    kubernetesVersion: release.kubernetes,
    etcdTag: release.etcd,
  })
  const invalidName = trimmedName !== '' && !LABEL_VALUE.test(trimmedName)

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
    <div style={{ margin: '1rem 0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <label htmlFor={`${id}-name`} style={fieldStyle}>
          VM template name
          <input
            id={`${id}-name`}
            type="text"
            value={templateName}
            placeholder="Name registered on DCS"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={invalidName}
            onChange={event => setTemplateName(event.target.value)}
            style={controlStyle}
          />
        </label>
        <label htmlFor={`${id}-acp`} style={fieldStyle}>
          ACP version
          <select
            id={`${id}-acp`}
            value={release.acp}
            onChange={event => setAcpVersion(event.target.value)}
            style={controlStyle}
          >
            {releases.map(item => (
              <option key={item.acp} value={item.acp}>
                {item.acp}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-os`} style={fieldStyle}>
          OS
          <select
            id={`${id}-os`}
            value={os}
            onChange={event => setOs(event.target.value)}
            style={controlStyle}
          >
            {OS_OPTIONS.map(item => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
            <option value={OTHER_OS}>Other…</option>
          </select>
        </label>
        {os === OTHER_OS ? (
          <label htmlFor={`${id}-custom-os`} style={fieldStyle}>
            OS identifier
            <input
              id={`${id}-custom-os`}
              type="text"
              value={customOs}
              spellCheck={false}
              autoComplete="off"
              onChange={event => setCustomOs(event.target.value)}
              style={controlStyle}
            />
          </label>
        ) : null}
      </div>
      {invalidName ? (
        <p role="alert" style={{ margin: '0 0 0.75rem', color: 'var(--rp-container-danger-text)' }}>
          This name cannot be used as a label value. A label value has at most 63 characters, starts and
          ends with a letter or digit, and contains only letters, digits, <code>-</code>, <code>_</code>,
          and <code>.</code>. Use a VM template whose name follows these rules.
        </p>
      ) : null}
      <div style={{ position: 'relative' }}>
        <pre data-lang="bash" style={preStyle}>
          <code>{command}</code>
        </pre>
        <button type="button" onClick={copy} style={copyButtonStyle}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {note}
    </div>
  )
}
