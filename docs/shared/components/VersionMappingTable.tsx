// Renders the Version Mapping table of the Alauda OS Support Matrix.
// The rows come from ../alauda-os/version-mapping.json: to add a release,
// append an entry there (see ../alauda-os/README.md), not here.
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
            <th>coredns</th>
            <th>etcd</th>
            <th>pause</th>
          </tr>
        </thead>
        <tbody>
          {versionMapping.releases.map(release => (
            <tr key={release.acp}>
              <td>{release.acp}</td>
              <td>{release.kubernetes}</td>
              <td>{release.containerd}</td>
              <td>{release.coredns}</td>
              <td>{release.etcd}</td>
              <td>{release.pause}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
