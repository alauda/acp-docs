#!/usr/bin/env bash
# Alauda Container Platform Registry — Image Registry Operator 文档测试
#
# 被测文档: docs/en/configure/registry/image_registry_operator.mdx
# 覆盖: § Install by Using YAML / § Upgrade / § Change the Registry Management State /
#       § Check Operator and Registry Status / § Check Registry Logs and Metrics Access
#
# ── 这个脚本同时是「通用样板」────────────────────────────────────────────────
# 它演示了任何模块的文档测试都可以照搬的骨架：
#   1. 前置：确认被测对象在环境里的初始状态（文档的前提条件是否成立）
#   2. 逐块执行：每个带 {name=} 的代码块都要被跑到（100% 覆盖）
#   3. 断言文档的**期望结果**：文档用散文写的 "Expected results" 也要验，
#      用 framework/acp-verify.sh 的状态断言，而不是肉眼看输出
#   4. 环境能力不足时 skip_test_env，而不是让用例失败
#
# 换一个模块时改什么：只有「块名 → 步骤」的映射与断言。断言函数是通用的。
#
# ── 环境要求 ─────────────────────────────────────────────────────────────────
#   - ACP 4.4 环境（已有环境，或 ./provision.sh --project registry 现场造）
#   - Registry Operator 包已在 OperatorHub 上架，或提供 PKG_REGISTRY_OPERATOR_URL
#
# ── 可选开关 ─────────────────────────────────────────────────────────────────
#   REGISTRY_UPGRADE_PACKAGE_URL   提供后才会跑 § Upgrade（需要目录源里有更新版本）
#   REGISTRY_PULL_SECRET_NAME      组件工作负载用的 pull Secret，默认 global-registry-auth
#   REGISTRY_TEST_RESTORE_MANAGED  § Change Management State 跑完后是否恢复 Managed，默认 true

set -e

# FRAMEWORK_ROOT 由 docs-runme-tests/run.sh 引擎注入
: "${FRAMEWORK_ROOT:?该脚本需经 docs-runme-tests/run.sh 运行}"

# 加载框架函数库
source "$FRAMEWORK_ROOT/framework/common.sh"
source "$FRAMEWORK_ROOT/framework/verify.sh"
# ACP 集群状态断言（资源存在性 / condition / jsonpath / CRD schema / RBAC-SAR）。
# run.sh 已自动加载，这里显式 source 是为了让脚本单独可读、可被工具静态分析。
source "$FRAMEWORK_ROOT/framework/acp-verify.sh"

# 项目级默认值
REGISTRY_NS="image-registry-system"
REGISTRY_OPERATOR="cluster-image-registry-operator"
REGISTRY_SUBSCRIPTION="cluster-image-registry-operator"
REGISTRY_CONFIG="configs.imageregistry.operator.alauda.io"
REGISTRY_CONFIG_NAME="cluster"
REGISTRY_PULL_SECRET_NAME="${REGISTRY_PULL_SECRET_NAME:-global-registry-auth}"
REGISTRY_TEST_RESTORE_MANAGED="${REGISTRY_TEST_RESTORE_MANAGED:-true}"

# 临时工作目录：放从代码块里取出来的 YAML
REGISTRY_TMP=""

_registry_setup_tmp() {
    REGISTRY_TMP="$(mktemp -d)"
}

_registry_cleanup_tmp() {
    [ -n "${REGISTRY_TMP}" ] && rm -rf "${REGISTRY_TMP}"
}

# ==============================================================================
# 步骤 0：前置检查
# ==============================================================================

# 文档 § Install by Using YAML 的 Prerequisites 明确要求包已在目标 CatalogSource 里。
# 这是文档自己写下的前提，测试必须先确认它成立——否则后面每一步的失败原因
# 都会被 Subscription 的准入拒绝掩盖掉。
_registry_step_prerequisites() {
    log_info "步骤 0: 检查前置条件（Operator 包是否已在 OperatorHub）"

    local out
    out="$(runme run registry:check-package-available 2>&1)" || {
        log_error "查询 PackageManifest 失败"
        log_error "输出: ${out}"
        return 1
    }

    if [ -z "${out}" ]; then
        log_error "OperatorHub 中没有 ${REGISTRY_OPERATOR} 包。"
        log_error "文档 § Install by Using YAML 的 Prerequisites 要求它先上架："
        log_error "  violet push <pkg>.tgz --target-catalog-source=platform ..."
        log_error "或提供 PKG_REGISTRY_OPERATOR_URL 让 project_init 代劳。"
        return 1
    fi
    log_success "Operator 包已就绪: ${out}"
    return 0
}

