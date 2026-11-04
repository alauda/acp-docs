// Generates the command that adds the Alauda OS image and the etcd image of one
// ACP version, or of every version on an upgrade path, to the image catalog of
// the bare-metal provider on the global cluster. The Kubernetes version and etcd
// tag of each ACP version come from ../alauda-os/version-mapping.json: to add a
// release, append an entry there (see ../alauda-os/README.md), not here.
import { useId, useState, type CSSProperties, type ReactNode } from 'react'

import { OS_VARIANTS, planUpgradePath, upgradeReleases, type Release } from './alauda-os.js'
import CommandBlock from './CommandBlock.js'
import { AcpVersionField, alertStyle, controlStyle, fieldRowStyle, fieldStyle } from './fields.js'

const latestRelease = upgradeReleases[upgradeReleases.length - 1]
const previousRelease = upgradeReleases[Math.max(upgradeReleases.length - 2, 0)]

// The defaults the provider assumes for a host without the
// os.baremetal.alauda.io/arch and os.baremetal.alauda.io/id labels.
const DEFAULT_ARCH = 'amd64'
const DEFAULT_OS_ID = 'alaudaos.m.55'

// In the order in which the selection is kept when the OS changes to one that
// allows a single architecture.
const ARCHITECTURES = ['amd64', 'arm64'] as const

type Architecture = (typeof ARCHITECTURES)[number]

// Bare Metal supports Alauda OS M55 and Alauda OS KU only; the OS select
// offers the variants listed here. The provider reads a single-segment
// repository as `library/<name>`, so a repository keeps its project.
const BARE_METAL_IMAGES: Partial<Record<string, { osId: string; repository: string }>> = {
  m55: { osId: DEFAULT_OS_ID, repository: 'tkestack/baremetal-base-image' },
  ku: { osId: 'alaudaos.k.25', repository: 'tkestack/kubeos-rootfs' },
}

interface BareMetalOs {
  value: string
  label: string
  mixedArchitecture: boolean
  osId: string
  repository: string
}

const BARE_METAL_OS: readonly BareMetalOs[] = OS_VARIANTS.flatMap(variant => {
  const image = BARE_METAL_IMAGES[variant.value]
  return image === undefined ? [] : [{ ...variant, ...image }]
})

// OCI distribution tag syntax.
const IMAGE_TAG = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/

// The provider looks up `<kubernetes>_<arch>_<os-id>`, then `<kubernetes>_<arch>`
// for the default OS, then `<kubernetes>` for amd64 with the default OS. The
// bare key serves every amd64 host with the default OS and matches the keys
// written before the labels existed.
const osImageKey = (kubernetes: string, arch: string, osId: string) =>
  arch === DEFAULT_ARCH && osId === DEFAULT_OS_ID ? kubernetes : `${kubernetes}_${arch}_${osId}`

type CatalogEntry = [key: string, value: string]

const renderCommand = (entries: CatalogEntry[]) =>
  [
    "ac -n cpaas-system patch configmap elemental-image-catalog --type merge --patch-file /dev/stdin <<'EOF'",
    JSON.stringify({ data: Object.fromEntries(entries) }, null, 2),
    'EOF',
    '',
    'ac -n cpaas-system get configmap elemental-image-catalog -o yaml',
  ].join('\n')

// `prefix` tells the versions of a multi-version example apart, such as
// `intermediate-` and `target-`.
const placeholderEntries = (prefix = ''): CatalogEntry[] => [
  [`<${prefix}os-image-key>`, `<os-image-repository>:<${prefix}os-image-tag>`],
  [`<${prefix}kubernetes-version>_etcd`, `acp/k8s/etcd:<${prefix}etcd-tag>`],
]

interface HostValues {
  os: BareMetalOs
  architectures: readonly Architecture[]
}

// The values carry no registry: the provider replaces the registry of a value
// with the one of the cluster, or with its mirror, when it installs a host. An
// invalid tag is reported by InvalidTagsAlert and replaced by a placeholder.
const releaseEntries = (
  release: Release,
  tagOf: (arch: Architecture) => string,
  { os, architectures }: HostValues,
): CatalogEntry[] => [
  ...architectures.map((arch): CatalogEntry => {
    const tag = tagOf(arch)
    const placeholder = `<os-image-tag-for-${release.acp}${os.mixedArchitecture ? `-${arch}` : ''}>`
    return [
      osImageKey(release.kubernetes, arch, os.osId),
      `${os.repository}:${IMAGE_TAG.test(tag) ? tag : placeholder}`,
    ]
  }),
  [`${release.kubernetes}_etcd`, `acp/k8s/etcd:${release.etcd}`],
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
      The values have no registry address. When the provider installs the OS image on a host, it uses the
      registry of the cluster, or its registry mirror.
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
      Use one Alauda OS variant per cluster. All hosts of an Alauda OS M55 cluster use one architecture,{' '}
      <code>amd64</code> or <code>arm64</code>. The hosts of an Alauda OS KU cluster can mix x86_64 (
      <code>amd64</code>) and Arm (<code>arm64</code>); add the keys of every architecture that its hosts
      use.
    </p>
  </>
)

