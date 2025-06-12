import { flushSync, useI18n } from '@rspress/core/runtime'
import clsx from 'clsx'
import { noop } from 'es-toolkit'
import {
  useRef,
  useState,
  unstable_ViewTransition as ViewTransition,
} from 'react'
import { Tooltip } from 'react-tooltip'

import { useMemorizedFn } from '@theme/hooks'

import { CloudAuth, useCloudAuth } from '../context'
import { AuthInfo } from '../types'

import { Chat } from './Chat'
import CloseIcon from './close.svg?react'
import NewChatIcon from './new-chat.svg?react'
import { Preamble } from './Preamble'
import { ResizableUserInput } from './ResizableUserInput'
import classes from './styles.module.scss'
import { ChatMessage } from './types'

export interface AIAssistantProps {
  open?: boolean
  onOpenChange(open: boolean): void
  onCleanup?(): void
}

const isLoggedIn_ = (
  authInfo: CloudAuth | null,
): authInfo is CloudAuth & { detail: AuthInfo } => Boolean(authInfo?.detail)

export const AIAssistant = ({
  open,
  onOpenChange,
  onCleanup,
}: AIAssistantProps) => {
  const { authInfo } = useCloudAuth()
  const t = useI18n<typeof import('@docs/i18n.json')>()
  const onClose = useMemorizedFn(() => onOpenChange(false))

  const isLoggedIn = isLoggedIn_(authInfo)

  const [messages, setMessages] = useState<ChatMessage[]>([])

  const chatRef = useRef<HTMLUListElement>(null)

  const onSend = useMemorizedFn((content: string) => {
    setMessages(messages => [
      ...messages,
      { id: Date.now(), role: 'user' as const, content },
    ])

    flushSync(noop)

    const chatEl = chatRef.current!

    chatEl.scrollTop = chatEl.scrollHeight
  })

  const onNewChat = useMemorizedFn(() => setMessages([]))

  return (
    <ViewTransition name="flip" onEnter={onCleanup} onExit={onCleanup}>
      <div className={clsx(classes.container, open && classes.open)}>
        <div className={classes.header}>
          <div>
            {t('ai_assistant')}
            {isLoggedIn && (
              <span className={classes.username}>
                ({authInfo.detail!.user.name})
              </span>
            )}
          </div>
          <div className={classes.icons}>
            {messages.length ? (
              <>
                <NewChatIcon className={classes.newChat} onClick={onNewChat} />
                <Tooltip anchorSelect={`.${classes.newChat}`}>
                  {t('new_chat')}
                </Tooltip>
              </>
            ) : null}
            <CloseIcon className={classes.close} onClick={onClose} />
          </div>
        </div>
        {messages.length ? (
          <Chat ref={chatRef} messages={messages} />
        ) : (
          <Preamble isLoggedIn={isLoggedIn} />
        )}
        {isLoggedIn && <ResizableUserInput onSend={onSend} />}
      </div>
    </ViewTransition>
  )
}
