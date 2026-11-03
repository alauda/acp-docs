// Generates the command that creates the ConfigMaps registering the VM templates
// (Huawei DCS, VMware vSphere) or the images (Huawei Cloud Stack) of an
// infrastructure provider on the global cluster, for one ACP version or for
// every version on an upgrade path. The Kubernetes version and etcd tag of each ACP version come
// from ../alauda-os/version-mapping.json: to add a release, append an entry
// there (see ../alauda-os/README.md), not here.
import { useId, useState, type CSSProperties, type ReactNode } from 'react'

import { OS_VARIANTS, planUpgradePath, upgradeReleases, type Release } from './alauda-os.js'
import CommandBlock from './CommandBlock.js'
import { AcpVersionField, alertStyle, controlStyle, fieldRowStyle, fieldStyle } from './fields.js'

const latestRelease = upgradeReleases[upgradeReleases.length - 1]
const previousRelease = upgradeReleases[Math.max(upgradeReleases.length - 2, 0)]

const OTHER_OS = 'other'

// The upgrade controllers accept only these values of the `architecture` data key.
type Architecture = 'x86_64' | 'aarch64'

const ARCHITECTURE_LABELS: Record<Architecture, string> = {
  x86_64: 'x86_64 (amd64)',
  aarch64: 'aarch64 (arm64)',
}

export type Provider = 'dcs' | 'hcs' | 'vsphere'

interface ProviderInfo {
  noun: string
  slug: string
  place: string
  // A provider with a single architecture gets no selector and no
  // `architecture` key, so its ConfigMaps keep their original form.
  architectures: readonly Architecture[]
}

// What each provider registers, and where it is registered. The ConfigMap name
// and the label follow the Huawei DCS pattern: `<provider>-vm-template`.
const PROVIDERS: Record<Provider, ProviderInfo> = {
  dcs: { noun: 'VM template', slug: 'vm-template', place: 'DCS', architectures: ['x86_64', 'aarch64'] },
  hcs: { noun: 'image', slug: 'image', place: 'HCS', architectures: ['x86_64', 'aarch64'] },
  vsphere: { noun: 'VM template', slug: 'vm-template', place: 'vCenter', architectures: ['x86_64'] },
}

const selectsArchitecture = (provider: Provider) => PROVIDERS[provider].architectures.length > 1

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

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
  architecture?: string
}

const renderConfigMap = (
  { configMapName, templateName, acpVersion, kubernetesVersion, etcdTag, architecture }: ConfigMapValues,
  provider: Provider,
) =>
  [
    'apiVersion: v1',
    'kind: ConfigMap',
    'metadata:',
    `  name: ${configMapName}`,
    '  namespace: cpaas-system',
    '  labels:',
    `    cpaas.io/${provider}-vm-template: ${quote(templateName)}`,
    `    cpaas.io/distribution-version: ${quote(acpVersion)}`,
    'data:',
    `  kubernetesVersion: ${quote(kubernetesVersion)}`,
    `  etcdTag: ${quote(etcdTag)}`,
    ...(architecture ? [`  architecture: ${quote(architecture)}`] : []),
  ].join('\n')

const renderCommand = (configMaps: ConfigMapValues[], provider: Provider) =>
  ["ac apply -f - <<'EOF'", configMaps.map(values => renderConfigMap(values, provider)).join('\n---\n'), 'EOF'].join('\n')

// `prefix` tells the ConfigMaps of a multi-version example apart, such as
// `intermediate-` and `target-`.
const placeholderValues = (provider: Provider, prefix = ''): ConfigMapValues => {
  const architecture = selectsArchitecture(provider) ? '<architecture>' : undefined
  return {
    configMapName: [`${provider}-vm-template-<os>`, architecture, `<${prefix}acp-version>`]
      .filter(Boolean)
      .join('-'),
    templateName: `<${prefix}${PROVIDERS[provider].slug}-name>`,
    acpVersion: `<${prefix}acp-version>`,
    kubernetesVersion: `<${prefix}kubernetes-version>`,
    etcdTag: `<${prefix}etcd-tag>`,
    architecture,
  }
}

