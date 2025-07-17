import { useInterval } from '@theme/hooks'
import { useState } from 'react'
import { useI18n } from 'rspress/runtime'

const CHUNKS = ['', '.', '..', '...']

const CHUNKS_LENGTH = CHUNKS.length

export const Thinking = () => {
  const t = useI18n<typeof import('@docs/i18n.json')>()

  const [index, setIndex] = useState(0)

  useInterval(
    () =>
      setIndex(index => {
        const nextIndex = index + 1
        return nextIndex === CHUNKS_LENGTH ? 0 : nextIndex
      }),
    250,
  )

  return `${t('thinking')}${CHUNKS[index]}`
}