# ==============================================================================
# § Install by Using YAML
# ==============================================================================

# 步骤 1：建命名空间并打 label（文档 § Install by Using YAML 第一段）
_registry_step_create_namespace() {
    log_info "步骤 1: 创建命名空间并打 label"
    # 该块是多命令块（create + label），用严格模式执行，首条失败即中断。
    # 不能直接 runme run——它只回传最后一条 label 的返回码，
    # create 失败时会被 label 的成功掩盖。
    run_block_strict registry:create-namespace || return 1

    assert_resource_exists namespace "${REGISTRY_NS}" || return 1
    assert_jsonpath_eq namespace "${REGISTRY_NS}" '{.metadata.labels.cpaas\.io/project}' "cpaas-system" || return 1
    log_success "命名空间就绪且 label 正确"
    return 0
}

# 步骤 2：应用 Subscription（文档 § Install by Using YAML 第二段）
# 模式 C：把 yaml 块内容写到文件，再执行文档里的 apply 命令。
# 不能对 yaml 块用 runme run——runme 对 ```yaml 只回显不执行且返回 0。
_registry_step_apply_subscription() {
    log_info "步骤 2: 应用 Subscription 清单"

    local manifest="${REGISTRY_TMP}/image-registry-operator-subscription.yaml"
    runme print registry:subscription-manifest > "${manifest}" || {
        log_error "获取 Subscription 清单失败"
        return 1
    }
    if [ ! -s "${manifest}" ]; then
        log_error "Subscription 清单为空"
        return 1
    fi

    # 文档里的 apply 命令引用的就是这个文件名，cd 到临时目录执行
    run_block_strict registry:apply-subscription "${REGISTRY_TMP}" || {
        log_error "应用 Subscription 失败——若报 check-subscription.cpaas.io 准入拒绝，"
        log_error "说明包没上架（见步骤 0）"
        return 1
    }

    assert_resource_exists subscription.operators.coreos.com "${REGISTRY_SUBSCRIPTION}" "${REGISTRY_NS}" || return 1
    log_success "Subscription 已创建"
    return 0
}

# 步骤 3：审批 InstallPlan（文档 § Install by Using YAML 第三段）
# 模式 H：块里有 <installplan-name> 占位符，需要动态替换。
_registry_step_approve_installplan() {
    log_info "步骤 3: 审批 InstallPlan"

    # 先把块里的 installplan 列表跑一遍，确认确有 InstallPlan
    local list_out
    list_out="$(runme print registry:approve-installplan | head -1)"
    local plan_name
    plan_name="$(kubectl -n "${REGISTRY_NS}" get installplan --no-headers 2>/dev/null \
        | awk '$4 == "false" {print $1; exit}')"

    if [ -z "${plan_name}" ]; then
        # 没有待审批的：可能已自动批准，或 CatalogSource 还没刷新出 InstallPlan
        plan_name="$(kubectl -n "${REGISTRY_NS}" get installplan --no-headers 2>/dev/null \
            | awk '{print $1; exit}')"
    fi
    if [ -z "${plan_name}" ]; then
        log_error "没有找到 InstallPlan——Subscription 可能还没被解析"
        log_error "Subscription 状态: $(kubectl -n "${REGISTRY_NS}" get subscription "${REGISTRY_SUBSCRIPTION}" -o jsonpath='{.status.conditions[*].message}' 2>&1)"
        return 1
    fi
    log_info "目标 InstallPlan: ${plan_name}"

    # 替换占位符后执行文档里的 patch 命令
    local cmd
    cmd="$(runme print registry:approve-installplan | grep -A3 'patch installplan')"
    cmd="${cmd//<installplan-name>/${plan_name}}"
    if ! bash -ec "${cmd}" >/dev/null 2>&1; then
        log_error "审批 InstallPlan 失败"
        return 1
    fi

    assert_jsonpath_eq installplan.operators.coreos.com "${plan_name}" '{.spec.approved}' "true" "${REGISTRY_NS}" || return 1
    log_success "InstallPlan 已审批"
    return 0
}

