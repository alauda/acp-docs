# AI Coding Agent 操作指南

本文档为 AI coding agent 提供必要的上下文和规则，确保代码修改符合项目约定。

## 核心原则 (Core Principles)

* **英文驱动**：`docs/en/` 是唯一真相来源（Source of Truth）。所有内容新增、结构调整必须首先在英文目录下完成。
* **路径自治**：文档私有图片必须放在同级 `assets/` 目录，严禁跨模块引用其他文档的资源。
* **最小改动**：保持现有的 `weight` 排序逻辑，除非明确要求重构。

---

## 构建与验证命令

```bash
# 安装依赖（项目使用 yarn 4.12.0）
yarn install

# 启动开发服务器（实时预览，修改文件后自动刷新）
yarn dev

# 构建生产版本（静态文件生成到 dist 目录）
yarn build

# 预览构建产物
yarn serve

# 运行 lint 检查（pre-commit hook 会自动执行）
yarn lint

# 导出文档
yarn export

# 翻译文档（将 en 同步至其他语言）
yarn translate

```

> **[重要] 导航栏限制**：左侧导航栏的物理结构修改（新增文件、修改 `weight`）需要重启 `yarn dev` 服务才能在预览中生效。

---

## 项目结构

```
acp-docs/
├── docs/
│   ├── en/                 # 英文文档（主语言，修改的首选目标）
│   ├── zh/                 # 中文文档（通过翻译流程生成，禁止脱离英文版单独修改逻辑）
│   ├── public/             # 全局静态资源
│   │   └── logo.svg
│   └── shared/             # 共享配置文件（如 CRD, OpenAPI, 暂由人工维护）
├── theme/                  # 主题定制
├── scripts/                # 工具脚本
├── doom.config.yml         # 框架核心配置
└── package.json

```

---

## 文档编写规范

### MDX 文件与 Frontmatter

每个 MDX 文件必须以 frontmatter 开头。文件名应使用 `kebab-case`（如 `install-guide.mdx`）。

```mdx
---
weight: 10              # 必选：控制顺序。默认 100，置顶建议 1-10
title: "Page Title"     # 可选：若不提供则取 H1
sourceSHA: abc123...    # 翻译追踪：英文版严禁手动修改此字段；中文版由工具维护
---

# 标题

内容...

```

### 目录索引文件

目录级别的索引文件（如 `index.mdx`）应使用 `<Overview />` 组件：

```mdx
# Category Name

<Overview />

```

### 组件使用

* **导入规范**：仅在需要特定功能时才导入组件。
* **组件 Skill**：关于 `Tabs`, `Steps`, `CodeBlock`, `Highlight` 等可用组件的详细用法，请参考关联的 **MDX 组件 Skill**。

### 图片与资源引用

* **必须使用相对路径**：`<img src="./assets/diagram.svg" width="400" />`
* **存放位置**：图片必须存放在对应文档目录的 `assets/` 子目录中。
* **清理规则**：删除文档时，必须同时删除其对应的 `assets/` 目录。

---

## 代码风格与 Lint

### 强制配置 (EditorConfig & Prettier)

* **缩进**：2 空格
* **行尾**：LF
* **分号**：`false`
* **单引号**：`true`
* **Markdown Lint**：使用 `-` 作为列表符号，启用 GFM。

---

## 禁止修改的文件 (Immutable Files)

**绝对禁止手动修改以下文件**（它们由工具自动生成或受系统保护）：

1. `docs/en/ui/cli_tools/ac/` 下的所有文件（由 `yarn update-ac-manual` 生成）。
2. `docs/public/_remotes/` 目录。
3. `node_modules/`, `dist/`, `.yarn/` (除特定插件外)。

---

## 任务完成验收标准 (Definition of Done)

修改文档后，必须按顺序执行：

1. **语法检查**：运行 `yarn lint` 并修复所有错误。
2. **路径验证**：确保所有 `assets` 引用和内部链接有效，无死链。
3. **构建验证**：运行 `yarn build` 确保静态站点生成成功。
4. **告知用户**：
* 如果修改了导航栏，告知用户需重启 `yarn dev`。
* 如果修改了英文版，询问用户是否需要运行 `yarn translate` 同步中文。



---

## 不确定情况处理

当遇到以下情况时，**必须询问用户**：

1. 需要修改 `doom.config.yml` 或 `tsconfig.json`。
2. 需要创建新的顶层文档类别。
3. 涉及 `docs/shared/` 下的 YAML 文件修改。
4. 需要修改主题文件（`theme/`）。

---

## 常见问题

**Q: 如何处理翻译同步？**
A: 修改 `docs/en/` 后，运行 `yarn translate`。不要直接手动修改 `docs/zh/` 下的对应逻辑，除非是修正翻译错别字。

**Q: AC CLI 文档过期了怎么办？**
A: 运行 `yarn update-ac-manual`，不要手动编辑生成的 `.mdx`。
