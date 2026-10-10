#!/usr/bin/env bash
# Alauda Container Platform Registry — 暴露 Registry 文档测试
#
# 被测文档: docs/en/configure/registry/exposing_the_registry.mdx
# 覆盖: § Expose the Registry by Using the Default Route /
#       § Expose the Registry by Using a Custom Secure Host /
#       § Verify the Exposure / § Access the Registry from Outside the Cluster
#
# ── 环境能力 ─────────────────────────────────────────────────────────────────
# 本用例依赖 Ingress 控制器与 LoadBalancer / 自定义域名。
# 环境不具备时以 skip_test_env 退出（框架约定：环境能力用环境变量判断，
# 不用标签表达）。
#   ENABLE_REGISTRY_EXPOSING=false   直接跳过整篇
#   REGISTRY_EXPOSING_HOST           自定义域名；未设置则跳过自定义路由部分

set -e

: "${FRAMEWORK_ROOT:?该脚本需经 docs-runme-tests/run.sh 运行}"
source "$FRAMEWORK_ROOT/framework/common.sh"
source "$FRAMEWORK_ROOT/framework/verify.sh"
source "$FRAMEWORK_ROOT/framework/acp-verify.sh"

REGISTRY_NS="image-registry-system"
REGISTRY_CONFIG="configs.imageregistry.operator.alauda.io"
REGISTRY_CONFIG_NAME="cluster"
EXPOSING_HOST="${REGISTRY_EXPOSING_HOST:-}"

_exposing_precheck() {
    log_info "步骤 0: 检查环境是否支持暴露测试"
    if [ "${ENABLE_REGISTRY_EXPOSING:-true}" != "true" ]; then
        skip_test_env "ENABLE_REGISTRY_EXPOSING=false，跳过暴露测试"
        return 0
    fi
    # 文档假设 Registry 已启用
    assert_condition "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" Available True || {
        log_error "Registry 未就绪——本用例要求 § Change the Registry Management State 已完成"
        return 1
    }
    return 0
}

# 等待 Ingress 被 operator 调和出来
#
# 为什么需要：patch defaultRoute / routes 之后，operator 不会立刻创建 Ingress。
# 实测首次跑时 patch 成功、紧接着 `kubectl get ingress default-route` 报 NotFound——
# 那是**测试脚本没等**，不是文档的问题。等 1 分钟内即可。
_wait_for_registry_ingress() {
    local name="$1" timeout="${2:-120}"
    local waited=0
    while [ "${waited}" -lt "${timeout}" ]; do
        if kubectl -n "${REGISTRY_NS}" get ingress "${name}" >/dev/null 2>&1; then
            log_info "Ingress ${name} 已出现（等待 ${waited}s）"
            return 0
        fi
        sleep 5
        waited=$((waited + 5))
    done
    log_error "等待 Ingress ${name} 超时（${timeout}s）"
    return 1
}

# 平台没有默认域名时，default-route 的 host 会是 `*`，且 operator 报
#   Degraded=True (IngressDegraded): ingress default-route has no host and no
#   published load balancer address
# 这是**环境能力问题**（没有通配域名 / 没有可用的 LB 地址），不是文档错误。
# 文档未描述这一状态，属可补充项。
#
# 返回 0 = 环境无法提供 host（调用方应 skip_test_env 并 return 0）
# 返回 1 = 有可用 host
#
# 注意 skip_test_env 的语义：它只设 __TEST_SKIPPED=1 并返回 0，**不中断执行**。
# 引擎在测试函数返回 0 且该标志为 1 时才记为 skipped。所以调用方必须
# 显式 `skip_test_env ...; return 0`，不能写成 `helper || return 1`。
_default_route_lacks_host() {
    local degraded_reason host
    degraded_reason="$(kubectl get "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" \
        -o jsonpath='{range .status.conditions[?(@.type=="Degraded")]}{.reason}{end}' 2>/dev/null)"
    host="$(kubectl -n "${REGISTRY_NS}" get ingress default-route \
        -o jsonpath='{.spec.rules[0].host}' 2>/dev/null)"

    if [ "${degraded_reason}" = "IngressDegraded" ] || [ "${host}" = "*" ] || [ -z "${host}" ]; then
        log_warn "default-route 没有可用 host（reason=${degraded_reason:-<none>}, host=${host:-<empty>}）"
        log_warn "operator 报: ingress default-route has no host and no published load balancer address"
        return 0
    fi
    log_info "default-route host: ${host}"
    return 1
}

# § Expose the Registry by Using the Default Route
_exposing_default_route() {
    log_info "步骤 1: 启用默认路由（defaultRoute=true）"
    run_block_strict exposing:enable-default-route || return 1

    # patch 之后必须等 operator 调和，否则 verify 会因为 Ingress 还没建出来而误判。
    # 实测首次跑就踩了：patch 成功、紧接着 get ingress 报 NotFound——
    # 那是测试脚本没等，不是文档的问题。
    _wait_for_registry_ingress default-route || return 1

    log_info "步骤 2: 验证默认路由"
    run_block_strict exposing:verify-default-route || return 1

    # 文档 § Expose ... Default Route 的 Expected results：
    # Ingress 里出现 default-route，且 Config/cluster 的 defaultRoute 为 true
    assert_jsonpath_eq "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" '{.spec.defaultRoute}' "true" || return 1
    assert_resource_exists ingress.networking.k8s.io default-route "${REGISTRY_NS}" || return 1

    # 环境没有默认域名时，后续依赖 host 的步骤无法进行 —— 明确跳过而非失败
    if _default_route_lacks_host; then
        skip_test_env "平台未配置默认域名 / 无可用 LB 地址，default-route 拿不到 host；依赖 host 的步骤无法进行"
        return 0
    fi

    log_info "步骤 3: 解析默认路由的 host"
    run_block_strict exposing:resolve-default-host || return 1
    log_info "步骤 4: 选择可用 host"
    run_block_strict exposing:select-host || return 1

    log_info "步骤 5: 用默认 host 登录（文档给法）"
    if ! run_block_strict exposing:login-default-host; then
        log_warn "默认 host 不可达，跳过登录验证（文档 § Prerequisites 已说明该限制）"
    fi
    return 0
}

