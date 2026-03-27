---
weight: 80
---

# Upgrading Clusters

AC CLI provides administrator commands for preparing upgrade metadata, reviewing cluster upgrade status, and requesting cluster upgrades.

Use these commands when you need to:

- Create a `ProductManifest` for a target version
- Check the current cluster version and available updates
- Request an upgrade to the latest version
- Request an upgrade to a specific version
- Review preflight results and upgrade execution progress

## Before You Start

In ACP, `availableUpdates` is not a static list that you maintain manually. The upgrade controller must first see a `ProductManifest` for the target version before it can publish available upgrade targets for the cluster.

If you do not create the `ProductManifest` first, common symptoms include:

- `ac adm upgrade` shows no `availableUpdates`
- `ac adm upgrade --to-latest` fails immediately
- You can only use `--allow-explicit-upgrade` to request a version manually

The recommended flow is:

1. Decide which version you want to publish or upgrade to.
2. Create a `ProductManifest` for that version.
3. Wait for the upgrade metadata to be processed.
4. Run `ac adm upgrade` and confirm that `availableUpdates` is populated.
5. Request the upgrade.

## Prerequisites

Before you run upgrade-related commands, make sure that:

- You are logged in to an ACP platform.
- You have cluster administrator or equivalent permissions.
- You know the target cluster name. If omitted, `ac adm upgrade` uses `global` by default.
- The target environment already has the `ProductManifest` CRD and the upgrade controller installed.

You can confirm the current context first:

```bash
ac config current-context
```

The current context still decides which credentials and endpoint AC uses for the command.

- For `ac adm upgrade` and `ac adm upgrade status`, the target cluster is still selected explicitly with `--cluster`, which defaults to `global`.
- For `ac adm release import-manifest`, AC first inspects the current context REST URL. If it points to an ACP workload path, AC rewrites the request to the matching global path automatically. If the current context is not an ACP workload/global URL, AC uses the current context as-is and does not require a kubeconfig session extension.

If needed, switch to another ACP session first:

```bash
# Switch to another ACP session
ac config use-session production
```

## Creating a ProductManifest

Use the following command to create a `ProductManifest` for the target version:

```bash
ac adm release import-manifest --version 4.20.0
```

This command creates the minimum upgrade metadata object required by the controller:

- `metadata.name` uses the version name with a leading `v`, for example `v4.20.0`
- `spec.version` uses the version you passed in, for example `4.20.0`

If you want the command to wait until the object is Ready, add `--wait`:

```bash
ac adm release import-manifest --version 4.20.0 --wait
```

You can also override the wait timeout:

```bash
ac adm release import-manifest --version 4.20.0 --wait --timeout=10m
```

Command behavior:

- `--version` is required.
- If the `ProductManifest` does not exist, AC creates it.
- If the `ProductManifest` already exists with the same version, the command succeeds without changing it.
- If the `ProductManifest` already exists with a different version, the command fails and does not overwrite the existing object.
- By default, the command does not wait for Ready. It waits only when you explicitly pass `--wait`.

## Viewing Upgrade Status and Available Updates

After the `ProductManifest` is created, use the following command to review the upgrade summary for the default `global` cluster:

```bash
ac adm upgrade
```

This command typically shows:

- The current cluster version
- The desired version, if an upgrade has already been requested
- The current list of available updates
- The overall upgrade conditions

Use it when you want quick answers to questions like:

- Which version is the cluster currently running?
- Has a target version already been requested?
- Are new upgrade targets available now?
- Is the cluster currently `Ready`, `Reconciling`, or `Degraded`?

To query a specific cluster, add `--cluster`:

```bash
ac adm upgrade --cluster=workload-a
```

If you just created a `ProductManifest` and still do not see `availableUpdates`, the controller may still be processing the metadata. Wait a moment and run `ac adm upgrade` again.

## Updating to the Latest Version

When `availableUpdates` is present, request an upgrade to the latest version with:

```bash
ac adm upgrade --to-latest
```

AC selects the highest version from `availableUpdates` and submits the upgrade request.

`--to-latest` is a boolean flag with a default value of `false`, which means:

- If you do not specify it, AC behaves as if `--to-latest=false` was used.
- If you specify `--to-latest` by itself, AC treats it as `true`.
- You can also write `--to-latest=true` or `--to-latest=false` explicitly.