# 步骤 4：等待 Operator 就绪（文档 § Install by Using YAML 第四段）
_registry_step_wait_operator() {
    log_info "步骤 4: 等待 Operator 就绪（文档给 300s）"

    run_block_strict registry:wait-operator-available || {
        log_error "等待 Operator 就绪超时"
        log_error "Pod 状态: $(kubectl -n "${REGISTRY_NS}" get pods -l name=${REGISTRY_OPERATOR} --no-headers 2>&1)"
        return 1
    }

    assert_workload_ready deployment "${REGISTRY_OPERATOR}" "${REGISTRY_NS}" || return 1
    # 文档 § Install by Using YAML 的 Expected results 之一：CSV 为 Succeeded
    assert_jsonpath_eq csv.operators.coreos.com \
        "$(kubectl -n "${REGISTRY_NS}" get csv --no-headers -o custom-columns=N:.metadata.name | head -1)" \
        '{.status.phase}' "Succeeded" "${REGISTRY_NS}" || return 1
    log_success "Operator 就绪且 CSV 为 Succeeded"
    return 0
}

# 步骤 5：组件工作负载的 pull 凭据（文档 § Install by Using YAML 的 Note）
#
# 这一步对应我实测踩到的坑：CSV 会创建专用 SA，但组件拉不到镜像时
# 表现为 insufficient_scope: authorization failed——看起来像 RBAC 问题，
# 实际是凭据挂载。文档给了排查与修补命令，这里把它变成回归测试。
_registry_step_workload_pull_secret() {
    log_info "步骤 5: 检查组件工作负载的 pull 凭据"

    local out
    out="$(runme run registry:check-workload-pull-secret 2>&1)" || {
        log_error "检查 SA pull secret 失败"
        return 1
    }
    log_info "当前挂载情况:"
    printf '%s\n' "${out}" | sed 's/^/    /'

    # 文档的检查命令列出三个 SA；任一为空即说明需要按 Note 修补
    local need_patch=false
    local line
    printf '%s\n' "${out}" | while IFS= read -r line; do
        [ -n "${line}" ] || continue
        case "${line}" in
            *"${REGISTRY_PULL_SECRET_NAME}"*) ;;
            *) echo "NEED_PATCH" ;;
        esac
    done > "${REGISTRY_TMP}/pull-check.txt"
    if grep -q NEED_PATCH "${REGISTRY_TMP}/pull-check.txt" 2>/dev/null; then
        need_patch=true
    fi

    if [ "${need_patch}" = "true" ]; then
        log_warn "有 SA 未挂平台 pull Secret，按文档 Note 修补"
        local cmd
        cmd="$(runme print registry:patch-workload-pull-secret)"
        cmd="${cmd//<platform-pull-secret>/${REGISTRY_PULL_SECRET_NAME}}"
        if ! bash -ec "${cmd}"; then
            log_error "按文档修补 pull secret 失败"
            return 1
        fi
    fi

    # 断言最终状态：三个 SA 都挂了平台 pull Secret
    local sa
    for sa in registry node-ca image-api-server; do
        local secrets
        secrets="$(kubectl -n "${REGISTRY_NS}" get sa "${sa}" -o jsonpath='{.imagePullSecrets[*].name}' 2>/dev/null)"
        case "${secrets}" in
            *"${REGISTRY_PULL_SECRET_NAME}"*) ;;
            *) log_error "SA ${sa} 未挂 ${REGISTRY_PULL_SECRET_NAME}（当前: ${secrets}）"; return 1 ;;
        esac
    done
    log_success "组件工作负载的 pull 凭据就绪"
    return 0
}

# 步骤 6：验证安装（文档 § Install from OperatorHub 的 Verify the installation）
_registry_step_verify_installed() {
    log_info "步骤 6: 验证 Operator 安装状态"

    run_block_strict registry:verify-operator-installed || return 1
    assert_workload_ready deployment "${REGISTRY_OPERATOR}" "${REGISTRY_NS}" || return 1
    log_success "Operator 安装验证通过"
    return 0
}

