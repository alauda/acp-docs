---
weight: 2
---

# Apply Security Context Constraints for Pod Security

This guide is for platform administrators and security administrators. It shows you how to install a SecurityContextConstraints (SCC) engine on top of an existing Kyverno deployment, and how to bind SCC profiles to ServiceAccounts, Users, and Groups so that Pod security boundaries are enforced automatically at admission time.

## Introduction

OpenShift's SecurityContextConstraints (SCC) model lets cluster administrators define a library of pod security profiles, then grant subjects (ServiceAccounts, Users, Groups) the right to use specific profiles. When a Pod is admitted, the platform picks the most appropriate SCC the subject is allowed to use, fills in missing defaults, and validates the Pod against that profile. Workloads themselves do not need to declare every security field — the SCC profile does it for them.

Vanilla Kubernetes has no equivalent built-in. This guide installs a Kyverno-based engine that reproduces the SCC experience on any standard Kubernetes cluster that already runs Kyverno. It uses:

- A `SecurityContextConstraints` CRD (`security.alauda.io/v1alpha1`) to store SCC profiles.
- Standard Kubernetes RBAC (`use` verb plus `resourceNames`) to bind subjects to profiles, so the operator workflow matches OpenShift (`oc adm policy add-scc-to-user` patterns translate one-to-one).
- A pair of Kyverno admission policies — one mutating, one validating — that select the right SCC, fill in defaults, and reject Pods that no granted SCC can accept.
- Five `GlobalContextEntry` resources that cache the SCC profiles and the relevant RBAC objects in memory so admission decisions do not require additional API calls.

The result: application teams continue to write straightforward Pod manifests, the cluster automatically constrains them to a security profile their ServiceAccount is allowed to use, and migration from OpenShift requires no changes to the binding model.

SCC authorization is a security-control change. Application teams should not be granted permission to create or modify SCC RBAC bindings directly, because doing so lets them bypass the cluster security boundary. Application teams should describe the workload requirement, such as `anyuid`, `hostNetwork`, or `hostPath`; platform or security administrators review the request and bind the least-privilege SCC to the appropriate subject.

## Who does what

Use the following table to decide which parts of this guide apply to you.

| Role | What you do | What you should not do |
|---|---|---|
| Platform administrator or security administrator | Install the SCC engine, approve SCC requests, create SCC RBAC bindings, switch the validating policy from `Warn` to `Deny`, and audit exceptions. | Do not grant broad SCCs such as `privileged`, `hostaccess`, or `anyuid` without a workload-level reason and an owner. |
| Application manager or application owner | Identify what the workload needs, such as root UID, host networking, host ports, host paths, user namespaces, or a fixed UID range. Provide the namespace, ServiceAccount, workload name, and reason to the platform or security administrator. Deploy the workload with the assigned ServiceAccount after approval. | Do not create SCC RBAC bindings or grant SCC permissions to your own ServiceAccount. Do not use `alauda.io/required-scc` unless the requested SCC has already been approved and bound. |

If you are a platform or security administrator, follow Part 1 and Part 2. If you are an application manager, use Step 2.1 to prepare the SCC request, then use Step 2.5 and Step 2.6 only after the SCC has been approved and bound by an administrator. Do not apply the RBAC manifests in Step 2.2 through Step 2.4 yourself.

The normal workflow is:

1. The application manager identifies the workload requirement and target ServiceAccount.
2. The platform or security administrator selects the least-privilege SCC and creates the RBAC binding.
3. The application manager deploys the workload with the approved ServiceAccount, and adds `alauda.io/required-scc` only when the administrator asks for a specific SCC to be pinned.
4. The administrator verifies authorization with `kubectl auth can-i`, and the workload owner verifies the admitted Pod has the expected `alauda.io/scc` annotation.

## Scenarios

Apply this guide when any of the following apply:

- You are migrating workloads from OpenShift and want to keep the existing `oc adm policy add-scc-to-*` binding model so that platform teams and audit tooling continue to work unchanged.
- You already use Kyverno and need a centrally managed security boundary that does not require every Pod manifest to declare a full `securityContext`.
- You operate a multi-tenant cluster and want different ServiceAccounts in different namespaces to receive different security ceilings — for example, an application SA limited to `restricted-v2`, a log-collector SA allowed `hostmount-anyuid`, and an ingress controller SA allowed `NET_BIND_SERVICE`.
- You want one cluster-wide place to express and audit "who is allowed to run privileged Pods" without scattering exemptions across every namespace.

## Prerequisites

Before you start, make sure all of the following are true:

1. The Kubernetes cluster runs version **1.30 or later** (CEL admission is stable).
2. Kyverno is already installed and running, at version **v4.3.1 or later**, with the `MutatingPolicy`, `ValidatingPolicy`, and `GlobalContextEntry` CRDs available. You can verify with:

   ```shell
   kubectl get crd validatingpolicies.policies.kyverno.io mutatingpolicies.policies.kyverno.io globalcontextentries.kyverno.io
   ```

3. The `kyverno` namespace contains these ServiceAccounts (default Kyverno installation):

   - `kyverno-admission-controller`
   - `kyverno-background-controller`
   - `kyverno-reports-controller`

4. You have **cluster-admin** (or equivalent) permissions, because installing the engine requires creating a CRD, ClusterRoles, ClusterRoleBindings, GlobalContextEntries, and admission policies.
5. You have reviewed the Pod Security Admission (PSA) `enforce` label on each namespace where you intend to allow non-`restricted` Pods. PSA runs **before** Kyverno; if a namespace is labelled `pod-security.kubernetes.io/enforce: restricted`, that namespace will reject any Pod that matches a permissive SCC such as `anyuid` or `hostnetwork-v2` before Kyverno is consulted. Adjust the namespace label to `baseline` or `privileged` where appropriate, or restrict the SCC profile set you offer in those namespaces.

::: tip
The engine installation is one-time work and is normally performed by a platform administrator. Part 2 is also an administrator workflow: platform or security administrators bind SCC profiles after reviewing workload requirements. Application teams typically only provide those requirements and then use the assigned ServiceAccount.
:::

## Steps

The work splits into two parts:

- **Part 1** installs the SCC engine cluster-wide. Run it once per cluster.
- **Part 2** authorizes workloads by binding SCC profiles to ServiceAccounts, Users, and Groups, and pins specific workloads to specific SCCs when needed.

### Part 1: Install the SCC engine

#### Step 1.1 — Install the `SecurityContextConstraints` CRD

