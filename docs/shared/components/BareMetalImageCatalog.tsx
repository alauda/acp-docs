// Generates the commands that prepare the Alauda OS images of the bare-metal
// provider: pushing the images of an OS archive to the registry, adding the OS
// image and the etcd image of one ACP version, or of every version on an
// upgrade path, to the image catalog on the global cluster, the values that
// `ac` takes in install-config.yaml, and the registration and ISO of the hosts
// of one OS and architecture. The Kubernetes version and etcd tag of each ACP
// version come from ../alauda-os/version-mapping.json: to add a release,
// append an entry there (see ../alauda-os/README.md), not here.
import { CodeBlockRuntime } from '@alauda/doom/theme'
import { useId, useState, type CSSProperties, type ReactNode } from 'react'

import { OS_VARIANTS, planUpgradePath, upgradeReleases, type Release } from './alauda-os.js'
import CommandBlock from './CommandBlock.js'
import { AcpVersionField, alertStyle, controlStyle, fieldRowStyle, fieldStyle } from './fields.js'

const latestRelease = upgradeReleases[upgradeReleases.length - 1]
const previousRelease = upgradeReleases[Math.max(upgradeReleases.length - 2, 0)]

// The defaults the provider assumes for a host without the
// os.baremetal.alauda.io/arch and os.baremetal.alauda.io/id labels.
// install-config.yaml has the same defaults when it omits `architecture` and
// `osType`.
const DEFAULT_ARCH = 'amd64'
const DEFAULT_OS_ID = 'alaudaos.m.55'

type Architecture = 'amd64' | 'arm64'

// An OS archive is named after the machine type of its architecture.
const MACHINE_TYPES: Record<Architecture, string> = { amd64: 'x86_64', arm64: 'aarch64' }

// Every image lives in this registry project. The provider reads a
// single-segment repository as `library/<name>`, so a catalog value keeps the
// project.
const PROJECT = 'tkestack'

interface BareMetalImages {
  /** The value of the os.baremetal.alauda.io/id label of the hosts. */
  osId: string
  /** The image that the registration ISO is built from. */
  isoRepository: string
  /** The image that the provider installs on a host. */
  rootRepository: string
  architectures: readonly Architecture[]
  /** The `provider.baremetal.osType` of install-config.yaml; absent for the default OS. */
  osType?: string
  /**
   * The installer of the OS installs the image in `install.system-uri` and
   * ignores `snapshotter` and the COS_STATE size of the registration.
   */
  installsSystemUri: boolean
}

// Bare Metal supports Alauda OS M55 on amd64 and Alauda OS KU on amd64 and
// arm64; the OS select offers the variants listed here. One archive holds both
// images of one OS and architecture, tagged with the archive file name
// without `.tar`.
const BARE_METAL_IMAGES: Partial<Record<string, BareMetalImages>> = {
  m55: {
    osId: DEFAULT_OS_ID,
    isoRepository: 'baremetal-base-image-iso',
    rootRepository: 'baremetal-base-image',
    architectures: ['amd64'],
    installsSystemUri: false,
  },
  ku: {
    osId: 'alaudaos.k.25',
    isoRepository: 'kubeos-iso',
    rootRepository: 'kubeos-rootfs',
    architectures: ['amd64', 'arm64'],
    osType: 'alaudaos-k',
    installsSystemUri: true,
  },
}

interface BareMetalOs extends BareMetalImages {
  value: string
  label: string
}

const BARE_METAL_OS: readonly BareMetalOs[] = OS_VARIANTS.flatMap(variant => {
  const image = BARE_METAL_IMAGES[variant.value]
  return image === undefined ? [] : [{ value: variant.value, label: variant.label, ...image }]
})

// OCI distribution tag syntax.
const IMAGE_TAG = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/

