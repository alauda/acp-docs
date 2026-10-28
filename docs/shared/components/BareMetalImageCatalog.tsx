// Generates the command that adds the Alauda OS image and the etcd image of one
// ACP version, or of every version on an upgrade path, to the image catalog of
// the bare-metal provider on the global cluster. The Kubernetes version and etcd
// tag of each ACP version come from ../alauda-os/version-mapping.json: to add a
// release, append an entry there (see ../alauda-os/README.md), not here.
import { useId, useState, type ReactNode } from 'react'

import { OS_VARIANTS, planUpgradePath, upgradeReleases, type Release } from './alauda-os.js'
import CommandBlock from './CommandBlock.js'
import { AcpVersionField, alertStyle, controlStyle, fieldRowStyle, fieldStyle } from './fields.js'

const latestRelease = upgradeReleases[upgradeReleases.length - 1]
const previousRelease = upgradeReleases[Math.max(upgradeReleases.length - 2, 0)]

// The defaults the provider assumes for a host without the
// os.baremetal.alauda.io/arch and os.baremetal.alauda.io/id labels.
const DEFAULT_ARCH = 'amd64'
const DEFAULT_OS_ID = 'alaudaos.m.55'

const ARCHITECTURES = ['amd64', 'arm64'] as const

// Alauda OS KO and KU report the same OS identifier and share a repository;
// only their image tags differ.
const BARE_METAL_IMAGES: Partial<Record<string, { osId: string; repository: string }>> = {
  m55: { osId: DEFAULT_OS_ID, repository: 'tkestack/baremetal-base-image' },
  ko: { osId: 'alaudaos.k.25', repository: 'tkestack/kubeos-rootfs' },
  ku: { osId: 'alaudaos.k.25', repository: 'tkestack/kubeos-rootfs' },
}

interface BareMetalOs {
  value: string
  label: string
  osId: string
  repository: string
}

const BARE_METAL_OS: readonly BareMetalOs[] = OS_VARIANTS.flatMap(variant => {
  const image = BARE_METAL_IMAGES[variant.value]
  return image === undefined ? [] : [{ ...variant, ...image }]
})

// OCI distribution tag syntax.
const IMAGE_TAG = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/

const REGISTRY_PLACEHOLDER = '<registry-address>'

// The provider looks up `<kubernetes>_<arch>_<os-id>`, then `<kubernetes>_<arch>`
// for the default OS, then `<kubernetes>` for amd64 with the default OS. The
// bare key serves every amd64 host with the default OS and matches the keys
// written before the labels existed.
const osImageKey = (kubernetes: string, arch: string, osId: string) =>
  arch === DEFAULT_ARCH && osId === DEFAULT_OS_ID ? kubernetes : `${kubernetes}_${arch}_${osId}`

// An image reference has no scheme, so a pasted registry URL loses it and its
// trailing slash.
const normalizeRegistry = (value: string) =>
  value
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/\/+$/, '') || REGISTRY_PLACEHOLDER

type CatalogEntry = [key: string, value: string]

