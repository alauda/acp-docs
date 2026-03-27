---
weight: 70
---

# AC CLI Administrator Command Reference

This reference provides descriptions and example commands for AC CLI administrator commands. You must have cluster-admin or equivalent permissions to use these commands.

For developer commands, see the AC CLI developer command reference.

Run `ac adm -h` to list all administrator commands or run `ac <command> --help` to get additional details for a specific command.


## ac adm

ACP administrative tools for cluster management

### Example usage

```bash
# Drain a node for maintenance
ac adm drain NODE_NAME

# Cordon a node (mark as unschedulable)
ac adm cordon NODE_NAME

# new-project to create project with cluster
ac adm new-project PROJECT_NAME --cluster CLUSTER_NAME

# Uncordon a node (mark as schedulable)
ac adm uncordon NODE_NAME
```

## ac adm certificate

Modify certificate resources

## ac adm certificate approve

Approve a certificate signing request

### Example usage

```bash
# Approve CSR 'csr-sqgzp'
ac adm certificate approve csr-sqgzp
```

## ac adm certificate deny

Deny a certificate signing request

### Example usage

```bash
# Deny CSR 'csr-sqgzp'
ac adm certificate deny csr-sqgzp
```

## ac adm cordon

Mark node as unschedulable

### Example usage

```bash
# Mark node "foo" as unschedulable
ac adm cordon foo
```

## ac adm drain

Drain node in preparation for maintenance

### Example usage

```bash
# Drain node "foo", even if there are pods not managed by a replication controller, replica set, job, daemon set, or stateful set on it
ac adm drain foo --force

# As above, but abort if there are pods not managed by a replication controller, replica set, job, daemon set, or stateful set, and use a grace period of 15 minutes
ac adm drain foo --grace-period=900
```

## ac adm new-project

Create a new project

### Example usage

```bash
# Create a project with specific clusters
ac adm new-project my-project --cluster cluster1

# Create a project with multiple clusters
ac adm new-project my-project --cluster cluster1,cluster2
```

## ac adm new-project-namespace

Create a new namespace in project

### Example usage

```bash
# Create a namespace in project with specific clusters
ac adm new-project-namespace  my-namespace --project my-project --cluster cluster1
```

## ac adm policy

Manage RBAC policy with project or namespace

### Example usage

```bash
# Assign a user to the admin role in a project
ac adm policy add-project-role-to-user project-admin-system alice --project my-project

# Assign a user to the namespace role in a cluster namespace in project
ac adm policy add-namespace-role-to-user namespace-developer-system alice --namespace my-namespace --project my-project --cluster business-1

# add kubernetes cluster role  view  to user alice
ac adm policy add-cluster-role-to-user view alice

# add kubernetes role  view  to user alice
ac adm policy add-role-to-user view alice -n my-namespace

```

## ac adm policy add-cluster-role-to-user

Assign a kubernetes cluster role to a user in current context cluster

### Example usage

```bash
# add kubernetes cluster role  view  to user alice
ac adm policy add-cluster-role-to-user view alice
```

## ac adm policy add-namespace-role-to-user

Assign a platform role to a user in a special cluster namespace in project

### Example usage

```bash
# Assign the namespace-developer-system role to user alice in project my-project
ac adm policy add-namespace-role-to-user namespace-developer-system alice --namespace my-namespace --project my-project --cluster business-1
```

## ac adm policy add-project-role-to-user

Assign a platform role to a user in a project

### Example usage

```bash
# Assign the project-admin-system role to user alice in project my-project
ac adm policy add-project-role-to-user project-admin-system alice --project my-project
```

## ac adm policy add-role-to-user

Assign a kubernetes role to a user in current context cluster

### Example usage

```bash
# add kubernetes role  view  to user alice
ac adm policy add-role-to-user view alice -n my-namespace
```

## ac adm release

Manage release metadata and related administrative workflows

### Example usage

```bash
# Import a ProductManifest for a release version
ac adm release import-manifest --version 4.20.0
```

## ac adm release import-manifest

Import release metadata as a ProductManifest

### Example usage

```bash
# Import release metadata for version 4.20.0
ac adm release import-manifest --version 4.20.0

# Import metadata and wait for the ProductManifest to become Ready
ac adm release import-manifest --version 4.20.0 --wait

# Override the wait timeout
ac adm release import-manifest --version 4.20.0 --wait --timeout=10m
```

## ac adm taint

Update the taints on one or more nodes

### Example usage

```bash
# Update node 'foo' with a taint with key 'dedicated' and value 'special-user' and effect 'NoSchedule'
# If a taint with that key and effect already exists, its value is replaced as specified
ac adm taint nodes foo dedicated=special-user:NoSchedule

# Remove from node 'foo' the taint with key 'dedicated' and effect 'NoSchedule' if one exists
ac adm taint nodes foo dedicated:NoSchedule-

# Remove from node 'foo' all the taints with key 'dedicated'
ac adm taint nodes foo dedicated-

# Add a taint with key 'dedicated' on nodes having label myLabel=X
ac adm taint node -l myLabel=X  dedicated=foo:PreferNoSchedule

# Add to node 'foo' a taint with key 'bar' and no value
ac adm taint nodes foo bar:NoSchedule
```

## ac adm uncordon

Mark node as schedulable

### Example usage

```bash
# Mark node "foo" as schedulable
ac adm uncordon foo
```

## ac adm upgrade

Review or request a cluster upgrade

### Example usage

```bash
# View the update status and available cluster updates
ac adm upgrade

# View summary for a specific cluster
ac adm upgrade --cluster=workload-a

# Update to the latest version
ac adm upgrade --to-latest

# Update to a specific version from available updates
ac adm upgrade --cluster=workload-a --to=4.15.0

# Allow an explicit version outside available updates
ac adm upgrade --to=4.15.0 --allow-explicit-upgrade
```

## ac adm upgrade status

Review preflight and stage details for the target cluster upgrade

### Example usage

```bash
# Review the status of the Cluster Version Operator for default cluster
ac adm upgrade status

# Review the status of a specific cluster
ac adm upgrade status --cluster=workload-a

# Review the full controller-reported details
ac adm upgrade status --verbose
```