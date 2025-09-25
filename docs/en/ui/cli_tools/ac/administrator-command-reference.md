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