// A host name or IPv4 address with an optional port: the platform registry
// address takes no IPv6 literal. A scheme or a path would break the image
// references and the registry API URL.
const HOST_LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?'
const REGISTRY_ADDRESS = new RegExp(`^${HOST_LABEL}(?:\\.${HOST_LABEL})*(?::\\d{1,5})?$`)

const REGISTRY_PLACEHOLDER = '<registry-address>'

// The provider looks up `<kubernetes>_<arch>_<os-id>`, then `<kubernetes>_<arch>`
// for the default OS, then `<kubernetes>` for amd64 with the default OS. The
// bare key serves every amd64 host with the default OS and matches the keys
// written before the labels existed.
const osImageKey = (kubernetes: string, arch: string, osId: string) =>
  arch === DEFAULT_ARCH && osId === DEFAULT_OS_ID ? kubernetes : `${kubernetes}_${arch}_${osId}`

type CatalogEntry = [key: string, value: string]

const renderCatalogCommand = (entries: CatalogEntry[]) =>
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

// An invalid tag is reported by InvalidTagsAlert and replaced by a
// placeholder, which names the architecture when the OS has more than one.
const tagOrPlaceholder = (release: Release, os: BareMetalOs, arch: Architecture, tag: string) =>
  IMAGE_TAG.test(tag)
    ? tag
    : `<os-image-tag-for-${release.acp}${os.architectures.length > 1 ? `-${arch}` : ''}>`

interface HostValues {
  os: BareMetalOs
  architectures: readonly Architecture[]
}

// The values carry no registry: the provider replaces the registry of a value
// with the one of the cluster, or with its mirror, when it installs a host.
const releaseEntries = (
  release: Release,
  tagOf: (arch: Architecture) => string,
  { os, architectures }: HostValues,
): CatalogEntry[] => [
  ...architectures.map(
    (arch): CatalogEntry => [
      osImageKey(release.kubernetes, arch, os.osId),
      `${PROJECT}/${os.rootRepository}:${tagOrPlaceholder(release, os, arch, tagOf(arch))}`,
    ],
  ),
  [`${release.kubernetes}_etcd`, `acp/k8s/etcd:${release.etcd}`],
]

// The images of one OS archive and where they go. Every value is final: a
// missing or invalid input is already replaced by its placeholder. `arch` is a
// string so that the Markdown output can use `<arch>`.
interface ArchiveImages {
  isoRepository: string
  rootRepository: string
  arch: string
  tag: string
  registry: string
  archive: string
}

const archiveImages = (
  os: BareMetalOs,
  arch: string,
  tag: string,
  registry: string,
  archive = '<bare-metal-os-archive>',
): ArchiveImages => ({
  isoRepository: os.isoRepository,
  rootRepository: os.rootRepository,
  arch,
  tag,
  registry,
  archive,
})

// The registry address to write: the input when valid, otherwise a
// placeholder that InvalidRegistryAlert explains.
const registryOrPlaceholder = (input: string) => (REGISTRY_ADDRESS.test(input) ? input : REGISTRY_PLACEHOLDER)

// The archive of each selected architecture. With `archivePerArch`, the
// archive placeholder names the architecture when the OS has more than one.
const selectedImages = (
  release: Release,
  { os, architectures }: HostValues,
  tagOf: (arch: Architecture) => string,
  registry: string,
  archivePerArch: boolean,
): ArchiveImages[] =>
  architectures.map(arch =>
    archiveImages(
      os,
      arch,
      tagOrPlaceholder(release, os, arch, tagOf(arch)),
      registryOrPlaceholder(registry),
      archivePerArch && os.architectures.length > 1 ? `<bare-metal-os-archive-${arch}>` : undefined,
    ),
  )

