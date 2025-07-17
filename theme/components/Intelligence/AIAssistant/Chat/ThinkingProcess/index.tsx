import { Markdown } from '@alauda/doom/runtime'
import { useI18n } from 'rspress/runtime'

export interface ThinkingProcessProps {
  children: string
}

export const ThinkingProcess = ({ children }: ThinkingProcessProps) => {
  const t = useI18n<typeof import('@docs/i18n.json')>()
  return (
    <div>
      <div>{t('thinking_process')}</div>
      <Markdown>{children}</Markdown>
    </div>
  )
}