const releaseValues = (
  release: Release,
  templateName: string,
  osPart: string,
  provider: Provider,
  architecture: Architecture | undefined,
): ConfigMapValues => ({
  // The architecture keeps apart the ConfigMaps of one ACP version and OS.
  configMapName: [
    `${provider}-vm-template-${osPart || '<os>'}`,
    architecture && toNamePart(architecture),
    toNamePart(release.acp),
  ]
    .filter(Boolean)
    .join('-'),
  templateName,
  acpVersion: release.acp,
  kubernetesVersion: release.kubernetes,
  etcdTag: release.etcd,
  architecture,
})

function Note({ provider }: { provider: Provider }) {
  const nouns = `${PROVIDERS[provider].noun}s`
  return (
    <>
      <p>
        Run the command on the <code>global</code> cluster. In a DR environment, run it on both{' '}
        <code>global</code> clusters: the ConfigMaps are not synchronized between them.
      </p>
      {selectsArchitecture(provider) ? (
        <p>
          For each ACP version, register {nouns} of only one OS per architecture on a <code>global</code>{' '}
          cluster. When {nouns} of different OSes have the same Kubernetes version and architecture, an
          upgrade can move a cluster to the other OS.
        </p>
      ) : (
        <p>
          For each ACP version, register {nouns} of only one OS on a <code>global</code> cluster. When{' '}
          {nouns} of different OSes have the same Kubernetes version, an upgrade can move a cluster to the
          other OS.
        </p>
      )}
    </>
  )
}

function InvalidNamesAlert({ names, provider }: { names: string[]; provider: Provider }) {
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
      letters, digits, <code>-</code>, <code>_</code>, and <code>.</code>. Use{' '}
      {PROVIDERS[provider].noun === 'image' ? 'images' : 'VM templates'} whose names follow these rules.
    </p>
  )
}

const invalidNames = (names: string[]) => [
  ...new Set(names.filter(name => name !== '' && !LABEL_VALUE.test(name))),
]

function SharedNamesAlert({ names, provider }: { names: string[]; provider: Provider }) {
  if (names.length === 0) {
    return null
  }
  return (
    <p role="alert" style={alertStyle}>
      Each architecture needs its own {PROVIDERS[provider].noun}.{' '}
      {names.map((name, index) => (
        <span key={name}>
          {index > 0 ? ', ' : null}
          <code>{name}</code>
        </span>
      ))}{' '}
      {names.length === 1 ? 'is' : 'are'} entered for more than one architecture.
    </p>
  )
}

// A VM template or image has exactly one architecture.
const sharedNames = (entries: { name: string; architecture: Architecture | undefined }[]) => {
  const architecturesByName = new Map<string, Set<Architecture | undefined>>()
  for (const { name, architecture } of entries) {
    if (name !== '') {
      architecturesByName.set(name, (architecturesByName.get(name) ?? new Set()).add(architecture))
    }
  }
  return [...architecturesByName].filter(([, architectures]) => architectures.size > 1).map(([name]) => name)
}

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

