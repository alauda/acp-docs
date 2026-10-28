# Alauda OS Version Mapping Data

`version-mapping.json` lists the component versions included in the Alauda OS images of each ACP release. The following pages read it, so update this file instead of editing their content:

- The **Version Mapping** table in `docs/en/overview/alauda_os_support_matrix.mdx`, rendered by `docs/shared/components/VersionMappingTable.tsx`.
- The VM template ConfigMap generator on the Huawei DCS pages, rendered by `docs/shared/components/DcsVmTemplateConfigMap.tsx`.

## Add a Release

Append one object to `releases` for every ACP release that publishes Alauda OS images:

- Keep the entries in release order, oldest first. The generator selects the last entry by default.
- Copy every value exactly as published for the release, including the leading `v` where the release uses one.
- Fill all fields: `acp`, `kubernetes`, `containerd`, `coredns`, `etcd`, and `pause`.

Each `acp` value must be unique.
