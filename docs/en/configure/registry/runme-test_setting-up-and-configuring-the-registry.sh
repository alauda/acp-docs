#!/usr/bin/env bash
# Alauda Container Platform Registry — 存储配置与请求处理文档测试
#
# 被测文档: docs/en/configure/registry/setting_up_and_configuring_the_registry.mdx
# 覆盖: § Configure Development Storage / § Configure PVC Storage /
#       § Configure S3-Compatible Storage Credentials / § Configure Request Handling /
#       § Configure Managed Service Account Pull Secrets / § Configure Image Limits /
#       § Configure Scheduled Image Pruning / § Operate Storage
#
# ── 环境能力 ─────────────────────────────────────────────────────────────────
#   REGISTRY_TEST_PVC=true          有可用 StorageClass 时跑 PVC 存储
#   REGISTRY_TEST_S3=true           有 S3 兼容后端与凭据时跑 S3 存储
#   REGISTRY_TEST_CA=true           有受信 CA 文件时跑 CA ConfigMap 部分
#   REGISTRY_S3_*                   见 § Configure S3-Compatible Storage Credentials
# 未开启的段落以 skip_test_env 退出，不算失败。

set -e

: "${FRAMEWORK_ROOT:?该脚本需经 docs-runme-tests/run.sh 运行}"
source "$FRAMEWORK_ROOT/framework/common.sh"
source "$FRAMEWORK_ROOT/framework/verify.sh"
source "$FRAMEWORK_ROOT/framework/acp-verify.sh"

REGISTRY_NS="image-registry-system"
REGISTRY_CONFIG="configs.imageregistry.operator.alauda.io"
REGISTRY_CONFIG_NAME="cluster"
QUOTA_NS="${REGISTRY_TEST_QUOTA_NS:-team-a}"
TMP=""

_setup_tmp() { TMP="$(mktemp -d)"; }
_cleanup_tmp() { [ -n "${TMP}" ] && rm -rf "${TMP}"; }

_config_precheck() {
    log_info "步骤 0: 前置检查"
    assert_condition "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" Available True || {
        log_error "Registry 未就绪——本用例要求 Registry 已启用"
        return 1
    }
    return 0
}

# § Configure Development Storage —— 文档把 emptyDir 列为快速起步路径
_config_development_storage() {
    log_info "步骤 1: 配置开发用存储（emptyDir）"
    run_block_strict registry-config:patch-development-storage || return 1
    run_block_strict registry-config:verify-development-storage || return 1

    # 文档 § Configure Development Storage 的 Expected results：
    # storage 为 emptyDir，且 storage.managementState 为 Managed
    assert_jsonpath_nonempty "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" '{.spec.storage.emptyDir}' || return 1
    assert_jsonpath_eq "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" \
        '{.spec.storage.managementState}' "Managed" || return 1
    log_success "emptyDir 存储已生效"
    return 0
}

# § Configure PVC Storage
_config_pvc_storage() {
    if [ "${REGISTRY_TEST_PVC:-false}" != "true" ]; then
        skip_test_env "未开启 REGISTRY_TEST_PVC，跳过 PVC 存储测试"
        return 0
    fi

    log_info "步骤 2: 配置 PVC 存储"
    # PVC 是 yaml 块 —— 用模式 C 写文件后执行文档里的 apply 命令
    runme print registry-config:pvc-manifest > "${TMP}/image-registry-pvc.yaml" || {
        log_error "获取 PVC 清单失败"; return 1
    }
    [ -s "${TMP}/image-registry-pvc.yaml" ] || { log_error "PVC 清单为空"; return 1; }

    ( cd "${TMP}" && run_block_strict registry-config:apply-pvc ) || return 1
    run_block_strict registry-config:patch-pvc-storage || return 1
    run_block_strict registry-config:verify-pvc-storage || return 1

    # 文档 § Configure PVC Storage 的 Expected results：
    # PVC 已 Bound，Config/cluster 的 storage.pvc.claim 指向它
    assert_jsonpath_nonempty "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" '{.spec.storage.pvc.claim}' || return 1
    assert_jsonpath_eq pvc image-registry '{.status.phase}' "Bound" "${REGISTRY_NS}" || return 1
    log_success "PVC 存储已生效"
    return 0
}

# § Configure S3-Compatible Storage Credentials
_config_s3_storage() {
    if [ "${REGISTRY_TEST_S3:-false}" != "true" ]; then
        skip_test_env "未开启 REGISTRY_TEST_S3，跳过 S3 存储测试"
        return 0
    fi

    log_info "步骤 3: 配置 S3 存储凭据"
    local cmd
    cmd="$(runme print registry-config:create-s3-secret)"
    cmd="${cmd//<access-key-id>/${REGISTRY_S3_ACCESS_KEY:?需要 REGISTRY_S3_ACCESS_KEY}}"
    cmd="${cmd//<secret-access-key>/${REGISTRY_S3_SECRET_KEY:?需要 REGISTRY_S3_SECRET_KEY}}"
    cmd="${cmd//<bucket-name>/${REGISTRY_S3_BUCKET:?需要 REGISTRY_S3_BUCKET}}"
    cmd="${cmd//<s3-region>/${REGISTRY_S3_REGION:?需要 REGISTRY_S3_REGION}}"
    bash -ec "${cmd}" || { log_error "创建 S3 凭据 Secret 失败"; return 1; }

    run_block_strict registry-config:verify-s3-secret || return 1
    # 文档：Secret 的 type 应为 Opaque
    assert_jsonpath_eq secret image-registry-private-configuration-user '{.type}' "Opaque" "${REGISTRY_NS}" || return 1

    if [ "${REGISTRY_TEST_CA:-false}" = "true" ]; then
        log_info "步骤 3b: 配置受信 CA"
        local cacmd
        cacmd="$(runme print registry-config:create-ca-configmap)"
        cacmd="${cacmd//<trusted-ca-configmap>/registry-trusted-ca}"
        cacmd="${cacmd//\/path\/to\/ca-bundle.crt/${REGISTRY_CA_BUNDLE:?需要 REGISTRY_CA_BUNDLE}}"
        bash -ec "${cacmd}" || { log_error "创建 CA ConfigMap 失败"; return 1; }
        run_block_strict registry-config:verify-ca-configmap || return 1
    else
        log_info "未开启 REGISTRY_TEST_CA，跳过 CA ConfigMap 部分"
    fi

    run_block_strict registry-config:patch-s3-storage || return 1
    run_block_strict registry-config:verify-s3-storage || return 1
    assert_jsonpath_nonempty "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" '{.spec.storage.s3.bucket}' || return 1
    log_success "S3 存储已生效"
    return 0
}

