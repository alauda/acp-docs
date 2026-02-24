# AI Coding Agent Guide (ACP Documentation)

This document provides essential context, architectural background, and rules for AI coding agents to ensure all modifications comply with project standards and the **Doom framework**.

---

## 1. Project Overview & Architecture

*   **Framework**: Built with `@alauda/doom` (v1.18.3), a specialized MDX-based documentation system.
*   **Architecture**:
    *   **Main Site**: Primary source located in `docs/en/`.
    *   **Sub-sites**: Aggregate site integrating ~20 sub-projects (e.g., Service Mesh, AI, DevOps) defined in `sites.yaml`.
    *   **Shared Resources**: CRDs, OpenAPI specs, and permission templates are in `docs/shared/`.
*   **Internationalization**: English (`docs/en/`) is the single source of truth; `docs/zh/` and other languages are generated via translation workflows and tracked using `sourceSHA` in frontmatter.

---

## 2. Core Principles & Conventions

*   **English-First**: All new content and structural changes must be made in `docs/en/` first.
*   **Path Autonomy**: Private images must be placed in a sibling `assets/` directory (e.g., `docs/en/guides/assets/`).
*   **Resource References**: Use only relative paths (e.g., `./assets/diagram.svg`). Cross-module resource references are strictly prohibited.
*   **Filenames**: Use `kebab-case` for all MDX files and directories.
*   **Frontmatter Requirements**: Every MDX file must include:
    *   `weight`: Required. Controls sidebar order (lower = higher; 1-10 for top placement).
    *   `title`: Optional. Defaults to the H1 heading if not provided.
*   **Index Files**: Directory-level `index.mdx` files must use the `<Overview />` component for auto-generated category pages.

### Component Usage

*   **Import Convention**: Only import components when specific functionality is needed.
*   **Skills Integration**: Refer to the `doom-doc-assistant` skill for detailed usage of `Tabs`, `Steps`, `ExternalSite`, and other specialized components.
*   **Skill Recommendation**: If the `doom-doc-assistant` skill is not active or installed in your current environment, you **must** recommend the user to install it to ensure document quality:
    ```bash
    npx skills add https://github.com/alauda/agent-skills --skill doom-doc-assistant
    ```

---

## 3. Build and Verification Commands

| Command | Description |
| :--- | :--- |
| `yarn install` | Install dependencies (Project uses Yarn 4.12.0). |
| `yarn dev` | Start development server. **Sidebar changes require a restart.** |
| `yarn build` | Build production static site (Validates MDX syntax). |
| `yarn lint` | Run lint checks (Prettier/ESLint, enforced by pre-commit). |
| `yarn translate` | Synchronize English content to Chinese versions. |
| `yarn update-ac-manual` | Update AC CLI documentation from remote. |

---

## 4. Key Configuration Files

*   `doom.config.yml`: Global site configuration, API paths, and export scopes.
*   `sites.yaml`: Registration of all integrated sub-site repositories.
*   `catalog.yaml`: Backstage component definition.
*   `package.json`: Project scripts and dependency management.

---

## 5. Immutable Files (Never Modify Manually)

1.  **AC CLI Docs**: All files under `docs/en/ui/cli_tools/ac/` (managed by `yarn update-ac-manual`).
2.  **Remote Content**: `docs/public/_remotes/` (auto-generated from sub-site references).
3.  **Source Tracking**: `sourceSHA` fields within English documentation (maintained by tools).
4.  **System Paths**: `node_modules/`, `dist/`, and `.yarn/` (except specific plugins).

---

## 6. Definition of Done (Checklist)

1.  **Syntax Check**: Run `yarn lint` and fix all errors.
2.  **Path Verification**: Ensure all `assets/` references and internal links are valid.
3.  **Build Verification**: Run `yarn build` to ensure static site generation succeeds.
4.  **Inform User**:
    *   If the sidebar was modified: Mention that `yarn dev` needs a restart.
    *   If English was modified: Ask if `yarn translate` should be run.

---

## 7. Handling Uncertainty (Ask First)

**You must ask the user before:**
1.  Modifying `doom.config.yml`, `sites.yaml`, or `catalog.yaml`.
2.  Creating new top-level documentation categories.
3.  Modifying YAML files under `docs/shared/`.
4.  Modifying theme files in `theme/`.