// Pushes both images with `ctr`, which keeps the manifest as it is in the
// archive, under the tag they have in the archive, and lists the tags of each
// repository so that the push can be checked.
const renderPushCommand = ({ isoRepository, rootRepository, tag, registry, archive }: ArchiveImages) =>
  [
    "read -rsp 'Registry password: ' REGISTRY_PASSWORD; echo",
    `ctr -n bare-metal-os images import --all-platforms --no-unpack ${archive}`,
    'ctr -n bare-metal-os images ls -q',
    '',
    `for repo in ${isoRepository} ${rootRepository}; do`,
    '  ctr -n bare-metal-os images push --local --skip-verify \\',
    '    -u "<registry-username>:${REGISTRY_PASSWORD}" \\',
    `    "${registry}/${PROJECT}/\${repo}:${tag}" "\${repo}:${tag}"`,
    '  curl -sSk -u "<registry-username>:${REGISTRY_PASSWORD}" \\',
    `    "https://${registry}/v2/${PROJECT}/\${repo}/tags/list"; echo`,
    'done',
    '',
    `ctr -n bare-metal-os images rm ${isoRepository}:${tag} ${rootRepository}:${tag}`,
    'unset REGISTRY_PASSWORD',
  ].join('\n')

// The `provider.baremetal` values of install-config.yaml. `osType` and
// `architecture` are written only when they differ from the defaults.
const renderInstallValues = (os: BareMetalOs, arch: string, tag: string) =>
  [
    'provider:',
    '  baremetal:',
    ...(os.osType === undefined ? [] : [`    osType: ${os.osType}`]),
    ...(arch === DEFAULT_ARCH ? [] : [`    architecture: ${arch}`]),
    `    isoImageTag: ${tag}`,
    `    rootImageTag: ${tag}`,
  ].join('\n')

// One registration per OS and architecture serves hosts of any workload
// cluster. Names that are `global` or start with `global-` are reserved for
// hosts of the global cluster.
const registrationName = (os: BareMetalOs, arch: string) => `alaudaos-${os.value}-${arch}`

const renderRegistration = (os: BareMetalOs, images: ArchiveImages) => {
  const name = registrationName(os, images.arch)
  const image = (repository: string) => `${images.registry}/${PROJECT}/${repository}:${images.tag}`
  return [
    'apiVersion: elemental.cattle.io/v1beta1',
    'kind: MachineRegistration',
    'metadata:',
    `  name: ${name}`,
    '  namespace: cpaas-system',
    '  labels:',
    '    app.kubernetes.io/part-of: cluster-api-provider-baremetal',
    'spec:',
    '  # ${...} placeholders are expanded by elemental-register from SMBIOS data.',
    `  machineName: "${name}-\${System Information/UUID}"`,
    '  machineInventoryLabels:',
    '    app.kubernetes.io/part-of: cluster-api-provider-baremetal',
    '    pool.baremetal.alauda.io/eligible: "true"',
    '    elemental.cattle.io/serial-number: "${System Information/Serial Number}"',
    '    # Architecture of the host, reported by elemental-register. Keep the value as is.',
    '    os.baremetal.alauda.io/arch: "${Runtime/Architecture}"',
    '    # OS identifier of the image this registration installs.',
    `    os.baremetal.alauda.io/id: ${os.osId}`,
    '  machineInventoryAnnotations:',
    '    elemental.cattle.io/machine-uuid: "${System Information/UUID}"',
    '  config:',
    '    elemental:',
    '      install:',
    '        # Each host reports its disks and waits until you select its system disk.',
    '        device-selection: inventory',
    '        eject-cd: true',
    '        reboot: true',
    ...(os.installsSystemUri
      ? [
          `        # Required for ${os.label}: the root filesystem image to install.`,
          `        system-uri: ${image(os.rootRepository)}`,
        ]
      : ['        snapshotter:', '          type: btrfs', '          maxSnaps: 4']),
    '      registration:',
    '        # Each host uses its hardware TPM when usable, otherwise an emulated one.',
    '        tpm-mode: auto',
    '        emulated-tpm-seed: -1',
    '---',
    'apiVersion: elemental.cattle.io/v1beta1',
    'kind: SeedImage',
    'metadata:',
    `  name: ${name}-iso`,
    '  namespace: cpaas-system',
    '  labels:',
    '    app.kubernetes.io/part-of: cluster-api-provider-baremetal',
    'spec:',
    '  type: iso',
    `  baseImage: ${image(os.isoRepository)}`,
    '  registrationRef:',
    '    apiVersion: elemental.cattle.io/v1beta1',
    '    kind: MachineRegistration',
    `    name: ${name}`,
    '    namespace: cpaas-system',
    `  targetPlatform: linux/${images.arch}`,
    '  size: 20Gi',
    '  cleanupAfterMinutes: 120',
    // The state partition must be 20480 MiB: with the default of 8192 MiB, a
    // later upgrade of the host fails, and the size cannot change afterwards.
    ...(os.installsSystemUri
      ? []
      : [
          '  cloud-config:',
          '    stages:',
          '      boot:',
          '        - name: "Size COS_STATE for reprovisioning"',
          '          files:',
          '            - path: /etc/elemental/config.d/partitions.yaml',
          '              permissions: 0644',
          '              content: |',
          '                install:',
          '                  partitions:',
          '                    state:',
          '                      size: 20480',
        ]),
  ].join('\n')
}

