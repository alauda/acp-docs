// Lists the ACP versions whose Alauda OS images an upgrade passes through,
// planned the way the platform plans it (see planUpgradePath). The versions
// come from ../alauda-os/version-mapping.json: to add a release, append an
// entry there (see ../alauda-os/README.md), not here.
import { useId, useState, type ReactNode } from 'react'

import { planUpgradePath, upgradeReleases } from './alauda-os.js'
import { AcpVersionField, alertStyle, fieldRowStyle } from './fields.js'

const STEP_LABELS = {
  current: 'Current',
  intermediate: 'Intermediate',
  target: 'Target',
} as const

export interface AlaudaOsUpgradePathProps {
  /**
   * Shown below the result, and in the Markdown output of the page, where the
   * calculator is not interactive. Use it to link to Pre-Upgrade Preparation
   * and to Version Mapping.
   */
  children?: ReactNode
}

export default function AlaudaOsUpgradePath({ children }: AlaudaOsUpgradePathProps) {
  const id = useId()
  const [currentAcp, setCurrentAcp] = useState(upgradeReleases[Math.max(upgradeReleases.length - 2, 0)].acp)
  const [targetAcp, setTargetAcp] = useState(upgradeReleases[upgradeReleases.length - 1].acp)

  if (import.meta.env.SSG_MD) {
    return (
      <>
        <p>
          The upgrade path has one row for each Kubernetes minor version between the current and the target
          version: the latest patch release of the matching ACP minor version, which is the row with the
          highest Kubernetes version in that minor. The last row is the target ACP version itself. Prepare the
          Alauda OS image of every row, using the same Alauda OS variant that the cluster runs today.
        </p>
        {children}
      </>
    )
  }

  const path = planUpgradePath(currentAcp, targetAcp)
  const rows = [{ role: 'current' as const, release: path.current }, ...path.hops]

  return (
    <div style={{ margin: '1rem 0' }}>
      <div style={fieldRowStyle}>
        <AcpVersionField
          id={`${id}-current`}
          label="Current ACP version"
          value={currentAcp}
          onChange={setCurrentAcp}
        />
        <AcpVersionField id={`${id}-target`} label="Target ACP version" value={targetAcp} onChange={setTargetAcp} />
      </div>
      {path.error === undefined ? (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Step</th>
                  <th>ACP version</th>
                  <th>Kubernetes version</th>
                  <th>etcd</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ role, release }) => (
                  <tr key={`${role}-${release.acp}`}>
                    <td>{STEP_LABELS[role]}</td>
                    <td>{release.acp}</td>
                    <td>{release.kubernetes}</td>
                    <td>{release.etcd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Prepare the Alauda OS image of every Intermediate and Target row, using the same Alauda OS variant
            that the cluster runs today.
          </p>
        </>
      ) : (
        <p role="alert" style={alertStyle}>
          {path.error}
        </p>
      )}
      {children}
    </div>
  )
}
