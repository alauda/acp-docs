// Alauda OS data and upgrade path planning shared by the doc components. The
// release values come from ../alauda-os/version-mapping.json: to add a
// release, append an entry there (see ../alauda-os/README.md), not here.
import versionMapping from '../alauda-os/version-mapping.json' with { type: 'json' }

export type Release = (typeof versionMapping.releases)[number]

/** Oldest first, in the order of version-mapping.json. */
export const releases: readonly Release[] = versionMapping.releases

/** The docs cover upgrades from this ACP version on; older clusters go to technical support. */
export const MIN_UPGRADE_SOURCE = 'v4.3.2'

const minUpgradeSourceIndex = releases.findIndex(release => release.acp === MIN_UPGRADE_SOURCE)
if (minUpgradeSourceIndex < 0) {
  throw new Error(`version-mapping.json has no row for ${MIN_UPGRADE_SOURCE}, the oldest upgrade source.`)
}

/** The ACP versions offered by the upgrade selectors, oldest first. */
export const upgradeReleases: readonly Release[] = releases.slice(minUpgradeSourceIndex)

export interface OsVariant {
  /** Identifier used in VM template ConfigMap names. */
  value: string
  label: string
}

export const OS_VARIANTS: readonly OsVariant[] = [
  { value: 'm55', label: 'Alauda OS M55' },
  { value: 'ko', label: 'Alauda OS KO' },
  { value: 'ku', label: 'Alauda OS KU' },
]

const KUBERNETES_VERSION = /^v?(\d+)\.(\d+)\.(\d+)(.*)$/

const parseKubernetes = (version: string) => {
  const match = KUBERNETES_VERSION.exec(version)
  if (!match) {
    throw new Error(`Unrecognized Kubernetes version in version-mapping.json: ${version}`)
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    suffix: match[4],
  }
}

/** `v1.34.5-3` → `1.34` */
export const kubernetesMinor = (version: string) => {
  const { major, minor } = parseKubernetes(version)
  return `${major}.${minor}`
}

// `-acp.9` → `['-acp.', '9']`, so that build numbers compare as numbers.
const suffixChunks = (suffix: string) => suffix.match(/\d+|\D+/g) ?? []

const compareChunks = (a: string, b: string) => {
  if (/^\d/.test(a) && /^\d/.test(b)) {
    return Number(a) - Number(b)
  }
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Orders Kubernetes versions as published for ACP releases, such as
 * `v1.34.5-8` after `v1.34.5-3` and `v1.35.6-acp.9` after `v1.35.6-acp.1`.
 */
export function compareKubernetes(a: string, b: string): number {
  const left = parseKubernetes(a)
  const right = parseKubernetes(b)
  const byNumber = left.major - right.major || left.minor - right.minor || left.patch - right.patch
  if (byNumber !== 0) {
    return byNumber
  }
  const leftChunks = suffixChunks(left.suffix)
  const rightChunks = suffixChunks(right.suffix)
  for (let index = 0; index < Math.min(leftChunks.length, rightChunks.length); index++) {
    const result = compareChunks(leftChunks[index], rightChunks[index])
    if (result !== 0) {
      return result
    }
  }
  // A suffix marks a later build of the same patch: `v1.34.5-1` follows `v1.34.5`.
  return leftChunks.length - rightChunks.length
}

const indexOfRelease = (acp: string) => {
  const index = releases.findIndex(release => release.acp === acp)
  if (index < 0) {
    throw new Error(`Unknown ACP version: ${acp}`)
  }
  return index
}

// Releases with the same Kubernetes version are ordered by their row: a later
// row is a newer ACP patch.
const compareRows = (a: number, b: number) =>
  compareKubernetes(releases[a].kubernetes, releases[b].kubernetes) || a - b

export interface UpgradeHop {
  role: 'intermediate' | 'target'
  release: Release
}

export interface UpgradePath {
  current: Release
  /** Empty when `error` is set. */
  hops: UpgradeHop[]
  error?: string
}

/**
 * Plans the Kubernetes and Alauda OS upgrade path the way the platform does on
 * Huawei DCS and Bare Metal: Kubernetes moves one minor at a time, each
 * intermediate minor uses its highest Kubernetes version, and the last hop is
 * the target release exactly. Every hop uses the OS variant the cluster runs
 * today: on Huawei DCS the platform selects VM templates by Kubernetes version
 * only, and on Bare Metal the image catalog keys include the OS identifier of
 * the hosts.
 */
export function planUpgradePath(currentAcp: string, targetAcp: string): UpgradePath {
  const currentIndex = indexOfRelease(currentAcp)
  const targetIndex = indexOfRelease(targetAcp)
  const current = releases[currentIndex]
  const target = releases[targetIndex]

  // Also rejects a target whose Kubernetes minor is below the current one.
  if (compareRows(targetIndex, currentIndex) <= 0) {
    return { current, hops: [], error: 'Select a target version later than the current version.' }
  }

  const from = parseKubernetes(current.kubernetes)
  const to = parseKubernetes(target.kubernetes)
  if (from.major !== to.major) {
    return { current, hops: [], error: 'An upgrade cannot cross a Kubernetes major version.' }
  }

  const hops: UpgradeHop[] = []
  for (let minor = from.minor + 1; minor < to.minor; minor++) {
    const key = `${from.major}.${minor}`
    let highest: Release | undefined
    for (const release of releases) {
      if (
        kubernetesMinor(release.kubernetes) === key &&
        (highest === undefined || compareKubernetes(release.kubernetes, highest.kubernetes) >= 0)
      ) {
        highest = release
      }
    }
    if (highest === undefined) {
      return {
        current,
        hops: [],
        error: `No ACP version with Kubernetes ${key} is listed, so the upgrade path cannot be planned.`,
      }
    }
    hops.push({ role: 'intermediate', release: highest })
  }
  hops.push({ role: 'target', release: target })
  return { current, hops }
}