const renderCommand = (entries: CatalogEntry[]) => {
  const patch = JSON.stringify({ data: Object.fromEntries(entries) }, null, 2)
  // Inside single quotes, the shell treats only a single quote specially.
  const quoted = patch.replace(/'/g, `'\\''`)
  return [
    `kubectl -n cpaas-system patch configmap elemental-image-catalog --type merge -p '${quoted}'`,
    '',
    'kubectl -n cpaas-system get configmap elemental-image-catalog -o yaml',
  ].join('\n')
}

// `prefix` tells the versions of a multi-version example apart, such as
// `intermediate-` and `target-`.
const placeholderEntries = (prefix = ''): CatalogEntry[] => [
  [`<${prefix}os-image-key>`, `${REGISTRY_PLACEHOLDER}/<os-image-repository>:<${prefix}os-image-tag>`],
  [`<${prefix}kubernetes-version>_etcd`, `${REGISTRY_PLACEHOLDER}/acp/k8s/etcd:<${prefix}etcd-tag>`],
]

interface HostValues {
  os: BareMetalOs
  arch: string
  registry: string
}

const releaseEntries = (release: Release, tag: string, { os, arch, registry }: HostValues): CatalogEntry[] => [
  [
    osImageKey(release.kubernetes, arch, os.osId),
    `${registry}/${os.repository}:${tag || `<os-image-tag-for-${release.acp}>`}`,
  ],
  [`${release.kubernetes}_etcd`, `${registry}/acp/k8s/etcd:${release.etcd}`],
]

// `v4.5.0` → `alaudaos-45.m55.<timestamp>-0`, the shape of an Alauda OS M55
// image tag.
const tagPlaceholder = (release: Release, os: BareMetalOs) => {
  const match = /^v?(\d+)\.(\d+)/.exec(release.acp)
  return os.value === 'm55' && match
    ? `alaudaos-${match[1]}${match[2]}.m55.<timestamp>-0`
    : 'Tag of the imported image'
}

const notes = (
  <>
    <p>
      After you import the image archive, <code>ctr -n bare-metal-os images ls -q</code> lists the OS image
      tag.
    </p>
    <p>
      Run the command on the <code>global</code> cluster. In a DR environment, run it on both{' '}
      <code>global</code> clusters: the image catalog is not synchronized between them.
    </p>
    <p>
      The command adds keys and keeps the existing ones. Do not remove existing keys, including those of the
      Kubernetes version that a cluster runs today: they are used to add nodes and to replace failed nodes.
    </p>
    <p>
      Do not change the image catalog while an upgrade is in progress. A host replaced after the change
      installs the new image, so the nodes of one pool can end up on different images.
    </p>
    <p>
      Use one Alauda OS variant per cluster. Alauda OS KO and Alauda OS KU share the same key, so for each
      Kubernetes version and architecture the image catalog holds the image of only one of them.
    </p>
  </>
)

const placeholderNote = (
  <>
    <p>
      Replace <code>{REGISTRY_PLACEHOLDER}</code> with the address of the platform registry, and take the
      Kubernetes version and the etcd tag of each ACP version from Version Mapping.
    </p>
    <p>
      <code>{'<os-image-key>'}</code> is the Kubernetes version itself for <code>amd64</code> hosts with
      Alauda OS M55, and <code>{'<kubernetes-version>_<arch>_<os-id>'}</code> for other hosts. The{' '}
      <code>{'<os-id>'}</code> is <code>alaudaos.m.55</code> for Alauda OS M55 and <code>alaudaos.k.25</code>{' '}
      for Alauda OS KO and Alauda OS KU.
    </p>
    <p>
      <code>{'<os-image-repository>'}</code> is <code>tkestack/baremetal-base-image</code> for Alauda OS M55
      and <code>tkestack/kubeos-rootfs</code> for Alauda OS KO and Alauda OS KU.
    </p>
  </>
)

function InvalidTagsAlert({ tags }: { tags: string[] }) {
  const invalid = [...new Set(tags.filter(tag => tag !== '' && !IMAGE_TAG.test(tag)))]
  if (invalid.length === 0) {
    return null
  }
  return (
    <p role="alert" style={alertStyle}>
      {invalid.map((tag, index) => (
        <span key={tag}>
          {index > 0 ? ', ' : null}
          <code>{tag}</code>
        </span>
      ))}{' '}
      {invalid.length === 1 ? 'is not a valid image tag.' : 'are not valid image tags.'} An image tag has at
      most 128 characters, starts with a letter, digit, or <code>_</code>, and contains only letters, digits,{' '}
      <code>_</code>, <code>.</code>, and <code>-</code>.
    </p>
  )
}

interface TextFieldProps {
  id: string
  label: string
  value: string
  placeholder?: string
  invalid?: boolean
  onChange: (value: string) => void
}

function TextField({ id, label, value, placeholder, invalid = false, onChange }: TextFieldProps) {
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
        aria-invalid={invalid}
        onChange={event => onChange(event.target.value)}
        style={controlStyle}
      />
    </label>
  )
}

function TagField({ id, label, value, placeholder, onChange }: Omit<TextFieldProps, 'invalid'>) {
  const trimmed = value.trim()
  return (
    <TextField
      id={id}
      label={label}
      value={value}
      placeholder={placeholder}
      invalid={trimmed !== '' && !IMAGE_TAG.test(trimmed)}
      onChange={onChange}
    />
  )
}

// The OS, architecture, and registry fields shared by both forms.
function useHostFields(id: string) {
  const [osValue, setOsValue] = useState(BARE_METAL_OS[0].value)
  const [arch, setArch] = useState<string>(DEFAULT_ARCH)
  const [registry, setRegistry] = useState('')

  const os = BARE_METAL_OS.find(item => item.value === osValue) ?? BARE_METAL_OS[0]

  const fields = (
    <>
      <label htmlFor={`${id}-os`} style={fieldStyle}>
        OS
        <select
          id={`${id}-os`}
          value={os.value}
          onChange={event => setOsValue(event.target.value)}
          style={controlStyle}
        >
          {BARE_METAL_OS.map(item => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${id}-arch`} style={fieldStyle}>
        Architecture
        <select id={`${id}-arch`} value={arch} onChange={event => setArch(event.target.value)} style={controlStyle}>
          {ARCHITECTURES.map(item => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <TextField
        id={`${id}-registry`}
        label="Registry address (optional)"
        value={registry}
        placeholder={REGISTRY_PLACEHOLDER}
        onChange={setRegistry}
      />
    </>
  )

  const values: HostValues = { os, arch, registry: normalizeRegistry(registry) }
  return { values, fields }
}

function SingleVersionForm() {
  const id = useId()
  const host = useHostFields(id)
  const [acpVersion, setAcpVersion] = useState(latestRelease.acp)
  const [tag, setTag] = useState('')

  const release = upgradeReleases.find(item => item.acp === acpVersion) ?? latestRelease
  const trimmedTag = tag.trim()

  return (
    <>
      <div style={fieldRowStyle}>
        <AcpVersionField id={`${id}-acp`} label="ACP version" value={release.acp} onChange={setAcpVersion} />
        {host.fields}
      </div>
      <div style={fieldRowStyle}>
        <TagField
          id={`${id}-tag`}
          label={`OS image tag for ${release.acp} (Kubernetes ${release.kubernetes})`}
          value={tag}
          placeholder={tagPlaceholder(release, host.values.os)}
          onChange={setTag}
        />
      </div>
      <InvalidTagsAlert tags={[trimmedTag]} />
      <CommandBlock command={renderCommand(releaseEntries(release, trimmedTag, host.values))} />
    </>
  )
}

function UpgradePathForm() {
  const id = useId()
  const host = useHostFields(id)
  const [currentAcp, setCurrentAcp] = useState(previousRelease.acp)
  const [targetAcp, setTargetAcp] = useState(latestRelease.acp)
  // Keyed by ACP version, so that a tag survives a change of the path.
  const [tags, setTags] = useState<Partial<Record<string, string>>>({})

  const path = planUpgradePath(currentAcp, targetAcp)
  const rows = path.hops.map(hop => hop.release)
  const tagOf = (release: Release) => (tags[release.acp] ?? '').trim()

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
        {host.fields}
      </div>
      {path.error === undefined ? (
        <>
          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {rows.map(release => (
              <TagField
                key={release.acp}
                id={`${id}-tag-${release.acp}`}
                label={`OS image tag for ${release.acp} (Kubernetes ${release.kubernetes})`}
                value={tags[release.acp] ?? ''}
                placeholder={tagPlaceholder(release, host.values.os)}
                onChange={value => setTags(current => ({ ...current, [release.acp]: value }))}
              />
            ))}
          </div>
          <InvalidTagsAlert tags={rows.map(tagOf)} />
          <CommandBlock
            command={renderCommand(rows.flatMap(release => releaseEntries(release, tagOf(release), host.values)))}
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

export interface BareMetalImageCatalogProps {
  /**
   * `single` generates the keys of one ACP version. `path` generates the keys
   * of every intermediate version on the upgrade path and of the target version.
   */
  mode?: 'single' | 'path'
  /**
   * Shown below the notes, in the page and in its Markdown output. Use it for
   * the `ResourcePatch` note, whose link must be written in the page so that it
   * resolves.
   */
  children?: ReactNode
}

export default function BareMetalImageCatalog({ mode = 'single', children }: BareMetalImageCatalogProps) {
  if (import.meta.env.SSG_MD) {
    const example =
      mode === 'path'
        ? [...placeholderEntries('intermediate-'), ...placeholderEntries('target-')]
        : placeholderEntries()
    return (
      <>
        <pre data-lang="bash">
          <code>{renderCommand(example)}</code>
        </pre>
        {placeholderNote}
        {mode === 'path' ? (
          <p>
            Repeat the intermediate keys for each intermediate version between the current and the target
            version, and omit them when there is none.
          </p>
        ) : null}
        {notes}
        {children}
      </>
    )
  }

  return (
    <div style={{ margin: '1rem 0' }}>
      {mode === 'path' ? <UpgradePathForm /> : <SingleVersionForm />}
      {notes}
      {children}
    </div>
  )
}
