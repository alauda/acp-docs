---
weight: 5
---

# Image Registry Validation Policy

This guide demonstrates how to configure Kyverno to control which container registries can be used in a Kubernetes cluster. It implements registry access control policies to ensure only images from approved and trusted registries are deployed.

## What is Image Registry Validation?

Registry validation provides centralized control over image sources. It enables:

- **Control image sources**: Only allow images from trusted registries
- **Block risky registries**: Prevent use of unknown or compromised registries  
- **Enforce compliance**: Meet security requirements about image sources
- **Different rules per environment**: Strict rules for production, relaxed for development
- **Track usage**: Monitor which registries are being utilized

## Quick Start

### 1. Block All Except Company Registry
```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: company-registry-only
spec:
  validationFailureAction: Enforce  # Block non-approved images
  background: false
  rules:
    - name: check-registry
      match:
        any:
        - resources:
            kinds:
            - Pod
      validate:
        message: "Only company registry allowed: registry.company.com"
        pattern:
          spec:
            containers:
            - image: "registry.company.com/*"
```

### 2. Test It
```bash
# Apply the policy
kubectl apply -f registry-policy.yaml

# This should fail (nginx from Docker Hub)
kubectl run test --image=nginx:latest

# This should work (if images exist in the registry)
kubectl run test --image=registry.company.com/nginx:latest
```

## Common Scenarios

### Scenario 1: Allow Multiple Trusted Registries

Organizations typically use several registries:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: multiple-trusted-registries
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    - name: check-approved-registries
      match:
        any:
        - resources:
            kinds:
            - Pod
      validate:
        message: "Images must come from approved registries: company registry, GCR, or official Docker images"
        anyPattern:
        - spec:
            containers:
            - image: "registry.company.com/*"      # Company registry
        - spec:
            containers:
            - image: "gcr.io/project-name/*"       # Google Container Registry
        - spec:
            containers:
            - image: "docker.io/library/*"         # Official Docker images only
        - spec:
            containers:
            - image: "quay.io/organization/*"      # Red Hat Quay
```

### Scenario 2: Different Rules for Different Environments

Production environments should be strict, development can be more flexible:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: environment-based-registry-rules
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    # Production: Only certified images
    - name: production-strict-registries
      match:
        any:
        - resources:
            kinds:
            - Pod
            namespaces:
            - production
            - prod-*
      validate:
        message: "Production only allows certified company images"
        pattern:
          spec:
            containers:
            - image: "registry.company.com/certified/*"
    
    # Development: More registries allowed
    - name: development-flexible-registries
      match:
        any:
        - resources:
            kinds:
            - Pod
            namespaces:
            - development
            - dev-*
            - staging
            - test-*
      validate:
        message: "Development can use company registry, GCR, or official Docker images"
        anyPattern:
        - spec:
            containers:
            - image: "registry.company.com/*"
        - spec:
            containers:
            - image: "gcr.io/dev-project/*"
        - spec:
            containers:
            - image: "docker.io/library/*"
        - spec:
            containers:
            - image: "docker.io/organization/*"
```

### Scenario 3: Block Specific Risky Registries

Block specific registries while allowing others:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: block-risky-registries
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    # Method 1: Use deny list approach
    - name: block-untrusted-registries
      match:
        any:
        - resources:
            kinds:
            - Pod
      validate:
        message: "Images from untrusted-registry.com are not allowed"
        deny:
          conditions:
          - key: "{{ request.object.spec.containers[?contains(image, 'untrusted-registry.com')] | length(@) }}"
            operator: GreaterThan
            value: 0
    
    # Method 2: Use allow list for Docker Hub (only official images)
    - name: allow-only-official-dockerhub
      match:
        any:
        - resources:
            kinds:
            - Pod
      validate:
        message: "Only official Docker Hub images are allowed (docker.io/library/*)"
        deny:
          conditions:
          - key: "{{ request.object.spec.containers[?starts_with(image, 'docker.io/') && !starts_with(image, 'docker.io/library/')] | length(@) }}"
            operator: GreaterThan
            value: 0
```

### Scenario 4: Team-Specific Registry Access

Different teams can have access to different registries:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: team-specific-registries
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    # Frontend team can use Node.js images
    - name: frontend-team-registries
      match:
        any:
        - resources:
            kinds:
            - Pod
            namespaces:
            - frontend-*
      validate:
        message: "Frontend team can use company registry and official Node.js images"
        anyPattern:
        - spec:
            containers:
            - image: "registry.company.com/*"
        - spec:
            containers:
            - image: "docker.io/library/node:*"
        - spec:
            containers:
            - image: "docker.io/library/nginx:*"
    
    # Data team can use ML/AI registries
    - name: data-team-registries
      match:
        any:
        - resources:
            kinds:
            - Pod
            namespaces:
            - data-*
            - ml-*
      validate:
        message: "Data team can use company registry and ML/AI images"
        anyPattern:
        - spec:
            containers:
            - image: "registry.company.com/*"
        - spec:
            containers:
            - image: "docker.io/tensorflow/*"
        - spec:
            containers:
            - image: "docker.io/pytorch/*"
        - spec:
            containers:
            - image: "nvcr.io/nvidia/*"
```

## Advanced Patterns

### Using Wildcards Effectively

```yaml
# Match patterns:
- image: "registry.company.com/*"           # Any image from this registry
- image: "registry.company.com/team-a/*"    # Only team-a images
- image: "*/database:*"                     # Any database image from any registry
- image: "gcr.io/project-*/app:*"          # Any app from project-* in GCR
```


## Best Practices

### Start with Warnings
```yaml
spec:
  validationFailureAction: Audit  # Start with audit mode, not blocking
```

### Exclude System Namespaces
```yaml
rules:
  - name: check-registries
    match:
      any:
      - resources:
          kinds:
          - Pod
    exclude:
      any:
      - resources:
          namespaces:
          - kube-system
          - kyverno
          - kube-public
```

### Common Issues

1. **Wrong image format**: 
   - ❌ `registry.company.com:5000/app` (missing protocol)
   - ✅ `registry.company.com/app:latest`

2. **Wildcard confusion**:
   - ❌ `registry.company.com*` (missing slash)
   - ✅ `registry.company.com/*`

3. **Docker Hub format**:
   - ❌ `nginx` (implicit docker.io)
   - ✅ `docker.io/library/nginx`
