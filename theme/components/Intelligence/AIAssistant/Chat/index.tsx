import { Markdown } from '@alauda/doom/runtime'
import clsx from 'clsx'
import { Ref } from 'react'

import AssistantIcon from '../../assistant.svg?react'
import { ChatMessage } from '../types'
import { ChatRefDocs } from './ChatRefDocs'
import classes from './styles.module.scss'
import { ThinkingProcess } from './ThinkingProcess'

export interface ChatProps {
  ref?: Ref<HTMLUListElement>
  messages: ChatMessage[]
}

export const Chat = ({ ref, messages }: ChatProps) => (
  <ul ref={ref} className={classes.container}>
    {messages.map(({ id, role, content, thinkingProcess, refDocs }) => (
      <li key={`${role}-${id}`} className={clsx(classes.chat, classes[role])}>
        {role === 'assistant' && <AssistantIcon className={classes.icon} />}
        <div className={classes.content}>
          {thinkingProcess && (
            <ThinkingProcess>{thinkingProcess}</ThinkingProcess>
          )}
          {refDocs?.length ? <ChatRefDocs refDocs={refDocs} /> : null}
          {typeof content === 'string' ? (
            <Markdown>{content}</Markdown>
          ) : (
            content
          )}
        </div>
      </li>
    ))}
  </ul>
)
