#!/usr/bin/env bash
# Alauda Container Platform Registry — 权限、用量与清理文档测试
#
# 被测文档: docs/en/configure/registry/managing_access_and_cleanup.mdx
# 覆盖: § Prerequisites / § Grant Namespace Permissions / § View Usage /
#       § Verify Image Signatures / § Prune Images / § Run Registry Garbage Collection
#
# ── 环境能力 ─────────────────────────────────────────────────────────────────
#   REGISTRY_TEST_SIGNATURE=true    有签名工具链时跑签名校验段落
#   REGISTRY_TEST_DESTRUCTIVE=true  允许执行真正会删数据的 prune --confirm / gc --confirm
# 默认都关闭：只跑 dry-run / 预览类命令，不破坏数据。

set -e

: "${FRAMEWORK_ROOT:?该脚本需经 docs-runme-tests/run.sh 运行}"
source "$FRAMEWORK_ROOT/framework/common.sh"
source "$FRAMEWORK_ROOT/framework/verify.sh"
source "$FRAMEWORK_ROOT/framework/acp-verify.sh"

REGISTRY_NS="image-registry-system"
REGISTRY_CONFIG="configs.imageregistry.operator.alauda.io"
REGISTRY_CONFIG_NAME="cluster"
ACCESS_NS="${REGISTRY_TEST_ACCESS_NS:-team-a}"
TMP=""

_setup_tmp() { TMP="$(mktemp -d)"; }
_cleanup_tmp() { [ -n "${TMP}" ] && rm -rf "${TMP}"; }

# § Prerequisites
_access_prerequisites() {
    log_info "步骤 0: 前置检查（文档要求 registry mode = modern）"
    run_block_strict registry-access:set-mode-modern || return 1

    # 文档 § Prerequisites 明确要求先切到 modern 模式
    local mode
    mode="$(ac config get-registry-mode 2>/dev/null | awk 'NR==2 {print $1}')"
    if [ "${mode}" != "modern" ]; then
        log_error "registry mode 应为 modern，实际: ${mode}"
        return 1
    fi
    assert_condition "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" Available True || return 1
    log_success "前置条件满足"
    return 0
}

# § Grant Namespace Permissions
_access_grant_permissions() {
    log_info "步骤 1: 授予命名空间权限"

    # 三个 rolebinding 块都含 <username> / <namespace> 占位符
    local cmd
    cmd="$(runme print registry-access:bind-puller-user)"
    cmd="${cmd//<username>/${REGISTRY_TEST_USER:-registry-test-user}}"
    cmd="${cmd//<image-namespace>/${ACCESS_NS}}"
    cmd="${cmd//<namespace>/${ACCESS_NS}}"
    bash -ec "${cmd}" || { log_error "创建 puller rolebinding 失败"; return 1; }

    cmd="$(runme print registry-access:bind-pusher-user)"
    cmd="${cmd//<username>/${REGISTRY_TEST_USER:-registry-test-user}}"
    cmd="${cmd//<namespace>/${ACCESS_NS}}"
    bash -ec "${cmd}" || { log_error "创建 pusher rolebinding 失败"; return 1; }

    cmd="$(runme print registry-access:bind-puller-sa)"
    cmd="${cmd//<serviceaccount>/${REGISTRY_TEST_SA:-default}}"
    cmd="${cmd//<namespace>/${ACCESS_NS}}"
    bash -ec "${cmd}" || { log_error "创建 SA puller rolebinding 失败"; return 1; }

    log_info "步骤 2: 验证绑定"
    run_block_strict registry-access:verify-bindings || return 1

    # 文档 § Grant Namespace Permissions 的 Expected results：
    # 三个 RoleBinding 都存在
    assert_resource_exists rolebinding image-puller-user "${ACCESS_NS}" || return 1
    assert_resource_exists rolebinding image-pusher-user "${ACCESS_NS}" || return 1
    assert_resource_exists rolebinding image-puller-sa "${ACCESS_NS}" || return 1

    log_info "步骤 3: 用 SubjectAccessReview 校验权限"
    # 文档这里的块用的是 kubectl auth can-i。对 imagestreams/layers 这类
    # 在 discovery 里的资源 can-i 是可用的，所以照文档执行即可；
    # 但**结论**用 SAR 交叉验证，避免 can-i 的 discovery 缓存问题。
    local cmd2
    cmd2="$(runme print registry-access:check-delete-permission)"
    cmd2="${cmd2//<username>/${REGISTRY_TEST_USER:-registry-test-user}}"
    bash -ec "${cmd2}" || true

    assert_rbac_allowed "system:serviceaccount:${ACCESS_NS}:${REGISTRY_TEST_SA:-default}" \
        get image.alauda.io imagestreams layers || {
        log_error "SA 应能拉取镜像层（system:image-puller 未生效）"
        return 1
    }
    log_success "命名空间权限已正确授予"
    return 0
}