If no `availableUpdates` exist, the command fails and does not submit a new target version.

After you request the upgrade, review the summary again:

```bash
ac adm upgrade
```

## Updating to a Specific Version

If you want to upgrade to a specific version, run:

```bash
ac adm upgrade --to=<version>
```

Example:

```bash
ac adm upgrade --to=4.20.0
```

Typical cases include:

- You do not want the newest available version
- You are following an approved release target from your release process
- You want to retry a known target version

By default, the requested version must already appear in `availableUpdates`. If it does not, the command fails.

If you intentionally need to request a version that is not listed in `availableUpdates`, add:

```bash
ac adm upgrade --to=<version> --allow-explicit-upgrade
```

`--allow-explicit-upgrade` defaults to `false`:

- If you do not specify it, AC behaves as if `--allow-explicit-upgrade=false` was used.
- If you specify `--allow-explicit-upgrade` by itself, AC treats it as `true`.
- You can also write `--allow-explicit-upgrade=true` or `--allow-explicit-upgrade=false` explicitly.

Example:

```bash
ac adm upgrade --to=4.20.0 --allow-explicit-upgrade=true
```

This flag only changes client-side validation. The upgrade controller and its preflight checks still decide whether the requested target can proceed.

## Reviewing Detailed Upgrade Status

If you need deeper diagnostics, run:

```bash
ac adm upgrade status
```

To review a specific cluster:

```bash
ac adm upgrade status --cluster=workload-a
```

Compared with `ac adm upgrade`, this command expands:

- A summary of the current version, desired version, and overall conditions
- Preflight results for the current upgrade target
- Upgrade stages and operation progress

### Preflight Results

Preflight describes whether the upgrade can move into execution. Each check can typically include:

- Check name
- Reentry policy
- State
- Reason
- Message

Interpret the states as follows:

- `Passed`: The check passed.
- `Retry`: The check cannot produce a final result yet. Wait and check again.
- `Failed`: A blocking condition exists and must be handled first.

If no preflight data is available yet, treat it as "no result yet", not as "all checks passed".

### Upgrade Stages

After the upgrade enters execution, the status output shows stage and operation progress.

Stage output can include:

- Stage name
- Priority
- Phase

Operation output can include:

- Operation name
- Action
- Current version
- Target version
- Phase

Interpret stage phases as follows:

- `Pending`: The stage has not started yet.
- `Running`: The stage is currently in progress.
- `Finished`: The stage has completed.

If no stage data is available yet, the upgrade likely has not entered the execution phase.

## Common Signals and Troubleshooting

Use the following guidelines when you read upgrade status:

- `Ready` usually means the cluster has reached the desired state.
- `Reconciling` usually means the cluster is still applying the current upgrade request.
- `Degraded` usually means the upgrade is blocked or has encountered an error.

When `ac adm upgrade` does not show any `availableUpdates`, check these items first:

1. Was the `ProductManifest` for the target version created?
2. If you used `--wait`, did the `ProductManifest` reach `Ready=True`?
3. Has the controller had enough time to process the new metadata?

When `ac adm upgrade` shows a desired target but the upgrade is not moving:

1. Run `ac adm upgrade status`.
2. Check whether any preflight item is in `Retry` or `Failed`.
3. Review whether upgrade stages have started.

When the upgrade is already in progress:

1. Run `ac adm upgrade status`.
2. Review the current stage and operation phases.
3. Compare the current version with the target version.

## Example Workflow

```bash
# 1. Create a ProductManifest for the target version
ac adm release import-manifest --version 4.20.0 --wait

# 2. Review the upgrade summary for the default global cluster
ac adm upgrade

# 3. Review the summary for a specific cluster
ac adm upgrade --cluster=workload-a

# 4. Request an upgrade to the latest available version
ac adm upgrade --to-latest

# 5. Review detailed status
ac adm upgrade status --cluster=workload-a

# 6. Request an upgrade to a specific version
ac adm upgrade --cluster=workload-a --to=4.20.0

# 7. Request a version outside availableUpdates when you explicitly intend to do so
ac adm upgrade --cluster=workload-a --to=4.20.0 --allow-explicit-upgrade
```
