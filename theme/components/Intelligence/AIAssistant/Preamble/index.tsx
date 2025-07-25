import { useI18n } from '@rspress/core/runtime'
import clsx from 'clsx'

import AssistantIcon from '../../assistant.svg?react'

import { LoginForm } from './LoginForm/index.js'
import classes from './styles.module.scss'

export interface PreambleProps {
  loggedIn: boolean
}

export const Preamble = ({ loggedIn }: PreambleProps) => {
  const t = useI18n<typeof import('@docs/i18n.json')>()

  return (
    <div className={clsx(classes.preamble, loggedIn && classes.loggedIn)}>
      <AssistantIcon width={48} height={40} />
      <div className={classes.title}>
        {t(loggedIn ? 'hi_there' : 'user_login')}
      </div>
      <div className={classes.content}>
        {t(loggedIn ? 'ai_assistant_tip' : 'user_login_tip')}
      </div>
      {loggedIn || <LoginForm className={classes.form} />}
    </div>
  )
}