// The architectures to generate ConfigMaps for, in the order of the provider
// table. `undefined` stands for a provider without a selector, whose
// ConfigMaps carry no `architecture` key.
function useArchitectureField(id: string, provider: Provider) {
  const supported = PROVIDERS[provider].architectures
  const [selected, setSelected] = useState<readonly Architecture[]>([supported[0]])

  if (!selectsArchitecture(provider)) {
    return { architectures: [undefined], field: null }
  }

  const architectures = supported.filter(item => selected.includes(item))
  const toggle = (item: Architecture, checked: boolean) =>
    setSelected(current => (checked ? [...current, item] : current.filter(other => other !== item)))

  const field = (
    <fieldset style={{ ...fieldStyle, border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <legend style={{ padding: 0, marginBottom: '0.25rem' }}>Architectures</legend>
      {supported.map(item => {
        const checked = architectures.includes(item)
        return (
          <label key={item} htmlFor={`${id}-architecture-${item}`} style={{ display: 'flex', gap: '0.375rem' }}>
            <input
              id={`${id}-architecture-${item}`}
              type="checkbox"
              checked={checked}
              // At least one architecture stays selected.
              disabled={checked && architectures.length === 1}
              onChange={event => toggle(item, event.target.checked)}
            />
            {ARCHITECTURE_LABELS[item]}
          </label>
        )
      })}
    </fieldset>
  )

  return { architectures, field }
}

const nameGroupsStyle: CSSProperties = { display: 'grid', gap: '0.75rem', marginBottom: '0.75rem' }

const nameGroupStyle: CSSProperties = {
  margin: 0,
  padding: '0.5rem 0.75rem 0.75rem',
  minWidth: 0,
  border: '1px solid var(--rp-c-divider)',
  borderRadius: 'var(--rp-radius-small)',
}

// The template or image names of one ACP version.
function TemplateNameGroup({ release, children }: { release: Release; children: ReactNode }) {
  return (
    <fieldset style={nameGroupStyle}>
      <legend style={{ padding: '0 0.25rem', fontSize: '0.875rem', fontWeight: 600 }}>
        {release.acp} · Kubernetes {release.kubernetes}
      </legend>
      <div style={{ ...fieldRowStyle, marginBottom: 0 }}>{children}</div>
    </fieldset>
  )
}

interface TemplateNameFieldProps {
  id: string
  provider: Provider
  release: Release
  architecture: Architecture | undefined
  value: string
  shared?: boolean
  onChange: (value: string) => void
}

function TemplateNameField({
  id,
  provider,
  release,
  architecture,
  value,
  shared = false,
  onChange,
}: TemplateNameFieldProps) {
  const { noun, place } = PROVIDERS[provider]
  const trimmed = value.trim()
  const label = architecture ? `${architecture} ${noun} name` : `${capitalize(noun)} name`
  return (
    <label htmlFor={id} style={fieldStyle}>
      <span>
        {architecture ? (
          <>
            <strong>{architecture}</strong> {noun} name
          </>
        ) : (
          label
        )}
      </span>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={`Name registered on ${place}`}
        spellCheck={false}
        autoComplete="off"
        // The legend of the group is not part of the input's accessible name,
        // so the name repeats the version.
        aria-label={`${label} for ${release.acp} (Kubernetes ${release.kubernetes})`}
        aria-invalid={shared || (trimmed !== '' && !LABEL_VALUE.test(trimmed))}
        onChange={event => onChange(event.target.value)}
        style={controlStyle}
      />
    </label>
  )
}

function SingleVersionForm({ provider }: { provider: Provider }) {
  const { slug } = PROVIDERS[provider]
  const id = useId()
  const os = useOsField(id)
  const arch = useArchitectureField(id, provider)
  // Keyed by architecture, so that a name survives a change of the selection.
  const [templateNames, setTemplateNames] = useState<Partial<Record<string, string>>>({})
  const [acpVersion, setAcpVersion] = useState(latestRelease.acp)

  const release = upgradeReleases.find(item => item.acp === acpVersion) ?? latestRelease
  const keyOf = (architecture: Architecture | undefined) => architecture ?? ''
  const nameOf = (architecture: Architecture | undefined) => (templateNames[keyOf(architecture)] ?? '').trim()
  const shared = sharedNames(arch.architectures.map(architecture => ({ name: nameOf(architecture), architecture })))
  const command = renderCommand(
    arch.architectures.map(architecture =>
      releaseValues(
        release,
        nameOf(architecture) || (architecture ? `<${slug}-name-for-${architecture}>` : `<${slug}-name>`),
        os.osPart,
        provider,
        architecture,
      ),
    ),
    provider,
  )

  return (
    <>
      <div style={fieldRowStyle}>
        <AcpVersionField id={`${id}-acp`} label="ACP version" value={release.acp} onChange={setAcpVersion} />
        {os.fields}
        {arch.field}
      </div>
      <div style={nameGroupsStyle}>
        <TemplateNameGroup release={release}>
          {arch.architectures.map(architecture => (
            <TemplateNameField
              key={keyOf(architecture)}
              id={`${id}-name${architecture ? `-${architecture}` : ''}`}
              provider={provider}
              release={release}
              architecture={architecture}
              value={templateNames[keyOf(architecture)] ?? ''}
              shared={shared.includes(nameOf(architecture))}
              onChange={value => setTemplateNames(names => ({ ...names, [keyOf(architecture)]: value }))}
            />
          ))}
        </TemplateNameGroup>
      </div>
      <InvalidNamesAlert names={invalidNames(arch.architectures.map(nameOf))} provider={provider} />
      <SharedNamesAlert names={shared} provider={provider} />
      <CommandBlock command={command} />
    </>
  )
}

function UpgradePathForm({ provider }: { provider: Provider }) {
  const { slug } = PROVIDERS[provider]
  const id = useId()
  const os = useOsField(id)
  const arch = useArchitectureField(id, provider)
  const [currentAcp, setCurrentAcp] = useState(previousRelease.acp)
  const [targetAcp, setTargetAcp] = useState(latestRelease.acp)
  // Keyed by ACP version and architecture, so that a name survives a change of
  // the path or of the selection.
  const [templateNames, setTemplateNames] = useState<Partial<Record<string, string>>>({})

  const path = planUpgradePath(currentAcp, targetAcp)
  // One ConfigMap per version on the path and per selected architecture.
  const groups = path.hops.map(hop => ({
    release: hop.release,
    rows: arch.architectures.map(architecture => ({
      release: hop.release,
      architecture,
      key: architecture ? `${hop.release.acp}/${architecture}` : hop.release.acp,
    })),
  }))
  const rows = groups.flatMap(group => group.rows)
  const nameOf = (row: (typeof rows)[number]) => (templateNames[row.key] ?? '').trim()
  const shared = sharedNames(rows.map(row => ({ name: nameOf(row), architecture: row.architecture })))

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
        {arch.field}
      </div>
      {path.error === undefined ? (
        <>
          <div style={nameGroupsStyle}>
            {groups.map(group => (
              <TemplateNameGroup key={group.release.acp} release={group.release}>
                {group.rows.map(row => (
                  <TemplateNameField
                    key={row.key}
                    id={`${id}-name-${row.release.acp}${row.architecture ? `-${row.architecture}` : ''}`}
                    provider={provider}
                    release={row.release}
                    architecture={row.architecture}
                    value={templateNames[row.key] ?? ''}
                    shared={shared.includes(nameOf(row))}
                    onChange={value => setTemplateNames(names => ({ ...names, [row.key]: value }))}
                  />
                ))}
              </TemplateNameGroup>
            ))}
          </div>
          <InvalidNamesAlert names={invalidNames(rows.map(nameOf))} provider={provider} />
          <SharedNamesAlert names={shared} provider={provider} />
          <CommandBlock
            command={renderCommand(
              rows.map(row =>
                releaseValues(
                  row.release,
                  nameOf(row) || `<${slug}-name-for-${row.release.acp}${row.architecture ? `-${row.architecture}` : ''}>`,
                  os.osPart,
                  provider,
                  row.architecture,
                ),
              ),
              provider,
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

export interface VmTemplateConfigMapProps {
  /** The infrastructure provider whose VM templates or images the ConfigMaps register. */
  provider: Provider
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

export default function VmTemplateConfigMap({ provider, mode = 'single', children }: VmTemplateConfigMapProps) {
  if (import.meta.env.SSG_MD) {
    const example =
      mode === 'path'
        ? [placeholderValues(provider, 'intermediate-'), placeholderValues(provider, 'target-')]
        : [placeholderValues(provider)]
    return (
      <>
        <pre data-lang="bash">
          <code>{renderCommand(example, provider)}</code>
        </pre>
        {children}
        <Note provider={provider} />
      </>
    )
  }

  return (
    <div style={{ margin: '1rem 0' }}>
      {mode === 'path' ? <UpgradePathForm provider={provider} /> : <SingleVersionForm provider={provider} />}
      <Note provider={provider} />
    </div>
  )
}
