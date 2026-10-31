/// <reference types="@alauda/doom/runtime" />

interface ImportMetaEnv {
  /** `true` while Rspress renders pages to Markdown for the llms output. */
  readonly SSG_MD?: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
