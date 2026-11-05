// A shell command shown as a code block, for the generators whose command
// changes with the form, which a Markdown code block cannot do. The site's
// runtime code block gives it the same highlighting and copy button as the
// code blocks written in Markdown.
import { CodeBlockRuntime } from '@alauda/doom/theme'

export default function CommandBlock({ command }: { command: string }) {
  return <CodeBlockRuntime lang="bash" code={command} />
}