Save the following manifest as `scc-crd.yaml`. It defines a cluster-scoped `SecurityContextConstraints` resource (short name `scc`) whose fields mirror OpenShift SCC semantics.

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: securitycontextconstraints.security.alauda.io
spec:
  group: security.alauda.io
  names:
    plural: securitycontextconstraints
    singular: securitycontextconstraints
    kind: SecurityContextConstraints
    listKind: SecurityContextConstraintsList
    shortNames:
      - scc
  scope: Cluster
  versions:
    - name: v1alpha1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          description: |
            SecurityContextConstraints governs the ability to make requests that affect
            container security context. This custom CRD mirrors OpenShift SCC semantics
            while keeping fields under spec for Kyverno CEL consumption.
          type: object
          required:
            - spec
          properties:
            apiVersion:
              type: string
            kind:
              type: string
            metadata:
              type: object
            spec:
              type: object
              required:
                - runAsUser
              properties:
                allowHostPorts:
                  description: Determines if the profile allows host ports in containers.
                  type: boolean
                priority:
                  description: Higher priority SCC is evaluated first.
                  type: integer
                  format: int32
                  nullable: true
                restrictiveScore:
                  description: Secondary sort key. Lower score means less restrictive.
                  type: integer
                  format: int32
                  minimum: 0
                requiredDropCapabilities:
                  description: Capabilities that must be dropped.
                  type: array
                  nullable: true
                  items:
                    type: string
                  x-kubernetes-list-type: atomic
                allowPrivilegedContainer:
                  description: Determines if privileged containers are allowed.
                  type: boolean
                runAsUser:
                  description: Strategy controlling runAsUser.
                  type: object
                  nullable: true
                  properties:
                    type:
                      description: Strategy type for runAsUser.
                      type: string
                      enum:
                        - RunAsAny
                        - MustRunAs
                        - MustRunAsRange
                        - MustRunAsNonRoot
                        - MustRunAsNonRootOrSystem
                    uid:
                      description: Required when type=MustRunAs.
                      type: integer
                      format: int64
                      minimum: 0
                    uidRangeMin:
                      description: Minimum uid for MustRunAsRange.
                      type: integer
                      format: int64
                      minimum: 0
                    uidRangeMax:
                      description: Maximum uid for MustRunAsRange.
                      type: integer
                      format: int64
                      minimum: 0
                users:
                  description: Users who can use this SCC.
                  type: array
                  nullable: true
                  items:
                    type: string
                  x-kubernetes-list-type: atomic
                groups:
                  description: Groups who can use this SCC.
                  type: array
                  nullable: true
                  items:
                    type: string
                  x-kubernetes-list-type: atomic
                allowHostDirVolumePlugin:
                  description: Determines if hostPath-like volume plugin usage is allowed.
                  type: boolean
                seccompProfiles:
                  description: Allowed seccomp profiles. '*' allows all.
                  type: array
                  nullable: true
                  items:
                    type: string
                    pattern: "^(\\*|runtime/default|unconfined|localhost/.+)$"
                  x-kubernetes-list-type: atomic
                allowHostIPC:
                  description: Determines if host IPC is allowed.
                  type: boolean
                forbiddenSysctls:
                  description: Explicitly forbidden sysctls.
                  type: array
                  nullable: true
                  items:
                    type: string
                  x-kubernetes-list-type: atomic
                seLinuxContext:
                  description: Strategy controlling SELinux labels.
                  type: object
                  nullable: true
                  properties:
                    type:
                      description: Strategy type for SELinux context.
                      type: string
                    seLinuxOptions:
                      description: Fixed SELinux options required by MustRunAs.
                      type: object
                      properties:
                        user:
                          type: string
                        role:
                          type: string
                        type:
                          type: string
                        level:
                          type: string
                readOnlyRootFilesystem:
                  description: Forces readOnlyRootFilesystem when set to true.
                  type: boolean
                fsGroup:
                  description: Strategy controlling fsGroup.
                  type: object
                  nullable: true
                  properties:
                    type:
                      type: string
                    ranges:
                      type: array
                      items:
                        type: object
                        properties:
                          min:
                            type: integer
                            format: int64
                          max:
                            type: integer
                            format: int64
                      x-kubernetes-list-type: atomic
                supplementalGroups:
                  description: Strategy controlling supplemental groups.
                  type: object
                  nullable: true
                  properties:
                    type:
                      type: string
                    ranges:
                      type: array
                      items:
                        type: object
                        properties:
                          min:
                            type: integer
                            format: int64
                          max:
                            type: integer
                            format: int64
                      x-kubernetes-list-type: atomic
                userNamespaceLevel:
                  description: Controls host user namespace usage.
                  type: string
                  default: AllowHostLevel
                  enum:
                    - AllowHostLevel
                    - RequirePodLevel
                defaultAddCapabilities:
                  description: Capabilities added by default unless explicitly dropped.
                  type: array
                  nullable: true
                  items:
                    type: string
                  x-kubernetes-list-type: atomic
                allowedUnsafeSysctls:
                  description: Explicitly allowed unsafe sysctls.
                  type: array
                  nullable: true
                  items:
                    type: string
                  x-kubernetes-list-type: atomic
                allowedFlexVolumes:
                  description: Allowed flex volume drivers.
                  type: array
                  nullable: true
                  items:
                    type: object
                    required:
                      - driver
                    properties:
                      driver:
                        type: string
                  x-kubernetes-list-type: atomic
                volumes:
                  description: Allowed volume plugin types. '*' allows all.
                  type: array
                  nullable: true
                  items:
                    type: string
                    enum:
                      - '*'
                      - none
                      - hostPath
                      - emptyDir
                      - gcePersistentDisk
                      - awsElasticBlockStore
                      - gitRepo
                      - secret
                      - nfs
                      - iscsi
                      - glusterfs
                      - persistentVolumeClaim
                      - rbd
                      - flexVolume
                      - cinder
                      - cephfs
                      - flocker
                      - downwardAPI
                      - fc
                      - azureFile
                      - configMap
                      - vsphereVolume
                      - quobyte
                      - azureDisk
                      - photonPersistentDisk
                      - projected
                      - portworxVolume
                      - scaleIO
                      - storageos
                      - csi
                      - ephemeral
                      - image
                  x-kubernetes-list-type: atomic
                allowHostPID:
                  description: Determines if host PID is allowed.
                  type: boolean
                allowHostNetwork:
                  description: Determines if hostNetwork is allowed.
                  type: boolean
                allowPrivilegeEscalation:
                  description: Determines if privilege escalation can be requested.
                  type: boolean
                  nullable: true
                defaultAllowPrivilegeEscalation:
                  description: Default for allowPrivilegeEscalation when container omits it.
                  type: boolean
                  nullable: true
                allowedCapabilities:
                  description: Capabilities that may be added.
                  type: array
                  nullable: true
                  items:
                    type: string
                  x-kubernetes-list-type: atomic
              x-kubernetes-validations:
                - rule: "!has(self.runAsUser) || self.runAsUser.type != 'MustRunAs' || has(self.runAsUser.uid)"
                  message: "runAsUser.uid is required when runAsUser.type is MustRunAs."
                - rule: "!has(self.runAsUser) || self.runAsUser.type == 'MustRunAs' || !has(self.runAsUser.uid)"
                  message: "runAsUser.uid is only allowed when runAsUser.type is MustRunAs."
                - rule: "!has(self.runAsUser) || self.runAsUser.type != 'MustRunAsRange' || (has(self.runAsUser.uidRangeMin) && has(self.runAsUser.uidRangeMax))"
                  message: "uidRangeMin and uidRangeMax are required when runAsUser.type is MustRunAsRange."
                - rule: "!has(self.runAsUser) || self.runAsUser.type == 'MustRunAsRange' || (!has(self.runAsUser.uidRangeMin) && !has(self.runAsUser.uidRangeMax))"
                  message: "uidRangeMin and uidRangeMax are only allowed when runAsUser.type is MustRunAsRange."
                - rule: "!has(self.runAsUser) || !has(self.runAsUser.uidRangeMin) || !has(self.runAsUser.uidRangeMax) || self.runAsUser.uidRangeMin <= self.runAsUser.uidRangeMax"
                  message: "uidRangeMin must be less than or equal to uidRangeMax."
      additionalPrinterColumns:
        - name: Priv
          type: string
          description: Determines if privileged containers are allowed
          jsonPath: .spec.allowPrivilegedContainer
        - name: Caps
          type: string
          description: Allowed capabilities
          jsonPath: .spec.allowedCapabilities
        - name: SELinux
          type: string
          description: SELinux strategy
          jsonPath: .spec.seLinuxContext.type
        - name: RunAsUser
          type: string
          description: RunAsUser strategy
          jsonPath: .spec.runAsUser.type
        - name: FSGroup
          type: string
          description: FSGroup strategy
          jsonPath: .spec.fsGroup.type
        - name: SupGroup
          type: string
          description: SupplementalGroups strategy
          jsonPath: .spec.supplementalGroups.type
        - name: Priority
          type: string
          description: SCC sort priority
          jsonPath: .spec.priority
        - name: Score
          type: string
          description: Secondary restrictive score
          jsonPath: .spec.restrictiveScore
        - name: ReadOnlyRootFS
          type: string
          description: Force read-only root filesystem
          jsonPath: .spec.readOnlyRootFilesystem
        - name: Volumes
          type: string
          description: Allowed volume plugins
          jsonPath: .spec.volumes
  conversion:
    strategy: None
```

Apply it and wait for the CRD to be `Established` before continuing:

```shell
kubectl apply -f scc-crd.yaml
kubectl wait --for=condition=Established --timeout=120s \
  crd/securitycontextconstraints.security.alauda.io
```

#### Step 1.2 — Install the 13 built-in SCC profiles

Save the following manifest as `scc-profiles.yaml`. It defines 13 SCC profiles modelled on the OpenShift built-in set, ordered from most restrictive (`restrictiveScore: 100`) to least restrictive (`restrictiveScore: 0`). Higher `restrictiveScore` is preferred by the auto-pick policy when multiple SCCs are granted to the same subject.

::: tip
You do not have to install every profile. Trim this manifest to the subset your platform offers — but you must keep at least one profile available to each subject, otherwise their Pods will be rejected at admission.
:::

```yaml
apiVersion: security.alauda.io/v1alpha1
kind: SecurityContextConstraints
metadata:
  name: restricted-v2
spec:
  priority: 0
  restrictiveScore: 100
  allowPrivilegedContainer: false
  allowPrivilegeEscalation: false
  allowHostNetwork: false
  allowHostPID: false
  allowHostIPC: false
  allowHostPorts: false
  allowHostDirVolumePlugin: false
  runAsUser:
    type: MustRunAsRange
    uidRangeMin: 1
    uidRangeMax: 2147483647
  seLinuxContext:
    type: MustRunAs
  fsGroup:
    type: MustRunAs
  supplementalGroups:
    type: RunAsAny
  allowedCapabilities:
    - NET_BIND_SERVICE
  requiredDropCapabilities:
    - ALL
  defaultAddCapabilities: []
  volumes:
    - configMap
    - csi
    - downwardAPI
    - emptyDir
    - ephemeral
    - image
    - persistentVolumeClaim
    - projected
    - secret
  seccompProfiles:
    - runtime/default
  readOnlyRootFilesystem: false
---
apiVersion: security.alauda.io/v1alpha1
kind: SecurityContextConstraints
metadata:
  name: restricted-v3
spec:
  priority: 0
  restrictiveScore: 100
  allowPrivilegedContainer: false
  allowPrivilegeEscalation: false
  allowHostNetwork: false
  allowHostPID: false
  allowHostIPC: false
  allowHostPorts: false
  allowHostDirVolumePlugin: false
  runAsUser:
    type: MustRunAsRange
    uidRangeMin: 1000
    uidRangeMax: 65534
  seLinuxContext:
    type: MustRunAs
  fsGroup:
    type: MustRunAs
    ranges:
      - min: 1000
        max: 65534
  supplementalGroups:
    type: MustRunAs
    ranges:
      - min: 1000
        max: 65534
  userNamespaceLevel: RequirePodLevel
  allowedCapabilities:
    - NET_BIND_SERVICE
  requiredDropCapabilities:
    - ALL
  volumes:
    - configMap
    - csi
    - downwardAPI
    - emptyDir
    - ephemeral
    - image
    - persistentVolumeClaim
    - projected
    - secret
  seccompProfiles:
    - runtime/default
  readOnlyRootFilesystem: false
---
apiVersion: security.alauda.io/v1alpha1
kind: SecurityContextConstraints
metadata:
  name: restricted
spec:
  priority: 0
  restrictiveScore: 98
  allowPrivilegedContainer: false
  allowPrivilegeEscalation: true
  allowHostNetwork: false
  allowHostPID: false
  allowHostIPC: false
  allowHostPorts: false
  allowHostDirVolumePlugin: false
  runAsUser:
    type: MustRunAsRange
    uidRangeMin: 1
    uidRangeMax: 2147483647
  seLinuxContext:
    type: MustRunAs
  fsGroup:
    type: MustRunAs
  supplementalGroups:
    type: RunAsAny
  allowedCapabilities: []
  requiredDropCapabilities:
    - KILL
    - MKNOD
    - SETUID
    - SETGID
  volumes:
    - configMap
    - csi
    - downwardAPI
    - emptyDir
    - ephemeral
    - image
    - persistentVolumeClaim
    - projected
    - secret
  readOnlyRootFilesystem: false
---
apiVersion: security.alauda.io/v1alpha1
kind: SecurityContextConstraints
metadata:
  name: nonroot-v2
spec:
  priority: 0
  restrictiveScore: 95
  allowPrivilegedContainer: false
  allowPrivilegeEscalation: false
  allowHostNetwork: false
  allowHostPID: false
  allowHostIPC: false
  allowHostPorts: false
  allowHostDirVolumePlugin: false
  runAsUser:
    type: MustRunAsNonRoot
  seLinuxContext:
    type: MustRunAs
  fsGroup:
    type: RunAsAny
  supplementalGroups:
    type: RunAsAny
  allowedCapabilities:
    - NET_BIND_SERVICE
  requiredDropCapabilities:
    - ALL
  volumes:
    - configMap
    - csi
    - downwardAPI
    - emptyDir
    - ephemeral
    - image
    - persistentVolumeClaim
    - projected
    - secret
  seccompProfiles:
    - runtime/default
---
apiVersion: security.alauda.io/v1alpha1
kind: SecurityContextConstraints
metadata:
  name: nonroot
spec:
  priority: 0
  restrictiveScore: 92
  allowPrivilegedContainer: false
  allowPrivilegeEscalation: true
  allowHostNetwork: false
  allowHostPID: false
  allowHostIPC: false
  allowHostPorts: false
  allowHostDirVolumePlugin: false
  runAsUser:
    type: MustRunAsNonRoot
  seLinuxContext:
    type: MustRunAs
  fsGroup:
    type: RunAsAny
  supplementalGroups:
    type: RunAsAny
  allowedCapabilities: []
  requiredDropCapabilities:
    - KILL
    - MKNOD
    - SETUID
    - SETGID
  volumes:
    - configMap
    - csi
    - downwardAPI
    - emptyDir
    - ephemeral
    - image
    - persistentVolumeClaim
    - projected
    - secret
  readOnlyRootFilesystem: false
