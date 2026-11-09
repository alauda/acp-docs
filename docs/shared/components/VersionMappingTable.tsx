// Renders the Version Mapping table of the Alauda OS Support Matrix.
// The rows come from ../alauda-os/version-mapping.json: do not hand-edit; see ../alauda-os/README.md.
import versionMapping from '../alauda-os/version-mapping.json' with { type: 'json' }

export default function VersionMappingTable() {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>ACP Version</th>
            <th>Kubernetes Version</th>
            <th>containerd</th>
            <th>etcd</th>
          </tr>
        </thead>
        <tbody>
          {versionMapping.releases.map(release => (
            <tr key={release.acp}>
              <td>{release.acp}</td>
              <td>{release.kubernetes}</td>
              <td>{release.containerd}</td>
              <td>{release.etcd}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