# § Configure Request Handling
_config_request_handling() {
    log_info "步骤 4: 配置请求处理（readOnly / requests）"
    run_block_strict registry-config:patch-request-handling || return 1
    run_block_strict registry-config:verify-request-handling || return 1

    # 文档 § Configure Request Handling 的 Expected results：
    # readOnly 与 requests.read.maxRunning / requests.write.maxInQueue 保持设定值
    assert_jsonpath_nonempty "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" '{.spec.requests.read.maxRunning}' || return 1
    assert_jsonpath_nonempty "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" '{.spec.requests.write.maxInQueue}' || return 1
    log_success "请求处理配置已生效"
    return 0
}

# § Configure Managed Service Account Pull Secrets
_config_managed_pull_secrets() {
    log_info "步骤 5: 配置托管 ServiceAccount pull secret"
    run_block_strict registry-config:patch-managed-pull-secrets || return 1
    run_block_strict registry-config:verify-managed-pull-secrets || return 1

    # 文档：imagePullSecret.managed 为 true 时，平台为命名空间自动创建 pull Secret
    assert_jsonpath_eq "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" \
        '{.spec.imagePullSecret.managed}' "true" || return 1

    log_info "步骤 5b: 检查工作负载命名空间的 puller 绑定"
    # 该块含 <workload-namespace> 占位符，用 REGISTRY_TEST_QUOTA_NS 代入
    local cmd
    cmd="$(runme print registry-config:check-workload-puller)"
    cmd="${cmd//<workload-namespace>/${QUOTA_NS}}"
    bash -ec "${cmd}" || { log_error "检查 puller 绑定失败"; return 1; }
    log_success "托管 pull secret 已生效"
    return 0
}

# § Configure Image Limits
_config_image_limits() {
    log_info "步骤 6: 配置镜像配额与限制（命名空间 ${QUOTA_NS}）"

    # 两个 yaml 块 —— 模式 C
    runme print registry-config:quota-manifest > "${TMP}/team-a-image-quota.yaml" || return 1
    runme print registry-config:limits-manifest > "${TMP}/team-a-image-limits.yaml" || return 1
    # 文档里的 apply 命令引用 team-a-*.yaml；文件名固定，命名空间由清单内容决定
    ( cd "${TMP}" && run_block_strict registry-config:apply-quota ) || return 1
    ( cd "${TMP}" && run_block_strict registry-config:apply-limits ) || return 1
    run_block_strict registry-config:verify-limits || return 1

    # 文档 § Configure Image Limits 的 Expected results：
    # ResourceQuota 的 hard.alauda.io/images 与 LimitRange 的 type 已生效
    assert_jsonpath_nonempty resourcequota image-registry-quota \
        '{.status.hard.alauda\.io/images}' "${QUOTA_NS}" || return 1
    assert_jsonpath_eq limitrange image-registry-limits '{.spec.limits[0].type}' "alauda.io/Image" "${QUOTA_NS}" || return 1
    log_success "镜像配额与限制已生效"
    return 0
}

# § Configure Scheduled Image Pruning
_config_image_pruner() {
    log_info "步骤 7: 配置定时镜像清理（ImagePruner）"

    runme print registry-config:pruner-manifest > "${TMP}/image-pruner.yaml" || return 1
    ( cd "${TMP}" && run_block_strict registry-config:apply-pruner ) || return 1
    run_block_strict registry-config:verify-pruner || return 1

    # 文档 § Configure Scheduled Image Pruning 的 Expected results：
    # ImagePruner 存在且 CronJob image-pruner 已创建
    assert_resource_exists imagepruners.imageregistry.operator.alauda.io cluster || return 1
    assert_resource_exists cronjob.batch image-pruner "${REGISTRY_NS}" || return 1
    log_success "定时清理已配置"
    return 0
}

# § Operate Storage
_operate_storage() {
    log_info "步骤 8: 检查存储状态"
    run_block_strict registry-config:inspect-storage || return 1
    return 0
}

test_setting_up_and_configuring_the_registry() {
    log_info "=========================================="
    log_info "开始 存储配置与请求处理 文档测试"
    log_info "被测文档: setting_up_and_configuring_the_registry.mdx"
    log_info "=========================================="

    _setup_tmp

    _config_precheck || return 1
    _config_development_storage || return 1
    _config_pvc_storage || return 1
    _config_s3_storage || return 1
    _config_request_handling || return 1
    _config_managed_pull_secrets || return 1
    _config_image_limits || return 1
    _config_image_pruner || return 1
    _operate_storage || return 1

    _cleanup_tmp

    log_success "=========================================="
    log_success "存储配置与请求处理 文档测试完成"
    log_success "=========================================="
    return 0
}

# 本文档不含卸载章节。存储后端是 Registry 的运行前提，后续用例依赖它，
# 按框架约定不自行编写清理逻辑。
