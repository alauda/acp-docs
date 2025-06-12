import { useI18n } from '@rspress/core/runtime'

import { X } from '@theme/components/_X'

import AssistantIcon from '../../assistant.svg?react'

import classes from './styles.module.scss'

export interface PreambleProps {
  isLoggedIn: boolean
}

export const Preamble = ({ isLoggedIn }: PreambleProps) => {
  const t = useI18n<typeof import('@docs/i18n.json')>()
  return (
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
  )
}