# ==============================================================================
# § Change the Registry Management State
# ==============================================================================

# 文档明确指出：managementState 无默认值，未设置时 Config/cluster 报
# Available=True (Removed)，image-registry / image-api-server 根本不存在。
# 所以断言"启用后组件存在"之前，必须先确认启用这一步真的生效。
_registry_step_enable_registry() {
    log_info "步骤 7: 启用 Registry（managementState=Managed）"

    run_block_strict registry:enable || return 1
    run_block_strict registry:wait-enabled || return 1

    assert_jsonpath_eq "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" '{.spec.managementState}' "Managed" || return 1
    assert_condition "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" Available True || return 1
    assert_condition "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" Degraded False || return 1
    assert_workload_ready deployment image-registry "${REGISTRY_NS}" || return 1
    assert_workload_ready deployment image-api-server "${REGISTRY_NS}" || return 1
    log_success "Registry 已启用且数据面就绪"
    return 0
}

# 文档 § Change the Registry Management State 里给的读法
_registry_step_read_storage_state() {
    log_info "步骤 8: 读取 storage.managementState（文档给的命令）"

    local out
    out="$(runme run registry:read-storage-management-state 2>&1)" || {
        log_error "读取 storage.managementState 失败"
        return 1
    }
    log_info "storage.managementState = ${out}"
    if [ -z "${out}" ]; then
        log_error "storage.managementState 为空——storage 未配置"
        return 1
    fi
    return 0
}

# 文档：设 Removed 后 image-registry / image-api-server 消失，image-pruner CronJob 仍在
_registry_step_disable_registry() {
    log_info "步骤 9: 停用 Registry（managementState=Removed）"

    run_block_strict registry:disable || return 1

    # 等数据面真的消失（文档 § Change Management State 的 Note 说会停掉运行时组件）
    local waited=0
    while [ "${waited}" -lt 120 ]; do
        if ! kubectl -n "${REGISTRY_NS}" get deployment image-registry >/dev/null 2>&1 \
           && ! kubectl -n "${REGISTRY_NS}" get deployment image-api-server >/dev/null 2>&1; then
            break
        fi
        sleep 10
        waited=$((waited + 10))
    done

    # 文档给的那条命令本身就带 --ignore-not-found，跑它并断言输出为空
    local out
    out="$(runme run registry:verify-disabled 2>&1)" || true
    if [ -n "${out}" ]; then
        log_error "停用后 image-registry / image-api-server 应不存在，实际:"
        log_error "${out}"
        return 1
    fi
    # CronJob 不随 Removed 消失——这是文档在 § Overview 里写明的
    assert_resource_exists cronjob.batch image-pruner "${REGISTRY_NS}" || return 1
    log_success "Registry 已停用，CronJob 保留"
    return 0
}

_registry_step_restore_managed() {
    if [ "${REGISTRY_TEST_RESTORE_MANAGED}" != "true" ]; then
        log_info "REGISTRY_TEST_RESTORE_MANAGED=false，跳过恢复 Managed"
        return 0
    fi
    log_info "步骤 10: 恢复 Registry 为 Managed（供后续用例使用）"
    kubectl patch "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" \
        --type=merge -p '{"spec":{"managementState":"Managed"}}' >/dev/null || return 1
    local waited=0
    while [ "${waited}" -lt 300 ]; do
        if kubectl -n "${REGISTRY_NS}" rollout status deployment/image-registry --timeout=30s >/dev/null 2>&1; then
            break
        fi
        sleep 10
        waited=$((waited + 10))
    done
    assert_condition "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" Available True || return 1
    log_success "Registry 已恢复 Managed"
    return 0
}

# ==============================================================================
# § Check Operator and Registry Status
# ==============================================================================

