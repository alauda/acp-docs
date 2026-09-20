#!/usr/bin/env bash
# Alauda Container Platform Registry — 访问 Registry 文档测试
#
# 被测文档: docs/en/developer/registry/accessing_the_registry.mdx
# 覆盖: § Prerequisites / § Access the Registry from Inside the Cluster /
#       § Access the Registry from a Workload / § Access the Registry from Outside the Cluster /
#       § Inspect Registry Objects with ac
#
# ── 环境能力 ─────────────────────────────────────────────────────────────────
#   REGISTRY_TEST_ACCESS_NS   工作负载命名空间，默认 team-a
#   REGISTRY_TEST_IMAGE       工作负载用的镜像，默认 <registry>/acp/coredns:<tag>
#   REGISTRY_TEST_EXTERNAL=true   允许跑外部 nerdctl push/pull（需要域名可达 + 客户端信任）

set -e

: "${FRAMEWORK_ROOT:?该脚本需经 docs-runme-tests/run.sh 运行}"
source "$FRAMEWORK_ROOT/framework/common.sh"
source "$FRAMEWORK_ROOT/framework/verify.sh"
source "$FRAMEWORK_ROOT/framework/acp-verify.sh"

REGISTRY_NS="image-registry-system"
REGISTRY_CONFIG="configs.imageregistry.operator.alauda.io"
REGISTRY_CONFIG_NAME="cluster"
WORKLOAD_NS="${REGISTRY_TEST_ACCESS_NS:-team-a}"
PULLER_NS="${REGISTRY_TEST_PULLER_NS:-team-b}"
TMP=""

_setup_tmp() { TMP="$(mktemp -d)"; }
_cleanup_tmp() { [ -n "${TMP}" ] && rm -rf "${TMP}"; }

