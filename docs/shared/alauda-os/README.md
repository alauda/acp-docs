# Alauda OS Version Mapping Data

`version-mapping.json` lists the component versions included in the Alauda OS images of each ACP release. The following pages read it:

- The **Version Mapping** table in `docs/en/overview/alauda_os_support_matrix.mdx`, rendered by `docs/shared/components/VersionMappingTable.tsx`.
- The VM template and image ConfigMap generator, rendered by `docs/shared/components/VmTemplateConfigMap.tsx` (`DcsVmTemplateConfigMap.tsx` wraps it for Huawei DCS): the **Huawei DCS** tab of **Stage the Alauda OS Images** in `docs/en/upgrade/pre-upgrade.mdx`, and the prerequisites pages of Huawei DCS, Huawei Cloud Stack, and VMware vSphere in `docs/en/workload_clusters/alauda_os/`.
- The Bare Metal OS image generator, rendered by `docs/shared/components/BareMetalImageCatalog.tsx`: **Prerequisites** of the Bare Metal `global` cluster installation in `docs/en/install/alauda_os/bare-metal/prerequisites.mdx` (`mode="install"`), **Prepare Alauda OS for Hosts** in `docs/en/workload_clusters/alauda_os/bare-metal/prepare_os.mdx` (`mode="register"`), and the **Bare Metal** tab of **Stage the Alauda OS Images** in `docs/en/upgrade/pre-upgrade.mdx` (`mode="path"`).
- The upgrade path calculator in **Determine the Versions to Prepare** in `docs/en/upgrade/pre-upgrade.mdx`, rendered by `docs/shared/components/AlaudaOsUpgradePath.tsx`.

The generators and the calculator read the file through `docs/shared/components/alauda-os.ts`, which also plans the upgrade path: for each Kubernetes minor version between the current and the target version, it selects the entry with the highest `kubernetes` value in that minor.

## Source

This file is generated from ACP [release-info](https://acp-release-info.pages.dev/version-mapping.json). Do not hand-edit.

It lists `acp`, `kubernetes`, `containerd`, and `etcd` for every ACP v4 target, oldest first, including pending releases. After `upgrade_paths/` changes, `hack/sync-acp-docs-version-mapping.sh` in release-info opens PRs that replace this file.

Keep the entries in release order. The generators and the calculator select the last entry as the default target. Entries with the same `kubernetes` value are ordered by their position, so a later entry is a newer ACP patch.

Each `acp` value must be unique.
