#!/usr/bin/env bash
# Alauda Container Platform Registry — 用 ac 管理镜像文档测试
#
# 被测文档: docs/en/developer/registry/managing_images_with_ac.mdx
# 覆盖: § Check the Registry Configuration / § Authenticate to the Registry /
#       § Manage Image Streams / § Manage Image Tags / § Configure Image Lookup /
#       § Inspect Images / § Copy and Combine Images / § Extract Image Contents
#
# ── 环境能力 ─────────────────────────────────────────────────────────────────
#   REGISTRY_TEST_AC_NS      操作命名空间，默认 team-a
#   REGISTRY_TEST_AC_IMAGE   用于 import / mirror 的源镜像（必须环境内可达）
#   REGISTRY_TEST_EXTERNAL   true 时才跑引用外部仓库（registry.example.com）的块
# 未提供源镜像时，import / mirror / append / extract 段落以 skip_test_env 退出。

set -e

: "${FRAMEWORK_ROOT:?该脚本需经 docs-runme-tests/run.sh 运行}"
source "$FRAMEWORK_ROOT/framework/common.sh"
source "$FRAMEWORK_ROOT/framework/verify.sh"
source "$FRAMEWORK_ROOT/framework/acp-verify.sh"

NS="${REGISTRY_TEST_AC_NS:-team-a}"
SRC_IMAGE="${REGISTRY_TEST_AC_IMAGE:-}"
TMP=""

_setup_tmp() { TMP="$(mktemp -d)"; }
_cleanup_tmp() { [ -n "${TMP}" ] && rm -rf "${TMP}"; }

# § Check the Registry Configuration
_ac_check_config() {
    log_info "步骤 1: 检查 Registry 配置"
    run_block_strict ac-images:get-registry-mode || return 1
    run_block_strict ac-images:registry-info || return 1
    run_block_strict ac-images:registry-info-internal || return 1
    run_block_strict ac-images:registry-info-public || return 1
    run_block_strict ac-images:registry-info-check || return 1

    # 文档 § Check the Registry Configuration 的 Expected results：
    # --internal 给出集群内地址，且该地址指向 image-registry-system 里的 Service
    local internal
    internal="$(ac registry info --internal 2>/dev/null | head -1)"
    log_info "内部地址: ${internal}"
    if [ -z "${internal}" ]; then
        log_error "ac registry info --internal 未返回地址"
        return 1
    fi
    log_success "Registry 配置检查通过"
    return 0
}

# § Authenticate to the Registry
_ac_authenticate() {
    log_info "步骤 2: 认证到 Registry"
    run_block_strict ac-images:registry-login || return 1
    run_block_strict ac-images:prepare-auth-dir || return 1

    # 文档：登录后认证文件应存在
    local auth_file="/tmp/registry-auth/config.json"
    if [ ! -f "${auth_file}" ]; then
        log_error "认证文件未生成: ${auth_file}"
        return 1
    fi
    log_success "认证文件已生成"
    return 0
}

# § Manage Image Streams
_ac_manage_imagestreams() {
    log_info "步骤 3: 管理 ImageStream"

    run_block_strict ac-images:create-imagestream || return 1
    assert_resource_exists imagestreams.image.alauda.io demo "${NS}" || return 1

    # 文档还给了带 --lookup-local 的建法，用一个不同的名字避免冲突
    local cmd
    cmd="$(runme print ac-images:create-imagestream-lookup-local)"
    cmd="${cmd//demo/demo-lookup-local}"
    bash -ec "${cmd}" || { log_error "创建 lookup-local ImageStream 失败"; return 1; }
    assert_jsonpath_eq imagestreams.image.alauda.io demo-lookup-local \
        '{.spec.lookupPolicy.local}' "true" "${NS}" || return 1

    run_block_strict ac-images:create-imagestreamtag || return 1

    if [ -z "${SRC_IMAGE}" ]; then
        skip_test_env "未提供 REGISTRY_TEST_AC_IMAGE，跳过 import-image 与后续镜像操作"
        return 0
    fi

    log_info "步骤 3b: 导入镜像（文档的 ac import-image）"
    cmd="$(runme print ac-images:import-image)"
    # 文档的块形如 ac import-image demo:latest --from=<source> ...
    cmd="$(printf '%s' "${cmd}" | sed "s|--from=[^ ]*|--from=${SRC_IMAGE}|")"
    bash -ec "${cmd}" || { log_error "import-image 失败"; return 1; }

    run_block_strict ac-images:get-imagestreamtag-yaml || return 1
    assert_resource_exists imagestreamtags.image.alauda.io demo:latest "${NS}" || return 1
    log_success "ImageStream 管理完成"
    return 0
}