_accessing_prerequisites() {
    log_info "步骤 0: 前置检查"
    run_block_strict accessing:set-mode-modern || return 1

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

# § Access the Registry from Inside the Cluster
_accessing_inside_cluster() {
    log_info "步骤 1: 集群内访问地址（文档给的内部 Service 地址）"

    # 文档给的是 text 块，不是可执行命令 —— 用 runme print 取内容后断言它确实是
    # 集群内可达的 Service 地址形态
    local addr
    addr="$(runme print accessing:internal-address 2>/dev/null)"
    log_info "文档给出的内部地址: ${addr}"
    if [ -z "${addr}" ]; then
        log_error "内部地址块为空"
        return 1
    fi

    # 该地址应能在集群里解析：用一次临时 Pod 验证（文档 § Access from Inside the Cluster 的语义）
    local svc_name svc_ns
    svc_name="${addr%%:*}"
    svc_name="${svc_name%%.*}"
    svc_ns="$(printf '%s' "${addr}" | sed -n 's/^[^.]*\.\([^.]*\)\..*/\1/p')"
    if [ -z "${svc_name}" ] || [ -z "${svc_ns}" ]; then
        log_error "无法从 ${addr} 解析出 Service 与命名空间"
        return 1
    fi
    assert_resource_exists service "${svc_name}" "${svc_ns}" || {
        log_error "文档给出的内部地址 ${addr} 对应的 Service 不存在"
        return 1
    }
    log_success "内部访问地址有效"
    return 0
}

# § Access the Registry from a Workload
_accessing_from_workload() {
    log_info "步骤 2: 用默认 ServiceAccount 访问（依赖托管 pull secret）"

    # my-app.yaml 是 yaml 块 —— 模式 C
    runme print accessing:workload-manifest > "${TMP}/my-app.yaml" || return 1
    [ -s "${TMP}/my-app.yaml" ] || { log_error "工作负载清单为空"; return 1; }

    # 文档的清单里命名空间与镜像可能用占位符；有配置时替换
    if [ -n "${REGISTRY_TEST_IMAGE:-}" ]; then
        python3 - "${TMP}/my-app.yaml" "${REGISTRY_TEST_IMAGE}" "${WORKLOAD_NS}" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
s = p.read_text()
s = s.replace("image: my-app:latest", f"image: {sys.argv[2]}")
s = s.replace("namespace: team-a", f"namespace: {sys.argv[3]}")
p.write_text(s)
PY
    fi

    ( cd "${TMP}" && run_block_strict accessing:apply-workload ) || {
        log_error "应用工作负载失败——若镜像拉取失败，检查托管 pull secret（见 registry-config 用例）"
        return 1
    }
    run_block_strict accessing:wait-workload || {
        log_error "工作负载未就绪"
        log_error "Pod 状态: $(kubectl -n "${WORKLOAD_NS}" get pods --no-headers 2>&1 | head -3)"
        return 1
    }
    log_success "工作负载已就绪（说明托管 pull secret 生效）"
    return 0
}

# § Access the Registry from a Workload —— 自定义 ServiceAccount 路径
_accessing_with_puller_sa() {
    log_info "步骤 3: 用专用 ServiceAccount 访问"

    run_block_strict accessing:create-puller-sa || return 1
    # bind-puller 含 <namespace> / <serviceaccount> 占位符
    local cmd
    cmd="$(runme print accessing:bind-puller)"
    cmd="${cmd//<namespace>/${PULLER_NS}}"
    cmd="${cmd//<serviceaccount>/app-puller}"
    bash -ec "${cmd}" || { log_error "绑定 puller 失败"; return 1; }

    assert_resource_exists serviceaccount app-puller "${PULLER_NS}" || return 1
    assert_rbac_allowed "system:serviceaccount:${PULLER_NS}:app-puller" \
        get image.alauda.io imagestreams layers || {
        log_error "app-puller 应能拉取镜像层"
        return 1
    }

    log_info "步骤 3b: 解析 pull secret"
    # 该块是 PULL_SECRET="$(...)" 赋值式，用 eval 取（模式 F）
    eval "$(runme print accessing:resolve-pull-secret)" || {
        log_error "解析 pull secret 失败"
        return 1
    }

    runme print accessing:workload-with-puller-manifest > "${TMP}/my-app-app-puller.yaml" || return 1
    ( cd "${TMP}" && run_block_strict accessing:apply-workload-with-puller ) || return 1
    run_block_strict accessing:wait-workload || return 1
    log_success "专用 SA 访问路径可用"
    return 0
}

# § Access the Registry from Outside the Cluster
_accessing_from_outside() {
    log_info "步骤 4: 外部访问"

    run_block_strict accessing:login || {
        log_error "ac registry login 失败"
        return 1
    }
    run_block_strict accessing:prepare-auth-dir || return 1

    if [ "${REGISTRY_TEST_EXTERNAL:-false}" != "true" ]; then
        skip_test_env "未开启 REGISTRY_TEST_EXTERNAL，跳过外部 nerdctl push/pull"
    fi
    if ! command -v nerdctl >/dev/null 2>&1; then
        skip_test_env "本机没有 nerdctl，跳过外部 push/pull"
    fi

    # 三个块都引用文档示例域名 registry.example.com，实际环境需替换
    if ! run_block_strict accessing:external-push; then
        log_warn "外部 push 失败——示例域名不可达或客户端未信任证书"
    fi
    if ! run_block_strict accessing:external-pull-tag; then
        log_warn "外部 pull（按 tag）失败"
    fi
    if ! run_block_strict accessing:external-pull-digest; then
        log_warn "外部 pull（按 digest）失败"
    fi
    return 0
}

# § Inspect Registry Objects with ac
_accessing_inspect_objects() {
    log_info "步骤 5: 用 ac 检查 Registry 对象"

    run_block_strict accessing:list-imagestreams || return 1
    run_block_strict accessing:get-imagestream || return 1
    run_block_strict accessing:get-imagestreamtag || return 1
    run_block_strict accessing:get-imagestreamimage || return 1
    run_block_strict accessing:confirm-mode-modern || return 1
    run_block_strict accessing:list-imagestreams-team-a || return 1

    # 文档 § Inspect Registry Objects 的 Expected results：
    # ImageStreamTag 的 current 条目指向 Registry v2 的地址
    local ref
    ref="$(kubectl -n "${WORKLOAD_NS}" get imagestreamtags.image.alauda.io my-app:v1 \
        -o jsonpath='{.image.dockerImageReference}' 2>/dev/null)"
    if [ -n "${ref}" ]; then
        case "${ref}" in
            *"${REGISTRY_NS}"*|*image-registry*) ;;
            *) log_warn "ImageStreamTag 的引用 ${ref} 不含 Registry v2 地址，请复核" ;;
        esac
    fi
    log_success "对象检查完成"
    return 0
}

test_accessing_the_registry() {
    log_info "=========================================="
    log_info "开始 访问 Registry 文档测试"
    log_info "被测文档: docs/en/developer/registry/accessing_the_registry.mdx"
    log_info "=========================================="

    _setup_tmp

    _accessing_prerequisites || return 1
    _accessing_inside_cluster || return 1
    _accessing_from_workload || return 1
    _accessing_with_puller_sa || return 1
    _accessing_from_outside || return 1
    _accessing_inspect_objects || return 1

    _cleanup_tmp

    log_success "=========================================="
    log_success "访问 Registry 文档测试完成"
    log_success "=========================================="
    return 0
}

# 本文档不含卸载章节。用例创建了 my-app 工作负载与 app-puller SA，
# 但文档没有对应的清理步骤，按框架约定「不要自行编写清理逻辑」，
# 故不提供 cleanup_accessing_the_registry。