---
apiVersion: security.alauda.io/v1alpha1
kind: SecurityContextConstraints
metadata:
  name: hostnetwork-v2
spec:
  priority: 0
  restrictiveScore: 70
  allowPrivilegedContainer: false
  allowPrivilegeEscalation: false
  allowHostNetwork: true
  allowHostPID: false
  allowHostIPC: false
  allowHostPorts: true
  allowHostDirVolumePlugin: false
  runAsUser:
    type: MustRunAsRange
    uidRangeMin: 1
    uidRangeMax: 2147483647
  seLinuxContext:
    type: MustRunAs
  fsGroup:
    type: MustRunAs
  supplementalGroups:
    type: MustRunAs
  allowedCapabilities:
    - NET_BIND_SERVICE
  requiredDropCapabilities:
    - ALL
  volumes:
    - configMap
    - csi
    - downwardAPI
    - emptyDir
    - ephemeral
    - image
    - persistentVolumeClaim
    - projected
    - secret
  seccompProfiles:
    - runtime/default
---
apiVersion: security.alauda.io/v1alpha1
kind: SecurityContextConstraints
metadata:
  name: hostnetwork
spec:
  priority: 0
  restrictiveScore: 68
  allowPrivilegedContainer: false
  allowPrivilegeEscalation: true
  allowHostNetwork: true
  allowHostPID: false
  allowHostIPC: false
  allowHostPorts: true
  allowHostDirVolumePlugin: false
  runAsUser:
    type: MustRunAsRange
    uidRangeMin: 1
    uidRangeMax: 2147483647
  seLinuxContext:
    type: MustRunAs
  fsGroup:
    type: MustRunAs
  supplementalGroups:
    type: MustRunAs
  allowedCapabilities: []
  requiredDropCapabilities:
    - KILL
    - MKNOD
    - SETUID
    - SETGID
  volumes:
    - configMap
    - csi
    - downwardAPI
    - emptyDir
    - ephemeral
    - image
    - persistentVolumeClaim
    - projected
    - secret
  readOnlyRootFilesystem: false
---
apiVersion: security.alauda.io/v1alpha1
kind: SecurityContextConstraints
metadata:
  name: anyuid
spec:
  priority: 10
  restrictiveScore: 60
  allowPrivilegedContainer: false
  allowPrivilegeEscalation: true
  allowHostNetwork: false
  allowHostPID: false
  allowHostIPC: false
  allowHostPorts: false
  allowHostDirVolumePlugin: false
  runAsUser:
    type: RunAsAny
  seLinuxContext:
    type: MustRunAs
  fsGroup:
    type: RunAsAny
  supplementalGroups:
    type: RunAsAny
  allowedCapabilities: []
  requiredDropCapabilities:
    - MKNOD
  volumes:
    - configMap
    - csi
    - downwardAPI
    - emptyDir
    - ephemeral
    - image
    - persistentVolumeClaim
    - projected
    - secret
---
apiVersion: security.alauda.io/v1alpha1
kind: SecurityContextConstraints
metadata:
  name: nested-container
spec:
  priority: 0
  restrictiveScore: 58
  allowPrivilegedContainer: false
  allowPrivilegeEscalation: true
  allowHostNetwork: false
  allowHostPID: false
  allowHostIPC: false
  allowHostPorts: false
  allowHostDirVolumePlugin: false
  runAsUser:
    type: MustRunAsRange
    uidRangeMin: 0
    uidRangeMax: 65534
  seLinuxContext:
    type: MustRunAs
    seLinuxOptions:
      type: container_engine_t
  fsGroup:
    type: MustRunAs
    ranges:
      - min: 0
        max: 65534
  supplementalGroups:
    type: MustRunAs
    ranges:
      - min: 0
        max: 65534
  userNamespaceLevel: RequirePodLevel
  allowedCapabilities:
    - SETUID
    - SETGID
  requiredDropCapabilities: []
  volumes:
    - configMap
    - csi
    - downwardAPI
    - emptyDir
    - ephemeral
    - image
    - persistentVolumeClaim
    - projected
    - secret
  seccompProfiles:
    - '*'
  readOnlyRootFilesystem: false
---
apiVersion: security.alauda.io/v1alpha1
kind: SecurityContextConstraints
metadata:
  name: hostmount-anyuid
spec:
  priority: 0
  restrictiveScore: 55
  allowPrivilegedContainer: false
  allowPrivilegeEscalation: true
  allowHostNetwork: false
  allowHostPID: false
  allowHostIPC: false
  allowHostPorts: false
  allowHostDirVolumePlugin: true
  runAsUser:
    type: RunAsAny
  seLinuxContext:
    type: MustRunAs
  fsGroup:
    type: RunAsAny
  supplementalGroups:
    type: RunAsAny
  allowedCapabilities: []
  requiredDropCapabilities:
    - MKNOD
  volumes:
    - configMap
    - csi
    - downwardAPI
    - emptyDir
    - ephemeral
    - hostPath
    - image
    - nfs
    - persistentVolumeClaim
    - projected
    - secret
  readOnlyRootFilesystem: false
---
apiVersion: security.alauda.io/v1alpha1
kind: SecurityContextConstraints
metadata:
  name: hostmount-anyuid-v2
spec:
  priority: 0
  restrictiveScore: 50
  allowPrivilegedContainer: false
  allowPrivilegeEscalation: true
  allowHostNetwork: false
  allowHostPID: false
  allowHostIPC: false
  allowHostPorts: false
  allowHostDirVolumePlugin: true
  runAsUser:
    type: RunAsAny
  seLinuxContext:
    type: RunAsAny
  fsGroup:
    type: RunAsAny
  supplementalGroups:
    type: RunAsAny
  allowedCapabilities: []
  requiredDropCapabilities:
    - MKNOD
  volumes:
    - configMap
    - csi
    - downwardAPI
    - emptyDir
    - ephemeral
    - hostPath
    - image
    - nfs
    - persistentVolumeClaim
    - projected
    - secret
---
apiVersion: security.alauda.io/v1alpha1
kind: SecurityContextConstraints
metadata:
  name: hostaccess
spec:
  priority: 0
  restrictiveScore: 40
  allowPrivilegedContainer: false
  allowPrivilegeEscalation: true
  allowHostNetwork: true
  allowHostPID: true
  allowHostIPC: true
  allowHostPorts: true
  allowHostDirVolumePlugin: true
  runAsUser:
    type: MustRunAsRange
    uidRangeMin: 1
    uidRangeMax: 2147483647
  seLinuxContext:
    type: MustRunAs
  fsGroup:
    type: MustRunAs
  supplementalGroups:
    type: RunAsAny
  allowedCapabilities: []
  requiredDropCapabilities:
    - KILL
    - MKNOD
    - SETUID
    - SETGID
  volumes:
    - configMap
    - csi
    - downwardAPI
    - emptyDir
    - ephemeral
    - hostPath
    - image
    - persistentVolumeClaim
    - projected
    - secret
---
apiVersion: security.alauda.io/v1alpha1
kind: SecurityContextConstraints
metadata:
  name: privileged
spec:
  priority: 0
  restrictiveScore: 0
  allowPrivilegedContainer: true
  allowPrivilegeEscalation: true
  allowHostNetwork: true
  allowHostPID: true
  allowHostIPC: true
  allowHostPorts: true
  allowHostDirVolumePlugin: true
  runAsUser:
    type: RunAsAny
  seLinuxContext:
    type: RunAsAny
  fsGroup:
    type: RunAsAny
  supplementalGroups:
    type: RunAsAny
  allowedCapabilities:
    - '*'
  requiredDropCapabilities: []
  volumes:
    - '*'
  seccompProfiles:
    - '*'
  allowedUnsafeSysctls:
    - '*'
```

Apply the profiles:

```shell
kubectl apply -f scc-profiles.yaml
kubectl get scc
```

You should see all 13 profiles listed with their `Priority` and `Score` columns populated (along with other SCC columns such as `Priv`, `RunAsUser`, and `Volumes`).

#### Step 1.3 — Install GlobalContextEntries, Kyverno reader RBAC, and admission policies

This step installs three things at once:

1. **GlobalContextEntries (GCE)** — five in-memory caches that Kyverno uses to look up SCC profiles, ClusterRoles, ClusterRoleBindings, RoleBindings, and Roles during admission, without making API calls per request.
2. **Reader RBAC** — a ClusterRole granting Kyverno's three service accounts read access to the SCC CRD, the four RBAC resources above, and the Pod / `pods/ephemeralcontainers` resources that the policies match.
3. **Two admission policies** — one `MutatingPolicy` that fills in defaults from the chosen SCC, and one `ValidatingPolicy` that rejects Pods that no granted SCC accepts.

::: warning
The two policies contain the CEL logic that drives SCC selection and validation. You do **not** need to read or understand the CEL to use this engine — apply the manifests as-is. The expressions are long because they replicate the OpenShift SCC admission algorithm field-by-field.
:::

Save the following as `scc-gce.yaml` and apply it:

```yaml
apiVersion: kyverno.io/v2alpha1
kind: GlobalContextEntry
metadata:
  name: scc-profiles
spec:
  kubernetesResource:
    group: security.alauda.io
    version: v1alpha1
    resource: securitycontextconstraints
  projections:
    - name: items
      jmesPath: "@"
---
apiVersion: kyverno.io/v2alpha1
kind: GlobalContextEntry
metadata:
  name: scc-clusterroles
spec:
  kubernetesResource:
    group: rbac.authorization.k8s.io
    version: v1
    resource: clusterroles
  projections:
    - name: items
      jmesPath: "@"
---
apiVersion: kyverno.io/v2alpha1
kind: GlobalContextEntry
metadata:
  name: scc-clusterrolebindings
spec:
  kubernetesResource:
    group: rbac.authorization.k8s.io
    version: v1
    resource: clusterrolebindings
  projections:
    - name: items
      jmesPath: "@"
---
apiVersion: kyverno.io/v2alpha1
kind: GlobalContextEntry
metadata:
  name: scc-rolebindings
spec:
  kubernetesResource:
    group: rbac.authorization.k8s.io
    version: v1
    resource: rolebindings
  projections:
    - name: items
      jmesPath: "@"
---
apiVersion: kyverno.io/v2alpha1
kind: GlobalContextEntry
metadata:
  name: scc-roles
spec:
  kubernetesResource:
    group: rbac.authorization.k8s.io
    version: v1
    resource: roles
  projections:
    - name: items
      jmesPath: "@"
