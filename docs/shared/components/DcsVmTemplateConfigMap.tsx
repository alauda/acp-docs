// Generates the command that creates the ConfigMaps registering Huawei DCS VM
// templates on the global cluster, for one ACP version or for every version on
// an upgrade path. The Kubernetes version and etcd tag of each ACP version come
// from ../alauda-os/version-mapping.json: to add a release, append an entry
// there (see ../alauda-os/README.md), not here.
import { useId, useState, type ReactNode } from 'react'

import { OS_VARIANTS, planUpgradePath, upgradeReleases, type Release } from './alauda-os.js'
import CommandBlock from './CommandBlock.js'
import { AcpVersionField, alertStyle, controlStyle, fieldRowStyle, fieldStyle } from './fields.js'

const latestRelease = upgradeReleases[upgradeReleases.length - 1]
const previousRelease = upgradeReleases[Math.max(upgradeReleases.length - 2, 0)]

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

interface ConfigMapValues {
  configMapName: string
  templateName: string
  acpVersion: string
  kubernetesVersion: string
  etcdTag: string
}

const renderConfigMap = ({
  configMapName,
  templateName,
  acpVersion,
  kubernetesVersion,
  etcdTag,
}: ConfigMapValues) =>
  [
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
  ].join('\n')

const renderCommand = (configMaps: ConfigMapValues[]) =>
  ["kubectl apply -f - <<'EOF'", configMaps.map(renderConfigMap).join('\n---\n'), 'EOF'].join('\n')

// `prefix` tells the ConfigMaps of a multi-version example apart, such as
// `intermediate-` and `target-`.
const placeholderValues = (prefix = ''): ConfigMapValues => ({
  configMapName: `dcs-vm-template-<os>-<${prefix}acp-version>`,
  templateName: `<${prefix}vm-template-name>`,
  acpVersion: `<${prefix}acp-version>`,
  kubernetesVersion: `<${prefix}kubernetes-version>`,
  etcdTag: `<${prefix}etcd-tag>`,
})

const releaseValues = (release: Release, templateName: string, osPart: string): ConfigMapValues => ({
  configMapName: `dcs-vm-template-${osPart || '<os>'}-${toNamePart(release.acp)}`,
  templateName,
  acpVersion: release.acp,
  kubernetesVersion: release.kubernetes,
  etcdTag: release.etcd,
})

const note = (
  <>
    <p>
      Run the command on the <code>global</code> cluster. In a DR environment, run it on both{' '}
      <code>global</code> clusters: the ConfigMaps are not synchronized between them.
    </p>
    <p>
      For each ACP version, register VM templates of only one OS on a <code>global</code> cluster. When
      VM templates of different OSes have the same Kubernetes version, an upgrade can move a cluster to
      the other OS.
    </p>
  </>
)

function InvalidNamesAlert({ names }: { names: string[] }) {
  if (names.length === 0) {
    return null
  }
  return (
    <p role="alert" style={alertStyle}>
      {names.map((name, index) => (
        <span key={name}>
          {index > 0 ? ', ' : null}
          <code>{name}</code>
        </span>
      ))}{' '}
      {names.length === 1 ? 'cannot be used as a label value.' : 'cannot be used as label values.'} A
      label value has at most 63 characters, starts and ends with a letter or digit, and contains only
      letters, digits, <code>-</code>, <code>_</code>, and <code>.</code>. Use VM templates whose names
      follow these rules.
    </p>
  )
}

const invalidNames = (names: string[]) => [
  ...new Set(names.filter(name => name !== '' && !LABEL_VALUE.test(name))),
]

