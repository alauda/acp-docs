# AI Coding Agent Guide (ACP Documentation)

This document provides essential context, architectural background, and rules for AI coding agents to ensure all modifications comply with project standards and the **Doom framework**.

---

## 1. Project Overview & Architecture

*   **Framework**: Built with `@alauda/doom`, a specialized MDX-based documentation system.
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