```

Save the following as `scc-reader-rbac.yaml` and apply it. The `pods` and `pods/ephemeralcontainers` read permissions are required because Kyverno checks read access to every matched resource during the policy-readiness gate (`RBACPermissionsGranted`); without them, the mutating policy stays `NotReady`.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kyverno-scc-reader
rules:
  - apiGroups:
      - security.alauda.io
    resources:
      - securitycontextconstraints
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - rbac.authorization.k8s.io
    resources:
      - clusterroles
      - clusterrolebindings
      - rolebindings
      - roles
    verbs:
      - get
      - list
      - watch
  - apiGroups:
      - ""
    resources:
      - pods
      - pods/ephemeralcontainers
    verbs:
      - get
      - list
      - watch
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kyverno-scc-reader
subjects:
  - kind: ServiceAccount
    name: kyverno-admission-controller
    namespace: kyverno
  - kind: ServiceAccount
    name: kyverno-background-controller
    namespace: kyverno
  - kind: ServiceAccount
    name: kyverno-reports-controller
    namespace: kyverno
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: kyverno-scc-reader
```

Save the following as `scc-auto-pick.yaml`. This is the `ValidatingPolicy` that rejects Pods which no granted SCC accepts.

::: warning
The example below is configured with `validationActions: [Deny]`. On an existing cluster, change it to `validationActions: [Warn]` before the first apply, then switch it back to `Deny` after you have reviewed warnings and created the required SCC bindings. See Step 1.4 for the rollout process.
:::

```yaml
apiVersion: policies.kyverno.io/v1alpha1
kind: ValidatingPolicy
metadata:
  name: scc-auto-pick
  annotations:
    policies.kyverno.io/title: SCC Auto-Pick (CEL, CRD + RBAC)
    pod-policies.kyverno.io/autogen-controllers: "none"
spec:
  autogen:
    podControllers:
      controllers: []
    validatingAdmissionPolicy:
      enabled: false
  evaluation:
    admission:
      enabled: true
    background:
      enabled: false
  failurePolicy: Fail
  validationActions:
    - Deny
  matchConstraints:
    resourceRules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE", "UPDATE"]
        resources: ["pods"]
  matchConditions:
    - name: skip-system-ns
      expression: |
        !(request.namespace.startsWith('kube-') ||
          request.namespace.startsWith('cpaas-') ||
          request.namespace.startsWith('alauda-') ||
          request.namespace == 'kyverno' ||
          request.namespace == 'cattle-system' ||
          request.namespace == 'operators' ||
          request.namespace == 'default')

  variables:
    - name: containers
      expression: |
        object.spec.containers + object.spec.?initContainers.orValue([]) +
        object.spec.?ephemeralContainers.orValue([])

    - name: required
      expression: object.metadata.?annotations[?'alauda.io/required-scc'].orValue('')

    - name: profiles
      expression: |
        cel.bind(items, globalContext.Get('scc-profiles', 'items'),
          items == null ? [] : items)

    - name: subjectMatches
      expression: |
        [
          {'kind':'ServiceAccount',
           'name': string(object.spec.?serviceAccountName.orValue('default')),
           'namespace': string(request.namespace)},
          {'kind':'Group', 'name':'system:serviceaccounts'},
          {'kind':'Group', 'name':'system:serviceaccounts:'+request.namespace},
          {'kind':'Group', 'name':'system:authenticated'},
          {'kind':'User',  'name': request.userInfo.username}
        ]
        + request.userInfo.groups.map(g, {'kind':'Group','name': g})

    - name: rolebindings
      expression: |
        cel.bind(rbs, globalContext.Get('scc-rolebindings','items'),
          rbs == null ? [] : rbs)

    - name: matchedClusterRoleRefsFromCRB
      expression: |
        cel.bind(crbs, globalContext.Get('scc-clusterrolebindings','items'),
          crbs == null ? [] : crbs)
        .filter(b, b.?roleRef.?kind.orValue('') == 'ClusterRole'
                && b.?subjects.orValue([]).exists(s,
            variables.subjectMatches.exists(m,
              s.kind == m.kind && s.name == m.name &&
              (s.kind != 'ServiceAccount' ||
               s.?namespace.orValue('') == m.?namespace.orValue('')))))
        .map(b, b.roleRef.name)

    - name: matchedClusterRoleRefsFromRB
      expression: |
        variables.rolebindings
          .filter(b, b.?metadata.?namespace.orValue('') == request.namespace
                  && b.?roleRef.?kind.orValue('') == 'ClusterRole'
                  && b.?subjects.orValue([]).exists(s,
              variables.subjectMatches.exists(m,
                s.kind == m.kind && s.name == m.name &&
                (s.kind != 'ServiceAccount' ||
                 s.?namespace.orValue('') == m.?namespace.orValue('')))))
          .map(b, b.roleRef.name)

    - name: matchedRoleRefsFromRB
      expression: |
        variables.rolebindings
          .filter(b, b.?metadata.?namespace.orValue('') == request.namespace
                  && b.?roleRef.?kind.orValue('') == 'Role'
                  && b.?subjects.orValue([]).exists(s,
              variables.subjectMatches.exists(m,
                s.kind == m.kind && s.name == m.name &&
                (s.kind != 'ServiceAccount' ||
                 s.?namespace.orValue('') == m.?namespace.orValue('')))))
          .map(b, b.roleRef.name)

    - name: matchedClusterRoleRefs
      expression: |
        variables.matchedClusterRoleRefsFromCRB + variables.matchedClusterRoleRefsFromRB

    - name: allSccNames
      expression: |
        variables.profiles.map(p, p.metadata.name)

    - name: assignedFromClusterRoles
      expression: |
        cel.bind(crs, globalContext.Get('scc-clusterroles','items'),
          crs == null ? [] : crs)
          .filter(r, variables.matchedClusterRoleRefs.exists(n, n == r.metadata.name))
          .map(r, r.?rules.orValue([])
            .filter(ru,
              ru.?apiGroups.orValue([]).exists(g, g == 'security.alauda.io' || g == '*') &&
              ru.?resources.orValue([]).exists(x, x == 'securitycontextconstraints' || x == '*') &&
              ru.?verbs.orValue([]).exists(v, v == 'use' || v == '*'))
            .map(ru,
              ru.?resourceNames.orValue([]).size() == 0
                ? variables.allSccNames
                : ru.resourceNames)
          )
          .flatten()
          .flatten()

    - name: assignedFromRoles
      expression: |
        cel.bind(roles, globalContext.Get('scc-roles','items'),
          roles == null ? [] : roles)
          .filter(r,
            r.?metadata.?namespace.orValue('') == request.namespace
            && variables.matchedRoleRefsFromRB.exists(n, n == r.metadata.name))
          .map(r, r.?rules.orValue([])
            .filter(ru,
              ru.?apiGroups.orValue([]).exists(g, g == 'security.alauda.io' || g == '*') &&
              ru.?resources.orValue([]).exists(x, x == 'securitycontextconstraints' || x == '*') &&
              ru.?verbs.orValue([]).exists(v, v == 'use' || v == '*'))
            .map(ru,
              ru.?resourceNames.orValue([]).size() == 0
                ? variables.allSccNames
                : ru.resourceNames)
          )
          .flatten()
          .flatten()

    - name: assigned
      expression: |
        (variables.assignedFromClusterRoles + variables.assignedFromRoles)
          .filter(n, variables.allSccNames.exists(s, s == n))

    - name: safeSysctls
      expression: |
        ['kernel.shm_rmid_forced',
         'net.ipv4.ip_local_port_range',
         'net.ipv4.ip_unprivileged_port_start',
         'net.ipv4.tcp_syncookies',
         'net.ipv4.ping_group_range']

    - name: vtypes
      expression: |
        ['hostPath','emptyDir','gcePersistentDisk','awsElasticBlockStore','gitRepo',
         'secret','nfs','iscsi','glusterfs','persistentVolumeClaim','rbd','flexVolume',
         'cinder','cephfs','flocker','downwardAPI','fc','azureFile','configMap',
         'vsphereVolume','quobyte','azureDisk','photonPersistentDisk','projected',
         'portworxVolume','scaleIO','storageos','csi','ephemeral','image']

    - name: ordered
      expression: |
        variables.assigned.sortBy(n,
          int(variables.profiles.filter(pr, pr.metadata.name == n)[?0].orValue({}).?spec.?priority.orValue(0)) * -100000 +
          -int(variables.profiles.filter(pr, pr.metadata.name == n)[?0].orValue({}).?spec.?restrictiveScore.orValue(100))
        )
    - name: requiredExists
      expression: variables.required == '' || variables.profiles.exists(pr, pr.metadata.name == variables.required)
    - name: requiredBound
      expression: variables.required == '' || variables.assigned.exists(n, n == variables.required)
    - name: candidateNames
      expression: |
        variables.required != ''
          ? [variables.required]
          : variables.ordered

    - name: matched
      expression: |
        variables.candidateNames.exists(n,
          cel.bind(p, variables.profiles.filter(pr, pr.metadata.name == n)[?0].orValue({}).?spec.orValue({}),
             (p.?allowPrivilegedContainer.orValue(false)
               || !variables.containers.exists(c, c.?securityContext.?privileged.orValue(false)))
          && (p.?allowPrivilegeEscalation.orValue(true)
               || !variables.containers.exists(c, c.?securityContext.?allowPrivilegeEscalation.orValue(true)))
          && (p.?allowHostNetwork.orValue(false) || !object.spec.?hostNetwork.orValue(false))
          && (p.?allowHostPID.orValue(false)     || !object.spec.?hostPID.orValue(false))
          && (p.?allowHostIPC.orValue(false)     || !object.spec.?hostIPC.orValue(false))
          && (p.?allowHostDirVolumePlugin.orValue(false)
               || !object.spec.?volumes.orValue([]).exists(v, has(v.hostPath)))
          && (
               p.?runAsUser.?type.orValue('RunAsAny') == 'RunAsAny'
               || (
                    (p.?runAsUser.?type.orValue('RunAsAny') in ['MustRunAsNonRoot','MustRunAsNonRootOrSystem'])
                    && !variables.containers.exists(c, c.?securityContext.?runAsUser.orValue(
                         object.spec.?securityContext.?runAsUser.orValue(1)) == 0)
                  )
               || (
                    p.?runAsUser.?type.orValue('RunAsAny') == 'MustRunAs'
                    && variables.containers.all(c, c.?securityContext.?runAsUser.orValue(
                         object.spec.?securityContext.?runAsUser.orValue(1))
                         == p.?runAsUser.?uid.orValue(-1))
                  )
               || (
                    p.?runAsUser.?type.orValue('RunAsAny') == 'MustRunAsRange'
                    && variables.containers.all(c,
                         c.?securityContext.?runAsUser.orValue(
                           object.spec.?securityContext.?runAsUser.orValue(1))
                           >= p.?runAsUser.?uidRangeMin.orValue(1)
                         && c.?securityContext.?runAsUser.orValue(
                              object.spec.?securityContext.?runAsUser.orValue(1))
                           <= p.?runAsUser.?uidRangeMax.orValue(2147483647))
                  )
             )
          && (p.?allowedCapabilities.orValue([]).exists(t, t == '*')
               || variables.containers.all(c,
                    c.?securityContext.?capabilities.?add.orValue([]).all(cap,
                      p.?allowedCapabilities.orValue([]).exists(a, a == cap))))
          && (p.?requiredDropCapabilities.orValue([]).size() == 0
               || variables.containers.all(c,
                    p.?requiredDropCapabilities.orValue([]).all(req,
                      c.?securityContext.?capabilities.?drop.orValue([]).exists(d, d == req || d == 'ALL'))))
          && (p.?volumes.orValue(['*']).exists(t, t == '*')
               || object.spec.?volumes.orValue([]).all(v,
                    variables.vtypes.filter(t, v[?t].hasValue()).all(t,
                      p.?volumes.orValue([]).exists(a, a == t))))
          && (p.?allowHostPorts.orValue(false)
               || variables.containers.all(c,
                    c.?ports.orValue([]).all(port, port.?hostPort.orValue(0) == 0)))
          && (p.?allowedUnsafeSysctls.orValue([]).exists(t, t == '*')
               || object.spec.?securityContext.?sysctls.orValue([]).all(s,
                    variables.safeSysctls.exists(safe, safe == s.name)
                    || p.?allowedUnsafeSysctls.orValue([]).exists(a, a == s.name)))
          && (!p.?readOnlyRootFilesystem.orValue(false)
               || variables.containers.all(c, c.?securityContext.?readOnlyRootFilesystem.orValue(false) == true))
          && (p.?seccompProfiles.orValue([]).size() == 0
               || p.?seccompProfiles.orValue([]).exists(t, t == '*')
               || variables.containers.all(c,
                    p.?seccompProfiles.orValue([]).exists(a,
                      (c.?securityContext.?seccompProfile.?type.orValue(
                         object.spec.?securityContext.?seccompProfile.?type.orValue('')) == 'RuntimeDefault'
                         && a == 'runtime/default')
                      || (c.?securityContext.?seccompProfile.?type.orValue(
                         object.spec.?securityContext.?seccompProfile.?type.orValue('')) == 'Unconfined'
                         && a == 'unconfined')
                      || (c.?securityContext.?seccompProfile.?type.orValue(
                         object.spec.?securityContext.?seccompProfile.?type.orValue('')) == 'Localhost'
                         && a == 'localhost/' + c.?securityContext.?seccompProfile.?localhostProfile.orValue(
                              object.spec.?securityContext.?seccompProfile.?localhostProfile.orValue(''))))))
          && (p.?allowedFlexVolumes.orValue([]).size() == 0
               || object.spec.?volumes.orValue([]).filter(v, v.?flexVolume.hasValue()).all(v,
                    p.?allowedFlexVolumes.orValue([]).exists(d, d.?driver.orValue('') == v.flexVolume.driver)))
          )
        )

  validations:
    - expression: variables.requiredExists
      message: "required-scc does not exist"
      messageExpression: |
        "required SCC '" + variables.required + "' not found in scc-profiles"
    - expression: variables.requiredBound
      message: "required-scc is not bound to ServiceAccount"
      messageExpression: |
        "required SCC '" + variables.required +
        "' is not bound to ServiceAccount '" +
        object.spec.?serviceAccountName.orValue('default') +
        "' in namespace '" + request.namespace + "'"
    - expression: variables.matched
      message: "Pod violates all SCCs assigned to its ServiceAccount"
      messageExpression: |
        variables.required != ''
        ? ("Pod " + object.metadata.name +
           " does not satisfy required SCC '" + variables.required + "'")
        : ("Pod " + object.metadata.name +
           " does not satisfy any SCC profile assigned to ServiceAccount '" +
           object.spec.?serviceAccountName.orValue('default') +
           "' in namespace '" + request.namespace +
           "' (candidates: " + variables.ordered.join(",") + ")")
```