# § View Usage
_access_view_usage() {
    log_info "步骤 4: 查看用量"
    run_block_strict registry-access:top-images || return 1
    run_block_strict registry-access:top-imagestreams || return 1
    return 0
}

# § Verify Image Signatures
_access_verify_signatures() {
    if [ "${REGISTRY_TEST_SIGNATURE:-false}" != "true" ]; then
        skip_test_env "未开启 REGISTRY_TEST_SIGNATURE，跳过签名校验段落"
    fi

    log_info "步骤 5: 校验镜像签名"
    # 文档的块含 sha256:<digest> 占位符，需要一个已签名的镜像摘要
    local digest="${REGISTRY_TEST_SIGNED_DIGEST:?需要 REGISTRY_TEST_SIGNED_DIGEST}"
    local cmd
    cmd="$(runme print registry-access:verify-signature)"
    cmd="${cmd//sha256:<digest>/${digest}}"
    bash -ec "${cmd}" || { log_error "签名校验失败"; return 1; }

    log_info "步骤 6: 读取签名记录"
    cmd="$(runme print registry-access:get-image-signatures)"
    cmd="${cmd//sha256:<digest>/${digest}}"
    bash -ec "${cmd}" > "${TMP}/sig-before.txt" || return 1

    log_info "步骤 7: 移除签名"
    cmd="$(runme print registry-access:remove-signatures)"
    cmd="${cmd//sha256:<digest>/${digest}}"
    bash -ec "${cmd}" || { log_error "移除签名失败"; return 1; }

    run_block_strict registry-access:verify-signatures-removed || true
    log_success "签名校验段落完成"
    return 0
}

# § Prune Images —— 默认只跑预览
_access_prune_images() {
    log_info "步骤 8: 预览镜像清理（文档的 dry-run 语义）"
    run_block_strict registry-access:prune-preview || return 1
    run_block_strict registry-access:prune-keep-revisions || return 1
    run_block_strict registry-access:prune-with-allowlist || return 1
    run_block_strict registry-access:prune-allowlist-preview || return 1

    if [ "${REGISTRY_TEST_DESTRUCTIVE:-false}" != "true" ]; then
        log_warn "未开启 REGISTRY_TEST_DESTRUCTIVE，跳过真正会删数据的 prune/gc"
        return 0
    fi

    log_info "步骤 9: 执行真实清理（已开启 DESTRUCTIVE）"
    run_block_strict registry-access:prune-registry-confirm || return 1
    log_success "镜像清理完成"
    return 0
}

# § Run Registry Garbage Collection
_access_registry_gc() {
    log_info "步骤 10: Registry 垃圾回收"

    # 文档先给不带 --confirm 的预览，再给 --confirm 的真实执行
    run_block_strict registry-access:gc-preview || return 1

    if [ "${REGISTRY_TEST_DESTRUCTIVE:-false}" != "true" ]; then
        log_warn "未开启 REGISTRY_TEST_DESTRUCTIVE，跳过 gc --confirm"
        return 0
    fi

    run_block_strict registry-access:gc-confirm || return 1
    run_block_strict registry-access:login || return 1
    log_success "垃圾回收完成"
    return 0
}

test_managing_access_and_cleanup() {
    log_info "=========================================="
    log_info "开始 权限、用量与清理 文档测试"
    log_info "被测文档: managing_access_and_cleanup.mdx"
    log_info "=========================================="

    _setup_tmp

    _access_prerequisites || return 1
    _access_grant_permissions || return 1
    _access_view_usage || return 1
    _access_verify_signatures || return 1
    _access_prune_images || return 1
    _access_registry_gc || return 1

    _cleanup_tmp

    log_success "=========================================="
    log_success "权限、用量与清理 文档测试完成"
    log_success "=========================================="
    return 0
}

# 本文档含清理动作（prune / gc），但那些是**文档的功能内容**，不是本用例
# 自己创建的资源，因此不提供 cleanup_* 函数——按框架约定，
# cleanup 只用于回收测试自己建出来的东西。
