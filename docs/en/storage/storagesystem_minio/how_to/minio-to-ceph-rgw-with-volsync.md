# MinIO to Rook Ceph RGW Data Migration Guide

## 1. Overview and Architecture

This document explains how to use the embedded Rclone component in the installed **Alauda Build of VolSync** Operator image to migrate all data from a highly available (HA) MinIO deployment in Kubernetes to Rook Ceph RGW.

### 1.1 Architecture Notes

* **Secure image reuse**: This approach schedules a Kubernetes Job that reuses the security-patched `build-harbor.alauda.cn/acp/volsync` Operator image, overrides the default entrypoint, and directly invokes the internal Rclone binary to perform standard **S3-to-S3** API-level object synchronization.

### 1.2 Synchronization Strategy

Use a three-phase strategy: **"Full -> Incremental -> Cutover"**:

1. **Initial Sync (Full Sync)**: Keep services online while migrating historical data.
2. **Incremental Sync**: Keep services online and run multiple times to catch up newly added or modified data.
3. **Cutover Sync**: Stop writes, enforce strict consistency checks, and complete final switching.

---

## 2. Prerequisites and Preparation

### 2.1 Verify Alauda VolSync Installation and Extract Version (Critical Prerequisite)

Before executing this plan, ensure the **"Alauda Build of VolSync"** Operator is installed in the `volsync-system` namespace. The migration Job image version must strictly match the currently running Operator version.

For detailed installation instructions of **Alauda Build of VolSync**, see [Configure PVC DR with VolSync](../../../configure/storage/how_to/configuring_pvc_dr.mdx).

**How to get the version:**
Log in to the cluster management console, navigate to **Marketplace / OperatorHub**, open **Installed Operators**, locate the VolSync Operator, and record the displayed version (for example, `v0.8.0` or `v0.9.0`). Save this value as `<OPERATOR_VERSION>` for later configuration.

### 2.2 Collect MinIO Source Information

* **Endpoint**: MinIO internal Service address (for example: `http://minio.tenant-ns.svc:9000`).
* **Credentials**: Access Key / Secret Key with `Read` and `List` permissions on all buckets.

### 2.3 Create a Ceph RGW User (Destination)

Apply the following YAML in the Rook Ceph cluster to create a dedicated migration user and grant bucket creation permissions.

```yaml
apiVersion: ceph.rook.io/v1
kind: CephObjectStoreUser
metadata:
  name: volsync-migration-user
  namespace: rook-ceph
spec:
  store: object-store
  displayName: "VolSync Migration Admin"
  capabilities:
    bucket: "*"

```

For least privilege, keep only bucket-level permissions for this migration account and do not grant `user` management capability.

Extract and decode Ceph credentials for later use:

```bash
# Get Access Key
kubectl -n rook-ceph get secret rook-ceph-object-user-object-store-volsync-migration-user -o jsonpath='{.data.AccessKey}' | base64 -d
# Get Secret Key
kubectl -n rook-ceph get secret rook-ceph-object-user-object-store-volsync-migration-user -o jsonpath='{.data.SecretKey}' | base64 -d

```

---

## 3. Deployment Configuration (Manifests)

It is recommended to deploy migration tasks in the destination-side namespace (Ceph RGW) or in a dedicated operations namespace.

Create the namespace used by both manifests before applying them:

```bash
kubectl create ns migration-ops
```

> **Deployment location recommendation (Important)**
>
> During migration, Rclone reads data locally for processing and then uploads it to the target S3 cluster. Therefore, the network location of the cluster running the migration task directly impacts bandwidth and completion time. It is recommended to deploy the VolSync Operator/migration Job in the **MinIO or Ceph cluster** to reduce cross-cluster network overhead and improve transfer stability.

### 3.1 Create the Rclone Config Secret

Write source and destination S3 credentials into a Secret. **Important: never add quotes around `endpoint` or secret values.**

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: volsync-rclone-config-secret
  namespace: migration-ops
type: Opaque
stringData:
  rclone.conf: |
    [source-minio]
    type = s3
    provider = Minio
    env_auth = false
    access_key_id = MINIO_ACCESS_KEY_HERE
    secret_access_key = MINIO_SECRET_KEY_HERE
    endpoint = MINIO_ENDPOINT_HERE
    no_check_certificate = true

    [dest-ceph]
    type = s3
    provider = Ceph
    env_auth = false
    access_key_id = CEPH_ACCESS_KEY_HERE
    secret_access_key = CEPH_SECRET_KEY_HERE
    endpoint = CEPH_ENDPOINT_HERE
    list_version = 2