Save the following as `scc-fill-defaults.yaml` and apply it. This is the `MutatingPolicy` that records the selected SCC on the Pod (`alauda.io/scc` annotation) and fills in `runAsUser`, `seccompProfile`, and `allowPrivilegeEscalation` defaults inherited from that SCC.

```yaml
apiVersion: policies.kyverno.io/v1alpha1
kind: MutatingPolicy
metadata:
  name: scc-fill-defaults
  annotations:
    policies.kyverno.io/title: SCC default value filler (CRD + RBAC, explicit-wins)
    pod-policies.kyverno.io/autogen-controllers: "none"
spec:
  autogen:
    podControllers:
      controllers: []
  evaluation:
    admission:
      enabled: true
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE"]
        resources: ["pods"]
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["UPDATE"]
        resources: ["pods/ephemeralcontainers"]
  matchConditions:
    - name: skip-system-ns
      expression: |
        !(request.namespace.startsWith('kube-') ||
          request.namespace.startsWith('cpaas-') ||
          request.namespace.startsWith('alauda-') ||
          request.namespace == 'kyverno' ||
          request.namespace == 'cattle-system' ||
          request.namespace == 'operators' ||
          request.namespace == 'default')

  variables:
    - name: containers
      expression: |
        object.spec.containers + object.spec.?initContainers.orValue([]) +
        object.spec.?ephemeralContainers.orValue([])
    - name: required
      expression: object.metadata.?annotations[?'alauda.io/required-scc'].orValue('')

    - name: profiles
      expression: |
        cel.bind(items, globalContext.Get('scc-profiles', 'items'),
          items == null ? [] : items)

    - name: subjectMatches
      expression: |
        [
          {'kind':'ServiceAccount',
           'name': string(object.spec.?serviceAccountName.orValue('default')),
           'namespace': string(object.metadata.namespace)},
          {'kind':'Group', 'name':'system:serviceaccounts'},
          {'kind':'Group', 'name':'system:serviceaccounts:'+object.metadata.namespace},
          {'kind':'Group', 'name':'system:authenticated'},
          {'kind':'User',  'name': request.userInfo.username}
        ]
        + request.userInfo.groups.map(g, {'kind':'Group','name': g})
    - name: rolebindings
      expression: |
        cel.bind(rbs, globalContext.Get('scc-rolebindings','items'),
          rbs == null ? [] : rbs)
    - name: matchedClusterRoleRefsFromCRB
      expression: |
        cel.bind(crbs, globalContext.Get('scc-clusterrolebindings','items'),
          crbs == null ? [] : crbs)
        .filter(b, b.?roleRef.?kind.orValue('') == 'ClusterRole'
                && b.?subjects.orValue([]).exists(s,
            variables.subjectMatches.exists(m,
              s.kind == m.kind && s.name == m.name &&
              (s.kind != 'ServiceAccount' ||
               s.?namespace.orValue('') == m.?namespace.orValue('')))))
        .map(b, b.roleRef.name)
    - name: matchedClusterRoleRefsFromRB
      expression: |
        variables.rolebindings
          .filter(b, b.?metadata.?namespace.orValue('') == object.metadata.namespace
                  && b.?roleRef.?kind.orValue('') == 'ClusterRole'
                  && b.?subjects.orValue([]).exists(s,
              variables.subjectMatches.exists(m,
                s.kind == m.kind && s.name == m.name &&
                (s.kind != 'ServiceAccount' ||
                 s.?namespace.orValue('') == m.?namespace.orValue('')))))
          .map(b, b.roleRef.name)
    - name: matchedRoleRefsFromRB
      expression: |
        variables.rolebindings
          .filter(b, b.?metadata.?namespace.orValue('') == object.metadata.namespace
                  && b.?roleRef.?kind.orValue('') == 'Role'
                  && b.?subjects.orValue([]).exists(s,
              variables.subjectMatches.exists(m,
                s.kind == m.kind && s.name == m.name &&
                (s.kind != 'ServiceAccount' ||
                 s.?namespace.orValue('') == m.?namespace.orValue('')))))
          .map(b, b.roleRef.name)
    - name: matchedClusterRoleRefs
      expression: |
        variables.matchedClusterRoleRefsFromCRB + variables.matchedClusterRoleRefsFromRB
    - name: allSccNames
      expression: |
        variables.profiles.map(p, p.metadata.name)
    - name: assignedFromClusterRoles
      expression: |
        cel.bind(crs, globalContext.Get('scc-clusterroles','items'),
          crs == null ? [] : crs)
          .filter(r, variables.matchedClusterRoleRefs.exists(n, n == r.metadata.name))
          .map(r, r.?rules.orValue([])
            .filter(ru,
              ru.?apiGroups.orValue([]).exists(g, g == 'security.alauda.io' || g == '*') &&
              ru.?resources.orValue([]).exists(x, x == 'securitycontextconstraints' || x == '*') &&
              ru.?verbs.orValue([]).exists(v, v == 'use' || v == '*'))
            .map(ru,
              ru.?resourceNames.orValue([]).size() == 0
                ? variables.allSccNames
                : ru.resourceNames)
          )
          .flatten()
          .flatten()

    - name: assignedFromRoles
      expression: |
        cel.bind(roles, globalContext.Get('scc-roles','items'),
          roles == null ? [] : roles)
          .filter(r,
            r.?metadata.?namespace.orValue('') == object.metadata.namespace
            && variables.matchedRoleRefsFromRB.exists(n, n == r.metadata.name))
          .map(r, r.?rules.orValue([])
            .filter(ru,
              ru.?apiGroups.orValue([]).exists(g, g == 'security.alauda.io' || g == '*') &&
              ru.?resources.orValue([]).exists(x, x == 'securitycontextconstraints' || x == '*') &&
              ru.?verbs.orValue([]).exists(v, v == 'use' || v == '*'))
            .map(ru,
              ru.?resourceNames.orValue([]).size() == 0
                ? variables.allSccNames
                : ru.resourceNames)
          )
          .flatten()
          .flatten()

    - name: assigned
      expression: |
        (variables.assignedFromClusterRoles + variables.assignedFromRoles)
          .filter(n, variables.allSccNames.exists(s, s == n))

    - name: safeSysctls
      expression: |
        ['kernel.shm_rmid_forced',
         'net.ipv4.ip_local_port_range',
         'net.ipv4.ip_unprivileged_port_start',
         'net.ipv4.tcp_syncookies',
         'net.ipv4.ping_group_range']
    - name: vtypes
      expression: |
        ['hostPath','emptyDir','gcePersistentDisk','awsElasticBlockStore','gitRepo',
         'secret','nfs','iscsi','glusterfs','persistentVolumeClaim','rbd','flexVolume',
         'cinder','cephfs','flocker','downwardAPI','fc','azureFile','configMap',
         'vsphereVolume','quobyte','azureDisk','photonPersistentDisk','projected',
         'portworxVolume','scaleIO','storageos','csi','ephemeral','image']

    - name: ordered
      expression: |
        variables.assigned.sortBy(n,
          int(variables.profiles.filter(pr, pr.metadata.name == n)[?0].orValue({}).?spec.?priority.orValue(0)) * -100000 +
          -int(variables.profiles.filter(pr, pr.metadata.name == n)[?0].orValue({}).?spec.?restrictiveScore.orValue(100))
        )
    - name: requiredExists
      expression: variables.required == '' || variables.profiles.exists(pr, pr.metadata.name == variables.required)
    - name: requiredBound
      expression: variables.required == '' || variables.assigned.exists(n, n == variables.required)
    - name: candidateNames
      expression: |
        variables.required != ''
          ? ((variables.requiredExists && variables.requiredBound) ? [variables.required] : [])
          : variables.ordered
    - name: isEphemeralSubresource
      expression: request.operation == 'UPDATE'
    - name: annotatedSelectedName
      expression: object.metadata.?annotations[?'alauda.io/scc'].orValue('')

    - name: matchedNames
      expression: |
        variables.candidateNames.filter(n,
          cel.bind(p, variables.profiles.filter(pr, pr.metadata.name == n)[?0].orValue({}).?spec.orValue({}),
            cel.bind(defaultPE, p.?defaultAllowPrivilegeEscalation.orValue(
                  p.?allowPrivilegeEscalation.orValue(true)),
              cel.bind(podRunAsUserForFill,
                    object.spec.?securityContext.?runAsUser.orValue(
                      (p.?runAsUser.?type.orValue('') == 'MustRunAs' && p.?runAsUser.?uid.hasValue())
                        ? p.?runAsUser.?uid.orValue(1)
                        : 1),
                cel.bind(seccompFirstForFill,
                      p.?seccompProfiles.orValue([]).filter(s, s != '' && s != '*')[?0].orValue(''),
                  cel.bind(fillSeccompType,
                        seccompFirstForFill == 'runtime/default' ? 'RuntimeDefault' :
                        seccompFirstForFill.startsWith('localhost/') ? 'Localhost' : '',
                    cel.bind(fillSeccompLocalhost,
                          fillSeccompType == 'Localhost'
                            ? seccompFirstForFill.substring('localhost/'.size()) : '',
                      cel.bind(needPodSeccompFillForMatch,
                            !object.spec.?securityContext.?seccompProfile.hasValue() &&
                            object.spec.containers.all(c, !c.?securityContext.?seccompProfile.hasValue()) &&
                            object.spec.?initContainers.orValue([]).all(c, !c.?securityContext.?seccompProfile.hasValue()),
                        (p.?allowPrivilegedContainer.orValue(false)
                          || !variables.containers.exists(c, c.?securityContext.?privileged.orValue(false)))
                        && (p.?allowPrivilegeEscalation.orValue(true)
                            || !variables.containers.exists(c, c.?securityContext.?allowPrivilegeEscalation.orValue(defaultPE)))
                        && (p.?allowHostNetwork.orValue(false) || !object.spec.?hostNetwork.orValue(false))
                        && (p.?allowHostPID.orValue(false)     || !object.spec.?hostPID.orValue(false))
                        && (p.?allowHostIPC.orValue(false)     || !object.spec.?hostIPC.orValue(false))
                        && (p.?allowHostDirVolumePlugin.orValue(false)
                            || !object.spec.?volumes.orValue([]).exists(v, has(v.hostPath)))
                        && (
                            p.?runAsUser.?type.orValue('RunAsAny') == 'RunAsAny'
                            || (
                                (p.?runAsUser.?type.orValue('RunAsAny') in ['MustRunAsNonRoot','MustRunAsNonRootOrSystem'])
                                && !variables.containers.exists(c, c.?securityContext.?runAsUser.orValue(
                                      podRunAsUserForFill) == 0)
                              )
                            || (
                                p.?runAsUser.?type.orValue('RunAsAny') == 'MustRunAs'
                                && variables.containers.all(c, c.?securityContext.?runAsUser.orValue(
                                      podRunAsUserForFill) == p.?runAsUser.?uid.orValue(-1))
                              )
                            || (
                                p.?runAsUser.?type.orValue('RunAsAny') == 'MustRunAsRange'
                                && variables.containers.all(c,
                                    c.?securityContext.?runAsUser.orValue(podRunAsUserForFill)
                                      >= p.?runAsUser.?uidRangeMin.orValue(1)
                                    && c.?securityContext.?runAsUser.orValue(podRunAsUserForFill)
                                      <= p.?runAsUser.?uidRangeMax.orValue(2147483647))
                              )
                          )
                        && (p.?allowedCapabilities.orValue([]).exists(t, t == '*')
                            || variables.containers.all(c,
                                c.?securityContext.?capabilities.?add.orValue([]).all(cap,
                                  p.?allowedCapabilities.orValue([]).exists(a, a == cap))))
                        && (p.?requiredDropCapabilities.orValue([]).size() == 0
                            || variables.containers.all(c,
                                p.?requiredDropCapabilities.orValue([]).all(req,
                                  c.?securityContext.?capabilities.?drop.orValue([]).exists(d, d == req || d == 'ALL'))))
                        && (p.?volumes.orValue(['*']).exists(t, t == '*')
                            || object.spec.?volumes.orValue([]).all(v,
                                variables.vtypes.filter(t, v[?t].hasValue()).all(t,
                                  p.?volumes.orValue([]).exists(a, a == t))))
                        && (p.?allowHostPorts.orValue(false)
                            || variables.containers.all(c,
                                c.?ports.orValue([]).all(port, port.?hostPort.orValue(0) == 0)))
                        && (p.?allowedUnsafeSysctls.orValue([]).exists(t, t == '*')
                            || object.spec.?securityContext.?sysctls.orValue([]).all(s,
                                variables.safeSysctls.exists(safe, safe == s.name)
                                || p.?allowedUnsafeSysctls.orValue([]).exists(a, a == s.name)))
                        && (!p.?readOnlyRootFilesystem.orValue(false)
                            || variables.containers.all(c, c.?securityContext.?readOnlyRootFilesystem.orValue(false) == true))
                        && (p.?seccompProfiles.orValue([]).size() == 0
                            || p.?seccompProfiles.orValue([]).exists(t, t == '*')
                            || variables.containers.all(c,
                                p.?seccompProfiles.orValue([]).exists(a,
                                  (c.?securityContext.?seccompProfile.?type.orValue(
                                      object.spec.?securityContext.?seccompProfile.?type.orValue(
                                        (needPodSeccompFillForMatch && fillSeccompType != '') ? fillSeccompType : '')) == 'RuntimeDefault'
                                    && a == 'runtime/default')
                                  || (c.?securityContext.?seccompProfile.?type.orValue(
                                      object.spec.?securityContext.?seccompProfile.?type.orValue(
                                        (needPodSeccompFillForMatch && fillSeccompType != '') ? fillSeccompType : '')) == 'Unconfined'
                                    && a == 'unconfined')
                                  || (c.?securityContext.?seccompProfile.?type.orValue(
                                      object.spec.?securityContext.?seccompProfile.?type.orValue(
                                        (needPodSeccompFillForMatch && fillSeccompType != '') ? fillSeccompType : '')) == 'Localhost'
                                    && a == 'localhost/' + c.?securityContext.?seccompProfile.?localhostProfile.orValue(
                                        object.spec.?securityContext.?seccompProfile.?localhostProfile.orValue(
                                          (needPodSeccompFillForMatch && fillSeccompType == 'Localhost')
                                            ? fillSeccompLocalhost : ''))))))
                        && (p.?allowedFlexVolumes.orValue([]).size() == 0
                            || object.spec.?volumes.orValue([]).filter(v, v.?flexVolume.hasValue()).all(v,
                                p.?allowedFlexVolumes.orValue([]).exists(d, d.?driver.orValue('') == v.flexVolume.driver)))
                      )
                    )
                  )
                )
              )
            )
          )
        )

    - name: selectedName
      expression: |
        variables.isEphemeralSubresource
          && variables.annotatedSelectedName != ''
          && variables.candidateNames.exists(n, n == variables.annotatedSelectedName)
          ? variables.annotatedSelectedName
          : variables.matchedNames[?0].orValue('')

    - name: selectedSpec
      expression: |
        variables.profiles.filter(pr, pr.metadata.name == variables.selectedName)[?0].orValue({}).?spec.orValue({})

    - name: defaultPE
      expression: |
        variables.selectedSpec.?defaultAllowPrivilegeEscalation.orValue(
          variables.selectedSpec.?allowPrivilegeEscalation.orValue(true))

    - name: seccompFirst
      expression: |
        variables.selectedSpec.?seccompProfiles.orValue([])
          .filter(s, s != '' && s != '*')[?0].orValue('')
    - name: defaultSeccompType
      expression: |
        variables.seccompFirst == 'runtime/default' ? 'RuntimeDefault' :
        variables.seccompFirst.startsWith('localhost/') ? 'Localhost' : ''
    - name: defaultSeccompLocalhostProfile
      expression: |
        variables.defaultSeccompType == 'Localhost'
          ? variables.seccompFirst.substring('localhost/'.size()) : ''
    - name: needPodSeccomp
      expression: |
        variables.selectedName != '' && variables.defaultSeccompType != '' &&
        !object.spec.?securityContext.?seccompProfile.hasValue() &&
        object.spec.containers.all(c, !c.?securityContext.?seccompProfile.hasValue()) &&
        object.spec.?initContainers.orValue([]).all(c, !c.?securityContext.?seccompProfile.hasValue())

    - name: hasLiteralUid
      expression: |
        variables.selectedName != '' &&
        variables.selectedSpec.?runAsUser.?type.orValue('') == 'MustRunAs' &&
        variables.selectedSpec.?runAsUser.?uid.hasValue()
    - name: literalUid
      expression: |
        variables.hasLiteralUid ? variables.selectedSpec.?runAsUser.?uid.orValue(-1) : -1
    - name: needPodRunAsUser
      expression: |
        variables.hasLiteralUid &&
        !object.spec.?securityContext.?runAsUser.hasValue()

  mutations:
    - patchType: ApplyConfiguration
      applyConfiguration:
        expression: |
          (variables.isEphemeralSubresource || variables.selectedName == '') ? Object{} :
          Object{
            metadata: Object.metadata{
              annotations: {
                "alauda.io/scc": string(variables.selectedName)
              }
            }
          }

    - patchType: ApplyConfiguration
      applyConfiguration:
        expression: |
          (variables.isEphemeralSubresource || !variables.needPodRunAsUser) ? Object{} :
          Object{
            spec: Object.spec{
              securityContext: Object.spec.securityContext{
                runAsUser: variables.literalUid
              }
            }
          }

    - patchType: ApplyConfiguration
      applyConfiguration:
        expression: |
          (variables.isEphemeralSubresource || !variables.needPodSeccomp) ? Object{} :
          (variables.defaultSeccompType == 'Localhost') ?
          Object{
            spec: Object.spec{
              securityContext: Object.spec.securityContext{
                seccompProfile: Object.spec.securityContext.seccompProfile{
                  type: 'Localhost',
                  localhostProfile: variables.defaultSeccompLocalhostProfile
                }
              }
            }
          } :
          Object{
            spec: Object.spec{
              securityContext: Object.spec.securityContext{
                seccompProfile: Object.spec.securityContext.seccompProfile{
                  type: variables.defaultSeccompType
                }
              }
            }
          }

    - patchType: ApplyConfiguration
      applyConfiguration:
        expression: |
          (variables.isEphemeralSubresource || variables.selectedName == '') ? Object{} :
          Object{
            spec: Object.spec{
              containers: object.spec.containers.map(c, Object.spec.containers{
                name: c.name,
                securityContext: Object.spec.containers.securityContext{
                  allowPrivilegeEscalation:
                    c.?securityContext.?allowPrivilegeEscalation.hasValue()
                      ? c.securityContext.allowPrivilegeEscalation
                      : variables.defaultPE
                }
              })
            }
          }

    - patchType: ApplyConfiguration
      applyConfiguration:
        expression: |
          (variables.isEphemeralSubresource || variables.selectedName == '' || !object.spec.?initContainers.hasValue()) ? Object{} :
          Object{
            spec: Object.spec{
              initContainers: object.spec.initContainers.map(c, Object.spec.initContainers{
                name: c.name,
                securityContext: Object.spec.initContainers.securityContext{
                  allowPrivilegeEscalation:
                    c.?securityContext.?allowPrivilegeEscalation.hasValue()
                      ? c.securityContext.allowPrivilegeEscalation
                      : variables.defaultPE
                }
              })
            }
          }

    - patchType: ApplyConfiguration
      applyConfiguration:
        expression: |
          (!variables.isEphemeralSubresource || variables.selectedName == '' || !object.spec.?ephemeralContainers.hasValue()) ? Object{} :
          Object{
            spec: Object.spec{
              ephemeralContainers: object.spec.ephemeralContainers.map(c, Object.spec.ephemeralContainers{
                name: c.name,
                securityContext: Object.spec.ephemeralContainers.securityContext{
                  allowPrivilegeEscalation:
                    c.?securityContext.?allowPrivilegeEscalation.hasValue()
                      ? c.securityContext.allowPrivilegeEscalation
                      : variables.defaultPE
                }
              })
            }
          }
```

