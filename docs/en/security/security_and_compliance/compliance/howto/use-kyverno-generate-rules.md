---
weight: 11
---

# Use Kyverno Generate Rules

Use Kyverno `generate` rules to create Kubernetes resources automatically when a matching resource is created or updated. A generate rule defines:

- Which source resource to watch, using `match`.
- Which changes should trigger generation, using optional `preconditions`.
- Which target resource Kyverno should create, using `generate`.
- Whether Kyverno should keep the generated resource synchronized with the source resource.

This guide uses a ConfigMap update as the example workflow. When a specific ConfigMap in a specific namespace changes, Kyverno creates a platform `NotificationMessage` resource. The notification service then sends an email to the specified recipient.

For the upstream Kyverno reference, see the official [Kyverno generate rules documentation](https://kyverno.io/docs/policy-types/cluster-policy/generate/).

## How Generate Works

A Kyverno generate rule is part of a `ClusterPolicy` or `Policy`.

```yaml
rules:
  - name: <rule-name>
    match:
      any:
        - resources:
            kinds:
              - <source-kind>
            operations:
              - CREATE
              - UPDATE
    preconditions:
      all:
        - key: <expression>
          operator: <operator>
          value: <expression>
    generate:
      apiVersion: <target-api-version>
      kind: <target-kind>
      name: <target-name>
      namespace: <target-namespace>
      synchronize: false
      data:
        <target-resource-content>
```

Use `synchronize: false` when every trigger should create an independent target resource. Use `synchronize: true` only when the generated resource should be updated or removed along with the source resource.

## Example Scenario

In this example:

- The source namespace is `app-team-a`.
- The source ConfigMap is `app-notification-source`.
- Only `UPDATE` operations are matched.
- Only changes to `ConfigMap.data` trigger generation.
- Kyverno creates a short-lived `NotificationMessage` in `cpaas-system`.
- The generated message sends an email directly to `platform-operator@example.com`.

The notification message API used in this example is `notificationmessages.aitextensions.alauda.io/v1beta1`. It is served by the platform notification API and is consumed quickly after creation.

## Prerequisites

- Alauda Container Platform Compliance with Kyverno is installed.
- The platform notification capability is installed in the same cluster.
- An email notification server has been configured. The platform default email server is stored as the `platform-email-server` Secret in the `cpaas-system` namespace.
- A notification template for email messages exists in the `cpaas-system` namespace.
- Kyverno has permission to create `NotificationMessage` resources in the target namespace.

This example does not require a notification rule, notification policy, notification receiver, or notification sender resource. The recipient email address is specified directly in the generated `NotificationMessage`.

## Prepare the Target Resource Dependency

The generated `NotificationMessage` references an email template. Create the template before applying the Kyverno policy.

```yaml
apiVersion: ait.alauda.io/v1beta1
kind: NotificationTemplate
metadata:
  name: configmap-change-email-template
  namespace: cpaas-system
  labels:
    cpaas.io/template.email.body.type: Html
    cpaas.io/template.language: EN
spec:
  templates:
    - type: Email
      subject: "ConfigMap {{ .labels.namespace }}/{{ .labels.name }} changed"
      content: |-
        The watched ConfigMap was updated.

        Namespace: {{ .labels.namespace }}
        Name: {{ .labels.name }}
        Resource version: {{ .labels.resourceVersion }}
        Application: {{ .labels.application }}
        Owner: {{ .labels.owner }}
        Severity: {{ .labels.severity }}
```

## Prepare the Source Resource

Create the namespace and ConfigMap that Kyverno will watch.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: app-team-a
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-notification-source
  namespace: app-team-a
data:
  application: payment
  owner: platform-ops
  severity: warning
```

## Grant Kyverno Permission

Kyverno creates generated resources through its background controller. Grant the controller permission to create `NotificationMessage` resources in the target namespace.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: kyverno-generate-notificationmessages
  namespace: cpaas-system
rules:
  - apiGroups:
      - aitextensions.alauda.io
      - aiops.alauda.io
    resources:
      - notificationmessages
    verbs:
      - get
      - list
      - watch
      - create
      - update
      - patch
      - delete
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: kyverno-generate-notificationmessages
  namespace: cpaas-system
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: kyverno-generate-notificationmessages
subjects:
  - kind: ServiceAccount
    name: kyverno-background-controller
    namespace: kyverno
```

If Kyverno is installed in a different namespace or uses a different background controller ServiceAccount name, update the `subjects` section before applying the YAML.

## Create the Generate Policy

Create a `ClusterPolicy` that generates a `NotificationMessage` only when `app-team-a/app-notification-source` is updated and its `data` field changes.

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: generate-notificationmessage-on-configmap-change
  annotations:
    policies.kyverno.io/title: Generate NotificationMessage on ConfigMap Change
    policies.kyverno.io/category: Operations
    policies.kyverno.io/subject: ConfigMap, NotificationMessage
    policies.kyverno.io/description: >-
      Generates a platform NotificationMessage resource when the watched ConfigMap data changes.
spec:
  background: false
  rules:
    - name: generate-email-notificationmessage
      match:
        any:
          - resources:
              kinds:
                - ConfigMap
              namespaces:
                - app-team-a
              names:
                - app-notification-source
              operations:
                - UPDATE
      preconditions:
        all:
          - key: "{{ request.object.data || `{}` }}"
            operator: NotEquals
            value: "{{ request.oldObject.data || `{}` }}"
      generate:
        apiVersion: aitextensions.alauda.io/v1beta1
        kind: NotificationMessage
        name: "cm-change-{{ request.object.metadata.namespace }}-{{ request.object.metadata.name }}-{{ request.object.metadata.resourceVersion }}"
        namespace: cpaas-system
        synchronize: false
        data:
          metadata:
            labels:
              app.kubernetes.io/managed-by: kyverno
              app.kubernetes.io/part-of: configmap-change-notification
              configmap-change/source-namespace: "{{ request.object.metadata.namespace }}"
              configmap-change/source-name: "{{ request.object.metadata.name }}"
            annotations:
              configmap-change/resource-version: "{{ request.object.metadata.resourceVersion }}"
          spec:
            body:
              labels:
                namespace: "{{ request.object.metadata.namespace }}"
                name: "{{ request.object.metadata.name }}"
                resourceVersion: "{{ request.object.metadata.resourceVersion }}"
                application: "{{ request.object.data.application || '' }}"
                owner: "{{ request.object.data.owner || '' }}"
                severity: "{{ request.object.data.severity || '' }}"
            notifications:
              - name: "configmap-change-email-{{ request.object.metadata.resourceVersion }}"
                ephemeral:
                  methods:
                    - Email
                  template: configmap-change-email-template
                receivers:
                  - destination: platform-operator@example.com
```

The generate rule uses these key fields:

- `match.resources`: Watches only the specified ConfigMap and only `UPDATE` operations.
- `preconditions`: Compares the new and old `data` fields so metadata-only updates do not generate messages.
- `generate.apiVersion`, `kind`, `name`, and `namespace`: Define the target resource identity.
- `generate.data`: Defines the full generated resource body.
- `synchronize: false`: Creates a separate target resource for each matching update.

The generated `NotificationMessage` uses `spec.body.labels` as template variables, `ephemeral.methods` to select email delivery, `ephemeral.template` to reference the email template, and `receivers[].destination` to specify the recipient email address.

## Verify the Generate Rule

Update the watched ConfigMap.

```shell
kubectl patch configmap app-notification-source \
  -n app-team-a \
  --type merge \
  -p '{"data":{"severity":"critical"}}'
```

Check the Kyverno background controller logs. The logs show that Kyverno created the generated target resource.

```shell
kubectl logs -n kyverno deploy/kyverno-background-controller --since=5m
```

The log output contains a generated target similar to the following:

```shell
created generate target resource target=aitextensions.alauda.io/v1beta1/NotificationMessage/cpaas-system/cm-change-app-team-a-app-notification-source-19377570
```

For this example, also check the notification API logs. A successful email delivery shows one task, the email sender and recipient, and a `Done` status.

```shell
kubectl logs -n cpaas-system deploy/courier-api --since=5m
```

The log output contains entries similar to the following:

```shell
Try to exec {"tasks": 1}
Email begin {"from": ["user@example.com"], "to": ["platform-operator@example.com"]}
Email end {"from": ["user@example.com"], "to": ["platform-operator@example.com"]}
"status":{"conditions":[{"method":"Email","addresses":["platform-operator@example.com"],"type":"Ready","status":"True"}],"phase":"Done"}
```

`NotificationMessage` resources are short-lived and are consumed by the notification API. A normal `kubectl get` command may not show the generated message after it has been accepted.

## Troubleshooting

If no target resource is generated, check the Kyverno update requests.

```shell
kubectl get updaterequests -A
```

If an update request failed, inspect it for the detailed error.

```shell
kubectl describe updaterequest -n kyverno <update-request-name>
```

Common causes include:

- The source resource update did not match the `match.resources` filter.
- The ConfigMap update did not change the `data` field, so the precondition was not met.
- The Kyverno background controller does not have permission to create `notificationmessages.aitextensions.alauda.io` resources in `cpaas-system`.
- The `notificationmessages.aitextensions.alauda.io/v1beta1` API is not available in the target cluster.
- The generated resource name exceeds the Kubernetes DNS label length limit.
- The email template referenced by `ephemeral.template` does not exist.
- The email notification server is not configured or is not available.
