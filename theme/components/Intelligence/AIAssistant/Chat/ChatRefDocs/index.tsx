import { useI18n } from '@rspress/core/runtime'
import clsx from 'clsx'
import { useCallback, useMemo, useState } from 'react'

import { X } from '@theme/components/_X.js'

import { RefDoc } from '../../types.js'
import AngleDownIcon from './angle-down.svg?react'
import classes from './styles.module.scss'

export interface ChatRefDocsProps {
  refDocs: RefDoc[]
}

export const ChatRefDocs = ({ refDocs }: ChatRefDocsProps) => {
  const t = useI18n<typeof import('@docs/i18n.json')>()
  const [expand, setExpand] = useState(false)
  const toggleExpand = useCallback(() => setExpand(prev => !prev), [])
  const displayedDocs = useMemo(
    () => (expand ? refDocs : refDocs.slice(0, 3)),
    [expand, refDocs],
  )
  return (
    <div className={clsx('chat-ref-docs', classes.container)}>
      <div className={classes.header}>
        <span className={classes.title}>
          {t('referenced_doc_links') + t('colon')}
        </span>
        {refDocs.length > 3 && (
          <span className={classes.action} onClick={toggleExpand}>
            {t(expand ? 'view_less_related_docs' : 'view_more_related_docs')} (
            {refDocs.length})
            <AngleDownIcon
              className={clsx(classes.icon, expand && classes.expanded)}
            />
          </span>
        )}
      </div>
      <ul className={classes.docs}>
        {displayedDocs.map(doc => (
          <li key={doc.id} className={classes.doc}>
            <X.a
              href={doc.path}
              title={doc.content}
              target="_blank"
              rel="noopener noreferrer"
            >
              {doc.content}
            </X.a>
          </li>
        ))}
      </ul>
    </div>
  )
}
