import { flushSync, useI18n } from '@rspress/core/runtime'
import clsx from 'clsx'
import { noop } from 'es-toolkit'
import {
  useRef,
  useState,
  unstable_ViewTransition as ViewTransition,
} from 'react'
import { Tooltip } from 'react-tooltip'
import { ApiMethod, xfetch } from 'x-fetch'

import { useMemorizedFn } from '@theme/hooks'

import { CloudAuth, useCloudAuth } from '../context'
import { AuthInfo } from '../types'

import { Chat } from './Chat'
import CloseIcon from './close.svg?react'
import NewChatIcon from './new-chat.svg?react'
import { Preamble } from './Preamble'
import { ResizableUserInput } from './ResizableUserInput'
import classes from './styles.module.scss'
import { Thinking } from './Thinking'
import { ChatMessage } from './types'
import { parseStreamContent } from './utils'

export interface AIAssistantProps {
  open?: boolean
  onOpenChange(open: boolean): void
  onCleanup?(): void
}

const isLoggedIn = (
  authInfo: CloudAuth | null,
): authInfo is CloudAuth & { detail: AuthInfo } => Boolean(authInfo?.detail)

let textDecoder: TextDecoder

export const AIAssistant = ({
  open,
  onOpenChange,
  onCleanup,
}: AIAssistantProps) => {
  const { authInfo } = useCloudAuth()
  const t = useI18n<typeof import('@docs/i18n.json')>()
  const onClose = useMemorizedFn(() => onOpenChange(false))

  const loggedIn = isLoggedIn(authInfo)

  const sessionIdRef = useRef<number>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])

  const chatRef = useRef<HTMLUListElement>(null)

  const onSend = useMemorizedFn(async (content: string) => {
    const assistantMessage: ChatMessage = {
      id: Date.now(),
      role: 'assistant' as const,
      content: <Thinking />,
    }

    setMessages(messages => [
      ...messages,
      { id: Date.now(), role: 'user' as const, content },
      assistantMessage,
    ])

    if (!sessionIdRef.current) {
      const { session_id } = await xfetch<{ session_id: number }>(
        '/smart/api/new_session',
        {
          method: ApiMethod.POST,
          headers: { username: authInfo!.detail!.user.name },
        },
      )
      sessionIdRef.current = session_id
    }

    const res = await xfetch('/smart/api/smart_answer', {
      type: null,
      method: ApiMethod.POST,
      body: {
        input_text: content,
        session_id: sessionIdRef.current,
      },
    })

    textDecoder ??= new TextDecoder()

    let text = ''

    for await (const chunk_ of res.body! as unknown as AsyncIterable<Uint8Array>) {
      const chunk = textDecoder.decode(chunk_)

      text += chunk
        .replace(/data: (\n\n)?/g, '')
        .replace(/(?<!\n)\n\n(?!\n)/g, '')
        .replace(/(?<!\n)\n\n\n\n(?!\n)/g, '\n')
        .replace(/\n{2,}/g, '\n')

      const parsed = parseStreamContent(text)

      if (
        !parsed.refDocs?.length &&
        !parsed.thinkingProcess &&
        !parsed.content
      ) {
        continue
      }

      setMessages(messages => {
        const index = messages.findLastIndex(
          msg => msg.role === 'assistant' && msg.id === assistantMessage.id,
        )
        if (index === -1) {
          return [...messages, { ...assistantMessage, ...parsed }]
        }
        return [
          ...messages.slice(0, index),
          { ...messages[index], ...parsed },
          ...messages.slice(index + 1),
        ]
      })
    }

    flushSync(noop)

    const chatEl = chatRef.current!

    chatEl.scrollTop = chatEl.scrollHeight
  })

  const onNewChat = useMemorizedFn(() => {
    sessionIdRef.current = null
    setMessages([])
  })

  return (
    <ViewTransition name="flip" onEnter={onCleanup} onExit={onCleanup}>
      <div className={clsx(classes.container, open && classes.open)}>
        <div className={classes.header}>
          <div>
            {t('ai_assistant')}
            {loggedIn && (
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
          <Preamble loggedIn={loggedIn} />
        )}
        {loggedIn && <ResizableUserInput onSend={onSend} />}
      </div>
    </ViewTransition>
  )
}
