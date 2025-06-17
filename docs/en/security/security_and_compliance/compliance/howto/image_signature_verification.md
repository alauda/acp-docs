---
weight: 3
---


# Image Signature Verification Policy

This guide demonstrates how to configure Kyverno to verify that container images are properly signed before they can run in a Kubernetes cluster. Think of it like checking an ID card - only images with valid "signatures" are allowed in.

## What is Image Signature Verification?

Image signature verification is like having a security guard check IDs at the door. It ensures:

- **Images are authentic**: They come from who they claim to come from
- **Images are untampered**: No one has modified them after signing
- **Only trusted images run**: Unsigned or improperly signed images are blocked
- **Audit trail**: Track which images were verified and when

## Quick Start

### 1. Generate Keys
```bash
# Create a signing key pair (like creating an ID card system)
cosign generate-key-pair
# This creates: cosign.key (private, keep secret) and cosign.pub (public, share freely)
```

### 2. Sign Images
```bash
# Sign images (like putting an official stamp on it)
cosign sign --key cosign.key registry.company.com/app:v1.0.0
```

### 3. Create Basic Verification Policy
```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-signed-images
spec:
  validationFailureAction: Enforce  # Block unsigned images
  background: false
  rules:
    - name: check-signatures
      match:
        any:
        - resources:
            kinds:
            - Pod
      verifyImages:
      - imageReferences:
        - "registry.company.com/*"  # Check images from company registry
        attestors:
        - count: 1
          entries:
          - keys:
              publicKeys: |-
                -----BEGIN PUBLIC KEY-----
                # Paste the cosign.pub content here
                MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE8nXRh950IZbRj8Ra/N9sbqOPZrfM
                5/KAQN0/KjHcorm/J5yctVd7iEcnessRQjU917hmKO6JWVGHpDguIyakZA==
                -----END PUBLIC KEY-----
        mutateDigest: true  # Convert tags to secure digest format
```

### 4. Test It
```bash
# Apply the policy
kubectl apply -f signature-policy.yaml

# Try to run an unsigned image (should fail)
kubectl run test --image=nginx:latest

# Try to run a signed image (should work)
kubectl run test --image=registry.company.com/app:v1.0.0
```

## Common Use Cases

### Scenario 1: Multiple Teams Need to Sign Critical Images

For critical applications, both the development team AND security team might need to sign images:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-dual-signatures
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    - name: critical-app-signatures
      match:
        any:
        - resources:
            kinds:
            - Pod
      verifyImages:
      - imageReferences:
        - "registry.company.com/critical/*"
        attestors:
        # Both teams must sign
        - count: 1  # Security team signature
          entries:
          - keys:
              publicKeys: |-
                -----BEGIN PUBLIC KEY-----
                # Security team's public key
                MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE8nXRh950IZbRj8Ra/N9sbqOPZrfM
                5/KAQN0/KjHcorm/J5yctVd7iEcnessRQjU917hmKO6JWVGHpDguIyakZA==
                -----END PUBLIC KEY-----
        - count: 1  # Development team signature
          entries:
          - keys:
              publicKeys: |-
                -----BEGIN PUBLIC KEY-----
                # Development team's public key
                MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEyctVd7iEcnessRQjU917hmKO6JWV
                GHpDguIyakZA8nXRh950IZbRj8Ra/N9sbqOPZrfM5/KAQN0/KjHcorm/J5==
                -----END PUBLIC KEY-----
        mutateDigest: true
```

### Scenario 2: Different Rules for Different Environments

Production needs strict verification, development can be more relaxed:

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: environment-specific-verification
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    # Strict rules for production
    - name: production-must-be-signed
      match:
        any:
        - resources:
            kinds:
            - Pod
            namespaces:
            - production
      verifyImages:
      - imageReferences:
        - "*"  # All images must be signed
        failureAction: Enforce  # Block if not signed
        attestors:
        - count: 1
          entries:
          - keys:
              publicKeys: |-
                -----BEGIN PUBLIC KEY-----
                # Production signing key
                MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE8nXRh950IZbRj8Ra/N9sbqOPZrfM
                5/KAQN0/KjHcorm/J5yctVd7iEcnessRQjU917hmKO6JWVGHpDguIyakZA==
                -----END PUBLIC KEY-----
        mutateDigest: true
    
    # Relaxed rules for development
    - name: development-warn-unsigned
      match:
        any:
        - resources:
            kinds:
            - Pod
            namespaces:
            - development
            - staging
      verifyImages:
      - imageReferences:
        - "registry.company.com/*"  # Only check company images
        failureAction: Audit  # Audit but allow unsigned images
        attestors:
        - count: 1
          entries:
          - keys:
              publicKeys: |-
                -----BEGIN PUBLIC KEY-----
                # Development signing key
                MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEyctVd7iEcnessRQjU917hmKO6JWV
                GHpDguIyakZA8nXRh950IZbRj8Ra/N9sbqOPZrfM5/KAQN0/KjHcorm/J5==
                -----END PUBLIC KEY-----
        mutateDigest: true
```

### Scenario 3: Using Certificates Instead of Keys

For enterprise environments, X.509 certificates might be used:

```bash
# Sign with certificate
cosign sign --cert company-cert.pem --cert-chain ca-chain.pem \
  registry.company.com/myapp:v1.0.0
```

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: certificate-verification
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    - name: verify-with-certificates
      match:
        any:
        - resources:
            kinds:
            - Pod
      verifyImages:
      - imageReferences:
        - "registry.company.com/*"
        attestors:
        - count: 1
          entries:
          - certificates:
              cert: |-
                -----BEGIN CERTIFICATE-----
                # Company's signing certificate (replace with real certificate)
                MIIDXTCCAkWgAwIBAgIJAKoK/heBjcOuMA0GCSqGSIb3DQEBBQUAMEUxCzAJBgNV
                BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
                aWRnaXRzIFB0eSBMdGQwHhcNMTcwODI4MTExNzQwWhcNMTgwODI4MTExNzQwWjBF
                MQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
                ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
                CgKCAQEAuuExVilGcXIZ3ulNuL7wLrA7VkqJoGpB1YPmYnlS7sobTggOGSqMUvqU
                BdLXcAo3ZCOXuKrBHBlltvcNdFHynfxOtkAOCZjirD6uQBrNPiQDlgMYMy14QIDAQAB
                o1AwTjAdBgNVHQ4EFgQUhKs8VQFhVLp5J4W1sFVLOVgnQxwwHwYDVR0jBBgwFoAU
                hKs8VQFhVLp5J4W1sFVLOVgnQxwwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQUF
                AAOCAQEAuuExVilGcXIZ3ulNuL7wLrA7VkqJoGpB1YPmYnlS7sobTggOGSqMUvqU
                -----END CERTIFICATE-----
              rekor:
                url: https://rekor.sigstore.dev
        mutateDigest: true
```