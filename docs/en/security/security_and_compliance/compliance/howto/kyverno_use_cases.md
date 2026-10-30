---
weight: 10
---

# Kyverno Policy Configuration Use Cases

This document provides core policy configuration use cases based on Kyverno. It helps you implement automatic resource mutation, unified configuration, and automated injection of security templates and baseline environments based on Namespaces or Projects in your Kubernetes cluster.

## 1. Resource Mutation and Unified Configuration (Mutate)

Kyverno's Mutate rules can automatically modify submitted resources during the admission control phase. The following cases demonstrate how to inject unified labels into all Pods under a namespace and enforce a uniform `restartPolicy`.

### 1.1 Injecting Unified Labels into Pods

This policy will automatically append preset labels to all newly created Pods in the cluster (or within a specific namespace). This is commonly used for unified project management and billing scheduling.

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-default-pod-labels
  annotations:
    policies.kyverno.io/title: Add Default Pod Labels
    policies.kyverno.io/subject: Pod
    policies.kyverno.io/description: >-
      Automatically inject default labels into newly created Pods.
spec:
  rules:
    - name: inject-pod-labels
      match:
        any:
        - resources:
            kinds:
              - Pod
            # Optional: Uncomment and modify the following fields to apply only to specific namespaces
            # namespaces:
            #   - my-project-ns
      mutate:
        patchStrategicMerge:
          metadata:
            labels:
              # The +() syntax adds the label if it doesn't exist, and does not overwrite it if it does
              +(company.com/managed-by): "kyverno"
              +(company.com/environment): "production"
```

### 1.2 Enforcing Uniform RestartPolicy for Pods

This policy enforces that the default `restartPolicy` for all newly created Pods is `Always`. This is critical to ensure that business containers are automatically restarted if they exit unexpectedly.

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: enforce-restart-policy
spec:
  rules:
    - name: set-restart-policy-always
      match:
        any:
        - resources:
            kinds:
              - Pod
      mutate:
        patchStrategicMerge:
          spec:
            # This will forcefully overwrite the restartPolicy to Always, even if the user specifies Never or OnFailure
            restartPolicy: Always
```

---

## 2. Automated Template Configuration Based on Namespace/Project (Generate)

When a new namespace or project is created, Kyverno's Generate rules can detect this event and automatically generate related Kubernetes resources (such as NetworkPolicy, ConfigMap, Secret, RoleBinding, etc.). This acts as an **out-of-the-box security and unified configuration template**.

### 2.1 Automatically Injecting Default Isolated NetworkPolicy

This policy automatically generates a default `NetworkPolicy` when a new namespace is created. This policy denies all inbound (Ingress) requests by default, thereby overriding default network connectivity and achieving network isolation between namespaces.

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: generate-default-networkpolicy
  annotations:
    policies.kyverno.io/title: Generate Default NetworkPolicy
    policies.kyverno.io/subject: Namespace, NetworkPolicy
    policies.kyverno.io/description: >-
      Automatically generates a NetworkPolicy that denies all cross-namespace inbound traffic when a new Namespace is created,
      achieving default network isolation between projects.
spec:
  rules:
    - name: generate-deny-all-networkpolicy
      match:
        any:
        - resources:
            kinds:
              - Namespace
      # Exclude specific system namespaces to prevent blocking system components
      exclude:
        any:
        - resources:
            namespaces:
              - kube-system
              - kyverno
              - monitoring
      generate:
        kind: NetworkPolicy
        apiVersion: networking.k8s.io/v1
        name: default-deny-all
        # Use a template variable to get the name of the newly created Namespace
        namespace: "{{request.object.metadata.name}}"
        # synchronize=true means that if this Kyverno policy changes, the generated resources will automatically sync and update
        synchronize: true 
        data:
          metadata:
            labels:
              security.policy/type: "default-deny"
          spec:
            podSelector: {} # An empty selector matches all Pods in the namespace
            policyTypes:
            - Ingress
            # Without specifying Ingress rules (whitelists), all Ingress traffic is denied
```

### 2.2 Automatically Initializing Project Configurations Based on Templates (DBS/Security Quotas)

This example demonstrates how to automatically prepare a series of underlying environments based on project attributes (e.g., labels applied when creating a Namespace). For instance, issuing DBS connection templates (for CLI or applications to read) and default security quotas (LimitRange).

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: setup-namespace-dbs-template
spec:
  rules:
    # Rule 1: Automatically generate DBS default configuration for projects with specific labels
    - name: generate-dbs-configmap
      match:
        any:
        - resources:
            kinds:
              - Namespace
            selector:
              matchLabels:
                project-type: database # Triggers when the NS has this Label
      generate:
        kind: ConfigMap
        apiVersion: v1
        name: dbs-default-template
        namespace: "{{request.object.metadata.name}}"
        synchronize: true
        data:
          data:
            # Default DBS configuration for CLI support tools
            dbs-url: "jdbc:mysql://default-db-cluster:3306/db"
            dbs-cli-version: "v1.2.0"
            secure-mode: "true"
            
    # Rule 2: Uniformly generate LimitRange (security limits) for all newly created Namespaces
    - name: generate-default-limitrange
      match:
        any:
        - resources:
            kinds:
              - Namespace
      generate:
        kind: LimitRange
        apiVersion: v1
        name: default-limits
        namespace: "{{request.object.metadata.name}}"
        synchronize: true
        data:
          spec:
            limits:
            - default:
                cpu: 500m
                memory: 512Mi
              defaultRequest:
                cpu: 100m
                memory: 128Mi
              type: Container
```

## Summary
1. **Mutate Capabilities**: Non-intrusively fixes and supplements YAML submitted by developers, easily achieving label and state control at the resource level (such as `RestartPolicy`).
2. **Generate Capabilities**: Acts as a declarative project generator. Once a Namespace creation event occurs, Kyverno automatically populates security policies (NetworkPolicy) and dependency templates (ConfigMap, Secret, LimitRange) in the background, providing a highly standardized and unified isolated environment for CLI tools and upper-level applications.