Both policies skip the following namespaces by default: namespaces starting with `kube-`, `cpaas-`, or `alauda-`, plus `kyverno`, `cattle-system`, `operators`, and `default`. Adjust the `skip-system-ns` expression in both policies if your platform uses different system namespaces.

#### Step 1.4 — Roll out safely with Warn → Deny

The validating policy is delivered with `failurePolicy: Fail` and `validationActions: [Deny]`, which means it rejects non-compliant Pods immediately. On an existing cluster, switching this on without preparation can break workloads whose ServiceAccounts have not yet been bound to any SCC.

Use a three-stage rollout:

1. **Warn before the first apply**. Before applying `scc-auto-pick.yaml` on an existing cluster, change `validationActions` to:

   ```yaml
   validationActions:
     - Warn
   ```

   Apply the file. The policy now attaches a warning to every admission response that would have been rejected, but admits the Pod. Watch the Kyverno admission controller logs to collect the affected workloads:

   ```shell
   kubectl logs -n kyverno -l app.kubernetes.io/component=admission-controller \
     --tail=500 | grep -i 'scc-auto-pick'
   ```

2. **Fix**. For each warned workload, add or correct the RBAC binding so that its ServiceAccount can `use` an appropriate SCC (see Part 2). Confirm with:

   ```shell
   kubectl auth can-i use \
     securitycontextconstraints.security.alauda.io/<scc-name> \
     --as="system:serviceaccount:<namespace>:<sa-name>" -n <namespace>
   ```