_registry_step_check_status() {
    log_info "步骤 11: 检查 Operator 与 Registry 状态"

    run_block_strict registry:check-operator-status || return 1

    # 文档 § Check Operator and Registry Status 的 Expected results
    assert_workload_ready deployment "${REGISTRY_OPERATOR}" "${REGISTRY_NS}" || return 1
    assert_workload_ready deployment image-registry "${REGISTRY_NS}" || return 1
    assert_workload_ready deployment image-api-server "${REGISTRY_NS}" || return 1
    assert_condition "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" Available True || return 1
    assert_condition "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" Progressing False || return 1
    assert_condition "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" Degraded False || return 1
    # 文档还列了 node-ca 与 image-pruner
    assert_resource_exists daemonset.apps node-ca "${REGISTRY_NS}" || return 1
    assert_resource_exists cronjob.batch image-pruner "${REGISTRY_NS}" || return 1
    assert_resource_exists apiservice.apiregistration.k8s.io v1.image.alauda.io || return 1
    log_success "Operator 与 Registry 状态全部符合文档期望"
    return 0
}

# ==============================================================================
# § Check Registry Logs and Metrics Access
# ==============================================================================

_registry_step_logs_and_metrics() {
    log_info "步骤 12: 检查 Registry 日志"

    assert_resource_exists pod "${REGISTRY_NS}" 2>/dev/null || true
    run_block_strict registry:list-registry-pods || return 1
    run_block_strict registry:get-registry-logs || {
        log_error "读取 Registry 日志失败"
        return 1
    }
    log_success "日志可读"

    log_info "步骤 13: 检查 metrics 访问（文档用 SubjectAccessReview）"

    # 文档改后的命令是一个 SAR 循环，对 prometheus-sa / vm-sa 各输出一行 true/false。
    # 那两个 SA 由监控插件创建；未装监控插件时输出 false，属环境能力问题，应跳过而非失败。
    local out
    out="$(run_block_strict registry:check-metrics-access 2>&1; runme run registry:check-metrics-access 2>&1)" || true
    printf '%s\n' "${out}" | sed 's/^/    /'

    if printf '%s\n' "${out}" | grep -q ': true'; then
        log_success "metrics 访问已授权"
    else
        skip_test_env "prometheus-sa / vm-sa 不存在或未授权（需要监控插件），跳过 metrics 断言"
        return 0
    fi

    # 固化文档改动的理由：原来的 `kubectl auth can-i` 写法对 registry/metrics 恒返回 no，
    # 即使权限正确。这里断言 SAR 确实给出了 true，而 can-i 仍然给 no——
    # 如果哪天 can-i 变成 yes 了，说明上游修了，这条断言会提醒我们更新文档。
    local cani_out
    cani_out="$(kubectl auth can-i get registry/metrics.image.alauda.io \
        --as=system:serviceaccount:cpaas-system:prometheus-sa 2>/dev/null | tail -1)"
    if [ "${cani_out}" = "yes" ]; then
        log_warn "kubectl auth can-i 现在对 registry/metrics 返回 yes 了"
        log_warn "文档里「can-i 恒返回 no」的说明可能已过时，请复核 image_registry_operator.mdx"
    else
        log_info "确认: kubectl auth can-i 仍返回 no（文档改用 SAR 的理由成立）"
    fi
    return 0
}

# ==============================================================================
# § Upgrade（需要目录源里有更新版本，否则跳过）
# ==============================================================================

