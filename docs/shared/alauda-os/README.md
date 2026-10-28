# Alauda OS Version Mapping Data

`version-mapping.json` lists the component versions included in the Alauda OS images of each ACP release. The following pages read it, so update this file instead of editing their content:

- The **Version Mapping** table in `docs/en/overview/alauda_os_support_matrix.mdx`, rendered by `docs/shared/components/VersionMappingTable.tsx`.
- The VM template ConfigMap generator on the Huawei DCS pages, rendered by `docs/shared/components/DcsVmTemplateConfigMap.tsx`.
- The upgrade path calculator in **Preparing for Cross-Version Upgrades** in `docs/en/upgrade/workload/alauda_os/index.mdx`, rendered by `docs/shared/components/AlaudaOsUpgradePath.tsx`.

The generator and the calculator read the file through `docs/shared/components/alauda-os.ts`, which also plans the upgrade path: for each Kubernetes minor version between the current and the target version, it selects the entry with the highest `kubernetes` value in that minor.

## Add a Release

Append one object to `releases` for every ACP release that publishes Alauda OS images:

- Keep the entries in release order, oldest first. The generator and the calculator select the last entry as the target by default. Entries with the same `kubernetes` value are ordered by their position, so a later entry is a newer ACP patch.
- Copy every value exactly as published for the release, including the leading `v` where the release uses one.
- Write `kubernetes` as `v<major>.<minor>.<patch>`, optionally followed by a build suffix such as `-3` or `-acp.9`. Numbers in the suffix are compared as numbers.
- Fill all fields: `acp`, `kubernetes`, `containerd`, and `etcd`.

Each `acp` value must be unique.