3. **Deny**. Once warnings stop arriving for legitimate workloads, switch back to `Deny` and re-apply:

   ```yaml
   validationActions:
     - Deny
   ```

::: tip
If you need to exempt an entire namespace temporarily, you can either add it to the `skip-system-ns` expression in both policies or create a `PolicyException` resource. See **Learn More** below for the `PolicyException` pattern.
:::

#### Step 1.5 — Verify the engine is ready

Run the following checks. All resources should be present and the two policies should be `READY=true`.

```shell
# 1. CRD is established and 13 profiles are loaded
kubectl get crd securitycontextconstraints.security.alauda.io
kubectl get scc

# 2. Five GCE caches exist
kubectl get globalcontextentry scc-profiles scc-clusterroles \
  scc-clusterrolebindings scc-rolebindings scc-roles

# 3. Two admission policies are ready
kubectl get validatingpolicy scc-auto-pick
kubectl get mutatingpolicy scc-fill-defaults

# 4. Reader RBAC is in place
kubectl get clusterrole kyverno-scc-reader
kubectl get clusterrolebinding kyverno-scc-reader
```

If `scc-fill-defaults` shows `READY=false`, the most common cause is missing read permission on `pods/ephemeralcontainers` — make sure Step 1.3's `kyverno-scc-reader` ClusterRole was applied in full.

### Part 2: Authorize workloads to use SCCs

With the engine installed, no Pod is granted any SCC by default. Until an administrator creates an RBAC binding for a ServiceAccount (or User, or Group), Pods running under that subject in non-system namespaces will be rejected with the message `Pod violates all SCCs assigned to its ServiceAccount`.

Treat each SCC binding as a security authorization decision. Grant SCC binding privileges only to platform administrators or security administrators; ordinary application users and namespace owners should not be able to grant themselves higher Pod privileges.

#### Step 2.1 — Choose the right SCC profile

Match the workload's security needs against the table below. By default, the engine ranks granted SCCs by `priority` first and `restrictiveScore` second. Pick the least-privilege profile set the workload needs, and use `alauda.io/required-scc` when you must force one specific profile.

| Workload characteristics | Recommended SCC |
|---|---|
| Stateless service, non-root, drops ALL capabilities, no host access | `restricted-v2` |
| Same as above, but needs to bind ports <1024 | `restricted-v2` (the profile already allows `NET_BIND_SERVICE`) |
| Same as above, but uses a fixed UID range like 1000–65534 and user namespaces | `restricted-v3` |
| Service that runs as a non-root user but cannot drop all capabilities | `nonroot-v2` (drops ALL) or `nonroot` (older drop set) |
| Image that requires running as root (`USER root`) | `anyuid` |
| Ingress controller or other Pod that needs `hostNetwork` and host ports | `hostnetwork-v2` (drops ALL) or `hostnetwork` (older drop set) |
| Service that mounts `hostPath` for log / metrics collection, runs as non-root | `hostmount-anyuid` |
| Same as above, but does not require SELinux relabeling | `hostmount-anyuid-v2` |
| Diagnostic Pod that needs `hostNetwork`, `hostPID`, `hostIPC` and host paths | `hostaccess` |
| Container-in-container build sandbox using user namespaces | `nested-container` |
| Fully privileged workload (CNI, storage drivers, debug pods) | `privileged` |

::: warning
Always grant the least privilege required. A ServiceAccount bound to `privileged` can run any Pod, including those that escape the container boundary. Reserve `privileged` for infrastructure DaemonSets and avoid granting it to user workloads.
:::

When an application manager requests SCC access, include:

- Namespace and ServiceAccount, for example `databases/postgres-sa`.
- Workload name and controller type, for example `StatefulSet/postgres`.
- The requested SCC or required capability, for example `anyuid` because the image runs as UID 0.
- Why a stricter SCC such as `restricted-v2` is not sufficient.
- Whether the workload must pin a specific SCC with `alauda.io/required-scc`.

#### Step 2.2 — Bind an SCC to a ServiceAccount

The most common administrator action is to bind an SCC to a workload ServiceAccount. Suppose you have an application running under `databases/postgres-sa` and the image runs as root (UID 0). You want this ServiceAccount to be allowed `anyuid`, while still keeping `restricted-v2` available for stricter workloads. In this root-UID example, `restricted-v2` does not match (`runAsUser.uidRangeMin: 1`), so admission selects `anyuid`. More generally, when a Pod satisfies both profiles, the default profile set in this guide prefers `anyuid` first because `anyuid` has higher `priority` than `restricted-v2` unless you adjust priorities or pin `alauda.io/required-scc`.

Save the following as `bind-postgres-sa.yaml`:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: scc-use-anyuid-restricted
  labels:
    rbac.alauda.io/scc-use: "true"
