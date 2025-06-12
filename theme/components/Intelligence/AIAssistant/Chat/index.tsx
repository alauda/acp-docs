import { Markdown } from '@alauda/doom/runtime'
import clsx from 'clsx'
import { Ref } from 'react'

import AssistantIcon from '../../assistant.svg?react'
import { ChatMessage } from '../types'
import { ChatRefDocs } from './ChatRefDocs'
import classes from './styles.module.scss'

export interface ChatProps {
  ref?: Ref<HTMLUListElement>
  messages: ChatMessage[]
}

export const Chat = ({ ref, messages }: ChatProps) => {
  return (
    <ul ref={ref} className={classes.container}>
      {messages.map(({ id, role, content, refDocs }) => (
        <li key={`${role}-${id}`} className={clsx(classes.chat, classes[role])}>
          {role === 'assistant' && <AssistantIcon className={classes.icon} />}
          <div className={classes.content}>
            {refDocs?.length ? <ChatRefDocs refDocs={refDocs} /> : null}
            <Markdown>{content}</Markdown>
          </div>
        </li>
      ))}
    </ul>
  )
}