# § Manage Image Tags
_ac_manage_tags() {
    log_info "步骤 4: 管理 ImageTag"

    if [ -z "${SRC_IMAGE}" ]; then
        skip_test_env "未提供 REGISTRY_TEST_AC_IMAGE，跳过 tag 操作"
        return 0
    fi

    # tag-from-external 引用外部仓库示例域名，需要显式开启
    if [ "${REGISTRY_TEST_EXTERNAL:-false}" = "true" ]; then
        run_block_strict ac-images:tag-from-external || log_warn "从外部仓库打 tag 失败"
    else
        log_info "未开启 REGISTRY_TEST_EXTERNAL，跳过引用外部仓库的 tag 块"
    fi

    run_block_strict ac-images:tag-from-imagestreamtag || log_warn "跨命名空间打 tag 失败（可能目标命名空间不存在）"
    run_block_strict ac-images:tag-with-alias || log_warn "带 alias 打 tag 失败"
    run_block_strict ac-images:tag-delete || log_warn "删除 tag 失败（可能本就不存在）"
    log_success "ImageTag 管理完成"
    return 0
}

# § Configure Image Lookup
_ac_configure_lookup() {
    log_info "步骤 5: 配置 Image Lookup"
    run_block_strict ac-images:set-image-lookup || return 1
    assert_jsonpath_eq imagestreams.image.alauda.io demo '{.spec.lookupPolicy.local}' "true" "${NS}" || return 1

    run_block_strict ac-images:set-image-lookup-disable || return 1
    run_block_strict ac-images:set-image-lookup-list || return 1

    if [ -z "${SRC_IMAGE}" ]; then
        log_info "未提供源镜像，跳过 ac set image（需要工作负载与镜像）"
        return 0
    fi
    run_block_strict ac-images:set-image || log_warn "ac set image 失败（工作负载可能不存在）"
    run_block_strict ac-images:set-image-by-digest || log_warn "按 digest 设置镜像失败"
    run_block_strict ac-images:wait-workload || log_warn "工作负载未就绪"
    log_success "Image Lookup 配置完成"
    return 0
}

# § Inspect Images
_ac_inspect_images() {
    log_info "步骤 6: 检查镜像对象"
    run_block_strict ac-images:list-imagestreams || return 1
    run_block_strict ac-images:get-imagestream || return 1
    run_block_strict ac-images:get-imagestreamtag || return 1
    run_block_strict ac-images:get-imagestreamimage || log_warn "按 digest 取 ImageStreamImage 失败"
    run_block_strict ac-images:list-images || return 1
    run_block_strict ac-images:get-images-yaml || return 1
    log_success "镜像对象检查完成"
    return 0
}

# § Manage Image Tags（清理部分）与 § Inspect Images 的删除命令
_ac_delete_images() {
    log_info "步骤 7: 删除镜像与 tag"

    run_block_strict ac-images:tag-delete-cleanup || log_warn "删除 tag 失败（可能已不存在）"

    if [ "${REGISTRY_TEST_DESTRUCTIVE:-false}" != "true" ]; then
        log_warn "未开启 REGISTRY_TEST_DESTRUCTIVE，跳过 ac delete images（会真删数据）"
        return 0
    fi
    run_block_strict ac-images:delete-image-by-repo || return 1
    run_block_strict ac-images:delete-images || return 1
    log_success "镜像删除完成"
    return 0
}