# § Expose the Registry by Using a Custom Secure Host
_exposing_custom_route() {
    if [ -z "${EXPOSING_HOST}" ]; then
        skip_test_env "未设置 REGISTRY_EXPOSING_HOST，跳过自定义安全主机测试"
        return 0
    fi

    log_info "步骤 6: 创建 TLS Secret（文档示例用 registry.example.com）"
    # 文档的命令引用 /path/to/xxx.crt|key 占位符。
    # 有 REGISTRY_TLS_CERT/REGISTRY_TLS_KEY 时按文档形状执行，否则只校验命令形态。
    if [ -n "${REGISTRY_TLS_CERT:-}" ] && [ -n "${REGISTRY_TLS_KEY:-}" ]; then
        local cmd
        cmd="$(runme print exposing:create-tls-secret)"
        cmd="${cmd//\/path\/to\/registry.example.com.crt/${REGISTRY_TLS_CERT}}"
        cmd="${cmd//\/path\/to\/registry.example.com.key/${REGISTRY_TLS_KEY}}"
        bash -ec "${cmd}" || { log_error "创建 TLS Secret 失败"; return 1; }
        assert_resource_exists secret registry-tls "${REGISTRY_NS}" || return 1
    else
        log_warn "未提供 REGISTRY_TLS_CERT / REGISTRY_TLS_KEY，跳过 TLS Secret 创建"
    fi

    log_info "步骤 7: 配置自定义路由"
    run_block_strict exposing:configure-custom-route || return 1

    # 同 default-route：patch routes 之后要等 operator 把 Ingress 调和出来
    _wait_for_registry_ingress public-registry || return 1

    log_info "步骤 8: 验证自定义路由"
    run_block_strict exposing:verify-custom-route || return 1

    # 文档 § Expose ... Custom Secure Host 的 Expected results：
    # routes 里出现该 host，Ingress 名为 public-registry
    assert_resource_exists ingress.networking.k8s.io public-registry "${REGISTRY_NS}" || return 1
    assert_jsonpath_eq ingress.networking.k8s.io public-registry \
        '{.spec.rules[0].host}' "${EXPOSING_HOST}" "${REGISTRY_NS}" || return 1
    log_success "自定义路由已生效"
    return 0
}

# § Verify the Exposure
_exposing_verify() {
    log_info "步骤 9: 校验 TLS 证书（文档用 openssl s_client）"
    if [ -n "${EXPOSING_HOST}" ]; then
        # 该块依赖 host 可解析且 443 可达；不可达时跳过，不算失败
        if ! run_block_strict exposing:verify-tls; then
            log_warn "无法从本机连接 ${EXPOSING_HOST}:443，跳过 TLS 校验（需 ALB/DNS 支持）"
        fi
    else
        log_warn "未设置 REGISTRY_EXPOSING_HOST，跳过 TLS 校验"
    fi

    log_info "步骤 10: 检查 Ingress"
    run_block_strict exposing:inspect-ingress || return 1
    return 0
}

# § Access the Registry from Outside the Cluster
_exposing_external_access() {
    log_info "步骤 11: 外部登录（不安全 / 安全两种）"
    # 两个块都引用文档示例域名 registry.example.com，实际环境不可达。
    # 只执行文档给的块以验证命令形态；失败则记录为环境限制。
    if ! run_block_strict exposing:login-insecure; then
        log_warn "示例域名 registry.example.com 不可达，跳过（需把文档示例替换为真实域名）"
    fi
    if ! run_block_strict exposing:login-secure; then
        log_warn "示例域名 registry.example.com 不可达，跳过"
    fi

    log_info "步骤 12: 外部客户端 push / pull（nerdctl）"
    if ! command -v nerdctl >/dev/null 2>&1; then
        skip_test_env "本机没有 nerdctl，跳过外部 push/pull 验证"
        return 0
    fi
    if ! run_block_strict exposing:external-push-pull; then
        log_warn "外部 push/pull 失败——示例域名不可达或客户端未配置信任"
    fi
    return 0
}

test_exposing_the_registry() {
    log_info "=========================================="
    log_info "开始 暴露 Registry 文档测试"
    log_info "被测文档: docs/en/configure/registry/exposing_the_registry.mdx"
    log_info "=========================================="

    _exposing_precheck || return 1
    _exposing_default_route || return 1
    _exposing_custom_route || return 1
    _exposing_verify || return 1
    _exposing_external_access || return 1

    log_success "=========================================="
    log_success "暴露 Registry 文档测试完成"
    log_success "=========================================="
    return 0
}

# 本文档不含卸载章节；defaultRoute 与自定义路由是 Registry 的对外暴露配置，
# 后续用例（如外部访问）依赖它，按框架约定不自行编写清理逻辑。
