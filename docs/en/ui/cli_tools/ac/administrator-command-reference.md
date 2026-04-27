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

```
# Drain a node for maintenance
ac adm drain NODE_NAME

# Cordon a node (mark as unschedulable)
ac adm cordon NODE_NAME

# new-project to create project with cluster
ac adm new-project --cluster CLUSTER_NAME

# Uncordon a node (mark as schedulable)
ac adm uncordon NODE_NAME
```

## ac adm certificate

Modify certificate resources

## ac adm certificate approve

Approve a certificate signing request

### Example usage

```
# Approve CSR 'csr-sqgzp'
ac adm certificate approve csr-sqgzp
```

## ac adm certificate deny

Deny a certificate signing request

### Example usage

```
# Deny CSR 'csr-sqgzp'
ac adm certificate deny csr-sqgzp
```

## ac adm cordon

Mark node as unschedulable

### Example usage

```
# Mark node "foo" as unschedulable
ac adm cordon foo
```

## ac adm drain

Drain node in preparation for maintenance

### Example usage

```
# Drain node "foo", even if there are pods not managed by a replication controller, replica set, job, daemon set, or stateful set on it
ac adm drain foo --force

# As above, but abort if there are pods not managed by a replication controller, replica set, job, daemon set, or stateful set, and use a grace period of 15 minutes
ac adm drain foo --grace-period=900
```

## ac adm new-project

Create a new project

### Example usage

```
# Create a project with specific clusters
ac adm new-project my-project --cluster cluster1

# Create a project with multiple clusters
ac adm new-project my-project --cluster cluster1,cluster2
```

## ac adm new-project-namespace

Create a new namespace in project

### Example usage

```
# Create a namespace in project with specific clusters
ac adm new-project-namespace  my-namespace --project my-project --cluster cluster1
```

## ac adm policy

Manage RBAC policy with project or namespace

### Example usage

```
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

```
# add kubernetes cluster role  view  to user alice
ac adm policy add-cluster-role-to-user view alice
```

## ac adm policy add-namespace-role-to-user

Assign a platform role to a user in a special cluster namespace in project

### Example usage

```
# Assign the namespace-developer-system role to user alice in project my-project
ac adm policy add-namespace-role-to-user namespace-developer-system alice --namespace my-namespace --project my-project --cluster business-1
```

## ac adm policy add-project-role-to-user

Assign a platform role to a user in a project

### Example usage

```
# Assign the project-admin-system role to user alice in project my-project
ac adm policy add-project-role-to-user project-admin-system alice --project my-project
```

## ac adm policy add-role-to-user

Assign a kubernetes role to a user in current context cluster

### Example usage

```
# add kubernetes role  view  to user alice
ac adm policy add-role-to-user view alice -n my-namespace
```

## ac adm taint

Update the taints on one or more nodes

### Example usage

```
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

```
# Mark node "foo" as schedulable
ac adm uncordon foo
```