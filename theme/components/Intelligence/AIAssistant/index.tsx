import { useI18n } from '@rspress/core/runtime'
import clsx from 'clsx'
import {
  useRef,
  useState,
  unstable_ViewTransition as ViewTransition,
} from 'react'
import { Tooltip } from 'react-tooltip'
import { ApiMethod, xfetch } from 'x-fetch'

import { useMemoizedFn } from '@theme/hooks'

import { CloudAuth, useCloudAuth } from '../context.js'
import { AuthInfo } from '../types.js'

import { Chat } from './Chat/index.js'
import CloseIcon from './close.svg?react'
import LogoutIcon from './logout.svg?react'
import NewChatIcon from './new-chat.svg?react'
import { Preamble } from './Preamble/index.js'
import { ResizableUserInput } from './ResizableUserInput/index.js'
import classes from './styles.module.scss'
import { Thinking } from './Thinking.js'
import { ChatMessage } from './types.js'
import { parseStreamContent } from './utils.js'

export interface AIAssistantProps {
  open?: boolean
  onOpenChange: (open: boolean) => void
  onCleanup?: () => void
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
  const t = useI18n<typeof import('@docs/i18n.json')>()

  const { authInfo, setAuthBasic } = useCloudAuth()

  const loggedIn = isLoggedIn(authInfo)

  const sessionIdRef = useRef<number>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])

  const chatRef = useRef<HTMLUListElement>(null)

  const onLogout = useMemoizedFn(() => setAuthBasic())

  const onNewChat = useMemoizedFn(() => {
    sessionIdRef.current = null
    setMessages([])
  })

  const onClose = useMemoizedFn(() => onOpenChange(false))

  const flushMessages = useMemoizedFn(
    (setMessagesAction: (messages: ChatMessage[]) => ChatMessage[]) => {
      setMessages(setMessagesAction)
      setTimeout(() => {
        const chatEl = chatRef.current
        if (!chatEl) {
          return
        }
        chatEl.scrollTop = chatEl.scrollHeight
      }, 200)
    },
  )

  const assistantMessageIndexRef = useRef<number>(-1)

  const onSend_ = async (content: string) => {
    const assistantMessage: ChatMessage = {
      id: Date.now(),
      role: 'assistant' as const,
      content: <Thinking />,
    }

    const index = (assistantMessageIndexRef.current = messages.length + 1)

    flushMessages(messages => [
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

      flushMessages(messages => [
        ...messages.slice(0, index),
        { ...messages[index], ...parsed },
        ...messages.slice(index + 1),
      ])
    }
  }

  const [loading, setLoading] = useState(false)

  const onSend = useMemoizedFn(async (content: string) => {
    setLoading(true)
    try {
      await onSend_(content)
    } catch {
      flushMessages(messages => {
        const index = assistantMessageIndexRef.current
        return [
          ...messages.slice(0, index),
          { ...messages[index], content: t('NetworkError') },
          ...messages.slice(index + 1),
        ]
      })
    } finally {
      setLoading(false)
    }
  })

  return (
    <ViewTransition name="flip" onEnter={onCleanup} onExit={onCleanup}>
      <div className={clsx(classes.container, 'rspress-doc', open && classes.open)}>
        <div className={classes.header}>
          <div className={classes.title}>
            {t('ai_assistant')}
            {loggedIn && (
              <>
                <span className={classes.username}>
                  ({authInfo.detail.user.name})
                </span>
                <LogoutIcon className={classes.logout} onClick={onLogout} />
                <Tooltip anchorSelect={`.${classes.logout}`}>
                  {t('logout')}
                </Tooltip>
              </>
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
            <Tooltip anchorSelect={`.${classes.close}`}>{t('close')}</Tooltip>
          </div>
        </div>
        {messages.length ? (
          <Chat ref={chatRef} messages={messages} />
        ) : (
          <Preamble loggedIn={loggedIn} />
        )}
        {loggedIn && <ResizableUserInput loading={loading} onSend={onSend} />}
      </div>
    </ViewTransition>
  )
}
