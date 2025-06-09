import { useI18n } from '@rspress/core/runtime'
import { useCallback, unstable_ViewTransition as ViewTransition } from 'react'

import AssistantIcon from '../assistant.svg?react'
import CloseIcon from './close.svg?react'
import classes from './styles.module.scss'
import { X } from '@theme/components/_X'

export interface AIAssistantProps {
  open?: boolean
  onOpenChange: (open: boolean) => void
  onCleanup?: () => void
}

export const AIAssistant = ({ onOpenChange, onCleanup }: AIAssistantProps) => {
  const t = useI18n<typeof import('@docs/i18n.json')>()
  const onClose = useCallback(() => onOpenChange(false), [])
  return (
    <ViewTransition name="flip" onEnter={onCleanup} onExit={onCleanup}>
      <div className={classes.container}>
        <div className={classes.header}>
          {t('ai_assistant')}
          <CloseIcon className={classes.close} onClick={onClose} />
        </div>
        <div className={classes.notLoggedIn}>
          <AssistantIcon width={48} height={40} />
          <div className={classes.title}>
            {t('not_logged_in')}
            {t('exclamation')}
          </div>
          <div className={classes.content}>
            <div>
              {t('not_logged_in_tip_china')}
              <X.a href="https://cloud.alauda.cn/login">
                {t('custom_portal_china')}
              </X.a>
              {t('semicolon')}
            </div>
            <div>
              {t('not_logged_in_tip_global')}
              <X.a href="https://cloud.alauda.io/login">
                {t('custom_portal_global')}
              </X.a>
              {t('period')}
            </div>
            <div>{t('not_logged_in_tip')}</div>
          </div>
        </div>
      </div>
    </ViewTransition>
  )
}