const renderCreateCommand = (name: string) =>
  [
    'ac config use-cluster global',
    `ac apply -f ${name}.yaml`,
    'ac -n cpaas-system wait --for=condition=SeedImageReady=True \\',
    `  seedimage/${name}-iso --timeout=30m`,
    `ac -n cpaas-system get seedimage ${name}-iso \\`,
    `  -o jsonpath='{.status.conditions[?(@.type=="SeedImageReady")].reason}{"\\n"}{.status.downloadURL}{"\\n"}{.status.checksumURL}{"\\n"}'`,
  ].join('\n')

// `v4.5.0`, Alauda OS KU, arm64 → `alaudaos-45.ku.<timestamp>-0.aarch64`, the
// shape of an archive file name without `.tar`.
const tagPlaceholder = (release: Release, os: BareMetalOs, arch: Architecture) => {
  const match = /^v?(\d+)\.(\d+)/.exec(release.acp)
  return match
    ? `alaudaos-${match[1]}${match[2]}.${os.value}.<timestamp>-0.${MACHINE_TYPES[arch]}`
    : 'Archive file name without .tar'
}

const hintStyle: CSSProperties = { margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--rp-c-text-2)' }

const outputTitleStyle: CSSProperties = { margin: '1.25rem 0 0.5rem', fontWeight: 600 }

const tagHintText = (
  <>
    An OS image tag is the file name of its OS archive without <code>.tar</code>. After the import,{' '}
    <code>ctr -n bare-metal-os images ls -q</code> prints it as the tag of both images of the archive.
  </>
)

const registryHintText = (
  <>
    For the registry of the <code>global</code> cluster, run <code>ac config use-cluster global</code>, then{' '}
    <code>{"ac -n cpaas-system get secret public-registry-credential -o jsonpath='{.data.registry}' | base64 -d"}</code>
    .
  </>
)

const catalogNotes = (
  <>
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
      Use one Alauda OS variant per cluster. Alauda OS M55 hosts use <code>amd64</code>. The hosts of an
      Alauda OS KU cluster can mix <code>amd64</code> and <code>arm64</code>; add the keys of every
      architecture that its hosts use.
    </p>
  </>
)

