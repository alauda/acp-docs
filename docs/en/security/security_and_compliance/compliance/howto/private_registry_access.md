---
weight: 1
---


# Private Registry Access Configuration

This guide demonstrates how to configure Kyverno to access private container registries. When Kyverno needs to verify image signatures or check image details, it requires proper credentials to access private registries - just like a key card is needed to enter a secure building.

## Why Does Kyverno Need Registry Access?

Kyverno needs to access registries when it:

- **Verifies image signatures**: Downloads signature data to check if images are properly signed
- **Checks image metadata**: Reads image labels, annotations, and manifest information
- **Scans for vulnerabilities**: Downloads images for security scanning
- **Validates image contents**: Inspects what's actually inside container images

Think of it like a security guard who needs to check ID - Kyverno needs to "see" the images to verify them.

## Quick Start

### 1. Create Registry Secret
```bash
# For company's private registry
kubectl create secret docker-registry my-registry-secret \
  --docker-server=registry.company.com \
  --docker-username=<username> \
  --docker-password=<password> \
  --docker-email=<email@company.com> \
  -n kyverno
```

### 2. Configure Kyverno to Use the Secret (Recommended)
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kyverno
  namespace: kyverno
imagePullSecrets:
- name: my-registry-secret
```


### 3. Kyverno Deployment Configuration

If more control is needed, the Kyverno deployment can be modified directly:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kyverno
  namespace: kyverno
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kyverno
  template:
    metadata:
      labels:
        app: kyverno
    spec:
      serviceAccountName: kyverno
      imagePullSecrets:
      - name: my-registry-secret
      - name: gcr-secret
      - name: dockerhub-secret
      containers:
      - name: kyverno
        image: ghcr.io/kyverno/kyverno:latest
        env:
        - name: REGISTRY_CREDENTIAL_HELPERS
          value: "ecr-login,gcr,acr-env"  # Enable credential helpers
        # ... other configuration
```