const placeholderNote = (
  <>
    <p>Take the Kubernetes version and the etcd tag of each ACP version from Version Mapping.</p>
    <p>
      <code>{'<os-image-key>'}</code> is the Kubernetes version itself for <code>amd64</code> hosts with
      Alauda OS M55, and <code>{'<kubernetes-version>_<arch>_<os-id>'}</code> for other hosts. The{' '}
      <code>{'<os-id>'}</code> is <code>alaudaos.m.55</code> for Alauda OS M55 and <code>alaudaos.k.25</code>{' '}
      for Alauda OS KU. For an Alauda OS KU cluster whose hosts use both <code>amd64</code> and{' '}
      <code>arm64</code>, add an OS image key for each architecture, with the tag of the image of that
      architecture.
    </p>
    <p>
      <code>{'<os-image-repository>'}</code> is <code>tkestack/baremetal-base-image</code> for Alauda OS M55
      and <code>tkestack/kubeos-rootfs</code> for Alauda OS KU.
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

interface SharedTag {
  acp: string
  tag: string
}

// The tags entered for more than one architecture of the same ACP version: an
// image has one architecture, so each needs its own tag.
const sharedTags = (release: Release, tags: string[]): SharedTag[] =>
  [...new Set(tags.filter((tag, index) => tag !== '' && tags.indexOf(tag) !== index))].map(tag => ({
    acp: release.acp,
    tag,
  }))

function SharedTagsAlert({ shared }: { shared: SharedTag[] }) {
  if (shared.length === 0) {
    return null
  }
  return (
    <p role="alert" style={alertStyle}>
      Each architecture needs its own OS image.{' '}
      {shared.map(({ acp, tag }, index) => (
        <span key={`${acp}/${tag}`}>
          {index > 0 ? ', ' : null}
          <code>{tag}</code> for {acp}
        </span>
      ))}{' '}
      {shared.length === 1 ? 'is' : 'are'} entered for more than one architecture.
    </p>
  )
}

const tagGroupsStyle: CSSProperties = { display: 'grid', gap: '0.75rem', marginBottom: '0.75rem' }

const tagGroupStyle: CSSProperties = {
  margin: 0,
  padding: '0.5rem 0.75rem 0.75rem',
  minWidth: 0,
  border: '1px solid var(--rp-c-divider)',
  borderRadius: 'var(--rp-radius-small)',
}

// The OS image tags of one ACP version.
function TagGroup({ release, children }: { release: Release; children: ReactNode }) {
  return (
    <fieldset style={tagGroupStyle}>
      <legend style={{ padding: '0 0.25rem', fontSize: '0.875rem', fontWeight: 600 }}>
        {release.acp} · Kubernetes {release.kubernetes}
      </legend>
      <div style={{ ...fieldRowStyle, marginBottom: 0 }}>{children}</div>
    </fieldset>
  )
}

interface TagFieldProps {
  id: string
  release: Release
  arch: Architecture
  os: BareMetalOs
  value: string
  shared: boolean
  onChange: (value: string) => void
}

function TagField({ id, release, arch, os, value, shared, onChange }: TagFieldProps) {
  const trimmed = value.trim()
  return (
    <label htmlFor={id} style={fieldStyle}>
      <span>
        <strong>{arch}</strong> OS image tag
      </span>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={tagPlaceholder(release, os)}
        spellCheck={false}
        autoComplete="off"
        // The legend of the group is not part of the input's accessible name,
        // so the name repeats the version.
        aria-label={`${arch} OS image tag for ${release.acp} (Kubernetes ${release.kubernetes})`}
        aria-invalid={shared || (trimmed !== '' && !IMAGE_TAG.test(trimmed))}
        onChange={event => onChange(event.target.value)}
        style={controlStyle}
      />
    </label>
  )
}

// The OS and architecture fields shared by both forms. An OS without the
// mixed-architecture capability takes one architecture.
function useHostFields(id: string) {
  const [osValue, setOsValue] = useState(BARE_METAL_OS[0].value)
  const [selected, setSelected] = useState<readonly Architecture[]>([DEFAULT_ARCH])

  const os = BARE_METAL_OS.find(item => item.value === osValue) ?? BARE_METAL_OS[0]
  const architectures = ARCHITECTURES.filter(item => selected.includes(item))

  const changeOs = (value: string) => {
    setOsValue(value)
    if (!BARE_METAL_OS.find(item => item.value === value)?.mixedArchitecture) {
      setSelected(current => [ARCHITECTURES.find(item => current.includes(item)) ?? DEFAULT_ARCH])
    }
  }

  const toggle = (item: Architecture, checked: boolean) =>
    setSelected(current => (checked ? [...current, item] : current.filter(other => other !== item)))

  const fields = (
    <>
      <label htmlFor={`${id}-os`} style={fieldStyle}>
        OS
        <select id={`${id}-os`} value={os.value} onChange={event => changeOs(event.target.value)} style={controlStyle}>
          {BARE_METAL_OS.map(item => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {os.mixedArchitecture ? (
        <fieldset style={{ ...fieldStyle, border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <legend style={{ padding: 0, marginBottom: '0.25rem' }}>Architectures</legend>
          {ARCHITECTURES.map(item => {
            const checked = architectures.includes(item)
            return (
              <label key={item} htmlFor={`${id}-arch-${item}`} style={{ display: 'flex', gap: '0.375rem' }}>
                <input
                  id={`${id}-arch-${item}`}
                  type="checkbox"
                  checked={checked}
                  disabled={checked && architectures.length === 1}
                  onChange={event => toggle(item, event.target.checked)}
                />
                {item}
              </label>
            )
          })}
        </fieldset>
      ) : (
        <label htmlFor={`${id}-arch`} style={fieldStyle}>
          Architecture
          <select
            id={`${id}-arch`}
            value={architectures[0]}
            onChange={event => setSelected([event.target.value as Architecture])}
            style={controlStyle}
          >
            {ARCHITECTURES.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  )

  const values: HostValues = { os, architectures }
  return { values, fields }
}

function SingleVersionForm() {
  const id = useId()
  const host = useHostFields(id)
  const [acpVersion, setAcpVersion] = useState(latestRelease.acp)
  // Keyed by architecture, so that a tag survives a change of the selection.
  const [tags, setTags] = useState<Partial<Record<string, string>>>({})

  const release = upgradeReleases.find(item => item.acp === acpVersion) ?? latestRelease
  const { os, architectures } = host.values
  const tagOf = (arch: Architecture) => (tags[arch] ?? '').trim()
  const shared = sharedTags(release, architectures.map(tagOf))

  return (
    <>
      <div style={fieldRowStyle}>
        <AcpVersionField id={`${id}-acp`} label="ACP version" value={release.acp} onChange={setAcpVersion} />
        {host.fields}
      </div>
      <div style={tagGroupsStyle}>
        <TagGroup release={release}>
          {architectures.map(arch => (
            <TagField
              key={arch}
              id={`${id}-tag-${arch}`}
              release={release}
              arch={arch}
              os={os}
              value={tags[arch] ?? ''}
              shared={shared.some(item => item.tag === tagOf(arch))}
              onChange={value => setTags(current => ({ ...current, [arch]: value }))}
            />
          ))}
        </TagGroup>
      </div>
      <InvalidTagsAlert tags={architectures.map(tagOf)} />
      <SharedTagsAlert shared={shared} />
      <CommandBlock command={renderCommand(releaseEntries(release, tagOf, host.values))} />
    </>
  )
}

function UpgradePathForm() {
  const id = useId()
  const host = useHostFields(id)
  const [currentAcp, setCurrentAcp] = useState(previousRelease.acp)
  const [targetAcp, setTargetAcp] = useState(latestRelease.acp)
  // Keyed by ACP version and architecture, so that a tag survives a change of
  // the path or of the selection.
  const [tags, setTags] = useState<Partial<Record<string, string>>>({})

  const path = planUpgradePath(currentAcp, targetAcp)
  const rows = path.hops.map(hop => hop.release)
  const { os, architectures } = host.values
  const keyOf = (release: Release, arch: Architecture) => `${release.acp}/${arch}`
  const tagOf = (release: Release) => (arch: Architecture) => (tags[keyOf(release, arch)] ?? '').trim()
  const shared = rows.flatMap(release => sharedTags(release, architectures.map(tagOf(release))))

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
          <div style={tagGroupsStyle}>
            {rows.map(release => (
              <TagGroup key={release.acp} release={release}>
                {architectures.map(arch => (
                  <TagField
                    key={arch}
                    id={`${id}-tag-${release.acp}-${arch}`}
                    release={release}
                    arch={arch}
                    os={os}
                    value={tags[keyOf(release, arch)] ?? ''}
                    shared={shared.some(item => item.acp === release.acp && item.tag === tagOf(release)(arch))}
                    onChange={value => setTags(current => ({ ...current, [keyOf(release, arch)]: value }))}
                  />
                ))}
              </TagGroup>
            ))}
          </div>
          <InvalidTagsAlert tags={rows.flatMap(release => architectures.map(tagOf(release)))} />
          <SharedTagsAlert shared={shared} />
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