rules:
  - apiGroups: ["security.alauda.io"]
    resources: ["securitycontextconstraints"]
    resourceNames: ["anyuid", "restricted-v2"]
    verbs: ["use"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: postgres-sa-scc
  namespace: databases
  labels:
    rbac.alauda.io/scc-use: "true"
subjects:
  - kind: ServiceAccount
    name: postgres-sa
    namespace: databases
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: scc-use-anyuid-restricted
```

Apply:

```shell
kubectl apply -f bind-postgres-sa.yaml
```

The `rbac.alauda.io/scc-use=true` label is optional. It does not affect SCC selection, but lets you list all SCC-related RBAC objects with `kubectl get clusterrole,rolebinding -l rbac.alauda.io/scc-use=true -A`.

::: note
You can equally well use a `ClusterRoleBinding` to grant this namespaced ServiceAccount cluster-scoped `use` permission. A namespaced `RoleBinding` is usually clearer when you want the grant to apply only within one namespace.
:::

#### Step 2.3 — Bind an SCC to a User

When a trusted human operator (authenticated as a Kubernetes `User`, for example via OIDC or certificate) needs to launch Pods directly - for example, an SRE running `kubectl debug` or `kubectl run` - you can grant the SCC to the User principal.

Save as `bind-user-sre.yaml`, replacing `[email protected]` with your User name:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: scc-use-hostaccess
  labels:
    rbac.alauda.io/scc-use: "true"
rules:
  - apiGroups: ["security.alauda.io"]
    resources: ["securitycontextconstraints"]
    resourceNames: ["hostaccess"]
    verbs: ["use"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: sre-alice-hostaccess
  labels:
    rbac.alauda.io/scc-use: "true"
subjects:
  - kind: User
    name: [email protected]
    apiGroup: rbac.authorization.k8s.io
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: scc-use-hostaccess
```

Apply:

```shell
kubectl apply -f bind-user-sre.yaml
```

When `[email protected]` runs `kubectl run` directly (not via a controller's ServiceAccount), the Pod they create is admitted under their User identity and gets `hostaccess`.

#### Step 2.4 — Bind an SCC to a Group

Group bindings are useful for administrator-managed blanket policies, such as "every authenticated user can run `restricted-v2` Pods". Two synthesized groups are particularly relevant:

- `system:authenticated` — every authenticated principal.
- `system:serviceaccounts:<namespace>` — every ServiceAccount in a specific namespace.

Save as `bind-group-authenticated.yaml`:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: scc-use-restricted-v2
  labels:
    rbac.alauda.io/scc-use: "true"
rules:
  - apiGroups: ["security.alauda.io"]
    resources: ["securitycontextconstraints"]
    resourceNames: ["restricted-v2"]
    verbs: ["use"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: scc-use-restricted-v2-authenticated
  labels:
    rbac.alauda.io/scc-use: "true"
subjects:
  - kind: Group
    name: system:authenticated
    apiGroup: rbac.authorization.k8s.io
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: scc-use-restricted-v2
```

::: warning
A `system:authenticated` group binding is a **fallback** that catches workloads whose ServiceAccount has no explicit SCC binding. It is acceptable as a migration safety net during the Warn-stage rollout in Step 1.4. Once every workload has an explicit binding, remove this fallback. Leaving it in place permanently widens your blast radius if a future SCC profile is added with permissive defaults.
:::

To restrict the binding to a single namespace's ServiceAccounts, change `subjects` to:

```yaml
subjects:
  - kind: Group
    name: system:serviceaccounts:my-namespace
    apiGroup: rbac.authorization.k8s.io
```

#### Step 2.5 — Pin a specific SCC with `alauda.io/required-scc`

By default the engine picks the most restrictive SCC a subject is allowed to use and which the Pod actually satisfies. If you have a workload that must always be admitted under one specific profile - for example, an audit-sensitive deployment that must use `restricted-v3` even though its ServiceAccount is also allowed `anyuid` - set the `alauda.io/required-scc` annotation on the Pod:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: audited-app
  namespace: payments
  annotations:
    alauda.io/required-scc: restricted-v3
spec:
  serviceAccountName: payments-sa
  securityContext:
    runAsNonRoot: true
    runAsUser: 1500
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: registry.example.com/payments/audited-app:1.2.3
      securityContext:
        allowPrivilegeEscalation: false
        capabilities:
          drop: ["ALL"]
```

The `alauda.io/required-scc` annotation only selects from SCCs the subject is already authorized to use. It does not grant SCC access. For this annotation to take effect, **both** of the following must hold:

- A SecurityContextConstraints named `restricted-v3` exists in the cluster.
- `payments/payments-sa` is bound to `restricted-v3` through a ClusterRole or Role that grants `use` on that resource name.

If either condition fails, the Pod is rejected. The validating policy emits specific messages for each case (see **Troubleshooting**).

When using PodTemplate-style controllers (Deployment, StatefulSet, Job), put the annotation in the Pod template's `metadata`, not on the controller:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: audited-app
  namespace: payments
spec:
  selector:
    matchLabels:
      app: audited-app
  template:
    metadata:
      labels:
        app: audited-app
      annotations:
        alauda.io/required-scc: restricted-v3
    spec:
      serviceAccountName: payments-sa
      # ...
```

#### Step 2.6 — Verify the binding takes effect

After applying any binding, run the following checks.

**Administrator verification** — confirm the subject can `use` the SCC:

```shell
kubectl auth can-i use \
  securitycontextconstraints.security.alauda.io/anyuid \
  --as="system:serviceaccount:databases:postgres-sa" -n databases
```

The expected output is `yes`. If you get `no`, recheck the `apiGroups`, `resources`, `resourceNames`, and `verbs` in your ClusterRole.

**Application owner verification** — after the administrator confirms the binding, create or redeploy the workload with the approved ServiceAccount, then inspect the admitted Pod annotation. For a quick probe:

```shell
kubectl -n databases run probe \
  --image=registry.example.com/library/pause:3.10 \
  --serviceaccount=postgres-sa \
  --overrides='{"spec":{"securityContext":{"runAsUser":999}}}' \
  --command -- /pause

kubectl -n databases get pod probe \
  -o jsonpath='{.metadata.annotations.alauda\.io/scc}{"\n"}'
```

The output should be the name of the SCC the engine selected (in this example, `anyuid`). If the application owner cannot create probe Pods, the administrator can perform this check or inspect a Pod from the real workload.

::: note
GlobalContextEntries refresh on a list/watch basis and propagate new bindings to the admission cache typically within seconds, sometimes up to a minute under heavy load. If a Pod is rejected immediately after you apply a new binding, wait a moment and retry before assuming the binding is wrong.
:::

## Results

After completing Part 1 and at least one Part 2 binding, you should be able to verify all of the following:

- `kubectl get crd securitycontextconstraints.security.alauda.io` shows the CRD in state `Established=True`.
- `kubectl get scc` lists every SCC profile you installed.
- `kubectl get globalcontextentry` returns all five `scc-*` entries.
- `kubectl get validatingpolicy scc-auto-pick` and `kubectl get mutatingpolicy scc-fill-defaults` both show `READY=true`.
- Pods created under a bound ServiceAccount in a non-system namespace receive an `alauda.io/scc=<name>` annotation, naming the SCC the engine selected.
- Pods created under an unbound ServiceAccount in a non-system namespace are rejected at admission time with the message `Pod violates all SCCs assigned to its ServiceAccount`.

## Troubleshooting

Use this table to map symptoms to causes and resolution steps.

For Pods created by controllers such as Deployments, StatefulSets, Jobs, and DaemonSets, the effective workload identity is normally the Pod's ServiceAccount. For Pods created directly by a trusted human operator, such as `kubectl run` or `kubectl debug`, User and Group SCC bindings can also match the admission request.

| Symptom | Likely cause | What to check |
|---|---|---|
| `Pod violates all SCCs assigned to its ServiceAccount (candidates: ...)` | The Pod's ServiceAccount is bound to at least one SCC, but the Pod's spec violates every one of them. The candidate list at the end of the message names the SCCs that were considered. | For each candidate, compare the Pod against that SCC's fields. Common mismatches: container `runAsUser` outside the allowed range, missing `drop: [ALL]` when `requiredDropCapabilities: [ALL]`, missing `seccompProfile.type` when the SCC requires `runtime/default`. |
| `Pod violates all SCCs assigned to its ServiceAccount (candidates: )` (empty candidate list) | No SCC is bound to the Pod's ServiceAccount. | Run `kubectl auth can-i use securitycontextconstraints.security.alauda.io/<name> --as=system:serviceaccount:<ns>:<sa> -n <ns>` for each SCC name from `kubectl get scc`. All return `no`. Add a binding per Step 2.2. |
| `required SCC '<name>' not found in scc-profiles` | The `alauda.io/required-scc` annotation references a SCC that does not exist. | Run `kubectl get scc <name>`. Correct the annotation, or install the missing profile. |
| `required SCC '<name>' is not bound to ServiceAccount '<sa>' in namespace '<ns>'` | The annotation references a SCC the ServiceAccount has no `use` permission for. | Add a `RoleBinding` granting `use` on `securitycontextconstraints/<name>` to the SA, then retry. |
| Binding was just added but Pods are still rejected | The Kyverno GlobalContextEntry caches RBAC objects asynchronously; new bindings take a few seconds to propagate. | Wait 10–30 seconds and retry. Check `kubectl get globalcontextentry scc-rolebindings -o jsonpath='{.status.lastRefreshTime}{"\n"}'` to confirm recent refresh. |
| Pod is admitted but `runAsUser` is unexpectedly set / unset | The mutating policy filled in a default from the selected SCC, or did not because the Pod already declared a value. | Inspect the `alauda.io/scc` annotation on the Pod to learn which SCC was chosen, then check that SCC's `runAsUser.type` and `runAsUser.uid`. Pods that declare their own `runAsUser` are never overwritten. |
| `READY=false` on `scc-fill-defaults` or `scc-auto-pick` | Kyverno is missing read permission on a resource the policies match (most often `pods/ephemeralcontainers`). | Re-apply the `kyverno-scc-reader` ClusterRole from Step 1.3 in full. |
| Pods in a `pod-security.kubernetes.io/enforce: restricted` namespace are rejected before Kyverno sees them | The Kubernetes Pod Security Admission plugin runs ahead of Kyverno and enforces the namespace label independently. | Relax the namespace label to `baseline` or `privileged` as appropriate for the workloads in that namespace, or restrict which SCCs you offer there. |

## Learn More

### Temporarily bypass the policy with `PolicyException`

When you need to allow a single ServiceAccount to exceed its current SCC for a short period (for example, an emergency debug session), and changing the RBAC binding is not appropriate, use a `PolicyException` resource. This requires Kyverno's admission controller to have been started with `--enablePolicyException=true`.

```yaml
apiVersion: policies.kyverno.io/v1alpha1
kind: PolicyException
metadata:
  name: postgres-debug-bypass
  namespace: policy-exceptions
spec:
  policyRefs:
    - name: scc-auto-pick
      kind: ValidatingPolicy
  matchConditions:
    - name: target-sa
      expression: |
        object.metadata.namespace == 'databases' &&
        object.spec.?serviceAccountName.orValue('') == 'postgres-sa'
    - name: must-be-debug-window
      expression: |
        object.metadata.?labels[?'debug-window'].orValue('') == 'open'
```

Best practice: place `PolicyException` resources in a dedicated namespace (for example, `policy-exceptions`) with restricted write access, label each exception with `owner` and `expire-at`, and audit them on a recurring schedule.

### How the engine picks an SCC

When more than one SCC is granted to a subject and the Pod satisfies more than one of them, the validating policy ranks candidates in this order:

1. Higher `priority` first.
2. Higher `restrictiveScore` second.

The first candidate whose fields the Pod fully satisfies is the one chosen. The mutating policy uses the same ordering when picking which SCC's defaults to fill in. This matches OpenShift's intent of "the most restrictive acceptable SCC wins" while allowing operators to override the order with `priority` on a per-profile basis.

### Mapping from OpenShift commands

If you are coming from OpenShift, the following `oc` commands translate to plain `kubectl apply` against the SCC engine. These operations grant SCC `use` permission and should be performed only by administrators who are allowed to change the cluster's Pod security boundary.

| OpenShift command | Equivalent on this engine |
|---|---|
| `oc adm policy add-scc-to-user <scc> <user>` | Create a ClusterRole granting `use` on `securitycontextconstraints/<scc>`, then a ClusterRoleBinding with `subjects: [{kind: User, name: <user>}]`. |
| `oc adm policy add-scc-to-user <scc> -z <sa> -n <ns>` | Same ClusterRole as above, plus a `RoleBinding` in namespace `<ns>` with `subjects: [{kind: ServiceAccount, name: <sa>, namespace: <ns>}]`. |
| `oc adm policy add-scc-to-group <scc> <group>` | Same ClusterRole, plus a ClusterRoleBinding with `subjects: [{kind: Group, name: <group>}]`. |
| `oc get scc` | `kubectl get scc` (the CRD's `shortNames: [scc]` keeps the command identical). |

## Next Steps

- Decide which SCC each existing namespace and ServiceAccount should be bound to after reviewing workload requirements, document the mapping, and apply the bindings through your GitOps workflow so that they are auditable and reproducible.
- Plan a periodic review of `PolicyException` resources — they are intended for short windows, not permanent exemptions.
- If you operate at large scale, monitor the Kyverno admission controller's `kyverno_admission_review_duration_seconds` metric to detect changes in admission latency as the number of SCC profiles or RBAC bindings grows.