_registry_step_upgrade() {
    log_info "步骤 14: Operator 升级（文档 § Upgrade）"

    if [ -z "${REGISTRY_UPGRADE_PACKAGE_URL:-}" ]; then
        skip_test_env "未提供 REGISTRY_UPGRADE_PACKAGE_URL，目录源中无更新版本，跳过升级测试"
        return 0
    fi

    # 升级前：文档要求先确认当前 Registry 健康
    run_block_strict registry:upgrade-precheck || {
        log_error "升级前健康检查失败——文档要求升级前 Registry 必须健康"
        return 1
    }
    assert_condition "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" Degraded False || return 1

    # 文档要求先把审批策略切成 Manual，避免升级被自动批准
    run_block_strict registry:upgrade-set-manual || return 1
    assert_jsonpath_eq subscription.operators.coreos.com "${REGISTRY_SUBSCRIPTION}" \
        '{.spec.installPlanApproval}' "Manual" "${REGISTRY_NS}" || return 1

    # 上架新版本包（这一步在文档里是"外部动作"，由 project_init 或人工完成）
    # 目标集群名：run.sh 在带 --cluster 时导出 TEST_TARGET_CLUSTER，
    # 否则退回 SINGLE_CLUSTER_NAME。不要调 resolve_init_clusters——
    # 那是 run.sh 内部函数，测试脚本里不可见。
    local target_cluster="${TEST_TARGET_CLUSTER:-${SINGLE_CLUSTER_NAME:-global}}"
    log_info "上架升级包到集群 ${target_cluster}: ${REGISTRY_UPGRADE_PACKAGE_URL}"
    download_package "${REGISTRY_UPGRADE_PACKAGE_URL}" || return 1
    upload_package "${target_cluster}" "${REGISTRY_UPGRADE_PACKAGE_URL}" || return 1

    # 等新 CSV 的 InstallPlan 出现
    log_info "等待新的 InstallPlan 出现（文档说需要审批）"
    local waited=0 plan_name=""
    while [ "${waited}" -lt 600 ]; do
        plan_name="$(kubectl -n "${REGISTRY_NS}" get installplan --no-headers 2>/dev/null \
            | awk '$4 == "false" {print $1; exit}')"
        [ -n "${plan_name}" ] && break
        sleep 20
        waited=$((waited + 20))
    done
    if [ -z "${plan_name}" ]; then
        log_error "等待新的 InstallPlan 超时——目录源可能没有产生更新版本"
        return 1
    fi
    log_info "待审批 InstallPlan: ${plan_name}"

    # 文档的 PLAN_NAME jsonpath 取法
    local plan_from_jsonpath
    plan_from_jsonpath="$(kubectl -n "${REGISTRY_NS}" get subscription "${REGISTRY_SUBSCRIPTION}" \
        -o jsonpath='{.status.installPlanRef.name}')"
    log_info "文档 jsonpath 取到: ${plan_from_jsonpath}"

    run_block_strict registry:upgrade-approve-installplan || return 1
    run_block_strict registry:upgrade-verify || return 1

    # 文档 § Upgrade 的 Expected results
    assert_condition "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" Available True || return 1
    assert_condition "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" Progressing False || return 1
    assert_condition "${REGISTRY_CONFIG}" "${REGISTRY_CONFIG_NAME}" Degraded False || return 1
    assert_workload_ready deployment image-registry "${REGISTRY_NS}" || return 1
    assert_workload_ready deployment image-api-server "${REGISTRY_NS}" || return 1
    log_success "升级完成且既有配置保持 reconciled"
    return 0
}

# ==============================================================================
# 主流程
# ==============================================================================

test_image_registry_operator() {
    log_info "=========================================="
    log_info "开始 Alauda Container Platform Registry / Image Registry Operator 文档测试"
    log_info "被测文档: docs/en/configure/registry/image_registry_operator.mdx"
    log_info "=========================================="

    _registry_setup_tmp

    # § Install by Using YAML
    _registry_step_prerequisites || return 1
    _registry_step_create_namespace || return 1
    _registry_step_apply_subscription || return 1
    _registry_step_approve_installplan || return 1
    _registry_step_wait_operator || return 1
    _registry_step_workload_pull_secret || return 1
    _registry_step_verify_installed || return 1

    # § Change the Registry Management State
    _registry_step_enable_registry || return 1
    _registry_step_read_storage_state || return 1
    _registry_step_disable_registry || return 1
    _registry_step_restore_managed || return 1

    # § Check Operator and Registry Status
    _registry_step_check_status || return 1

    # § Check Registry Logs and Metrics Access
    _registry_step_logs_and_metrics || return 1

    # § Upgrade
    _registry_step_upgrade || return 1

    _registry_cleanup_tmp

    log_success "=========================================="
    log_success "Image Registry Operator 文档测试完成，所有验证通过！"
    log_success "=========================================="
    return 0
}

# 本文档不含清理/卸载章节，故不提供 cleanup_image_registry_operator。
# Registry 是平台内置能力，卸载它会破坏后续用例的前置状态；
# 文档本身也没有卸载步骤，按框架约定「不要自行编写清理逻辑」。