// The OS select, with a free-text identifier for an OS that is not listed.
function useOsField(id: string) {
  const [os, setOs] = useState(OS_VARIANTS[0].value)
  const [customOs, setCustomOs] = useState('')

  const fields = (
    <>
      <label htmlFor={`${id}-os`} style={fieldStyle}>
        OS
        <select id={`${id}-os`} value={os} onChange={event => setOs(event.target.value)} style={controlStyle}>
          {OS_VARIANTS.map(item => (
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
    </>
  )

  return { osPart: toNamePart(os === OTHER_OS ? customOs : os), fields }
}

interface TemplateNameFieldProps {
  id: string
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}

function TemplateNameField({ id, label, value, placeholder, onChange }: TemplateNameFieldProps) {
  const trimmed = value.trim()
  return (
    <label htmlFor={id} style={fieldStyle}>
      {label}
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={trimmed !== '' && !LABEL_VALUE.test(trimmed)}
        onChange={event => onChange(event.target.value)}
        style={controlStyle}
      />
    </label>
  )
}

function SingleVersionForm() {
  const id = useId()
  const os = useOsField(id)
  const [templateName, setTemplateName] = useState('')
  const [acpVersion, setAcpVersion] = useState(latestRelease.acp)

  const release = upgradeReleases.find(item => item.acp === acpVersion) ?? latestRelease
  const trimmedName = templateName.trim()
  const command = renderCommand([releaseValues(release, trimmedName || '<vm-template-name>', os.osPart)])

  return (
    <>
      <div style={fieldRowStyle}>
        <TemplateNameField
          id={`${id}-name`}
          label="VM template name"
          value={templateName}
          placeholder="Name registered on DCS"
          onChange={setTemplateName}
        />
        <AcpVersionField id={`${id}-acp`} label="ACP version" value={release.acp} onChange={setAcpVersion} />
        {os.fields}
      </div>
      <InvalidNamesAlert names={invalidNames([trimmedName])} />
      <CommandBlock command={command} />
    </>
  )
}

function UpgradePathForm() {
  const id = useId()
  const os = useOsField(id)
  const [currentAcp, setCurrentAcp] = useState(previousRelease.acp)
  const [targetAcp, setTargetAcp] = useState(latestRelease.acp)
  // Keyed by ACP version, so that a name survives a change of the path.
  const [templateNames, setTemplateNames] = useState<Partial<Record<string, string>>>({})

  const path = planUpgradePath(currentAcp, targetAcp)
  const rows = path.hops.map(hop => hop.release)
  const nameOf = (release: Release) => (templateNames[release.acp] ?? '').trim()

  return (
    <>
      <div style={fieldRowStyle}>
        <AcpVersionField
          id={`${id}-current`}
          label="Current ACP version"
          value={currentAcp}
          onChange={setCurrentAcp}
        />
        <AcpVersionField id={`${id}-target`} label="Target ACP version" value={targetAcp} onChange={setTargetAcp} />
        {os.fields}
      </div>
      {path.error === undefined ? (
        <>
          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {rows.map(release => (
              <TemplateNameField
                key={release.acp}
                id={`${id}-name-${release.acp}`}
                label={`VM template name for ${release.acp} (Kubernetes ${release.kubernetes})`}
                value={templateNames[release.acp] ?? ''}
                placeholder="Name registered on DCS"
                onChange={value => setTemplateNames(names => ({ ...names, [release.acp]: value }))}
              />
            ))}
          </div>
          <InvalidNamesAlert names={invalidNames(rows.map(nameOf))} />
          <CommandBlock
            command={renderCommand(
              rows.map(release =>
                releaseValues(release, nameOf(release) || `<vm-template-name-for-${release.acp}>`, os.osPart),
              ),
            )}
          />
        </>
      ) : (
        <p role="alert" style={alertStyle}>
          {path.error}
        </p>
      )}
    </>
  )
}

export interface DcsVmTemplateConfigMapProps {
  /**
   * `single` generates the ConfigMap of one ACP version. `path` generates the
   * ConfigMaps of every intermediate version on the upgrade path and of the
   * target version.
   */
  mode?: 'single' | 'path'
  /**
   * Shown only in the Markdown output of the page, where the generator is not
   * interactive and the command keeps its placeholders. Use it to point to the
   * values of each ACP version.
   */
  children?: ReactNode
}

export default function DcsVmTemplateConfigMap({ mode = 'single', children }: DcsVmTemplateConfigMapProps) {
  if (import.meta.env.SSG_MD) {
    const example =
      mode === 'path' ? [placeholderValues('intermediate-'), placeholderValues('target-')] : [placeholderValues()]
    return (
      <>
        <pre data-lang="bash">
          <code>{renderCommand(example)}</code>
        </pre>
        {children}
        {note}
      </>
    )
  }

  return (
    <div style={{ margin: '1rem 0' }}>
      {mode === 'path' ? <UpgradePathForm /> : <SingleVersionForm />}
      {note}
    </div>
  )
}