```

### 3.2 Define the Migration Job

Deploy a Job that calls the security-patched Alauda VolSync image to execute S3 data synchronization.

> **About `remote:bucket[/prefix]` vs `remote:` (Important)**
>
> - For S3 backends, the common Rclone pattern is `remote:bucket` or `remote:bucket/prefix`, which is also the clearest and safest way to define scope.
> - This document intentionally keeps `source-minio:` -> `dest-ceph:` to support **full instance-level migration** (all visible buckets from the source side).
> - **Risk notice**: `remote:` has a broader scope. If credentials are over-privileged, buckets outside the intended scope may be migrated. Always validate in a test environment first, and consider switching to an explicit `remote:bucket[/prefix]` allowlist model for production cutover.

**Be sure to replace `<OPERATOR_VERSION>` in the YAML below with the actual version discovered in section 2.1.**

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: volsync-s3-sync-job
  namespace: migration-ops
spec:
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: rclone
          # Use Alauda's patched volsync image. Version must exactly match OperatorHub.
          image: build-harbor.alauda.cn/acp/volsync:<OPERATOR_VERSION>
          # Note: In ACP clusters, this image reference is automatically rewritten
          # to an internal registry address after Pod creation
          # (for example: registry.alauda.cn:60070/acp/volsync:<OPERATOR_VERSION>).
          # This is expected behavior.
          # Use `kubectl describe pod <pod-name>` to check effective Image / ImageID.
          imagePullPolicy: IfNotPresent
          # Override default entrypoint and directly invoke rclone inside the image
          command: ["rclone"]
          args:
            - "sync"
            - "source-minio:"
            - "dest-ceph:"
            - "--progress"
            - "--create-empty-src-dirs"
            - "--ignore-errors"
            # --- Performance tuning flags ---
            - "--transfers=32"      # parallel file transfers
            - "--checkers=64"       # parallel checkers
            - "--s3-chunk-size=64M" # large-object chunk size to reduce RGW fragmentation
            - "--fast-list"         # use ListObjectsV2 to reduce API requests
            - "--metadata"          # synchronize object metadata
          resources:
            requests:
              cpu: "2000m"
              memory: "4Gi"
            limits:
              cpu: "4000m"
              memory: "8Gi"
          env:
            - name: RCLONE_CONFIG
              value: "/config/rclone.conf"
          volumeMounts:
            - name: config-volume
              mountPath: /config
              readOnly: true
      volumes:
        - name: config-volume
          secret:
            secretName: volsync-rclone-config-secret

```

---

## 4. Execution Workflow

### Phase 1: Initial Full Sync

1. Create the operations namespace: `kubectl create ns migration-ops`
2. Apply the Secret: `kubectl apply -f rclone-secret.yaml`
3. Start the Job: `kubectl apply -f rclone-job.yaml`
4. Monitor progress: `kubectl -n migration-ops logs -f job/volsync-s3-sync-job`

### Phase 2: Incremental Sync

To catch up on newly generated data during full sync, repeat this step as needed.

1. Delete the previous Job: `kubectl -n migration-ops delete job volsync-s3-sync-job`
2. Recreate the Job: `kubectl apply -f rclone-job.yaml`

*Mechanism note: By default, Rclone compares Size and ModTime to decide whether transfer is needed. Existing unmodified files are skipped.*

### Phase 3: Final Cutover

1. **Stop writes**: Stop writes to MinIO at the application layer, or block write traffic via load balancer/Ingress.
2. **Strict sync validation**:
* Delete the current Job: `kubectl -n migration-ops delete job volsync-s3-sync-job`
* Update `rclone-job.yaml`: remove `- "--ignore-errors"` for the final cutover run, then append `- "--checksum"` to `args`. This avoids masking failed objects and prioritizes Size+Checksum (when available) for difference detection.
* **Consistency recommendation (Required)**: Do not rely on object counts or ETag alone. Before cutover, run `rclone check source-minio: dest-ceph: --download --checksum` (or perform sampled downloads of critical objects and compute SHA256) to reduce false positives caused by multipart/ETag differences.
* Re-apply the Job: `kubectl apply -f rclone-job.yaml`


3. **Validate and switch**: After the Job reaches `Completed` and logs show no errors, update the application S3 Endpoint and credentials to Ceph RGW.

---

## 5. Troubleshooting and Tuning Recommendations

| Symptom | Technical Diagnosis | Resolution |
| --- | --- | --- |
| **ImagePullBackOff** | Node cannot pull the image, or version mismatch exists. ACP clusters automatically rewrite `build-harbor.alauda.cn` to an internal registry address. | First run `kubectl describe pod <pod-name>` to verify the effective `Image` (rewritten or not) and `ImageID`. Then validate `<OPERATOR_VERSION>` and check network/authentication for the effective registry (`imagePullSecrets`). |
| **Pod OOMKilled** | `--fast-list` loads metadata in bulk for massive small-object scenarios, consuming high memory. | Increase Pod memory limit to 8Gi+ or remove `--fast-list` (this increases API requests and slows traversal). |
| **403 Forbidden** | Destination Ceph user lacks permission to create buckets. | Check `CephObjectStoreUser` configuration and ensure `capabilities` includes `bucket: "*"`. |
| **dial tcp: lookup "http: no such host"** | Secret config format is invalid; endpoint URL is quoted. | Edit Secret and **remove quotes around the endpoint URL**, ensuring strict format: `endpoint = http://...`. |
| **503 Service Unavailable** | Migration concurrency is too high, causing excessive Ceph RGW write pressure. | Reduce `--transfers` in Job `args`, or add `--bwlimit` to cap transfer bandwidth. |