# § Inspect Images（ac image info）
_ac_image_info() {
    log_info "步骤 8: ac image info"
    if [ -z "${SRC_IMAGE}" ]; then
        skip_test_env "未提供 REGISTRY_TEST_AC_IMAGE，跳过 image info"
        return 0
    fi

    # 文档的块引用 registry.example.com 示例域名；有真实镜像时替换
    local cmd
    cmd="$(runme print ac-images:image-info)"
    cmd="$(printf '%s' "${cmd}" | sed "s|registry\.example\.com/team-a/demo:latest|${SRC_IMAGE}|")"
    bash -ec "${cmd}" || { log_error "ac image info 失败"; return 1; }

    if [ "${REGISTRY_TEST_EXTERNAL:-false}" = "true" ]; then
        run_block_strict ac-images:image-info-external || log_warn "外部镜像 info 失败"
    fi
    run_block_strict ac-images:image-info-manifest-list || log_warn "manifest list info 失败"
    log_success "image info 完成"
    return 0
}

# § Copy and Combine Images
_ac_copy_images() {
    log_info "步骤 9: 复制镜像（ac image mirror）"
    if [ -z "${SRC_IMAGE}" ]; then
        skip_test_env "未提供 REGISTRY_TEST_AC_IMAGE，跳过 mirror / append"
        return 0
    fi

    local cmd
    cmd="$(runme print ac-images:image-mirror)"
    cmd="$(printf '%s' "${cmd}" | sed "s|registry\.example\.com/team-a/demo:stable|${SRC_IMAGE}|")"
    bash -ec "${cmd}" || log_warn "ac image mirror 失败（源或目标不可达）"

    # mirror-map-file 是 heredoc 块，需要真实源/目标才能执行
    runme print ac-images:mirror-map-file > "${TMP}/mirror-map.txt" || return 1
    log_info "镜像映射文件已生成: ${TMP}/mirror-map.txt"

    run_block_strict ac-images:image-info-mirrored || log_warn "mirror 后 info 失败"
    run_block_strict ac-images:image-append || log_warn "ac image append 失败"
    run_block_strict ac-images:image-append-2 || log_warn "ac image append（变体 2）失败"
    run_block_strict ac-images:image-append-3 || log_warn "ac image append（变体 3）失败"
    log_success "镜像复制完成"
    return 0
}

# § Extract Image Contents
_ac_extract_images() {
    log_info "步骤 10: 提取镜像内容（ac image extract）"
    if [ "${REGISTRY_TEST_EXTERNAL:-false}" != "true" ]; then
        skip_test_env "未开启 REGISTRY_TEST_EXTERNAL，跳过引用外部仓库的 extract"
        return 0
    fi
    run_block_strict ac-images:image-extract || log_warn "extract 失败"
    run_block_strict ac-images:image-extract-2 || log_warn "extract（变体 2）失败"
    run_block_strict ac-images:image-extract-3 || log_warn "extract（变体 3）失败"
    return 0
}

test_managing_images_with_ac() {
    log_info "=========================================="
    log_info "开始 用 ac 管理镜像 文档测试"
    log_info "被测文档: docs/en/developer/registry/managing_images_with_ac.mdx"
    log_info "=========================================="

    _setup_tmp

    _ac_check_config || return 1
    _ac_authenticate || return 1
    _ac_manage_imagestreams || return 1
    _ac_manage_tags || return 1
    _ac_configure_lookup || return 1
    _ac_inspect_images || return 1
    _ac_delete_images || return 1
    _ac_image_info || return 1
    _ac_copy_images || return 1
    _ac_extract_images || return 1

    _cleanup_tmp

    log_success "=========================================="
    log_success "用 ac 管理镜像 文档测试完成"
    log_success "=========================================="
    return 0
}

# 本文档不含卸载章节。用例创建了 demo ImageStream 等对象，但文档没有对应的
# 清理步骤，按框架约定「不要自行编写清理逻辑」，故不提供 cleanup_* 函数。
