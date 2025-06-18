---
weight: 4
---


# Image Signature Verification Policy with Secrets

This guide demonstrates how to use Kubernetes Secrets to store public keys for Kyverno image signature verification, providing better security and key management compared to embedding keys directly in policies.

## Why Use Secrets for Public Keys?

Using Kubernetes Secrets for storing public keys offers several advantages:

- **Enhanced Security**: Keys are stored securely in the Kubernetes Secret store
- **Easy Key Rotation**: Update keys without modifying policies
- **Access Control**: Use RBAC to control who can access the secrets

## Quick Start

### 1. Generate and Store Keys in Secret

```bash
# Generate cosign key pair
cosign generate-key-pair

# Create secret from the public key file
kubectl create secret generic cosign-public-key \
  --from-file=cosign.pub=./cosign.pub \
  --namespace=kyverno

# Verify the secret was created
kubectl get secret cosign-public-key -n kyverno
```

### 2. RBAC Configuration for Keyverno

Create Service Account for Kyverno

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kyverno-secret-reader
  namespace: kyverno
```

Create Role for Secret Access

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: kyverno
  name: secret-reader
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list", "watch"]
  resourceNames: ["cosign-public-key", "team-keys"]  # Specific secrets only
```

Bind Role to Service Account

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-secrets
  namespace: kyverno
subjects:
- kind: ServiceAccount
  name: kyverno-secret-reader
  namespace: kyverno
roleRef:
  kind: Role
  name: secret-reader
  apiGroup: rbac.authorization.k8s.io
```


### 3. Create Policy Using Secret Reference

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-with-secret
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    - name: check-signatures
      match:
        any:
        - resources:
            kinds: [Pod]
      verifyImages:
      - imageReferences:
        - "registry.company.com/*"
        attestors:
        - count: 1
          entries:
          - keys:
              secret:
                name: cosign-public-key
                namespace: kyverno
                key: cosign.pub
              rekor:
                url: https://rekor.sigstore.dev
        mutateDigest: true
```

### 4. Test the Configuration

```bash
# Sign an image
cosign sign --key cosign.key registry.company.com/app:v1.0.0

# Apply the policy
kubectl apply -f verify-with-secret.yaml

# Test with signed image (should work)
kubectl run test --image=registry.company.com/app:v1.0.0

# Test with unsigned image (should fail)
kubectl run test-fail --image=nginx:latest
```

## Secret Creation Methods

### Method 1: From File

```bash
# Create secret from existing cosign public key file
kubectl create secret generic cosign-public-key \
  --from-file=cosign.pub=./cosign.pub \
  --namespace=kyverno
```

### Method 2: From Literal String

```bash
# Create secret with inline public key content
kubectl create secret generic cosign-public-key \
  --from-literal=cosign.pub="-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE8nXRh950IZbRj8Ra/N9sbqOPZrfM
5/KAQN0/KjHcorm/J5yctVd7iEcnessRQjU917hmKO6JWVGHpDguIyakZA==
-----END PUBLIC KEY-----" \
  --namespace=kyverno
```

### Method 3: From YAML Manifest

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: cosign-public-key
  namespace: kyverno
  labels:
    app: kyverno
    component: image-verification
type: Opaque
stringData:
  cosign.pub: |
    -----BEGIN PUBLIC KEY-----
    MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE8nXRh950IZbRj8Ra/N9sbqOPZrfM
    5/KAQN0/KjHcorm/J5yctVd7iEcnessRQjU917hmKO6JWVGHpDguIyakZA==
    -----END PUBLIC KEY-----
```

```bash
kubectl apply -f cosign-secret.yaml
```

## Common Use Cases

### Scenario 1: Single Team with One Secret

Simple setup where one team manages all image signatures:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: single-team-verification
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    - name: verify-team-signatures
      match:
        any:
        - resources:
            kinds: [Pod, Deployment, StatefulSet, DaemonSet]
      exclude:
        any:
        - resources:
            namespaces: [kube-system, kyverno]
      
      verifyImages:
      - imageReferences:
        - "registry.company.com/*"
        - "gcr.io/myproject/*"
        
        failureAction: Enforce
        
        attestors:
        - count: 1
          entries:
          - keys:
              secret:
                name: team-cosign-key
                namespace: kyverno
                key: cosign.pub
              rekor:
                url: https://rekor.sigstore.dev
        
        mutateDigest: true
        verifyDigest: true
        required: true
```

### Scenario 2: Multi-Team with Different Secrets

Different teams have their own signing keys and secrets:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: multi-team-verification
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    # Frontend team images
    - name: verify-frontend-images
      match:
        any:
        - resources:
            kinds: [Pod]
            namespaces: [frontend-*]
      
      verifyImages:
      - imageReferences:
        - "registry.company.com/frontend/*"
        
        attestors:
        - count: 1
          entries:
          - keys:
              secret:
                name: frontend-team-key
                namespace: kyverno
                key: cosign.pub
              rekor:
                url: https://rekor.sigstore.dev
        
        mutateDigest: true
        required: true
    
    # Backend team images
    - name: verify-backend-images
      match:
        any:
        - resources:
            kinds: [Pod]
            namespaces: [backend-*]
      
      verifyImages:
      - imageReferences:
        - "registry.company.com/backend/*"
        
        attestors:
        - count: 1
          entries:
          - keys:
              secret:
                name: backend-team-key
                namespace: kyverno
                key: cosign.pub
              rekor:
                url: https://rekor.sigstore.dev
        
        mutateDigest: true
        required: true
```

### Scenario 3: Critical Images Requiring Multiple Signatures

High-security environments where multiple teams must sign critical images:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: critical-multi-signature
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    - name: verify-critical-images
      match:
        any:
        - resources:
            kinds: [Pod]
            namespaces: [production]
      
      verifyImages:
      - imageReferences:
        - "registry.company.com/critical/*"
        
        failureAction: Enforce
        
        attestors:
        # Security team signature (required)
        - count: 1
          entries:
          - keys:
              secret:
                name: security-team-key
                namespace: kyverno
                key: security.pub
              rekor:
                url: https://rekor.sigstore.dev
        
        # Development team signature (required)
        - count: 1
          entries:
          - keys:
              secret:
                name: dev-team-key
                namespace: kyverno
                key: development.pub
              rekor:
                url: https://rekor.sigstore.dev
        
        # Release team signature (required)
        - count: 1
          entries:
          - keys:
              secret:
                name: release-team-key
                namespace: kyverno
                key: release.pub
              rekor:
                url: https://rekor.sigstore.dev
        
        mutateDigest: true
        required: true
```

### Scenario 4: Offline Environment with Secrets

Using secrets in air-gapped environments:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: offline-verification-with-secret
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    - name: verify-offline-images
      match:
        any:
        - resources:
            kinds: [Pod, Deployment, StatefulSet, DaemonSet]
      
      verifyImages:
      - imageReferences:
        - "registry.internal.com/*"
        - "airgap.company.com/*"
        
        failureAction: Enforce
        emitWarning: false
        
        attestors:
        - count: 1
          entries:
          - keys:
              secret:
                name: offline-cosign-key
                namespace: kyverno
                key: cosign.pub
              
              # Offline mode configuration
              rekor:
                url: ""                    # Empty URL for offline mode
                ignoreTlog: true           # Ignore transparency log
                ignoreSCT: true            # Ignore SCT
              
              ctlog:
                ignoreTlog: true           # Ignore certificate transparency log
                ignoreSCT: true            # Ignore SCT
        
        mutateDigest: true
        verifyDigest: true
        required: true
```