const placeholderNote = (
  <>
    <p>Take the Kubernetes version and the etcd tag of each ACP version from Version Mapping.</p>
    <p>
      <code>{'<os-image-key>'}</code> is the Kubernetes version itself for Alauda OS M55, whose hosts use{' '}
      <code>amd64</code>, and <code>{'<kubernetes-version>_<arch>_alaudaos.k.25'}</code> for Alauda OS KU,
      where <code>{'<arch>'}</code> is <code>amd64</code> or <code>arm64</code>. For an Alauda OS KU cluster
      whose hosts use both architectures, add an OS image key for each architecture, with the tag of the
      image of that architecture.
    </p>
    <p>
      <code>{'<os-image-repository>'}</code> is <code>tkestack/baremetal-base-image</code> for Alauda OS M55
      and <code>tkestack/kubeos-rootfs</code> for Alauda OS KU.
    </p>
  </>
)

// Explains the placeholders of the push command in the Markdown output.
const pushPlaceholderNote = (
  <>
    <p>
      <code>{'<iso-repository>'}</code> and <code>{'<root-repository>'}</code> are{' '}
      <code>baremetal-base-image-iso</code> and <code>baremetal-base-image</code> for Alauda OS M55, and{' '}
      <code>kubeos-iso</code> and <code>kubeos-rootfs</code> for Alauda OS KU. Alauda OS M55 is available for{' '}
      <code>amd64</code>; Alauda OS KU for <code>amd64</code> and <code>arm64</code>, with one archive per
      architecture.
    </p>
    <p>{tagHintText}</p>
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

function InvalidRegistryAlert({ registry }: { registry: string }) {
  if (registry === '' || REGISTRY_ADDRESS.test(registry)) {
    return null
  }
  return (
    <p role="alert" style={alertStyle}>
      <code>{registry}</code> is not a registry address. Enter the domain name or IPv4 address of the registry,
      with its port if it has one, without <code>https://</code> or a path.
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
  describedBy: string
  onChange: (value: string) => void
}

function TagField({ id, release, arch, os, value, shared, describedBy, onChange }: TagFieldProps) {
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
        placeholder={tagPlaceholder(release, os, arch)}
        spellCheck={false}
        autoComplete="off"
        // The legend of the group is not part of the input's accessible name,
        // so the name repeats the version.
        aria-label={`${arch} OS image tag for ${release.acp} (Kubernetes ${release.kubernetes})`}
        aria-describedby={describedBy}
        aria-invalid={shared || (trimmed !== '' && !IMAGE_TAG.test(trimmed))}
        onChange={event => onChange(event.target.value)}
        style={controlStyle}
      />
    </label>
  )
}

// The OS and architecture fields shared by every form. With `multiple`, an OS
// with more than one architecture takes several; otherwise a form takes one.
// The selection is kept across OS changes and filtered by the architectures
// of the OS, so that it comes back when the OS is selected again.
function useHostFields(id: string, multiple: boolean) {
  const [osValue, setOsValue] = useState(BARE_METAL_OS[0].value)
  const [selected, setSelected] = useState<readonly Architecture[]>([DEFAULT_ARCH])

  const os = BARE_METAL_OS.find(item => item.value === osValue) ?? BARE_METAL_OS[0]
  const kept = os.architectures.filter(item => selected.includes(item))
  const architectures = kept.length === 0 ? os.architectures.slice(0, 1) : multiple ? kept : kept.slice(0, 1)

  const toggle = (item: Architecture, checked: boolean) =>
    setSelected(checked ? [...architectures, item] : architectures.filter(other => other !== item))

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
      {multiple && os.architectures.length > 1 ? (
        <fieldset style={{ ...fieldStyle, border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <legend style={{ padding: 0, marginBottom: '0.25rem' }}>Architectures</legend>
          {os.architectures.map(item => {
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
            // An OS with one architecture offers it as the only, fixed choice.
            disabled={os.architectures.length === 1}
            onChange={event => setSelected([event.target.value as Architecture])}
            style={controlStyle}
          >
            {os.architectures.map(item => (
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

// The registry address field. `input` is the trimmed input.
function useRegistryField(id: string, describedBy?: string) {
  const [input, setInput] = useState('')
  const trimmed = input.trim()

  const field = (
    <label htmlFor={`${id}-registry`} style={fieldStyle}>
      Registry address
      <input
        id={`${id}-registry`}
        type="text"
        value={input}
        placeholder="host or host:port"
        spellCheck={false}
        autoComplete="off"
        aria-describedby={describedBy}
        aria-invalid={trimmed !== '' && !REGISTRY_ADDRESS.test(trimmed)}
        onChange={event => setInput(event.target.value)}
        style={controlStyle}
      />
    </label>
  )

  return { input: trimmed, field }
}

function OutputTitle({ children }: { children: ReactNode }) {
  return <p style={outputTitleStyle}>{children}</p>
}

// CommandBlock shows bash without a title. The install-config.yaml values and
// the registration files are YAML, a registration file has a file name, and
// the commands of several architectures need to be told apart.
function TitledBlock({ lang, title, code }: { lang: string; title?: string; code: string }) {
  return <CodeBlockRuntime lang={lang} title={title} code={code} />
}

type SingleVersionMode = Exclude<Mode, 'path'>

// The forms of one ACP version. `single` generates the catalog command;
// `install` the push command and the install-config.yaml values of one
// architecture; `register` the push commands, the catalog command, and the
// registration of each architecture, with `children` below the catalog notes.
function SingleVersionForm({ mode, children }: { mode: SingleVersionMode; children?: ReactNode }) {
  const id = useId()
  const host = useHostFields(id, mode !== 'install')
  const registry = useRegistryField(id, mode === 'register' ? `${id}-registry-hint` : undefined)
  const [acpVersion, setAcpVersion] = useState(latestRelease.acp)
  // Keyed by OS and architecture, so that a tag survives a change of the
  // selection and is never used for an archive of another OS.
  const [tags, setTags] = useState<Partial<Record<string, string>>>({})

  const release = upgradeReleases.find(item => item.acp === acpVersion) ?? latestRelease
  const { os, architectures } = host.values
  const keyOf = (arch: Architecture) => `${os.value}/${arch}`
  const tagOf = (arch: Architecture) => (tags[keyOf(arch)] ?? '').trim()
  const shared = sharedTags(release, architectures.map(tagOf))
  const images = selectedImages(release, host.values, tagOf, registry.input, mode === 'register')

  return (
    <>
      <div style={fieldRowStyle}>
        <AcpVersionField id={`${id}-acp`} label="ACP version" value={release.acp} onChange={setAcpVersion} />
        {host.fields}
        {mode === 'single' ? null : registry.field}
      </div>
      {mode === 'register' ? (
        <p id={`${id}-registry-hint`} style={hintStyle}>
          {registryHintText}
        </p>
      ) : null}
      <div style={tagGroupsStyle}>
        <TagGroup release={release}>
          {architectures.map(arch => (
            <TagField
              key={arch}
              id={`${id}-tag-${arch}`}
              release={release}
              arch={arch}
              os={os}
              value={tags[keyOf(arch)] ?? ''}
              shared={shared.some(item => item.tag === tagOf(arch))}
              describedBy={`${id}-tag-hint`}
              onChange={value => setTags(current => ({ ...current, [keyOf(arch)]: value }))}
            />
          ))}
        </TagGroup>
      </div>
      <p id={`${id}-tag-hint`} style={hintStyle}>
        {tagHintText}
      </p>
      <InvalidTagsAlert tags={architectures.map(tagOf)} />
      <SharedTagsAlert shared={shared} />
      {mode === 'single' ? null : <InvalidRegistryAlert registry={registry.input} />}
      {mode === 'single' ? (
        <CommandBlock command={renderCatalogCommand(releaseEntries(release, tagOf, host.values))} />
      ) : null}
      {mode === 'install' ? (
        <>
          <OutputTitle>Push the OS images</OutputTitle>
          <CommandBlock command={renderPushCommand(images[0])} />
          <OutputTitle>
            Values for <code>install-config.yaml</code>
          </OutputTitle>
          <TitledBlock lang="yaml" code={renderInstallValues(os, images[0].arch, images[0].tag)} />
          {children}
        </>
      ) : null}
      {mode === 'register' ? (
        <>
          <OutputTitle>Push the OS images</OutputTitle>
          {images.map(item => (
            <TitledBlock key={item.arch} lang="bash" title={item.arch} code={renderPushCommand(item)} />
          ))}
          <OutputTitle>Add the image catalog keys</OutputTitle>
          <CommandBlock command={renderCatalogCommand(releaseEntries(release, tagOf, host.values))} />
          {catalogNotes}
          {children}
          <OutputTitle>Registration file</OutputTitle>
          {images.map(item => (
            <TitledBlock
              key={item.arch}
              lang="yaml"
              title={`${registrationName(os, item.arch)}.yaml`}
              code={renderRegistration(os, item)}
            />
          ))}
          <OutputTitle>Create the registration and build the ISO</OutputTitle>
          {images.map(item => (
            <TitledBlock
              key={item.arch}
              lang="bash"
              title={registrationName(os, item.arch)}
              code={renderCreateCommand(registrationName(os, item.arch))}
            />
          ))}
        </>
      ) : null}
    </>
  )
}

function UpgradePathForm() {
  const id = useId()
  const host = useHostFields(id, true)
  const [currentAcp, setCurrentAcp] = useState(previousRelease.acp)
  const [targetAcp, setTargetAcp] = useState(latestRelease.acp)
  // Keyed by ACP version, OS, and architecture, so that a tag survives a
  // change of the path or of the selection and is never used for an archive of
  // another OS.
  const [tags, setTags] = useState<Partial<Record<string, string>>>({})

  const path = planUpgradePath(currentAcp, targetAcp)
  const rows = path.hops.map(hop => hop.release)
  const { os, architectures } = host.values
  const keyOf = (release: Release, arch: Architecture) => `${release.acp}/${os.value}/${arch}`
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
                    describedBy={`${id}-tag-hint`}
                    onChange={value => setTags(current => ({ ...current, [keyOf(release, arch)]: value }))}
                  />
                ))}
              </TagGroup>
            ))}
          </div>
          <p id={`${id}-tag-hint`} style={hintStyle}>
            {tagHintText}
          </p>
          <InvalidTagsAlert tags={rows.flatMap(release => architectures.map(tagOf(release)))} />
          <SharedTagsAlert shared={shared} />
          <CommandBlock
            command={renderCatalogCommand(
              rows.flatMap(release => releaseEntries(release, tagOf(release), host.values)),
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

// The install-config.yaml values with both optional keys, for the Markdown
// output.
const installValuesPlaceholder = [
  'provider:',
  '  baremetal:',
  '    osType: alaudaos-k       # Alauda OS KU only',
  '    architecture: arm64      # arm64 only',
  '    isoImageTag: <os-image-tag>',
  '    rootImageTag: <os-image-tag>',
].join('\n')

function MarkdownBlock({ lang, title, code }: { lang: string; title?: string; code: string }) {
  return (
    <pre data-lang={lang} data-title={title}>
      <code>{code}</code>
    </pre>
  )
}

// The Markdown output, where the generator is not interactive and the
// commands keep their placeholders.
function MarkdownOutput({ mode, children }: { mode: Mode; children?: ReactNode }) {
  const push = (
    <>
      <p>
        <strong>Push the OS images</strong>
      </p>
      <MarkdownBlock
        lang="bash"
        code={renderPushCommand({
          isoRepository: '<iso-repository>',
          rootRepository: '<root-repository>',
          arch: '<arch>',
          tag: '<os-image-tag>',
          registry: REGISTRY_PLACEHOLDER,
          archive: '<bare-metal-os-archive>',
        })}
      />
      {pushPlaceholderNote}
    </>
  )

  if (mode === 'install') {
    return (
      <>
        {push}
        <p>
          <strong>
            Values for <code>install-config.yaml</code>
          </strong>
        </p>
        <MarkdownBlock lang="yaml" code={installValuesPlaceholder} />
        {children}
      </>
    )
  }

  const catalog = (
    <>
      <MarkdownBlock
        lang="bash"
        code={renderCatalogCommand(
          mode === 'path'
            ? [...placeholderEntries('intermediate-'), ...placeholderEntries('target-')]
            : placeholderEntries(),
        )}
      />
      {placeholderNote}
      {mode === 'path' ? (
        <p>
          Repeat the intermediate keys for each intermediate version between the current and the target version,
          and omit them when there is none.
        </p>
      ) : null}
      {mode === 'register' ? null : <p>{tagHintText}</p>}
      {catalogNotes}
      {children}
    </>
  )

  if (mode !== 'register') {
    return catalog
  }

  return (
    <>
      {push}
      <p>
        Run the commands for the archive of each architecture. <code>{REGISTRY_PLACEHOLDER}</code> is the address of the
        registry. {registryHintText}
      </p>
      <p>
        <strong>Add the image catalog keys</strong>
      </p>
      {catalog}
      <p>
        <strong>Registration file</strong>
      </p>
      {BARE_METAL_OS.map(os => {
        const arch = os.architectures.length > 1 ? '<arch>' : os.architectures[0]
        return (
          <div key={os.value}>
            <p>
              For {os.label}
              {arch === '<arch>' ? (
                <>
                  , with <code>{'<arch>'}</code> replaced by{' '}
                  {os.architectures.map((item, index) => (
                    <span key={item}>
                      {index > 0 ? ' or ' : null}
                      <code>{item}</code>
                    </span>
                  ))}
                </>
              ) : null}
              :
            </p>
            <MarkdownBlock
              lang="yaml"
              title={`${registrationName(os, arch)}.yaml`}
              code={renderRegistration(os, archiveImages(os, arch, '<os-image-tag>', REGISTRY_PLACEHOLDER))}
            />
          </div>
        )
      })}
      <p>
        <strong>Create the registration and build the ISO</strong>
      </p>
      <MarkdownBlock lang="bash" code={renderCreateCommand('<name>')} />
      <p>
        Run the commands for each registration file, with <code>{'<name>'}</code> replaced by its name, such as{' '}
        <code>alaudaos-m55-amd64</code>.
      </p>
    </>
  )
}

type Mode = 'single' | 'path' | 'install' | 'register'

export interface BareMetalImageCatalogProps {
  /**
   * `single` generates the image catalog keys of one ACP version. `path`
   * generates the keys of every intermediate version on the upgrade path and
   * of the target version. `install` generates the push command and the
   * install-config.yaml values for installing the global cluster. `register`
   * generates, for each architecture of one OS, the push command, the image
   * catalog keys, and the registration file with the commands that build its
   * ISO.
   */
  mode?: Mode
  /**
   * Shown below the image catalog notes, in the page and in its Markdown
   * output, and below the outputs with `install`. Use it for the
   * `ResourcePatch` note, whose link must be written in the page so that it
   * resolves.
   */
  children?: ReactNode
}

export default function BareMetalImageCatalog({ mode = 'single', children }: BareMetalImageCatalogProps) {
  if (import.meta.env.SSG_MD) {
    return <MarkdownOutput mode={mode}>{children}</MarkdownOutput>
  }

  return (
    <div style={{ margin: '1rem 0' }}>
      {mode === 'path' ? (
        <>
          <UpgradePathForm />
          {catalogNotes}
          {children}
        </>
      ) : mode === 'single' ? (
        <>
          <SingleVersionForm mode={mode} />
          {catalogNotes}
          {children}
        </>
      ) : (
        <SingleVersionForm mode={mode}>{children}</SingleVersionForm>
      )}
    </div>
  )
}
