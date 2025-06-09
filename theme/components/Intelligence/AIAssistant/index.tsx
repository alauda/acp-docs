import { useI18n } from '@rspress/core/runtime'
import { useCallback, unstable_ViewTransition as ViewTransition } from 'react'

import { X } from '@theme/components/_X'

import AssistantIcon from '../assistant.svg?react'
import { CloudAuth, useCloudAuth } from '../context'
import { AuthInfo } from '../types'
import CloseIcon from './close.svg?react'
import SendIcon from './send.svg?react'
import classes from './styles.module.scss'

export interface AIAssistantProps {
  open?: boolean
  onOpenChange: (open: boolean) => void
  onCleanup?: () => void
}

const isLoggedIn_ = (
  authInfo: CloudAuth | null,
): authInfo is CloudAuth & { detail: AuthInfo } => Boolean(authInfo?.detail)

export const AIAssistant = ({ onOpenChange, onCleanup }: AIAssistantProps) => {
  const { authInfo } = useCloudAuth()
  const t = useI18n<typeof import('@docs/i18n.json')>()
  const onClose = useCallback(() => onOpenChange(false), [])

  const isLoggedIn = isLoggedIn_(authInfo)

  return (
    <ViewTransition name="flip" onEnter={onCleanup} onExit={onCleanup}>
      <div className={classes.container}>
        <div className={classes.header}>
          <div>
            {t('ai_assistant')}
            {isLoggedIn && (
              <span className={classes.username}>
                ({authInfo.detail!.user.name})
              </span>
            )}
          </div>
          <CloseIcon className={classes.close} onClick={onClose} />
        </div>
        <div className={classes.preamble}>
          <AssistantIcon width={48} height={40} />
          <div className={classes.title}>
            {t(isLoggedIn ? 'hi_there' : 'not_logged_in')}
            {t('exclamation')}
          </div>
          <div className={classes.content}>
            {isLoggedIn ? (
              t('ai_assistant_tip')
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
        {isLoggedIn && (
          <div className={classes.input}>
            <textarea placeholder={t('ai_assistant_placeholder')} />
            <SendIcon className={classes.send} />
          </div>
        )}
      </div>
    </ViewTransition>
  )
}
